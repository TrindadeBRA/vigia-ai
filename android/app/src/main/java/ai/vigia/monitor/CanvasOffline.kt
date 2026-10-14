package ai.vigia.monitor

import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.view.WindowManager
import android.widget.TextView
import java.text.DateFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Dono único da tela offline/erro (relógio + olho + textos),
 * partilhado entre a Activity e o DreamService.
 */
object CanvasOffline {
    /** Wallpaper do Android atrás da janela (FLAG_SHOW_WALLPAPER + janela transparente). */
    fun enableWallpaperBehindWindow(window: Window) {
        try {
            window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WALLPAPER)
            window.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        } catch (_: Exception) {
        }
    }

    /** Liga relógio + olho + textos. errorRoot = findViewById(R.id.canvasError). */
    fun bind(errorRoot: View): Controller = Controller(
        root = errorRoot,
        clockView = errorRoot.findViewById(R.id.canvasErrorClock),
        dateView = errorRoot.findViewById(R.id.canvasErrorDate),
        detailView = errorRoot.findViewById(R.id.canvasErrorDetail),
        urlView = errorRoot.findViewById(R.id.canvasErrorUrl),
    )

    /**
     * Recria a view da tela offline na orientacao atual. Necessario porque o
     * servico/atividade NAO recria a hierarquia na rotacao: o XML inflado mantem
     * a variante antiga (retrato esticado em paisagem).
     * Devolve a view nova; o chamador deve religar (bind + listeners).
     */
    fun rebuild(host: ViewGroup, old: View): View {
        if (old.parent !== host) return old
        val index = host.indexOfChild(old)
        if (index < 0) return old
        val fresh = LayoutInflater.from(host.context).inflate(R.layout.view_canvas_offline, host, false)
        fresh.id = R.id.canvasError
        fresh.visibility = old.visibility
        host.removeViewAt(index)
        host.addView(fresh, index)
        return fresh
    }

    class Controller internal constructor(
        private val root: View,
        private val clockView: TextView?,
        private val dateView: TextView?,
        private val detailView: TextView?,
        private val urlView: TextView?,
    ) {
        private val handler = Handler(Looper.getMainLooper())
        private var ticking = false
        private val tick = object : Runnable {
            override fun run() {
                if (!ticking) return
                updateClock()
                val now = System.currentTimeMillis()
                val next = (now / 1000 + 1) * 1000 + 5
                handler.postDelayed(this, next - now)
            }
        }

        /** Visível + arranca o relógio. Idempotente: sem tickers duplicados. */
        fun show(detail: String, url: String) {
            try {
                detailView?.text = detail
            } catch (_: Exception) {
            }
            try {
                urlView?.text = url
            } catch (_: Exception) {
            }
            updateClock()
            if (root.visibility != View.VISIBLE) {
                try {
                    root.animate().cancel()
                } catch (_: Exception) {
                }
                root.alpha = 0f
                root.visibility = View.VISIBLE
                try {
                    root.animate().alpha(1f).setDuration(250).withEndAction {
                        try {
                            root.alpha = 1f
                        } catch (_: Exception) {
                        }
                    }.start()
                } catch (_: Exception) {
                    try {
                        root.alpha = 1f
                    } catch (_: Exception) {
                    }
                }
            }
            if (!ticking) {
                ticking = true
                try {
                    handler.removeCallbacks(tick)
                } catch (_: Exception) {
                }
                val now = System.currentTimeMillis()
                val next = (now / 1000 + 1) * 1000 + 5
                try {
                    handler.postDelayed(tick, next - now)
                } catch (_: Exception) {
                }
            }
        }

        /** Some + para o relógio. */
        fun hide() {
            ticking = false
            try {
                handler.removeCallbacks(tick)
            } catch (_: Exception) {
            }
            try {
                root.animate().cancel()
            } catch (_: Exception) {
            }
            try {
                root.alpha = 1f
            } catch (_: Exception) {
            }
            try {
                root.visibility = View.GONE
            } catch (_: Exception) {
            }
        }

        /** Para o relógio de vez (onDestroy / onDetachedFromWindow). */
        fun release() {
            ticking = false
            try {
                handler.removeCallbacks(tick)
            } catch (_: Exception) {
            }
            try {
                root.animate().cancel()
            } catch (_: Exception) {
            }
        }

        private fun updateClock() {
            try {
                val now = Date()
                clockView?.text = SimpleDateFormat("HH:mm", Locale.getDefault()).format(now)
                dateView?.text =
                    DateFormat.getDateInstance(DateFormat.FULL, Locale("pt", "BR")).format(now)
            } catch (_: Exception) {
            }
        }
    }
}
