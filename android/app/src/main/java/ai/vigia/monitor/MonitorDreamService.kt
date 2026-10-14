package ai.vigia.monitor

import android.annotation.SuppressLint
import android.content.res.Configuration
import android.graphics.Color
import android.service.dreams.DreamService
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewGroup
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.TextView

/**
 * Daydream: exatamente o mesmo canvas web do launcher, sem overlay.
 * Tocar em qualquer área que não seja botão/input sai do descanso.
 */
class MonitorDreamService : DreamService() {

    private var rootView: View? = null
    private var web: WebView? = null
    private var statusText: TextView? = null
    private var errorView: View? = null
    private var offline: CanvasOffline.Controller? = null
    private var btnRetry: Button? = null
    private var btnCanvasConfig: View? = null
    private var hasError = false
    private var lastUrl = ""
    private var lastDetail = ""

    private var downRawX = 0f
    private var downRawY = 0f
    private var downTime = 0L

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        isInteractive = true
        isFullscreen = true
        isScreenBright = true
        try {
            CanvasOffline.enableWallpaperBehindWindow(window)
        } catch (_: Exception) {
        }
        val root: View = LayoutInflater.from(this).inflate(R.layout.activity_canvas, null)
        rootView = root
        setContentView(root)
        web = root.findViewById(R.id.webView)
        statusText = root.findViewById(R.id.canvasStatus)
        wireOffline()
        web?.setBackgroundColor(Color.parseColor("#10151A"))
        web?.let { setupWeb(it) }
    }

    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
        val handled = super.dispatchTouchEvent(event)
        try {
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    downRawX = event.rawX
                    downRawY = event.rawY
                    downTime = event.eventTime
                }
                MotionEvent.ACTION_UP -> {
                    val dt = event.eventTime - downTime
                    if (downTime != 0L && dt in 0..CanvasTouch.TAP_MAX_DURATION_MS) {
                        val dx = event.rawX - downRawX
                        val dy = event.rawY - downRawY
                        val slop = ViewConfiguration.get(this).scaledTouchSlop
                        if (dx * dx + dy * dy <= slop * slop) {
                            handleTap(event.rawX, event.rawY)
                        }
                    }
                    downTime = 0L
                }
                MotionEvent.ACTION_CANCEL -> {
                    downTime = 0L
                }
            }
        } catch (_: Exception) {
        }
        return handled
    }

    private fun handleTap(rawX: Float, rawY: Float) {
        val root = rootView ?: return
        val buttons = listOfNotNull(btnRetry)
        try {
            if (CanvasTouch.isNativeInteractive(root, buttons, rawX, rawY)) return
        } catch (_: Exception) {
        }
        val w = web
        if (w != null) {
            try {
                if (w.isShown && w.visibility == View.VISIBLE) {
                    CanvasTouch.isWebInteractive(w) { interactive ->
                        try {
                            if (!interactive) wakeUp()
                        } catch (_: Exception) {
                        }
                    }
                    return
                }
            } catch (_: Exception) {
            }
        }
        try {
            wakeUp()
        } catch (_: Exception) {
        }
    }

    override fun onDreamingStarted() {
        super.onDreamingStarted()
        MonitorRegister.ensureRegistered(this)
        loadCanvas(canvasUrl())
        web?.postDelayed({
            val withId = canvasUrl()
            if (withId != lastUrl) loadCanvas(withId)
        }, 5000L)
    }

    override fun onDreamingStopped() {
        web?.stopLoading()
        super.onDreamingStopped()
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        // Reconstroi só o overlay offline na variante certa (layout-land) e
        // depois recarrega o canvas com a URL da nova orientação (comportamento
        // anterior). A ordem importa: se o reload falhar, a tela offline
        // reaparece sobre a view já reconstruída (orientação correta).
        try {
            val host = rootView as? ViewGroup
            val old = errorView
            if (host != null && old != null) {
                val wasVisible = try {
                    old.visibility == View.VISIBLE
                } catch (_: Exception) {
                    false
                }
                val fresh = CanvasOffline.rebuild(host, old)
                errorView = fresh
                wireOffline()
                if (wasVisible) {
                    val url = lastUrl.ifEmpty { ConfigStore.getBaseUrl(this) }
                    offline?.show(lastDetail, url)
                } else {
                    offline?.hide()
                }
            }
        } catch (_: Exception) {
        }
        loadCanvas(canvasUrl())
    }

    override fun onDetachedFromWindow() {
        try {
            offline?.release()
        } catch (_: Exception) {
        }
        offline = null
        web?.stopLoading()
        web?.destroy()
        web = null
        rootView = null
        super.onDetachedFromWindow()
    }

    private fun wireOffline() {
        val root = rootView ?: return
        errorView = root.findViewById(R.id.canvasError)
        try {
            offline?.release()
        } catch (_: Exception) {
        }
        offline = null
        errorView?.let { offline = CanvasOffline.bind(it) }
        root.findViewById<View>(R.id.btnCanvasConfig)?.visibility = View.GONE
        btnRetry = root.findViewById(R.id.btnRetry)
        btnRetry?.setOnClickListener { retryLoad() }
        btnCanvasConfig = root.findViewById(R.id.btnCanvasConfig)
    }

    private fun loadCanvas(url: String) {
        lastUrl = url
        hasError = false
        if (offline != null) offline?.hide() else errorView?.visibility = View.GONE
        web?.visibility = View.VISIBLE
        statusText?.visibility = View.VISIBLE
        statusText?.text = "Carregando canvas…"
        web?.loadUrl(url)
    }

    private fun retryLoad() {
        loadCanvas(canvasUrl())
    }

    private fun showPrettyError(detail: String) {
        hasError = true
        lastDetail = detail
        statusText?.visibility = View.GONE
        web?.visibility = View.INVISIBLE
        val url = lastUrl.ifEmpty { ConfigStore.getBaseUrl(this) }
        if (offline != null) {
            offline?.show(detail, url)
        } else {
            errorView?.visibility = View.VISIBLE
        }
    }

    private fun canvasUrl(): String {
        val base = ConfigStore.getBaseUrl(this)
        val deviceId = ConfigStore.getDeviceId(this)
        val m = resources.displayMetrics
        val orientation = if (m.heightPixels >= m.widthPixels) "portrait" else "landscape"
        // dream=1: o /canvas esconde o botão de recarregar (só no modo normal).
        return if (deviceId.isNotEmpty()) {
            "$base/canvas?monitor=$deviceId&orientation=$orientation&dream=1"
        } else {
            "$base/canvas?orientation=$orientation&dream=1"
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWeb(w: WebView) {
        w.settings.javaScriptEnabled = true
        w.settings.domStorageEnabled = true
        w.settings.mediaPlaybackRequiresUserGesture = false
        w.settings.cacheMode = WebSettings.LOAD_NO_CACHE
        w.clearCache(true)
        w.clearHistory()
        w.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                try {
                    view?.evaluateJavascript(CanvasTouch.SHIM_JS, null)
                } catch (_: Exception) {
                }
                if (hasError) return
                statusText?.visibility = View.GONE
                if (offline != null) offline?.hide() else errorView?.visibility = View.GONE
                web?.visibility = View.VISIBLE
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                if (request?.isForMainFrame == true) {
                    showPrettyError("Sem conexão (${ConfigStore.getBaseUrl(this@MonitorDreamService)})")
                }
            }

            @Suppress("DEPRECATION")
            override fun onReceivedError(view: WebView?, errorCode: Int, description: String?, failingUrl: String?) {
                showPrettyError("Sem conexão ($errorCode): ${ConfigStore.getBaseUrl(this@MonitorDreamService)}")
            }

            override fun onReceivedHttpError(view: WebView?, request: WebResourceRequest?, errorResponse: WebResourceResponse?) {
                if (request?.isForMainFrame == true && errorResponse != null) {
                    showPrettyError("Servidor respondeu ${errorResponse.statusCode} (${ConfigStore.getBaseUrl(this@MonitorDreamService)})")
                }
            }
        }
    }
}
