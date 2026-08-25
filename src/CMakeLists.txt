if("$ENV{PIOENV}" STREQUAL "test_queue")
    set(PUMPKIN_ENV "test_queue")
else()
    set(PUMPKIN_ENV "voice_websocket")
endif()

file(GLOB_RECURSE PUMPKIN_SOURCES
    "envs/${PUMPKIN_ENV}/*.cpp"
    "../lib/*.cpp"
)

idf_component_register(
    SRCS ${PUMPKIN_SOURCES}
    INCLUDE_DIRS
        "../include"
        "../lib/audio"
        "../lib/command_handler"
        "../lib/effect_manager"
        "../lib/event_queue"
        "../lib/fft"
        "../lib/led_counter"
        "../lib/led_strip"
        "../lib/light_effect"
        "../lib/show"
        "../lib/show_manager"
        "../lib/web_interface"
        "../lib/wifi_manager"
    REQUIRES
        driver
        esp-dsp
        esp_http_server
        esp_timer
        esp_wifi
        led_strip
        littlefs
        mdns
        nvs_flash
        wifi_provisioning
)