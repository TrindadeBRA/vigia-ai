package ai.vigia.monitor

import android.annotation.SuppressLint
import android.service.dreams.DreamService
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.TextView

/**
 * Daydream: exatamente o mesmo canvas web do launcher, sem overlay.
 * Toque sai do descanso (igual à firmware: toque no tema volta à Início).
 */
class MonitorDreamService : DreamService() {

    private var web: WebView? = null
    private var statusText: TextView? = null

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        isInteractive = true
        isFullscreen = true
        isScreenBright = true
        val root = LayoutInflater.from(this).inflate(R.layout.activity_canvas, null)
        root.findViewById<View>(R.id.overlayRow)?.visibility = View.GONE
        setContentView(root)
        web = root.findViewById(R.id.webView)
        statusText = root.findViewById(R.id.canvasStatus)
        web?.let { setupWeb(it) }
        web?.setOnTouchListener { _, e ->
            if (e.action == MotionEvent.ACTION_UP) wakeUp()
            false
        }
    }

    override fun onDreamingStarted() {
        super.onDreamingStarted()
        MonitorRegister.ensureRegistered(this)
        statusText?.visibility = View.VISIBLE
        statusText?.text = "Carregando canvas…"
        web?.loadUrl(canvasUrl())
    }

    override fun onDreamingStopped() {
        web?.stopLoading()
        super.onDreamingStopped()
    }

    override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
        super.onConfigurationChanged(newConfig)
        val url = canvasUrl()
        statusText?.visibility = View.VISIBLE
        statusText?.text = "Carregando canvas…"
        web?.loadUrl(url)
    }

    override fun onDetachedFromWindow() {
        web?.stopLoading()
        web?.destroy()
        web = null
        super.onDetachedFromWindow()
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
        w.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                statusText?.visibility = View.GONE
            }
        }
    }
}
