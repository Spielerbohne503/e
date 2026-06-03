package com.deadmode.app.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import com.deadmode.app.R
import com.deadmode.app.service.TimerService
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import java.util.concurrent.TimeUnit

class TimePickerBottomSheet : BottomSheetDialogFragment() {

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.fragment_time_picker, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val durations = mapOf(
            R.id.btn_15min to TimeUnit.MINUTES.toMillis(15),
            R.id.btn_30min to TimeUnit.MINUTES.toMillis(30),
            R.id.btn_1h    to TimeUnit.HOURS.toMillis(1),
            R.id.btn_2h    to TimeUnit.HOURS.toMillis(2),
            R.id.btn_1day  to TimeUnit.DAYS.toMillis(1),
            R.id.btn_1week to TimeUnit.DAYS.toMillis(7),
        )
        durations.forEach { (btnId, durationMs) ->
            view.findViewById<Button>(btnId).setOnClickListener {
                TimerService.start(requireContext(), durationMs)
                dismiss()
            }
        }
    }
}
