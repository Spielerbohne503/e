package com.deadmode.app

import android.app.NotificationManager
import android.app.PendingIntent
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Intent
import android.net.VpnService
import android.nfc.NfcAdapter
import android.nfc.NfcManager
import android.os.Bundle
import android.provider.Settings
import android.view.View
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.deadmode.app.data.Prefs
import com.deadmode.app.databinding.ActivityMainBinding
import com.deadmode.app.receiver.AdminReceiver
import com.deadmode.app.ui.TimePickerBottomSheet

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var nfcAdapter: NfcAdapter? = null

    companion object {
        private const val REQUEST_ADMIN = 1001
        private const val REQUEST_VPN = 1002
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Prefs.isActive(this) && !Prefs.isExpired(this)) {
            startActivity(Intent(this, DeadModeActivity::class.java))
            finish()
            return
        }

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val nfcManager = getSystemService(NFC_SERVICE) as NfcManager
        nfcAdapter = nfcManager.defaultAdapter

        if (nfcAdapter == null) {
            binding.tvNfcStatus.text = getString(R.string.nfc_unavailable)
        }

        binding.btnSetupAdmin.setOnClickListener { requestDeviceAdmin() }
        binding.btnSetupAccessibility.setOnClickListener { openAccessibilitySettings() }
        binding.btnSetupVpn.setOnClickListener { requestVpnPermission() }
        binding.btnSetupDnd.setOnClickListener { openDndSettings() }
        binding.btnTestTrigger.setOnClickListener { showTimePicker() }
    }

    override fun onResume() {
        super.onResume()
        updateSetupStatus()
        enableNfcDispatch()
    }

    override fun onPause() {
        super.onPause()
        nfcAdapter?.disableForegroundDispatch(this)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (intent.hasExtra(NfcAdapter.EXTRA_TAG)) {
            showTimePicker()
        }
    }

    private fun enableNfcDispatch() {
        val adapter = nfcAdapter ?: return
        val pendingIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, javaClass).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_MUTABLE
        )
        adapter.enableForegroundDispatch(this, pendingIntent, null, null)
    }

    private fun showTimePicker() {
        if (!isAdminActive()) {
            AlertDialog.Builder(this)
                .setTitle(R.string.setup_required_title)
                .setMessage(R.string.setup_required_admin)
                .setPositiveButton(android.R.string.ok) { _, _ -> requestDeviceAdmin() }
                .show()
            return
        }
        if (!isAccessibilityEnabled()) {
            AlertDialog.Builder(this)
                .setTitle(R.string.setup_required_title)
                .setMessage(R.string.setup_required_accessibility)
                .setPositiveButton(android.R.string.ok) { _, _ -> openAccessibilitySettings() }
                .show()
            return
        }
        TimePickerBottomSheet().show(supportFragmentManager, "timepicker")
    }

    private fun updateSetupStatus() {
        binding.btnSetupAdmin.isEnabled = !isAdminActive()
        binding.btnSetupAccessibility.isEnabled = !isAccessibilityEnabled()
        binding.btnSetupVpn.isEnabled = !hasVpnPermission()
        binding.btnSetupDnd.isEnabled = !hasDndPermission()

        val allDone = isAdminActive() && isAccessibilityEnabled()
        binding.tvReadyStatus.visibility = if (allDone) View.VISIBLE else View.GONE
        binding.tvNfcHint.visibility = if (allDone) View.VISIBLE else View.GONE
    }

    private fun isAdminActive(): Boolean {
        val dpm = getSystemService(DevicePolicyManager::class.java)
        return dpm.isAdminActive(ComponentName(this, AdminReceiver::class.java))
    }

    private fun isAccessibilityEnabled(): Boolean {
        val flat = Settings.Secure.getString(
            contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        return flat.contains("${packageName}/.service.AppBlockerService")
    }

    private fun hasVpnPermission(): Boolean = VpnService.prepare(this) == null

    private fun hasDndPermission(): Boolean =
        getSystemService(NotificationManager::class.java).isNotificationPolicyAccessGranted

    private fun requestDeviceAdmin() {
        startActivityForResult(
            Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN,
                    ComponentName(this@MainActivity, AdminReceiver::class.java))
                putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                    getString(R.string.admin_explanation))
            },
            REQUEST_ADMIN
        )
    }

    private fun openAccessibilitySettings() {
        startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
    }

    private fun requestVpnPermission() {
        val intent = VpnService.prepare(this) ?: return
        startActivityForResult(intent, REQUEST_VPN)
    }

    private fun openDndSettings() {
        startActivity(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS))
    }
}
