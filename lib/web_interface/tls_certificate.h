#ifndef TLS_CERTIFICATE_H
#define TLS_CERTIFICATE_H

#include <Arduino.h>

bool tls_certificate_load(String& certificate, String& private_key);

#endif // TLS_CERTIFICATE_H