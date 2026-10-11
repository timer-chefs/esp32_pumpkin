#ifndef DEVICE_LOG_H
#define DEVICE_LOG_H

#include <Arduino.h>

#include "config.h"

// What the device prints about itself, for the serial monitor and the web
// page alike. Printing to it writes to the serial port as before, and keeps
// a copy in memory that the web interface streams to its clients from
// loop() -- so a print never waits on the network, and a client that
// connects later still sees what came before it.
//
// Like the rest of the firmware, it is only used from loop()'s task.
class DeviceLog : public Print
{
public:
    size_t write(uint8_t byte) override;
    size_t write(const uint8_t* buffer, size_t size) override;

    // How many bytes have been logged since start-up, which is also where
    // the next one will be.
    uint32_t end() const;

    // Copies whole lines from `cursor` on into `text`, as many as fit in
    // `capacity` bytes, and moves `cursor` past them. Returns how many
    // bytes it copied, so they start at `cursor` minus that. A line waits
    // until it has ended, unless it is too long to ever fit, in which case
    // it comes in pieces. A cursor the history no longer reaches back to
    // first moves up to the oldest whole line still kept.
    size_t read_lines(uint32_t& cursor, char* text, size_t capacity) const;

private:
    char at(uint32_t position) const;

    // The last device_log_history_size bytes logged, round and round.
    char history[device_log_history_size];
    uint32_t written = 0;
};

extern DeviceLog device_log;

#endif //DEVICE_LOG_H
