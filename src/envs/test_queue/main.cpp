#include <Arduino.h>

#include "led_counter.h"
//#include "event_queue.h"

Led led0(GPIO_NUM_1), led1(GPIO_NUM_2), led2(GPIO_NUM_4);
Led* leds[] = {&led0, &led1, &led2};
LedCounter led_counter(leds, 3);

void setup()
{
  led_counter.init(); 
}

void loop()
{
   led_counter.increment();
   delay(1000);
}
