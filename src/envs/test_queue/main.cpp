#include <Arduino.h>

#include "led_counter.h"
#include "event_queue.h"
#include "config.h"

Led led0(pin_led0), led1(pin_led1), led2(pin_led2);
Led* leds[] = {&led0, &led1, &led2};
LedCounter led_counter(leds, 3);

EventQueue event_queue;

void setup()
{
  Serial.begin(baud_rate);
  
  led_counter.init();
  led_counter.reset();
  
  Serial.println("=== Event Queue Test ===");
  
  // Push 10 events
  Serial.println("Pushing 10 events...");
  for (int i = 0; i < 10; i++) {
    event_queue.push(Event::boot_request);
    led_counter.increment();
    delay(500);
    Serial.println(led_counter.getValue());
  }
  
  delay(2000);
  
  // Pop 10 events
  Serial.println("Popping 10 events...");
  for (int i = 0; i < 10; i++) {
    returned_event_t result = event_queue.pop();
    if (result.is_valid) {
      led_counter.decrement();
      delay(500);
      Serial.println(led_counter.getValue());
    }
  }
  
  Serial.println("Test complete!");
}

void loop()
{
}
