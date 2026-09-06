#include "sd_audio.h"

#include "audio.h"
#include "audio_files.h"
#include "config.h"
#include "sd_audio_commands.h"
#include "sd_upload.h"
#include "wav_reader.h"

#include <cstring>

static constexpr size_t output_bytes_per_frame = (bits_per_sample / 8) * channels;
static constexpr size_t output_bytes_per_ms = (sample_rate * output_bytes_per_frame) / 1000;
static constexpr size_t target_buffer_bytes = sd_audio_target_buffer_ms * output_bytes_per_ms;
static constexpr size_t output_chunk_samples = 128;

static_assert(
    sd_audio_read_block_size % sd_sector_size == 0,
    "The read block has to be a whole number of sectors");

// The card is read a sector-aligned block at a time and consumed one source
// frame at a time. `read_offset` is always sector-aligned, so the block can
// start a little before the audio and reach past the end of it.
struct BlockReader
{
    alignas(sd_dma_alignment) uint8_t block[sd_audio_read_block_size];
    size_t block_size;
    size_t block_offset;
    uint32_t read_offset;
    uint8_t recovery_attempts;
    // A read that failed with data still to come is a very different thing
    // from the file ending, and mustn't be reported as one.
    bool failed;
};

// Linear resampling state: `phase` is the position between `previous` and
// `next`, in source samples.
struct Resampler
{
    int16_t previous;
    int16_t next;
    float phase;
    float step;
};

struct Playback
{
    File* file;
    char path[audio_path_length];
    WavInfo info;
    uint32_t file_size;
    uint32_t data_end;

    BlockReader reader;
    Resampler resampler;

    bool is_playing;
    // The file has been read to its end, but the audio it produced is still
    // working its way through the buffer and the I2S hardware.
    bool is_draining;
    bool finished;
};

static Playback playback = {};

void sd_audio_init()
{
    register_sd_audio_commands();
    audio_files_init();
}

bool sd_audio_list_files(FileInfo* entries, size_t max_entries, size_t* count)
{
    return list_audio_files(entries, max_entries, count);
}

static void close_playing_file()
{
    if(playback.file)
    {
        close_file(playback.file);
        playback.file = nullptr;
    }
}

// Gets the card talking again and picks the file back up where it stopped.
static bool recover_playback()
{
    if(playback.reader.recovery_attempts >= max_sd_read_recoveries)
    {
        return false;
    }

    playback.reader.recovery_attempts++;
    Serial.printf(
        "Recovering the SD card (attempt %u)\n",
        playback.reader.recovery_attempts);

    close_playing_file();
    if(!sd_card_remount())
    {
        return false;
    }

    playback.file = open_file(playback.path, FILE_READ);
    if(!playback.file)
    {
        return false;
    }

    if(!playback.file->seek(playback.reader.read_offset))
    {
        close_playing_file();
        return false;
    }

    return true;
}

static bool refill_block()
{
    BlockReader& reader = playback.reader;

    if(reader.read_offset >= playback.data_end)
    {
        return false;
    }

    // Read whole sectors from a sector-aligned offset. FatFs passes a
    // request like that straight through to the SD driver with this buffer
    // as the destination, which is its direct DMA path. Reading from the
    // middle of a sector instead makes FatFs hand it a pointer part-way
    // into the buffer, and an unaligned destination costs a bounce buffer
    // the driver has to allocate and copy for every read.
    const uint32_t remaining = playback.data_end - reader.read_offset;
    const uint32_t whole_sectors =
        ((remaining + sd_sector_size - 1) / sd_sector_size) * sd_sector_size;

    size_t to_read = min((uint32_t)sizeof(reader.block), whole_sectors);
    to_read = min((uint32_t)to_read, playback.file_size - reader.read_offset);

    size_t bytes_read = read_file(playback.file, reader.block, to_read);
    if(bytes_read == 0)
    {
        Serial.printf(
            "SD read of %u bytes failed at offset %u of %u (free heap %u)\n",
            (unsigned)to_read,
            (unsigned)reader.read_offset,
            (unsigned)playback.file_size,
            (unsigned)ESP.getFreeHeap());

        if(!recover_playback())
        {
            reader.failed = true;
            return false;
        }

        bytes_read = read_file(playback.file, reader.block, to_read);
        if(bytes_read == 0)
        {
            reader.failed = true;
            return false;
        }
    }

    // The first block starts before the audio does, and the last one can
    // reach past the end of it.
    reader.block_offset = reader.read_offset < playback.info.data_start
        ? playback.info.data_start - reader.read_offset
        : 0;
    reader.block_size = min(
        (uint32_t)bytes_read,
        playback.data_end - reader.read_offset);
    reader.read_offset += bytes_read;

    return reader.block_offset < reader.block_size;
}

