package ai.vigia.monitor

import android.content.Context

/** Guarda IP+porta do coletor (PC) em SharedPreferences. */
object ConfigStore {
    private const val PREFS = "vigia_prefs"
    private const val KEY_HOST = "host"
    private const val KEY_PORT = "port"
    private const val KEY_DEVICE_ID = "device_id"

    const val DEFAULT_HOST = "192.168.1.10"
    const val DEFAULT_PORT = 8787

    fun getHost(ctx: Context): String =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_HOST, DEFAULT_HOST) ?: DEFAULT_HOST

    fun getPort(ctx: Context): Int =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getInt(KEY_PORT, DEFAULT_PORT)

    fun save(ctx: Context, host: String, port: Int) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_HOST, host.trim())
            .putInt(KEY_PORT, port)
            .apply()
    }

    fun getBaseUrl(ctx: Context): String = "http://${getHost(ctx)}:${getPort(ctx)}"

    fun getDeviceId(ctx: Context): String =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_DEVICE_ID, "") ?: ""

    fun setDeviceId(ctx: Context, id: String) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_DEVICE_ID, id)
            .apply()
    }

    fun monitorThemeUrl(ctx: Context, id: String): String = "${getBaseUrl(ctx)}/api/monitors/$id/theme"
    fun usageUrl(ctx: Context): String = "${getBaseUrl(ctx)}/usage"    fun eventsUrl(ctx: Context): String = "${getBaseUrl(ctx)}/events"
    fun healthUrl(ctx: Context): String = "${getBaseUrl(ctx)}/health"

    fun isValidHost(host: String): Boolean {
        val h = host.trim()
        if (h.isEmpty() || h.contains(" ") || h.contains("/")) return false
        // IPv4 ou hostname simples
        val ipv4 = Regex("""^\d{1,3}(\.\d{1,3}){3}$""")
        if (ipv4.matches(h)) {
            return h.split(".").all { (it.toIntOrNull() ?: 256) in 0..255 }
        }
        return Regex("""^[A-Za-z0-9][A-Za-z0-9.\-]*[A-Za-z0-9]$""").matches(h)
    }

    fun isValidPort(port: Int): Boolean = port in 1..65535
}
