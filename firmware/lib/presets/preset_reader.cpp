#include "preset_reader.h"

#include <cctype>
#include <cstring>
#include <memory>
#include <new>
#include <string>
#include <vector>

#include "device_log.h"
#include "preset_store.h"

using namespace Pumpkin::Protocol;

using Record = std::vector<std::string>;

// What presets_csv.ts falls back on for a light without a color.
static const CRGB fallback_color = CRGB(0xffa500);

static PresetInfo presets[max_auto_mode_presets];
static size_t count = 0;

static std::string trim(const std::string& text)
{
    size_t start = 0;
    size_t end = text.size();
    while(start < end && isspace(static_cast<unsigned char>(text[start])))
    {
        ++start;
    }
    while(end > start && isspace(static_cast<unsigned char>(text[end - 1])))
    {
        --end;
    }
    return text.substr(start, end - start);
}

// Splits the file into records as presets_csv.ts's readRecords() does: a
// field may be quoted, with its quotes doubled, to hold the delimiter, a
// quote or a line break, and the delimiter is a semicolon if the first line
// has one and no comma.
static std::vector<Record> read_records(const std::string& text)
{
    const std::string first_line = text.substr(0, text.find_first_of("\r\n"));
    const char delimiter = first_line.find(';') != std::string::npos &&
                                   first_line.find(',') == std::string::npos
                               ? ';'
                               : ',';

    std::vector<Record> records;
    Record fields;
    std::string field;
    bool is_quoted = false;

    const auto end_field = [&]()
    {
        fields.push_back(trim(field));
        field.clear();
    };
    const auto end_record = [&]()
    {
        end_field();
        records.push_back(std::move(fields));
        fields.clear();
    };

    for(size_t i = 0; i < text.size(); ++i)
    {
        const char character = text[i];

        if(is_quoted)
        {
            if(character != '"')
            {
                field += character;
            }
            else if(i + 1 < text.size() && text[i + 1] == '"')
            {
                field += '"';
                ++i;
            }
            else
            {
                is_quoted = false;
            }
        }
        else if(character == '"' && trim(field).empty())
        {
            is_quoted = true;
            field.clear();
        }
        else if(character == delimiter)
        {
            end_field();
        }
        else if(character == '\n' || character == '\r')
        {
            if(character == '\r' && i + 1 < text.size() && text[i + 1] == '\n')
            {
                ++i;
            }
            end_record();
        }
        else
        {
            field += character;
        }
    }

    if(!field.empty() || !fields.empty())
    {
        end_record();
    }

    return records;
}

static bool is_blank(const Record& record)
{
    for(const std::string& field : record)
    {
        if(!field.empty())
        {
            return false;
        }
    }
    return true;
}

// Reads a color written as "#rrggbb", or without the "#".
static bool parse_color(const std::string& text, CRGB& color)
{
    const size_t start = !text.empty() && text[0] == '#' ? 1 : 0;
    if(text.size() - start != 6)
    {
        return false;
    }

    for(size_t i = start; i < text.size(); ++i)
    {
        if(!isxdigit(static_cast<unsigned char>(text[i])))
        {
            return false;
        }
    }

    color = CRGB(strtoul(text.c_str() + start, nullptr, 16));
    return true;
}

// Fills in what playing a preset takes from one of the file's rows, falling
// back where presets_csv.ts does. `cell` gives a column's field, or an empty
// one for a column the file doesn't have.
template <typename Cell>
static void read_preset(const Cell& cell, PresetInfo& preset)
{
    preset = {};

    const std::string name = cell("name");
    strlcpy(preset.name, name.empty() ? "Unnamed" : name.c_str(), sizeof(preset.name));

    const std::string light = cell("light");
    if(!light.empty() && strcasecmp(light.c_str(), "none") != 0)
    {
        for(const LightEffectId effect : EnumValuesLightEffectId())
        {
            if(strcasecmp(light.c_str(), EnumNameLightEffectId(effect)) == 0)
            {
                preset.has_light = true;
                preset.light_effect = effect;
            }
        }

        if(preset.has_light && !parse_color(cell("color"), preset.color))
        {
            preset.color = fallback_color;
        }
    }

    // One too long to name a file on the card couldn't be played anyway.
    const std::string sound = cell("sound");
    if(sound.size() < sizeof(preset.sound))
    {
        strcpy(preset.sound, sound.c_str());
    }
}

// Reads the whole file into `text`, returning what went wrong, if anything.
static const char* read_file_text(std::string& text)
{
    File* file = preset_store_open();
    if(!file)
    {
        return sd_card_is_mounted()
            ? "There is no presets.csv on the SD card yet: save the presets "
              "in the editor to make one"
            : "No SD card detected";
    }

    const size_t size = file->size();
    if(size > max_presets_file_size)
    {
        close_file(file);
        return "presets.csv is too big for auto mode to read";
    }

    std::unique_ptr<uint8_t[]> contents(new(std::nothrow) uint8_t[size]);
    const bool is_read =
        contents && read_file(file, contents.get(), size) == size;
    close_file(file);
    if(!is_read)
    {
        return "Could not read presets.csv";
    }

    text.assign(reinterpret_cast<const char*>(contents.get()), size);

    // Written first so that Excel reads the file as UTF-8.
    static const char byte_order_mark[] = "\xEF\xBB\xBF";
    if(text.compare(0, 3, byte_order_mark) == 0)
    {
        text.erase(0, 3);
    }

    return nullptr;
}

static const char* read_presets()
{
    std::string text;
    const char* problem = read_file_text(text);
    if(problem)
    {
        return problem;
    }

    std::vector<Record> records = read_records(text);
    text.clear();

    size_t row = 0;
    while(row < records.size() && is_blank(records[row]))
    {
        ++row;
    }
    if(row == records.size())
    {
        return nullptr;
    }

    // The first row names the columns, which can come in any order.
    Record columns = records[row++];
    for(std::string& column : columns)
    {
        for(char& character : column)
        {
            character = tolower(static_cast<unsigned char>(character));
        }
    }

    bool has_names = false;
    for(const std::string& column : columns)
    {
        has_names = has_names || column == "name";
    }
    if(!has_names)
    {
        return "presets.csv doesn't name its columns on its first line";
    }

    for(; row < records.size(); ++row)
    {
        const Record& record = records[row];
        if(is_blank(record))
        {
            continue;
        }

        if(count == max_auto_mode_presets)
        {
            device_log.printf(
                "Auto mode plays only the first %u presets\n",
                (unsigned)max_auto_mode_presets);
            break;
        }

        const auto cell = [&](const char* column) -> std::string
        {
            for(size_t i = 0; i < columns.size() && i < record.size(); ++i)
            {
                if(columns[i] == column)
                {
                    return record[i];
                }
            }
            return "";
        };
        read_preset(cell, presets[count++]);
    }

    return nullptr;
}

bool presets_load(const char** error_message)
{
    count = 0;
    *error_message = read_presets();
    if(*error_message)
    {
        count = 0;
    }
    return *error_message == nullptr;
}

size_t presets_count()
{
    return count;
}

const PresetInfo& presets_get(size_t index)
{
    return presets[index];
}
