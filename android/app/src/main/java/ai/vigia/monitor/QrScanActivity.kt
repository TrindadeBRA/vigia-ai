package ai.vigia.monitor

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.ImageFormat
import android.graphics.SurfaceTexture
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.media.ImageReader
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import android.util.Size
import android.view.Surface
import android.view.TextureView
import android.widget.Button
import android.widget.TextView
import com.google.zxing.BinaryBitmap
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeReader

/** Lê o QR de setup de /display/theme e salva IP+porta no ConfigStore (Camera2, API 21+). */
class QrScanActivity : Activity() {

    companion object {
        const val EXTRA_HOST = "host"
        const val EXTRA_PORT = "port"
        private const val DECODE_THROTTLE_MS = 500L
    }

    private lateinit var preview: TextureView
    private lateinit var statusText: TextView

    private var bgThread: HandlerThread? = null
    private var bgHandler: Handler? = null
    private var camera: CameraDevice? = null
    private var session: CameraCaptureSession? = null
    private var frameReader: ImageReader? = null
    private var lastDecodeAt = 0L
    private var done = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_qr_scan)
        preview = findViewById(R.id.qrPreview)
        statusText = findViewById(R.id.qrStatus)
        findViewById<Button>(R.id.btnQrCancel).setOnClickListener {
            setResult(RESULT_CANCELED)
            finish()
        }
    }

    override fun onResume() {
        super.onResume()
        if (!hasCameraPermission()) {
            statusText.text = getString(R.string.msg_camera_denied)
            return
        }
        startBg()
        if (preview.isAvailable) openCamera()
        else preview.surfaceTextureListener = surfaceListener
    }

    override fun onPause() {
        closeCamera()
        stopBg()
        super.onPause()
    }

    private fun hasCameraPermission(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
        return checkSelfPermission(android.Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
    }

    private fun startBg() {
        val t = HandlerThread("qr-decode")
        t.isDaemon = true
        t.start()
        bgThread = t
        bgHandler = Handler(t.looper)
    }

    private fun stopBg() {
        try { bgThread?.quitSafely() } catch (_: Exception) {}
        bgThread = null
        bgHandler = null
    }

    private val surfaceListener = object : TextureView.SurfaceTextureListener {
        override fun onSurfaceTextureAvailable(st: SurfaceTexture, w: Int, h: Int) = openCamera()
        override fun onSurfaceTextureSizeChanged(st: SurfaceTexture, w: Int, h: Int) {}
        override fun onSurfaceTextureDestroyed(st: SurfaceTexture): Boolean = true
        override fun onSurfaceTextureUpdated(st: SurfaceTexture) {}
    }

    private fun openCamera() {
        val mgr = getSystemService(CAMERA_SERVICE) as CameraManager
        val id = backCameraId(mgr) ?: run {
            statusText.text = getString(R.string.msg_no_camera)
            return
        }
        val handler = bgHandler ?: return
        try {
            @Suppress("MissingPermission")
            mgr.openCamera(id, deviceCallback, handler)
        } catch (_: Exception) {
            statusText.text = getString(R.string.msg_no_camera)
        }
    }

    private fun backCameraId(mgr: CameraManager): String? {
        val ids = try { mgr.cameraIdList } catch (_: Exception) { return null }
        for (id in ids) {
            val chars = try { mgr.getCameraCharacteristics(id) } catch (_: Exception) { continue }
            if (chars.get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK) return id
        }
        return ids.firstOrNull()
    }

    private val deviceCallback = object : CameraDevice.StateCallback() {
        override fun onOpened(device: CameraDevice) {
            camera = device
            startPreview(device)
        }

        override fun onDisconnected(device: CameraDevice) {
            try { device.close() } catch (_: Exception) {}
            if (camera === device) camera = null
        }

        override fun onError(device: CameraDevice, error: Int) {
            try { device.close() } catch (_: Exception) {}
            if (camera === device) camera = null
            runOnUiThread { statusText.text = getString(R.string.msg_no_camera) }
        }
    }

    @Suppress("DEPRECATION")
    private fun startPreview(device: CameraDevice) {
        val handler = bgHandler ?: return
        val tex = preview.surfaceTexture ?: return
        val mgr = getSystemService(CAMERA_SERVICE) as CameraManager
        val size = chooseYuvSize(mgr, device.id) ?: run {
            runOnUiThread { statusText.text = getString(R.string.msg_no_camera) }
            return
        }
        tex.setDefaultBufferSize(size.width, size.height)
        val previewSurface = Surface(tex)
        val reader = ImageReader.newInstance(size.width, size.height, ImageFormat.YUV_420_888, 2)
        reader.setOnImageAvailableListener({ r -> onFrame(r) }, handler)
        frameReader = reader
        try {
            device.createCaptureSession(
                listOf(previewSurface, reader.surface),
                object : CameraCaptureSession.StateCallback() {
                    override fun onConfigured(s: CameraCaptureSession) {
                        session = s
                        try {
                            val req = device.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)
                            req.addTarget(previewSurface)
                            req.addTarget(reader.surface)
                            req.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
                            s.setRepeatingRequest(req.build(), null, handler)
                        } catch (_: Exception) {
                            runOnUiThread { statusText.text = getString(R.string.msg_no_camera) }
                        }
                    }

                    override fun onConfigureFailed(s: CameraCaptureSession) {
                        runOnUiThread { statusText.text = getString(R.string.msg_no_camera) }
                    }
                },
                handler,
            )
        } catch (_: Exception) {
            runOnUiThread { statusText.text = getString(R.string.msg_no_camera) }
        }
    }

    private fun onFrame(reader: ImageReader) {
        if (done) {
            try { reader.acquireLatestImage()?.close() } catch (_: Exception) {}
            return
        }
        val now = System.currentTimeMillis()
        if (now - lastDecodeAt < DECODE_THROTTLE_MS) {
            try { reader.acquireLatestImage()?.close() } catch (_: Exception) {}
            return
        }
        lastDecodeAt = now
        val img = try { reader.acquireLatestImage() } catch (_: Exception) { null } ?: return
        try {
            val nv21 = try {
                yuv420ToNv21(img)
            } catch (_: Exception) {
                return
            }
            val w = img.width
            val h = img.height
            val text = try {
                val src = PlanarYUVLuminanceSource(nv21, w, h, 0, 0, w, h, false)
                QRCodeReader().decode(BinaryBitmap(HybridBinarizer(src))).text
            } catch (_: Exception) {
                null
            }
            if (text != null) {
                val setup = SetupUrl.parse(text)
                if (setup != null) {
                    done = true
                    val (host, port) = setup
                    ConfigStore.save(this, host, port)
                    runOnUiThread {
                        setResult(RESULT_OK, Intent().putExtra(EXTRA_HOST, host).putExtra(EXTRA_PORT, port))
                        finish()
                    }
                }
            }
        } finally {
            try { img.close() } catch (_: Exception) {}
        }
    }

    private fun chooseYuvSize(mgr: CameraManager, cameraId: String): Size? {
        val chars = try {
            mgr.getCameraCharacteristics(cameraId)
        } catch (_: Exception) {
            return null
        }
        val map = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP) ?: return null
        val sizes = try {
            map.getOutputSizes(ImageFormat.YUV_420_888)?.toList() ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
        return sizes.filter { it.width <= 1280 && it.height <= 720 }
            .maxByOrNull { it.width * it.height }
            ?: sizes.minByOrNull { it.width * it.height }
    }

    private fun yuv420ToNv21(img: android.media.Image): ByteArray {
        val w = img.width
        val h = img.height
        val yPlane = img.planes[0]
        val uPlane = img.planes[1]
        val vPlane = img.planes[2]
        val out = ByteArray(w * h * 3 / 2)
        val yBuf = yPlane.buffer
        val yRow = yPlane.rowStride
        var o = 0
        val yRowTmp = ByteArray(yRow)
        for (row in 0 until h) {
            yBuf.position(row * yRow)
            yBuf.get(yRowTmp, 0, minOf(w, yRow))
            System.arraycopy(yRowTmp, 0, out, o, w)
            o += w
        }
        val uBuf = uPlane.buffer
        val vBuf = vPlane.buffer
        val uRow = uPlane.rowStride
        val vRow = vPlane.rowStride
        val uPix = uPlane.pixelStride
        val vPix = vPlane.pixelStride
        for (row in 0 until h / 2) {
            for (col in 0 until w / 2) {
                val v = vBuf.get(row * vRow + col * vPix)
                val u = uBuf.get(row * uRow + col * uPix)
                out[o++] = v
                out[o++] = u
            }
        }
        return out
    }

    private fun closeCamera() {
        try { session?.close() } catch (_: Exception) {}
        session = null
        try { frameReader?.close() } catch (_: Exception) {}
        frameReader = null
        try { camera?.close() } catch (_: Exception) {}
        camera = null
    }
}
