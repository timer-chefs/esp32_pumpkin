#ifndef AUTO_MODE_COMMANDS_H
#define AUTO_MODE_COMMANDS_H

#include "auto_mode.h"

// Lets clients start and stop `auto_mode`, which has to outlive the
// registration.
void register_auto_mode_commands(AutoMode& auto_mode);

#endif //AUTO_MODE_COMMANDS_H
