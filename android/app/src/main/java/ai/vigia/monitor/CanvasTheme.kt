package ai.vigia.monitor

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Espelho do ThemeState do /canvas (frontend/src/pages/config/themeCanvas/state.ts
 * + CanvasPage.tsx): mesmos endpoints, mesmo fallback, mesmos defaults.
 *
 * O widget de launcher desenha exatamente este tema — por isso o visual do
 * widget é idêntico ao do canvas (MonitorActivity / daydream usam o /canvas web,
 * o widget usa este mesmo JSON desenhado em Bitmap nativo).
 */
object CanvasTheme {
    data class Bg(
        val color: String = "#0f0f0f",
        val overlayColor: String = "#000000",
        val overlayOpacity: Double = 0.0,
        val zoom: Double = 1.0,
        val ox: Double = 0.5,
        val oy: Double = 0.5,
    )
    data class Clock(
        val enabled: Boolean = true,
        val x: Double = 0.5,
        val y: Double = 0.16,
        val scale: Double = 2.0,
        val color: String? = null,
        val format24h: Boolean = true,
        val showBackground: Boolean = true,
    )
    data class Countdown(
        val enabled: Boolean = false,
        val x: Double = 0.9,
        val y: Double = 0.88,
        val scale: Double = 1.0,
        val color: String? = null,
    )
    data class Icon(
        val id: String,
        val provider: String,
        val style: String, // "chip" | "card"
        val x: Double,
        val y: Double,
        val scale: Double,
        val color: String? = null,
        val showBackground: Boolean = true,
        val bgColor: String? = null,
        val metric: String = "",
    )
    data class Txt(
        val id: String,
        val text: String,
        val x: Double,
        val y: Double,
        val scale: Double,
        val color: String? = null,
    )
    data class Theme(
        val background: Bg = Bg(),
        val clock: Clock = Clock(),
        val countdown: Countdown = Countdown(),
        val icons: List<Icon> = emptyList(),
        val texts: List<Txt> = emptyList(),
        val wallpaperId: String? = null,
        val canvasW: Int = 480,
        val canvasH: Int = 320,
    )

    private fun isHex(v: String?): Boolean =
        v != null && Regex("^#[0-9a-fA-F]{6}$").matches(v)

    private fun clamp(v: Double, lo: Double, hi: Double): Double =
        v.coerceIn(lo, hi)

    private fun clampZoom(v: Double?): Double {
        val n = v ?: return 1.0
        if (!n.isFinite()) return 1.0
        return clamp(n, 1.0, 4.0)
    }

    private fun clampPan(v: Double?, zoom: Double): Double {
        val c = if (v != null && v.isFinite()) v else 0.5
        val z = clampZoom(zoom)
        val half = 0.5 / z
        if (half >= 0.5) return 0.5
        return clamp(c, half, 1.0 - half)
    }

    fun defaultMetric(provider: String): String = when (provider) {
        "claude" -> "session_percent"
        "gpt" -> "session_percent"
        "cursor" -> "percent"
        "openrouter" -> "remaining_cents"
        "deepseek" -> "remaining_cents"
        "opencode" -> "rolling_percent"
        "fal" -> "remaining_cents"
        "bitcoin" -> "value_usd_cents"
        "adsense" -> "unpaid_cents"
        "weather" -> "temperature"
        else -> "none"
    }

    fun providerSupportsCard(provider: String): Boolean =
        provider != "weather" && provider != "brand" && provider != "spotify"

    private fun parseThemeJson(raw: String): Theme? {
        return try {
            val j = JSONObject(raw)
            val jb = j.optJSONObject("background")
            val zoom = clampZoom(jb?.optDouble("zoom", 1.0))
            val bg = Bg(
                color = jb?.optString("color", "#0f0f0f")?.takeIf { isHex(it) } ?: "#0f0f0f",
                overlayColor = jb?.optString("overlayColor", "#000000")?.takeIf { isHex(it) } ?: "#000000",
                overlayOpacity = jb?.optDouble("overlayOpacity", 0.0)?.coerceIn(0.0, 1.0) ?: 0.0,
                zoom = zoom,
                ox = clampPan(if (jb != null && !jb.isNull("ox")) jb.optDouble("ox") else null, zoom),
                oy = clampPan(if (jb != null && !jb.isNull("oy")) jb.optDouble("oy") else null, zoom),
            )
            val jc = j.optJSONObject("clock")
            val clock = Clock(
                enabled = jc?.optBoolean("enabled", true) ?: true,
                x = jc?.optDouble("x", 0.5) ?: 0.5,
                y = jc?.optDouble("y", 0.16) ?: 0.16,
                scale = jc?.optDouble("scale", 2.0) ?: 2.0,
                color = jc?.optString("color", null)?.takeIf { it.isNotEmpty() && isHex(it) },
                format24h = jc?.optBoolean("format24h", true) ?: true,
                showBackground = jc?.optBoolean("showBackground", true) ?: true,
            )
            val jd = j.optJSONObject("countdown")
            val countdown = Countdown(
                enabled = jd?.optBoolean("enabled", false) ?: false,
                x = jd?.optDouble("x", 0.9) ?: 0.9,
                y = jd?.optDouble("y", 0.88) ?: 0.88,
                scale = jd?.optDouble("scale", 1.0) ?: 1.0,
                color = jd?.optString("color", null)?.takeIf { it.isNotEmpty() && isHex(it) },
            )
            val icons = mutableListOf<Icon>()
            val ja = j.optJSONArray("icons")
            if (ja != null) {
                for (i in 0 until ja.length()) {
                    val o = ja.optJSONObject(i) ?: continue
                    val provider = o.optString("provider", "claude")
                    val style = if (o.optString("style", "chip") == "card" && providerSupportsCard(provider)) "card" else "chip"
                    icons += Icon(
                        id = o.optString("id", "i$i").ifEmpty { "i$i" },
                        provider = provider,
                        style = style,
                        x = o.optDouble("x", 0.5),
                        y = o.optDouble("y", 0.5),
                        scale = o.optDouble("scale", 1.0),
                        color = o.optString("color", null)?.takeIf { it.isNotEmpty() && isHex(it) },
                        showBackground = o.optBoolean("showBackground", true),
                        bgColor = o.optString("bgColor", null)?.takeIf { it.isNotEmpty() && isHex(it) },
                        metric = o.optString("metric", "").ifEmpty { defaultMetric(provider) },
                    )
                }
            }
            val texts = mutableListOf<Txt>()
            val jt = j.optJSONArray("texts")
            if (jt != null) {
                for (i in 0 until jt.length()) {
                    val o = jt.optJSONObject(i) ?: continue
                    texts += Txt(
                        id = o.optString("id", "t$i").ifEmpty { "t$i" },
                        text = o.optString("text", ""),
                        x = o.optDouble("x", 0.5),
                        y = o.optDouble("y", 0.5),
                        scale = o.optDouble("scale", 1.0),
                        color = o.optString("color", null)?.takeIf { it.isNotEmpty() && isHex(it) },
                    )
                }
            }
            Theme(background = bg, clock = clock, countdown = countdown, icons = icons, texts = texts)
        } catch (_: Exception) {
            null
        }
    }

