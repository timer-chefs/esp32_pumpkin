#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "led_counter.h"
#include "event_queue.h"
#include "config.h"

Led led0(pin_led0), led1(pin_led1), led2(pin_led2);
Led* leds[] = {&led0, &led1, &led2};
LedCounter led_counter(leds, 3);

EventQueue event_queue;

static const char* tag = "test_queue";

extern "C" void app_main()
{
  led_counter.init();
  led_counter.reset();

  ESP_LOGI(tag, "Event Queue Test");

  // Push 10 events
  ESP_LOGI(tag, "Pushing 10 events...");
  for (int i = 0; i < 10; i++) {
    event_queue.push(Event::boot_request);
    led_counter.increment();
    vTaskDelay(pdMS_TO_TICKS(500));
    ESP_LOGI(tag, "LED count: %u", led_counter.getValue());
  }

  vTaskDelay(pdMS_TO_TICKS(2000));

  // Pop 10 events
  ESP_LOGI(tag, "Popping 10 events...");
  for (int i = 0; i < 10; i++) {
    returned_event_t result = event_queue.pop();
    if (result.is_valid) {
      led_counter.decrement();
      vTaskDelay(pdMS_TO_TICKS(500));
      ESP_LOGI(tag, "LED count: %u", led_counter.getValue());
    }
  }

  ESP_LOGI(tag, "Test complete!");
}
