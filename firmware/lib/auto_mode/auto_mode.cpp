#include "auto_mode.h"

#include <Preferences.h>

#include <cstdlib>
#include <utility>

#include "audio.h"
#include "device_log.h"
#include "fft.h"
#include "preset_reader.h"
#include "sd_audio.h"
#include "session_commands.h"

// Audio that started but has had nothing written to it for this long is
// taken to be over. A client that streamed it may have gone away without
// stopping it, which would otherwise hold auto mode up for good.
static constexpr uint32_t abandoned_audio_ms = 5000;

// How far look() turns either way.
static constexpr int eye_reach = 127;
// How far the eye moves on a beat at the least, in look()'s units, so that
// each beat shows.
static constexpr int beat_min_move = 40;

static bool has_sound(size_t index)
{
    return index < presets_count() && presets_get(index).sound[0] != '\0';
}

AutoMode::AutoMode(ShowManager& show_manager, Eye& eye)
    : show_manager(show_manager), eye(eye) {}

void AutoMode::begin()
{
    // Opening the namespace fails until auto mode has first been started,
    // which leaves it stopped, as it should.
    Preferences preferences;
    if(!preferences.begin(auto_mode_namespace, true) ||
       !preferences.getBool("running", false))
    {
        return;
    }

    device_log.println("Auto mode: carrying on from before the restart");
    start(
        preferences.getUInt("min_pause_ms"),
        preferences.getUInt("max_pause_ms"));
}

void AutoMode::start(uint32_t min_pause_ms, uint32_t max_pause_ms)
{
    min_pause = min_pause_ms;
    max_pause = max_pause_ms;

    if(!running)
    {
        running = true;
        phase = Phase::Pausing;
        next_play_at_ms = millis();
        // Deals afresh for the first pick.
        deck_size = 0;
        dealt = 0;
    }

    is_status_changed = true;
    save();

    device_log.printf(
        "Auto mode: pausing %u-%u s\n",
        (unsigned)(min_pause / 1000),
        (unsigned)(max_pause / 1000));
}

void AutoMode::stop()
{
    if(!running)
    {
        return;
    }

    if(phase == Phase::Playing && is_own_playing())
    {
        sd_audio_stop();
        show_manager.set_current_show(0);
        rest_eye();
    }

    end();
    device_log.println("Auto mode: stopped");
}

void AutoMode::hand_over()
{
    if(!running)
    {
        return;
    }

    end();
    device_log.println("Auto mode: stopped, as something else was played");
}

bool AutoMode::is_running() const
{
    return running;
}

uint32_t AutoMode::min_pause_ms() const
{
    return min_pause;
}

uint32_t AutoMode::max_pause_ms() const
{
    return max_pause;
}

bool AutoMode::take_status_change()
{
    const bool changed = is_status_changed;
    is_status_changed = false;
    return changed;
}

void AutoMode::update()
{
    // Taken even when there is nothing to follow, so that a beat heard then
    // isn't followed later.
    const bool is_beat = fft_take_beat();

    if(!running)
    {
        return;
    }

    switch(phase)
    {
        case Phase::Playing:
        {
            if(is_own_playing())
            {
                if(is_beat)
                {
                    follow_beat();
                }
                return;
            }

            rest_eye();
            phase = Phase::Waiting;
            return;
        }

        case Phase::Waiting:
        {
            if(!is_something_playing())
            {
                next_play_at_ms = millis() + random(min_pause, max_pause + 1);
                phase = Phase::Pausing;
            }
            return;
        }

        case Phase::Pausing:
        {
            if(is_something_playing())
            {
                phase = Phase::Waiting;
            }
            else if((int32_t)(millis() - next_play_at_ms) >= 0)
            {
                play_next();
            }
            return;
        }
    }
}

bool AutoMode::is_something_playing()
{
    return is_audio_running() &&
           millis() - audio_last_active_ms() < abandoned_audio_ms;
}

bool AutoMode::is_own_playing() const
{
    return is_audio_running() && audio_start_count() == played_start_count;
}

void AutoMode::play_next()
{
    // Whatever goes wrong, another try comes after the pause.
    phase = Phase::Waiting;

    size_t index;
    if(!next_preset(index))
    {
        return;
    }

    const PresetInfo& preset = presets_get(index);
    last_played = index;

    const char* error_message = nullptr;
    if(!sd_audio_start(preset.sound, &error_message))
    {
        device_log.printf(
            "Auto mode: could not play %s: %s\n",
            preset.sound,
            error_message);
        return;
    }

    EffectId effect;
    if(preset.has_light && find_effect(preset.light_effect, effect))
    {
        show_manager.set_light(effect, preset.color);
    }

    played_start_count = audio_start_count();
    phase = Phase::Playing;
}

bool AutoMode::next_preset(size_t& index)
{
    // A client starting auto mode reads the presets afresh too.
    if(dealt == deck_size || !has_sound(deck[dealt]))
    {
        shuffle();
    }

    if(deck_size == 0)
    {
        return false;
    }

    index = deck[dealt++];
    return true;
}

void AutoMode::shuffle()
{
    deck_size = 0;
    dealt = 0;

    // The card may also have been put in, or the file mended, since the last
    // try.
    const char* error_message = nullptr;
    if(!presets_load(&error_message))
    {
        device_log.printf("Auto mode: %s\n", error_message);
        return;
    }

    for(size_t i = 0; i < presets_count(); ++i)
    {
        if(has_sound(i))
        {
            deck[deck_size++] = i;
        }
    }

    for(size_t i = deck_size; i > 1; --i)
    {
        std::swap(deck[i - 1], deck[random(i)]);
    }

    // A new round mustn't open with what the last one ended on.
    if(deck_size > 1 && deck[0] == last_played)
    {
        std::swap(deck[0], deck[1 + random(deck_size - 1)]);
    }

    if(deck_size == 0)
    {
        device_log.println("Auto mode: no preset has a sound to play");
    }
}

void AutoMode::follow_beat()
{
    if(!may_move_eye())
    {
        return;
    }

    // Anywhere from far left to far right, but far enough from where it was
    // for the beat to show.
    int at;
    do
    {
        at = random(-eye_reach, eye_reach + 1);
    } while(abs(at - eye_position) < beat_min_move);

    eye_position = at;
    eye.glance(static_cast<int8_t>(at));
}

void AutoMode::rest_eye()
{
    if(may_move_eye())
    {
        eye.look(0);
        eye_position = 0;
    }
}

bool AutoMode::may_move_eye() const
{
    return eye.is_servo_calibrated(EyeServo::Ball);
}

void AutoMode::end()
{
    running = false;
    is_status_changed = true;
    save();
}

void AutoMode::save() const
{
    Preferences preferences;
    if(!preferences.begin(auto_mode_namespace))
    {
        device_log.println("Auto mode: could not remember whether it is running");
        return;
    }

    preferences.putBool("running", running);
    preferences.putUInt("min_pause_ms", min_pause);
    preferences.putUInt("max_pause_ms", max_pause);
}
