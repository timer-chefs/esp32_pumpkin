#ifndef EVENTS_H
#define EVENTS_H

enum class CommandType
{
    StartAudioStream,
    StopAudioStream,

    SetEffect,

    PlayShow,
    PauseShow,
    ResumeShow,
    StopShow,

    StartMicrophone,
    StopMicrophone,

    Ping
};

#endif //EVENTS_H
