#ifndef EVENTS_H
#define EVENTS_H

enum class Event {
    boot_request,
    boot_completed,
    web_client_connected,
    web_client_disconnected,
    voice_button_pressed,
    voice_button_released,
    none,   //Sentinel value.

    // AudioChunkReceived,
    // MediaPlayRequested,
    // MediaStopRequested,
    // VolumeChanged,
    // EffectChanged,
    // TwinSyncRequested,
    // TwinPeerDiscovered,
    // TwinSyncStarted,
    // Tick,
    // FaultRaised
};

#endif //EVENTS_H
