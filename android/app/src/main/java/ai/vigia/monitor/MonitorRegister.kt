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
    private const val HEARTBEAT_MS = 45_000L
    @Volatile private var loopStarted = false

    fun ensureRegistered(ctx: Context) {
        ensureLoop(ctx)
        Thread { runOnce(ctx.applicationContext, true) }.also { it.isDaemon = true; it.start() }
    }

    private fun ensureLoop(ctx: Context) {
        if (loopStarted) return
        synchronized(this) {
            if (loopStarted) return
            loopStarted = true
        }
        val appCtx = ctx.applicationContext
        Thread {
            while (true) {
                try {
                    runOnce(appCtx, false)
                } catch (_: Exception) {
                }
                try {
                    Thread.sleep(HEARTBEAT_MS)
                } catch (_: InterruptedException) {
                    return@Thread
                }
            }
        }.also { it.isDaemon = true; it.start() }
    }

    private fun runOnce(appCtx: Context, forceRegister: Boolean) {
        val deviceId = ConfigStore.getDeviceId(appCtx)
        if (deviceId.isNotEmpty() && !forceRegister) {
            if (sendHeartbeat(appCtx, deviceId)) return
        }
        doRegister(appCtx)
    }

    private fun sendHeartbeat(appCtx: Context, deviceId: String): Boolean {
        try {
            val conn = (URL("${ConfigStore.getBaseUrl(appCtx)}/api/monitors/$deviceId/heartbeat").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("X-Vigia-Device", "android")
                connectTimeout = 8000
                readTimeout = 8000
                doOutput = true
            }
            conn.outputStream.use { it.write(ByteArray(0)) }
            val code = conn.responseCode
            try { conn.inputStream.bufferedReader().readText() } catch (_: Exception) { }
            conn.disconnect()
            if (code == 200) return true
            if (code == 404) ConfigStore.setDeviceId(appCtx, "")
            return false
        } catch (_: Exception) {
            return false
        }
    }

    private fun doRegister(appCtx: Context) {
        try {
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
    }
}