// Reads the next frame from the file and mixes it down to a single sample.
static bool read_source_sample(int16_t& sample)
{
    BlockReader& reader = playback.reader;
    const size_t frame_bytes = playback.info.channels * sizeof(int16_t);

    while(reader.block_offset + frame_bytes > reader.block_size)
    {
        if(!refill_block())
        {
            return false;
        }
    }

    int16_t frame[2];
    memcpy(frame, reader.block + reader.block_offset, frame_bytes);
    reader.block_offset += frame_bytes;

    sample = playback.info.channels == 2
        ? (int16_t)(((int32_t)frame[0] + frame[1]) / 2)
        : frame[0];

    return true;
}

// Resamples the file to the pipeline's sample rate. Returns how many samples
// were produced, which is short of `max_samples` only at the end of the file.
static size_t read_output_samples(int16_t* output, size_t max_samples)
{
    Resampler& resampler = playback.resampler;
    size_t produced = 0;

    while(produced < max_samples)
    {
        while(resampler.phase >= 1.0f)
        {
            int16_t sample;
            if(!read_source_sample(sample))
            {
                return produced;
            }

            resampler.previous = resampler.next;
            resampler.next = sample;
            resampler.phase -= 1.0f;
        }

        output[produced++] = (int16_t)(
            resampler.previous +
            (resampler.next - resampler.previous) * resampler.phase);
        resampler.phase += resampler.step;
    }

    return produced;
}

bool sd_audio_start(const char* file_name, const char** error_message)
{
    if(!sd_card_is_mounted())
    {
        *error_message = "No SD card detected";
        return false;
    }

    if(sd_upload_is_busy())
    {
        *error_message = "An upload is in progress";
        return false;
    }

    *error_message = audio_file_name_problem(file_name);
    if(*error_message)
    {
        return false;
    }

    sd_audio_stop();
    build_audio_path(playback.path, sizeof(playback.path), file_name);

    playback.file = open_file(playback.path, FILE_READ);
    if(!playback.file)
    {
        *error_message = "Audio file not found on the SD card";
        return false;
    }

    if(!read_wav_info(playback.file, playback.info, error_message))
    {
        close_playing_file();
        return false;
    }

    playback.file_size = playback.file->size();
    playback.data_end = playback.info.data_start + playback.info.data_size;

    playback.reader = {};
    // Reads start at the sector the audio begins in, not at the audio
    // itself, so every one of them is sector-aligned.
    playback.reader.read_offset =
        playback.info.data_start - (playback.info.data_start % sd_sector_size);

    if(!playback.file->seek(playback.reader.read_offset))
    {
        *error_message = "Could not read the audio file";
        close_playing_file();
        return false;
    }

    playback.resampler = {};
    playback.resampler.step =
        (float)playback.info.sample_rate / (float)sample_rate;
    // Enough to pull both interpolation endpoints before the first output
    // sample, so playback starts on the file's very first sample.
    playback.resampler.phase = 2.0f;

    // Drop whatever the previous source left behind before taking over.
    audio_stoped();
    audio_started();

    playback.is_playing = true;
    playback.is_draining = false;
    playback.finished = false;

    Serial.printf(
        "Playing %s (%u Hz, %u channel(s), %u bytes of audio)\n",
        playback.path,
        (unsigned)playback.info.sample_rate,
        (unsigned)playback.info.channels,
        (unsigned)playback.info.data_size);

    return true;
}

void sd_audio_stop()
{
    if(!playback.is_playing && !playback.is_draining)
    {
        return;
    }

    close_playing_file();
    playback.is_playing = false;
    playback.is_draining = false;
    playback.reader.read_offset = 0;
    playback.data_end = 0;

    audio_stoped();
}

void sd_audio_service()
{
    while(playback.is_playing && audio_buffered_bytes() < target_buffer_bytes)
    {
        int16_t samples[output_chunk_samples];
        const size_t produced = read_output_samples(samples, output_chunk_samples);

        if(produced > 0)
        {
            audio_write(
                reinterpret_cast<const uint8_t*>(samples),
                produced * sizeof(int16_t));
        }

        if(produced < output_chunk_samples)
        {
            close_playing_file();
            playback.is_playing = false;
            playback.is_draining = true;

            if(playback.reader.failed)
            {
                Serial.println("Reading the SD card failed");
            }
        }
    }

    if(playback.is_draining && audio_buffered_bytes() == 0)
    {
        playback.is_draining = false;
        playback.finished = true;
        audio_stoped();

        Serial.println(
            playback.reader.failed
                ? "SD card playback ended early"
                : "SD card playback finished");
    }
}

bool sd_audio_take_playback_finished()
{
    const bool finished = playback.finished;
    playback.finished = false;
    return finished;
}
