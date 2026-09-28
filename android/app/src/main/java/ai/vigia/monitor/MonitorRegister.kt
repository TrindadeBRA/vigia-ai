package ai.vigia.monitor

import android.content.Context
import android.os.Build
import android.provider.Settings
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Auto-registro do aparelho no coletor (sem ADB): informa modelo e tamanho
 * da tela para o editor gerar um canvas próprio. Upsert pela key estável.
 */
object MonitorRegister {
    @Volatile private var started = false

    fun ensureRegistered(ctx: Context) {
        if (started) return
        started = true
        Thread {
            try {
                val appCtx = ctx.applicationContext
                val metrics = appCtx.resources.displayMetrics
                val key = Settings.Secure.getString(appCtx.contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown"
                val pkg = appCtx.packageName
                val version = try {
                    appCtx.packageManager.getPackageInfo(pkg, 0).versionName ?: ""
                } catch (_: Exception) {
                    ""
                }
                val body = JSONObject()
                    .put("key", key)
                    .put("model", Build.MODEL ?: "")
                    .put("brand", Build.BRAND ?: "")
                    .put("screenW", metrics.widthPixels)
                    .put("screenH", metrics.heightPixels)
                    .put("densityDpi", metrics.densityDpi)
                    .put("appVersion", version)
                    .toString()
                val conn = (URL("${ConfigStore.getBaseUrl(appCtx)}/api/monitors/register").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("X-Vigia-Device", "android")
                    setRequestProperty("X-Vigia-Screen", "${metrics.widthPixels}x${metrics.heightPixels}")
                    connectTimeout = 8000
                    readTimeout = 8000
                    doOutput = true
                }
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                if (conn.responseCode == 200) {
                    val id = JSONObject(conn.inputStream.bufferedReader().readText()).optString("id", "")
                    if (id.isNotEmpty()) ConfigStore.setDeviceId(appCtx, id)
                }
                conn.disconnect()
            } catch (_: Exception) {
            }
        }.also { it.isDaemon = true; it.start() }
    }
}
