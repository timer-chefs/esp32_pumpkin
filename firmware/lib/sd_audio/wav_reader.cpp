#include "wav_reader.h"

#include <cstring>

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

static bool read_exact(File* file, void* destination, size_t size)
{
    return read_file(file, static_cast<uint8_t*>(destination), size) == size;
}

static bool skip_bytes(File* file, uint32_t size)
{
    return file->seek(file->position() + size);
}

static bool parse_header(File* file, WavInfo& info, const char** error_message)
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

            info.channels = format_chunk.channels;
            info.sample_rate = format_chunk.sample_rate;
            info.bits_per_sample = format_chunk.bits_per_sample;
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

            info.data_start = file->position();
            // A truncated file can claim more data than it holds.
            info.data_size = min(chunk.size, (uint32_t)(file->size() - info.data_start));
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

static bool is_supported(const WavInfo& info, const char** error_message)
{
    if(info.bits_per_sample != 16)
    {
        *error_message = "Only 16-bit WAV files can be played";
        return false;
    }

    if(info.channels != 1 && info.channels != 2)
    {
        *error_message = "Only mono and stereo WAV files can be played";
        return false;
    }

    if(info.sample_rate < 8000 || info.sample_rate > 48000)
    {
        *error_message = "WAV sample rate must be between 8 and 48 kHz";
        return false;
    }

    // The reader hands out sector-aligned blocks and expects whole frames
    // inside them, which holds as long as the audio starts on a frame.
    if(info.data_start % (info.channels * sizeof(int16_t)) != 0)
    {
        *error_message = "WAV audio does not start on a sample boundary";
        return false;
    }

    return true;
}

bool read_wav_info(File* file, WavInfo& info, const char** error_message)
{
    return parse_header(file, info, error_message) &&
           is_supported(info, error_message);
}
