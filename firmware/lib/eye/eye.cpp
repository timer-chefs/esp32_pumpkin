#include "eye.h"

// Stands in for the servo code until it lands. Clients can already move the
// eye, and logging what they ask for is enough to see that they get through.

void Eye::look(int8_t at)
{
    Serial.printf("Eye: look at %d\n", at);
}

void Eye::blink(uint8_t amount)
{
    Serial.printf("Eye: lid at %u\n", amount);
}
