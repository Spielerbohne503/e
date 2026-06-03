package com.deadmode.app.service

import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.ParcelFileDescriptor
import java.io.FileInputStream
import java.nio.ByteBuffer

class BlockingVpnService : VpnService() {

    companion object {
        fun start(context: Context) {
            context.startService(Intent(context, BlockingVpnService::class.java)
                .setAction("START"))
        }

        fun stop(context: Context) {
            context.startService(Intent(context, BlockingVpnService::class.java)
                .setAction("STOP"))
        }
    }

    private var vpnInterface: ParcelFileDescriptor? = null
    private var drainThread: Thread? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            "START" -> establishVpn()
            "STOP"  -> tearDown()
        }
        return START_STICKY
    }

    private fun establishVpn() {
        vpnInterface = Builder()
            .addAddress("10.0.0.2", 32)
            .addRoute("0.0.0.0", 0)
            .addRoute("::", 0)
            .setMtu(1500)
            .setSession("DeadMode")
            .setBlocking(false)
            .establish()

        val fd = vpnInterface ?: return
        drainThread = Thread({
            val buf = ByteBuffer.allocate(32767)
            val stream = FileInputStream(fd.fileDescriptor)
            while (!Thread.currentThread().isInterrupted) {
                buf.clear()
                val len = stream.read(buf.array())
                if (len < 0) break
                // Packet discarded — no response, connections stall
            }
        }, "vpn-drain").apply { isDaemon = true; start() }
    }

    private fun tearDown() {
        drainThread?.interrupt()
        vpnInterface?.close()
        vpnInterface = null
        stopSelf()
    }

    override fun onDestroy() {
        tearDown()
        super.onDestroy()
    }
}
