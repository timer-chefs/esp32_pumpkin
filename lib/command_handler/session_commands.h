#ifndef SESSION_COMMANDS_H
#define SESSION_COMMANDS_H

// The commands that coordinate more than one subsystem -- starting and
// stopping playback, and the show and volume that go with it. Commands that
// belong to a single feature are registered by that feature instead.
void register_session_commands();

#endif //SESSION_COMMANDS_H
