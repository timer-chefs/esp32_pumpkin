#ifndef EVENT_QUEUE_H
#define EVENT_QUEUE_H

#include <Arduino.h>
#include <queue>
#include "../events.h"
#include "config.h"

struct returned_event_t
{
    Event event;
    bool is_valid;
};

class EventQueue
{
public:
    bool push(const Event& event_element);
    const bool is_empty();
    const bool is_full();
    returned_event_t pop();
    void clear();
    
private:
    static const size_t event_queue_size =
        max_event_queue_size;
    std::queue<Event> member_queue;
};


#endif //EVENT_QUEUE_H
