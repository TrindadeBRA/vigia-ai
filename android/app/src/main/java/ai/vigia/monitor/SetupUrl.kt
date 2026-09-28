package ai.vigia.monitor

import java.net.URI

/**
 * Parseia o QR de setup exibido em /display/theme.
 *
 * Payload canônico: `http://IP:porta/api/android/setup?host=IP&port=porta&v=1`
 * (no browser do celular abre a página de download do APK; aqui extrai IP+porta).
 * Aceita também as demais URLs do coletor (/usage, /health, /api/android/apk…)
 * e o esquema futuro `vigia://setup?host=&port=`.
 */
object SetupUrl {
    private val COLLECTOR_PATHS = setOf(
        "/api/android/setup",
        "/api/android/apk",
        "/usage",
        "/events",
        "/health",
        "/",
    )

    fun parse(text: String): Pair<String, Int>? {
        val uri = try {
            URI(text.trim())
        } catch (_: Exception) {
            return null
        }
        val scheme = (uri.scheme ?: "").lowercase()
        if (scheme != "http" && scheme != "https" && scheme != "vigia") return null
        val params = queryParams(uri.query ?: uri.rawQuery ?: "")
        val qHost = (params["host"] ?: "").trim()
        val qPort = params["port"]?.trim()?.toIntOrNull()

        if (scheme == "vigia") {
            if (qHost.isNotEmpty() && qPort != null &&
                ConfigStore.isValidHost(qHost) && ConfigStore.isValidPort(qPort)
            ) return qHost to qPort
            return null
        }

        if (qHost.isNotEmpty() || qPort != null) {
            if (qHost.isNotEmpty() && qPort != null &&
                ConfigStore.isValidHost(qHost) && ConfigStore.isValidPort(qPort)
            ) return qHost to qPort
            return null
        }

        val path = uri.path ?: "/"
        val known = COLLECTOR_PATHS.any { path == it || path.startsWith("/api/android/") }
        if (!known) return null
        val host = uri.host ?: return null
        val port = uri.port.takeIf { it != -1 } ?: return null
        if (!ConfigStore.isValidHost(host) || !ConfigStore.isValidPort(port)) return null
        return host to port
    }

    private fun queryParams(query: String): Map<String, String> {
        if (query.isEmpty()) return emptyMap()
        val out = LinkedHashMap<String, String>()
        for (pair in query.split("&")) {
            val eq = pair.indexOf("=")
            if (eq <= 0) continue
            val key = decode(pair.substring(0, eq))
            if (key.isEmpty() || out.containsKey(key)) continue
            out[key] = decode(pair.substring(eq + 1))
        }
        return out
    }

    private fun decode(s: String): String {
        return try {
            java.net.URLDecoder.decode(s, "UTF-8")
        } catch (_: Exception) {
            s
        }
    }
}
