#ifndef EYE_COMMANDS_H
#define EYE_COMMANDS_H

#include "eye.h"

// Lets clients move and calibrate `eye`, which has to outlive the
// registration.
void register_eye_commands(Eye& eye);

#endif //EYE_COMMANDS_H
