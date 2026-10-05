#ifndef EYE_H
#define EYE_H

#include <Arduino.h>

// The pumpkin's eye: a ball that turns from side to side, and a lid that
// opens and closes over it.
class Eye
{
public:
    // Turns the eye: negative is left, 0 straight ahead, positive right.
    void look(int8_t at);

    // Opens or closes the lid: 0 is shut, 255 wide open.
    void blink(uint8_t amount);
};

#endif //EYE_H
