package ai.vigia.monitor

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import java.net.HttpURLConnection
import java.net.URL

/** Configura IP+porta do coletor (PC) e atalhos do daydream. */
class ConfigActivity : Activity() {

    private lateinit var hostInput: EditText
    private lateinit var portInput: EditText
    private lateinit var resultText: TextView

    companion object {
        private const val REQ_SCAN = 41
        private const val REQ_CAMERA = 42
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_config)

        hostInput = findViewById(R.id.hostInput)
        portInput = findViewById(R.id.portInput)
        resultText = findViewById(R.id.resultText)

        hostInput.setText(ConfigStore.getHost(this))
        portInput.setText(ConfigStore.getPort(this).toString())

        findViewById<Button>(R.id.btnSave).setOnClickListener {
            val host = hostInput.text.toString().trim()
            val port = portInput.text.toString().trim().toIntOrNull() ?: -1
            if (!ConfigStore.isValidHost(host) || !ConfigStore.isValidPort(port)) {
                resultText.text = getString(R.string.msg_invalid)
                return@setOnClickListener
            }
            ConfigStore.save(this, host, port)
            resultText.text = getString(R.string.msg_saved)
        }

        findViewById<Button>(R.id.btnTest).setOnClickListener {
            resultText.text = getString(R.string.msg_testing)
            val url = ConfigStore.healthUrl(this)
            Thread {
                val msg = try {
                    val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                        connectTimeout = 8000
                        readTimeout = 8000
                    }
                    val code = conn.responseCode
                    val body = if (code == 200) conn.inputStream.bufferedReader().readText() else ""
                    conn.disconnect()
                    if (code == 200) "OK: $body" else "HTTP $code"
                } catch (e: Exception) {
                    "Falhou: ${e.message}"
                }
                runOnUiThread { resultText.text = msg }
            }.also { it.isDaemon = true; it.start() }
        }

        findViewById<Button>(R.id.btnScan).setOnClickListener {
            if (hasCameraPermission()) {
                startScan()
            } else {
                requestPermissions(arrayOf(android.Manifest.permission.CAMERA), REQ_CAMERA)
            }
        }

        findViewById<Button>(R.id.btnDream).setOnClickListener {
            try {
                startActivity(Intent(Settings.ACTION_DREAM_SETTINGS))
            } catch (_: Exception) {
                resultText.text = "Descanso de tela indisponível"
            }
        }
    }

    @Suppress("DEPRECATION")
    private fun startScan() {
        startActivityForResult(Intent(this, QrScanActivity::class.java), REQ_SCAN)
    }

    private fun hasCameraPermission(): Boolean {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.M) return true
        return checkSelfPermission(android.Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        if (requestCode == REQ_CAMERA) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startScan()
            } else {
                resultText.text = getString(R.string.msg_camera_denied)
            }
        } else {
            super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        }
    }

    @Deprecated("compat com API 21")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQ_SCAN) return
        if (resultCode == RESULT_OK) {
            hostInput.setText(ConfigStore.getHost(this))
            portInput.setText(ConfigStore.getPort(this).toString())
            resultText.text = getString(R.string.msg_qr_applied)
        } else {
            resultText.text = getString(R.string.msg_qr_cancelled)
        }
    }
}
