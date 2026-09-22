package com.veloov.totem

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var offlineOverlay: LinearLayout
    private lateinit var progressBar: ProgressBar
    private lateinit var reconfigZone: View

    private val handler = Handler(Looper.getMainLooper())
    private var reconfigPressedAt = 0L
    private var isLockedTask = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (!DeviceId.isConfigured(this)) {
            startActivity(android.content.Intent(this, ConfigActivity::class.java))
            finish()
            return
        }

        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        )

        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        offlineOverlay = findViewById(R.id.offlineOverlay)
        progressBar = findViewById(R.id.progressBar)
        reconfigZone = findViewById(R.id.reconfigZone)

        setupWebView()
        setupReconfigZone()
        loadUrl()
        startKioskMode()
    }

    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            allowFileAccess = false
            allowContentAccess = false
            mediaPlaybackRequiresUserGesture = false
            javaScriptCanOpenWindowsAutomatically = false
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            loadWithOverviewMode = true
            useWideViewPort = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                return false
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                injectDeviceId()
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: android.webkit.WebResourceError?) {
                if (request?.isForMainFrame == true) showOffline()
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    progressBar.visibility = View.VISIBLE
                } else {
                    progressBar.visibility = View.GONE
                }
            }
        }

        webView.addJavascriptInterface(NativeBridge(), "VeloovNative")
    }

    private fun loadUrl() {
        val slug = DeviceId.getSlug(this) ?: return
        val url = "https://mob.veloov.com/$slug"
        webView.loadUrl(url)
    }

    private fun injectDeviceId() {
        val deviceId = DeviceId.getDeviceId(this)
        val js = """
            (function() {
                try {
                    var nativeId = window.VeloovNative && window.VeloovNative.getDeviceId();
                    if (nativeId) {
                        localStorage.setItem('veloov_device_uuid', nativeId);
                    }
                } catch(e) {}
            })();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }

    private fun showOffline() {
        offlineOverlay.visibility = View.VISIBLE
        retryConnection()
    }

    private fun hideOffline() {
        offlineOverlay.visibility = View.GONE
    }

    private fun retryConnection() {
        handler.postDelayed({
            if (isOnline()) {
                hideOffline()
                webView.reload()
            } else {
                retryConnection()
            }
        }, 5000)
    }

    private fun isOnline(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
               caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    private fun setupReconfigZone() {
        reconfigZone.setOnLongClickListener {
            reconfigPressedAt = SystemClock.elapsedRealtime()
            handler.postDelayed({
                val elapsed = SystemClock.elapsedRealtime() - reconfigPressedAt
                if (elapsed >= 5000) {
                    stopKioskMode()
                    DeviceId.clearConfig(this)
                    val intent = android.content.Intent(this, ConfigActivity::class.java).apply {
                        addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK)
                    }
                    startActivity(intent)
                    finish()
                }
            }, 5000)
            true
        }
    }

    private fun startKioskMode() {
        try {
            startLockTask()
            isLockedTask = true
        } catch (e: Exception) {
            val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val adminComponent = ComponentName(this, AdminReceiver::class.java)
            if (dpm.isAdminActive(adminComponent)) {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        dpm.setLockTaskPackages(adminComponent, arrayOf(packageName))
                        startLockTask()
                        isLockedTask = true
                    }
                } catch (e2: Exception) {
                    // Device admin not properly set up — kiosk mode unavailable
                }
            }
        }
    }

    private fun stopKioskMode() {
        if (isLockedTask) {
            try {
                stopLockTask()
            } catch (e: Exception) {
                // ignore
            }
            isLockedTask = false
        }
    }

    override fun onBackPressed() {
        // Blocked in kiosk mode — do nothing
    }

    override fun onResume() {
        super.onResume()
        if (!isOnline()) {
            showOffline()
        } else {
            hideOffline()
        }
    }

    override fun onDestroy() {
        stopKioskMode()
        super.onDestroy()
    }

    inner class NativeBridge {
        @JavascriptInterface
        fun getDeviceId(): String = DeviceId.getDeviceId(this@MainActivity)

        @JavascriptInterface
        fun isOnline(): Boolean = this@MainActivity.isOnline()
    }
}
