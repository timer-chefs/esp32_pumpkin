#include "event_queue.h"

bool EventQueue::push(const Event& event_element)
{
    if(member_queue.size() < event_queue_size)
    {
        member_queue.push(event_element);
        return true;
    }
    return false;
}

const bool EventQueue::is_empty()
{
    return member_queue.empty();
}

const bool EventQueue::is_full()
{
    return member_queue.size() >= event_queue_size;
}

returned_event_t EventQueue::pop()
{
    if(member_queue.empty())
    {
        return {Event::none, false};
    }
    Event event_element = member_queue.front();
    member_queue.pop();
    return {event_element, true};
}

void EventQueue::clear()
{
    while(!member_queue.empty())
    {
        member_queue.pop();
    }
}
