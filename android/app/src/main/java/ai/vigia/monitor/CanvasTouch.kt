package ai.vigia.monitor

import android.view.View
import android.webkit.WebView

/**
 * Hit-testing partilhado do tap-to-dismiss do daydream.
 * Mantido aqui para o [MonitorDreamService] ficar legível.
 */
object CanvasTouch {
    const val TAP_MAX_DURATION_MS = 600L

    const val SHIM_JS = "(function(){if(window.__vigiaHitReady)return;window.__vigiaHitReady=1;window.__vigiaHit=0;" +
        "var SEL='a[href],button,input,textarea,select,summary,label,[role=\"button\"],[role=\"link\"],[role=\"tab\"]," +
        "[role=\"switch\"],[role=\"checkbox\"],[onclick],[contenteditable=\"true\"]';" +
        "function mark(e){var el=e.target;while(el&&el!==document.body){" +
        "if(el.matches&&el.matches(SEL)){window.__vigiaHit=1;return;}" +
        "try{if(getComputedStyle(el).cursor==='pointer'){window.__vigiaHit=1;return;}}catch(_){}" +
        "el=el.parentElement;}window.__vigiaHit=0;}" +
        "document.addEventListener('pointerdown',mark,true);" +
        "document.addEventListener('touchstart',mark,true);})();"

    private val webInteractiveTypes = setOf(
        WebView.HitTestResult.SRC_ANCHOR_TYPE,
        WebView.HitTestResult.SRC_IMAGE_ANCHOR_TYPE,
        WebView.HitTestResult.EDIT_TEXT_TYPE,
        WebView.HitTestResult.PHONE_TYPE,
        WebView.HitTestResult.EMAIL_TYPE,
        WebView.HitTestResult.GEO_TYPE,
    )

    /**
     * Ponto (x, y em coordenadas de ecrã, ex. MotionEvent.rawX/rawY)
     * dentro de algum botão visível.
     */
    fun isNativeInteractive(root: View, shownButtons: List<View>, x: Float, y: Float): Boolean {
        if (!root.isShown) return false
        for (b in shownButtons) {
            try {
                if (!b.isShown) continue
                if (b.visibility != View.VISIBLE) continue
                val loc = IntArray(2)
                b.getLocationOnScreen(loc)
                if (x >= loc[0] && x <= loc[0] + b.width &&
                    y >= loc[1] && y <= loc[1] + b.height
                ) {
                    return true
                }
            } catch (_: Exception) {
            }
        }
        return false
    }

    /**
     * Diz se o tap atingiu um elemento interativo dentro da página.
     * O shim JS é a FONTE DA VERDADE (só ele vê divs estilizados como botão);
     * o HitTestResult nativo é só fallback, para quando o shim ainda não existe
     * (página não carregada). Não usar OR: o resultado nativo pode estar
     * defasado em relação ao toque atual e engolir o tap-to-dismiss.
     * O callback corre na UI thread.
     */
    fun isWebInteractive(web: WebView, onResult: (Boolean) -> Unit) {
        try {
            if (!web.isShown || web.visibility != View.VISIBLE) {
                onResult(false)
                return
            }
        } catch (_: Exception) {
            onResult(false)
            return
        }
        try {
            // Leitura que CONSOME a flag: um valor obsoleto não vaza para o próximo toque.
            web.evaluateJavascript("(function(){var v=window.__vigiaHit;window.__vigiaHit=0;return v;})()") { v ->
                val clean = v?.trim()?.trim('"')?.trim()
                if (clean == "1" || clean == "0") {
                    onResult(clean == "1")
                } else {
                    // Shim ainda não instalado: cai no sinal nativo (a/input).
                    onResult(nativeInteractive(web))
                }
            }
        } catch (_: Exception) {
            onResult(nativeInteractive(web))
        }
    }

    private fun nativeInteractive(web: WebView): Boolean = try {
        webInteractiveTypes.contains(web.hitTestResult.type)
    } catch (_: Exception) {
        false
    }
}
