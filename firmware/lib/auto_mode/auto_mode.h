#ifndef AUTO_MODE_H
#define AUTO_MODE_H

#include <Arduino.h>

#include "config.h"
#include "eye.h"
#include "show_manager.h"

// Plays the presets that have a sound at random, one after another with a
// random pause after each, and has the eye follow the beat of what it plays.
// It runs until it is stopped or something else is played, and carries on
// after a restart.
class AutoMode
{
public:
    AutoMode(ShowManager& show_manager, Eye& eye);

    // Starts again if it was running before the restart. Call once, after
    // the presets have been read.
    void begin();

    // Starts playing, with pauses of between `min_pause_ms` and
    // `max_pause_ms`. The first preset plays straight away, unless something
    // is already playing. If auto mode is already running, what it is
    // playing plays on.
    void start(uint32_t min_pause_ms, uint32_t max_pause_ms);

    // Stops, and stops the preset it is playing, if any.
    void stop();

    // Stops because something else has been played, which it leaves be.
    void hand_over();

    bool is_running() const;
    uint32_t min_pause_ms() const;
    uint32_t max_pause_ms() const;

    // True once each time it has started or stopped, for telling clients.
    bool take_status_change();

    // Plays the next preset once it is time to. Call regularly from loop().
    void update();

private:
    enum class Phase : uint8_t
    {
        // One of its presets is playing.
        Playing,
        // Something else is playing; the pause starts when it is done.
        Waiting,
        // Until next_play_at_ms.
        Pausing,
    };

    // Whether anything at all is playing.
    static bool is_something_playing();

    // Whether the preset it last played still is.
    bool is_own_playing() const;

    void play_next();

    // Picks the next preset to play, dealing out those with a sound in a
    // random order and dealing again once they have all been played, so none
    // comes round twice before every other has had its turn. Returns false
    // if there are none.
    bool next_preset(size_t& index);

    // Reads the presets afresh, so those saved since play from this round
    // on, and deals them out.
    void shuffle();

    void follow_beat();

    // Looks straight ahead again once there is no beat to follow.
    void rest_eye();

    // An eye that hasn't been calibrated would swing through all of 0-180,
    // which may be further than it reaches, so it is left for a client to
    // move.
    bool may_move_eye() const;

    // Stops running, remembering that it has for after a restart.
    void end();

    // Remembers whether it is running, and its pauses, for after a restart.
    void save() const;

    ShowManager& show_manager;
    Eye& eye;

    // Indices of the presets to play, in the order they come round.
    uint8_t deck[max_auto_mode_presets];
    size_t deck_size = 0;
    size_t dealt = 0;
    size_t last_played = SIZE_MAX;

    uint32_t min_pause = 0;
    uint32_t max_pause = 0;

    bool running = false;
    bool is_status_changed = false;
    Phase phase = Phase::Pausing;
    uint32_t next_play_at_ms = 0;

    // audio_start_count() as it was once the preset started playing.
    uint32_t played_start_count = 0;

    // Where the eye was last turned to, in look()'s units.
    int eye_position = 0;
};

#endif //AUTO_MODE_H
