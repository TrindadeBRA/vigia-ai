package ai.vigia.monitor

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
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
    private var lastUrl = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(R.layout.activity_canvas)
        hideSystemUi()

        web = findViewById(R.id.webView)
        statusText = findViewById(R.id.canvasStatus)
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

        findViewById<Button>(R.id.btnCanvasConfig).setOnClickListener {
            startActivity(Intent(this, ConfigActivity::class.java))
        }
    }

    override fun onResume() {
        super.onResume()
        hideSystemUi()
        reloadIfUrlChanged()
    }

    override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
        super.onConfigurationChanged(newConfig)
        hideSystemUi()
        reloadIfUrlChanged()
    }

    private fun reloadIfUrlChanged() {
        val url = canvasUrl()
        if (url != lastUrl) {
            lastUrl = url
            statusText.visibility = View.VISIBLE
            statusText.text = "Carregando canvas…"
            web.loadUrl(url)
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
        w.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                statusText.visibility = View.GONE
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                if (request?.isForMainFrame == true) {
                    statusText.visibility = View.VISIBLE
                    statusText.text = "Sem conexão (${ConfigStore.getBaseUrl(this@MonitorActivity)})"
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
