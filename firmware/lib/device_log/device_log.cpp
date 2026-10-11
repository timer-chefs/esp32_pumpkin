#include "device_log.h"

#include <algorithm>

DeviceLog device_log;

size_t DeviceLog::write(uint8_t byte)
{
    return write(&byte, 1);
}

size_t DeviceLog::write(const uint8_t* buffer, size_t size)
{
    Serial.write(buffer, size);

    for(size_t i = 0; i < size; ++i)
    {
        history[(written + i) % device_log_history_size] = buffer[i];
    }
    written += size;
    return size;
}

uint32_t DeviceLog::end() const
{
    return written;
}

size_t DeviceLog::read_lines(uint32_t& cursor, char* text, size_t capacity) const
{
    const uint32_t oldest =
        written > device_log_history_size ? written - device_log_history_size : 0;
    if(cursor < oldest)
    {
        // The start of the line at `oldest` has been written over, so the
        // first whole line is the one after it.
        cursor = oldest;
        while(cursor < written && at(cursor++) != '\n')
        {
        }
    }

    const size_t available = std::min<size_t>(written - cursor, capacity);
    size_t length = available;
    while(length > 0 && at(cursor + length - 1) != '\n')
    {
        --length;
    }
    if(length == 0 && available == capacity)
    {
        length = capacity;
    }

    for(size_t i = 0; i < length; ++i)
    {
        text[i] = at(cursor + i);
    }
    cursor += length;
    return length;
}

char DeviceLog::at(uint32_t position) const
{
    return history[position % device_log_history_size];
}
