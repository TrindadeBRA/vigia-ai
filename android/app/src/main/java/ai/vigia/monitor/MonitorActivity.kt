package ai.vigia.monitor

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.TextView

/**
 * Launcher (HOME): o canvas web em tela cheia (render idêntico ao browser),
 * com botão de Configurar em overlay.
 */
class MonitorActivity : Activity() {

    private lateinit var web: WebView
    private lateinit var statusText: TextView
    private lateinit var errorView: View
    private var offline: CanvasOffline.Controller? = null
    private var lastUrl = ""
    private var lastDetail = ""
    private var hasError = false
    private var configOpened = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        CanvasOffline.enableWallpaperBehindWindow(window)
        setContentView(R.layout.activity_canvas)
        hideSystemUi()

        web = findViewById(R.id.webView)
        statusText = findViewById(R.id.canvasStatus)
        wireOffline()
        web.setBackgroundColor(Color.parseColor("#10151A"))
        MonitorRegister.ensureRegistered(this)
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            window.decorView.setOnApplyWindowInsetsListener { v, insets ->
                if (insets.isVisible(android.view.WindowInsets.Type.statusBars() or android.view.WindowInsets.Type.navigationBars())) {
                    v.post { hideSystemUi() }
                }
                v.onApplyWindowInsets(insets)
            }
        }
        setupWeb(web)
    }

    private fun wireOffline() {
        errorView = findViewById(R.id.canvasError)
        try {
            offline?.release()
        } catch (_: Exception) {
        }
        offline = null
        offline = CanvasOffline.bind(errorView)
        findViewById<Button>(R.id.btnRetry)?.setOnClickListener { retryLoad() }
        findViewById<View>(R.id.btnCanvasConfig)?.let {
            it.visibility = View.VISIBLE
            it.setOnClickListener {
                configOpened = true
                startActivity(Intent(this, ConfigActivity::class.java))
            }
        }
    }

    override fun onResume() {
        super.onResume()
        hideSystemUi()
        MonitorRegister.ensureRegistered(this)
        if (configOpened) {
            configOpened = false
            loadCanvas(canvasUrl())
            return
        }
        reloadIfUrlChanged()
        val decor = if (android.os.Build.VERSION.SDK_INT >= 30) window.decorView else null
        decor?.postDelayed({ reloadIfUrlChanged() }, 3000L)
        decor?.postDelayed({ reloadIfUrlChanged() }, 8000L)
        decor?.postDelayed({ reloadIfUrlChanged() }, 15000L)
        if (decor == null) {
            web.postDelayed({ reloadIfUrlChanged() }, 3000L)
            web.postDelayed({ reloadIfUrlChanged() }, 8000L)
            web.postDelayed({ reloadIfUrlChanged() }, 15000L)
        }
    }

    override fun onDestroy() {
        try {
            offline?.release()
        } catch (_: Exception) {
        }
        offline = null
        super.onDestroy()
    }

    override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
        super.onConfigurationChanged(newConfig)
        hideSystemUi()
        // A activity declara configChanges, então nunca é recriada na rotação:
        // só o overlay offline precisa da variante certa (layout-land).
        // Depois, recarrega o canvas se a URL mudou (o &orientation= novo
        // exige nova requisição para a página se renderizar na nova orientação).
        try {
            val host = errorView.parent as? ViewGroup
            if (host != null) {
                val wasVisible = try {
                    errorView.visibility == View.VISIBLE
                } catch (_: Exception) {
                    hasError
                }
                val fresh = CanvasOffline.rebuild(host, errorView)
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
        reloadIfUrlChanged()
    }

    private fun reloadIfUrlChanged() {
        val url = canvasUrl()
        if (url != lastUrl) {
            loadCanvas(url)
        } else if (hasError) {
            // URL igual mas em erro (ex.: voltou da config sem mudar nada):
            // atualiza o endereço exibido, mantém a página bonita.
            offline?.show(lastDetail, url)
        }
    }

    private fun loadCanvas(url: String) {
        lastUrl = url
        hasError = false
        offline?.hide() ?: run { errorView.visibility = View.GONE }
        web.visibility = View.VISIBLE
        statusText.visibility = View.VISIBLE
        statusText.text = "Carregando canvas…"
        web.loadUrl(url)
    }

    private fun retryLoad() {
        loadCanvas(canvasUrl())
    }

    private fun showPrettyError(detail: String) {
        if (!hasError) hasError = true
        lastDetail = detail
        statusText.visibility = View.GONE
        // Esconde o WebView para nunca exibir a página default de erro do navegador.
        web.visibility = View.INVISIBLE
        val url = lastUrl.ifEmpty { ConfigStore.getBaseUrl(this@MonitorActivity) }
        offline?.show(detail, url) ?: run {
            errorView.visibility = View.VISIBLE
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemUi()
    }

    private fun orientation(): String {
        val m = resources.displayMetrics
        return if (m.heightPixels >= m.widthPixels) "portrait" else "landscape"
    }

    private fun canvasUrl(): String {
        val base = ConfigStore.getBaseUrl(this)
        val deviceId = ConfigStore.getDeviceId(this)
        return if (deviceId.isNotEmpty()) {
            "$base/canvas?monitor=$deviceId&orientation=${orientation()}"
        } else {
            "$base/canvas?orientation=${orientation()}"
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
                statusText.visibility = View.GONE
                offline?.hide() ?: run { errorView.visibility = View.GONE }
                web.visibility = View.VISIBLE
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                if (request?.isForMainFrame == true) {
                    hasError = true
                    val detail = if (android.os.Build.VERSION.SDK_INT >= 23 && error != null) {
                        "Sem conexão (${error.errorCode}): ${ConfigStore.getBaseUrl(this@MonitorActivity)}"
                    } else {
                        "Sem conexão (${ConfigStore.getBaseUrl(this@MonitorActivity)})"
                    }
                    showPrettyError(detail)
                }
            }

            @Suppress("DEPRECATION")
            override fun onReceivedError(view: WebView?, errorCode: Int, description: String?, failingUrl: String?) {
                hasError = true
                showPrettyError("Sem conexão ($errorCode): ${ConfigStore.getBaseUrl(this@MonitorActivity)}")
            }

            override fun onReceivedHttpError(view: WebView?, request: WebResourceRequest?, errorResponse: WebResourceResponse?) {
                if (request?.isForMainFrame == true && errorResponse != null) {
                    hasError = true
                    showPrettyError("Servidor respondeu ${errorResponse.statusCode} (${ConfigStore.getBaseUrl(this@MonitorActivity)})")
                }
            }
        }
    }

    private fun hideSystemUi() {
        try {
            if (window.peekDecorView() == null) return
            if (android.os.Build.VERSION.SDK_INT >= 30) {
            try {
                window.setDecorFitsSystemWindows(false)
            } catch (_: Exception) {
            }
            window.insetsController?.let {
                it.hide(android.view.WindowInsets.Type.statusBars() or android.view.WindowInsets.Type.navigationBars())
                it.systemBarsBehavior = android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
            window.decorView.postDelayed({
                try {
                    window.insetsController?.hide(
                        android.view.WindowInsets.Type.statusBars() or android.view.WindowInsets.Type.navigationBars(),
                    )
                } catch (_: Exception) {
                }
            }, 500L)
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION)
        }
        } catch (_: Exception) {
        }
    }
}