    private fun getJson(url: String): JSONObject? {
        return try {
            val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                connectTimeout = 8000
                readTimeout = 8000
            }
            if (conn.responseCode != 200) return null
            val txt = conn.inputStream.bufferedReader(Charsets.UTF_8).readText()
            conn.disconnect()
            JSONObject(txt)
        } catch (_: Exception) {
            null
        }
    }

    /** Mesmo loadTheme() do CanvasPage.tsx: tema do monitor (orientação atual) ou global. */
    fun fetch(ctx: Context): Theme {
        val base = ConfigStore.getBaseUrl(ctx)
        val deviceId = ConfigStore.getDeviceId(ctx)
        val m = ctx.resources.displayMetrics
        val orientation = if (m.heightPixels >= m.widthPixels) "portrait" else "landscape"
        var themeJson: String? = null
        var wallpaperId: String? = null
        var canvasW = 480
        var canvasH = 320
        try {
            if (deviceId.isNotEmpty()) {
                val r = getJson("$base/api/monitors/$deviceId/theme?orientation=$orientation")
                if (r != null) {
                    if (r.optBoolean("active", false)) themeJson = r.optString("theme", null)
                    wallpaperId = r.optString("background_id", null)?.takeIf { it.isNotEmpty() }
                    val sw = r.optInt("screenW", 0)
                    val sh = r.optInt("screenH", 0)
                    if (sw in 80..4320 && sh in 80..4320) {
                        canvasW = sw
                        canvasH = sh
                    }
                }
            } else {
                val r = getJson("$base/api/theme")
                if (r != null) {
                    if (r.optBoolean("active", false)) themeJson = r.optString("theme", null)
                    wallpaperId = r.optString("background_id", null)?.takeIf { it.isNotEmpty() }
                }
                // canvas default = tamanho da placa (device.width/height do /api/config)
                val cfg = getJson("$base/api/config")
                val dev = cfg?.optJSONObject("device")
                val w = dev?.optInt("width", 0) ?: 0
                val h = dev?.optInt("height", 0) ?: 0
                if (w in 80..4320 && h in 80..4320) {
                    canvasW = w
                    canvasH = h
                }
            }
            if (themeJson == null) {
                // rascunho do editor — igual ao loadThemeDraft() (CanvasPage cai pra ele)
                val d = getJson("$base/api/theme-draft")
                if (d != null && d.length() > 0) themeJson = d.toString()
            }
        } catch (_: Exception) {
        }
        val parsed = themeJson?.let { parseThemeJson(it) } ?: Theme()
        return parsed.copy(wallpaperId = wallpaperId, canvasW = canvasW, canvasH = canvasH)
    }

    fun wallpaperUrl(ctx: Context, wallpaperId: String): String =
        "${ConfigStore.getBaseUrl(ctx)}/api/wallpapers/$wallpaperId/original"

    fun providerIconUrl(ctx: Context, provider: String): String? {
        val base = ConfigStore.getBaseUrl(ctx)
        val file = when (provider) {
            "claude" -> "claude.png"
            "gpt" -> "gpt.png"
            "cursor" -> "cursor.png"
            "openrouter" -> "openrouter.png"
            "deepseek" -> "deepseek.png"
            "opencode" -> "opencode.png"
            "fal" -> "fal.png"
            "bitcoin" -> "bitcoin.png"
            "adsense" -> "adsense.png"
            "weather" -> "weather.png"
            "currencies" -> "currencies.png"
            "spotify" -> "spotify.svg"
            else -> return null
        }
        return "$base/icons/$file"
    }
}
