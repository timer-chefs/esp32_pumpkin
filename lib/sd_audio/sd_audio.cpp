#include "sd_audio.h"

#include "audio.h"
#include "config.h"

#include <cstring>

struct WavFormat
{
    uint16_t channels;
    uint32_t sample_rate;
    uint16_t bits_per_sample;
};

struct __attribute__((packed)) RiffChunkHeader
{
    char id[4];
    uint32_t size;
};

struct __attribute__((packed)) WavFormatChunk
{
    uint16_t audio_format;
    uint16_t channels;
    uint32_t sample_rate;
    uint32_t byte_rate;
    uint16_t block_align;
    uint16_t bits_per_sample;
};

static constexpr uint16_t wav_format_pcm = 1;
// Files written by some tools describe plain 16-bit PCM through the
// extensible header instead of the plain one.
static constexpr uint16_t wav_format_extensible = 0xFFFE;

static constexpr size_t output_bytes_per_frame = (bits_per_sample / 8) * channels;
static constexpr size_t output_bytes_per_ms = (sample_rate * output_bytes_per_frame) / 1000;
static constexpr size_t target_buffer_bytes = sd_audio_target_buffer_ms * output_bytes_per_ms;
static constexpr size_t output_chunk_samples = 128;

static File* playing_file = nullptr;
static WavFormat playing_format = {};
static uint32_t data_remaining_bytes = 0;

// The card is read a block at a time and consumed one source frame at a time.
static uint8_t source_block[sd_audio_read_block_size];
static size_t source_block_size = 0;
static size_t source_block_offset = 0;

// Linear resampling state. `resample_phase` is the position between
// previous_sample and next_sample, in source samples.
static int16_t previous_sample = 0;
static int16_t next_sample = 0;
static float resample_phase = 0.0f;
static float resample_step = 1.0f;

static bool is_playing = false;
// The file has been read to its end, but the audio it produced is still
// working its way through the buffer and the I2S hardware.
static bool is_draining = false;
static bool playback_finished = false;

void sd_audio_init()
{
    create_directory(sd_audio_directory);
}

bool sd_audio_list_files(FileInfo* entries, size_t max_entries, size_t* count)
{
    if(!sd_card_is_mounted())
    {
        *count = 0;
        return false;
    }

    *count = list_files(sd_audio_directory, ".wav", entries, max_entries);
    return true;
}

static bool read_exact(File* file, void* destination, size_t size)
{
    return read_file(file, static_cast<uint8_t*>(destination), size) == size;
}

static bool skip_bytes(File* file, uint32_t size)
{
    return file->seek(file->position() + size);
}

static bool parse_wav_header(
    File* file,
    WavFormat& format,
    uint32_t& data_size,
    const char** error_message)
{
    char riff_header[12];
    if(!read_exact(file, riff_header, sizeof(riff_header)) ||
       memcmp(riff_header, "RIFF", 4) != 0 ||
       memcmp(riff_header + 8, "WAVE", 4) != 0)
    {
        *error_message = "Not a RIFF/WAVE file";
        return false;
    }

    bool has_format = false;
    RiffChunkHeader chunk;

    while(read_exact(file, &chunk, sizeof(chunk)))
    {
        if(memcmp(chunk.id, "fmt ", 4) == 0)
        {
            WavFormatChunk format_chunk;
            if(chunk.size < sizeof(format_chunk) ||
               !read_exact(file, &format_chunk, sizeof(format_chunk)))
            {
                *error_message = "Malformed WAV format chunk";
                return false;
            }

            if(format_chunk.audio_format != wav_format_pcm &&
               format_chunk.audio_format != wav_format_extensible)
            {
                *error_message = "WAV file is not uncompressed PCM";
                return false;
            }

            format.channels = format_chunk.channels;
            format.sample_rate = format_chunk.sample_rate;
            format.bits_per_sample = format_chunk.bits_per_sample;
            has_format = true;

            // Anything past the fields we read (e.g. the extensible header's
            // extra data) is of no interest.
            if(!skip_bytes(file, chunk.size - sizeof(format_chunk)))
            {
                *error_message = "Truncated WAV file";
                return false;
            }
        }
        else if(memcmp(chunk.id, "data", 4) == 0)
        {
            if(!has_format)
            {
                *error_message = "WAV file has no format chunk";
                return false;
            }

            // A truncated file can claim more data than it holds.
            const uint32_t available = file->size() - file->position();
            data_size = min(chunk.size, available);
            return true;
        }
        else if(!skip_bytes(file, chunk.size + (chunk.size % 2)))
        {
            // Chunks are padded to an even number of bytes.
            break;
        }
    }

    *error_message = "WAV file has no data chunk";
    return false;
}

