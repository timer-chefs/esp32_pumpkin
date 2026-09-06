#ifndef SD_AUDIO_COMMANDS_H
#define SD_AUDIO_COMMANDS_H

// Registered from sd_audio_init(), which also keeps the linker from dropping
// this translation unit out of the library archive.
void register_sd_audio_commands();

#endif //SD_AUDIO_COMMANDS_H