static bool is_supported(const WavFormat& format, const char** error_message)
{
    if(format.bits_per_sample != 16)
    {
        *error_message = "Only 16-bit WAV files can be played";
        return false;
    }

    if(format.channels != 1 && format.channels != 2)
    {
        *error_message = "Only mono and stereo WAV files can be played";
        return false;
    }

    if(format.sample_rate < 8000 || format.sample_rate > 48000)
    {
        *error_message = "WAV sample rate must be between 8 and 48 kHz";
        return false;
    }

    return true;
}

static bool is_bare_file_name(const char* file_name)
{
    return file_name[0] != '\0' &&
           file_name[0] != '.' &&
           strlen(file_name) < max_file_name_length &&
           strchr(file_name, '/') == nullptr &&
           strchr(file_name, '\\') == nullptr;
}

static bool refill_source_block()
{
    const size_t source_bytes_per_frame = playing_format.channels * sizeof(int16_t);

    size_t to_read = min((size_t)sizeof(source_block), (size_t)data_remaining_bytes);
    to_read -= to_read % source_bytes_per_frame;
    if(to_read == 0)
    {
        return false;
    }

    size_t bytes_read = read_file(playing_file, source_block, to_read);
    bytes_read -= bytes_read % source_bytes_per_frame;
    if(bytes_read == 0)
    {
        return false;
    }

    data_remaining_bytes -= bytes_read;
    source_block_size = bytes_read;
    source_block_offset = 0;
    return true;
}

// Reads the next frame from the file and mixes it down to a single sample.
static bool read_source_sample(int16_t& sample)
{
    if(source_block_offset == source_block_size && !refill_source_block())
    {
        return false;
    }

    int16_t frame[2];
    memcpy(frame, source_block + source_block_offset, playing_format.channels * sizeof(int16_t));
    source_block_offset += playing_format.channels * sizeof(int16_t);

    sample = playing_format.channels == 2
        ? (int16_t)(((int32_t)frame[0] + frame[1]) / 2)
        : frame[0];

    return true;
}

// Resamples the file to the pipeline's sample rate. Returns how many samples
// were produced, which is short of `max_samples` only at the end of the file.
static size_t read_output_samples(int16_t* output, size_t max_samples)
{
    size_t produced = 0;

    while(produced < max_samples)
    {
        while(resample_phase >= 1.0f)
        {
            int16_t sample;
            if(!read_source_sample(sample))
            {
                return produced;
            }

            previous_sample = next_sample;
            next_sample = sample;
            resample_phase -= 1.0f;
        }

        output[produced++] = (int16_t)(
            previous_sample + (next_sample - previous_sample) * resample_phase);
        resample_phase += resample_step;
    }

    return produced;
}

static void close_playing_file()
{
    if(playing_file)
    {
        close_file(playing_file);
        playing_file = nullptr;
    }
}

bool sd_audio_start(const char* file_name, const char** error_message)
{
    if(!sd_card_is_mounted())
    {
        *error_message = "No SD card detected";
        return false;
    }

    if(!is_bare_file_name(file_name))
    {
        *error_message = "Invalid audio file name";
        return false;
    }

    char path[max_file_name_length + 32];
    snprintf(path, sizeof(path), "%s/%s", sd_audio_directory, file_name);

    sd_audio_stop();

    playing_file = open_file(path, FILE_READ);
    if(!playing_file)
    {
        *error_message = "Audio file not found on the SD card";
        return false;
    }

    if(!parse_wav_header(playing_file, playing_format, data_remaining_bytes, error_message) ||
       !is_supported(playing_format, error_message))
    {
        close_playing_file();
        return false;
    }

    source_block_size = 0;
    source_block_offset = 0;
    previous_sample = 0;
    next_sample = 0;
    resample_step = (float)playing_format.sample_rate / (float)sample_rate;
    // Enough to pull both interpolation endpoints before the first output
    // sample, so playback starts on the file's very first sample.
    resample_phase = 2.0f;

    // Drop whatever the previous source left behind before taking over.
    audio_stoped();
    audio_started();

    is_playing = true;
    is_draining = false;
    playback_finished = false;

    Serial.printf(
        "Playing %s (%u Hz, %u channel(s), %u bytes of audio)\n",
        path,
        (unsigned)playing_format.sample_rate,
        (unsigned)playing_format.channels,
        (unsigned)data_remaining_bytes);

    return true;
}

void sd_audio_stop()
{
    if(!is_playing && !is_draining)
    {
        return;
    }

    close_playing_file();
    is_playing = false;
    is_draining = false;
    data_remaining_bytes = 0;

    audio_stoped();
}

void sd_audio_service()
{
    while(is_playing && audio_buffered_bytes() < target_buffer_bytes)
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
            is_playing = false;
            is_draining = true;
        }
    }

    if(is_draining && audio_buffered_bytes() == 0)
    {
        is_draining = false;
        playback_finished = true;
        audio_stoped();

        Serial.println("SD card playback finished");
    }
}

bool sd_audio_take_playback_finished()
{
    const bool finished = playback_finished;
    playback_finished = false;
    return finished;
}
