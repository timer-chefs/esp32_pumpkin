#include "tls_certificate.h"

#include "config.h"

#include <LittleFS.h>
#include <WiFi.h>
#include <mbedtls/ctr_drbg.h>
#include <mbedtls/ecp.h>
#include <mbedtls/entropy.h>
#include <mbedtls/oid.h>
#include <mbedtls/pk.h>
#include <mbedtls/x509_crt.h>
#include <vector>

static constexpr const char* certificate_path = "/tls-certificate.pem";
static constexpr const char* private_key_path = "/tls-private-key.pem";

static bool read_file(const char* path, String& contents)
{
    File file = LittleFS.open(path, "r");
    if(!file)
    {
        return false;
    }

    contents = file.readString();
    file.close();
    return !contents.isEmpty();
}

static bool write_file(const char* path, const String& contents)
{
    File file = LittleFS.open(path, "w");
    if(!file)
    {
        return false;
    }

    const size_t bytes_written = file.print(contents);
    file.close();
    return bytes_written == contents.length();
}

static int set_subject_alternative_names(mbedtls_x509write_cert& certificate)
{
    const String hostname = String(mdns_hostname) + ".local";
    const IPAddress ip_address = WiFi.localIP();
    std::vector<unsigned char> names;
    names.reserve(hostname.length() + 10);
    names.push_back(0x30);
    names.push_back(static_cast<unsigned char>(hostname.length() + 8));
    names.push_back(0x82);
    names.push_back(static_cast<unsigned char>(hostname.length()));
    names.insert(names.end(), hostname.begin(), hostname.end());
    names.push_back(0x87);
    names.push_back(4);
    for(size_t index = 0; index < 4; index++)
    {
        names.push_back(ip_address[index]);
    }

    return mbedtls_x509write_crt_set_extension(
        &certificate,
        MBEDTLS_OID_SUBJECT_ALT_NAME,
        MBEDTLS_OID_SIZE(MBEDTLS_OID_SUBJECT_ALT_NAME),
        0,
        names.data(),
        names.size());
}

static bool generate_certificate(String& certificate_pem, String& private_key_pem)
{
    mbedtls_entropy_context entropy;
    mbedtls_ctr_drbg_context random;
    mbedtls_pk_context key;
    mbedtls_x509write_cert certificate;
    mbedtls_mpi serial;
    mbedtls_entropy_init(&entropy);
    mbedtls_ctr_drbg_init(&random);
    mbedtls_pk_init(&key);
    mbedtls_x509write_crt_init(&certificate);
    mbedtls_mpi_init(&serial);

    bool success = false;
    do
    {
        static constexpr unsigned char personalization[] = "pumpkin-tls-certificate";
        if(mbedtls_ctr_drbg_seed(
            &random,
            mbedtls_entropy_func,
            &entropy,
            personalization,
            sizeof(personalization) - 1) != 0)
        {
            break;
        }

        if(mbedtls_pk_setup(&key, mbedtls_pk_info_from_type(MBEDTLS_PK_ECKEY)) != 0 ||
           mbedtls_ecp_gen_key(
               MBEDTLS_ECP_DP_SECP256R1,
               mbedtls_pk_ec(key),
               mbedtls_ctr_drbg_random,
               &random) != 0)
        {
            break;
        }

        unsigned char serial_bytes[16];
        if(mbedtls_ctr_drbg_random(&random, serial_bytes, sizeof(serial_bytes)) != 0 ||
           mbedtls_mpi_read_binary(&serial, serial_bytes, sizeof(serial_bytes)) != 0)
        {
            break;
        }

        const String distinguished_name = String("CN=") + mdns_hostname + ".local,O=Pumpkin";
        mbedtls_x509write_crt_set_version(&certificate, MBEDTLS_X509_CRT_VERSION_3);
        mbedtls_x509write_crt_set_md_alg(&certificate, MBEDTLS_MD_SHA256);
        mbedtls_x509write_crt_set_subject_key(&certificate, &key);
        mbedtls_x509write_crt_set_issuer_key(&certificate, &key);

        if(mbedtls_x509write_crt_set_serial(&certificate, &serial) != 0 ||
           mbedtls_x509write_crt_set_subject_name(&certificate, distinguished_name.c_str()) != 0 ||
           mbedtls_x509write_crt_set_issuer_name(&certificate, distinguished_name.c_str()) != 0 ||
           mbedtls_x509write_crt_set_validity(
               &certificate,
               "20240101000000",
               "20491231235959") != 0 ||
           mbedtls_x509write_crt_set_basic_constraints(&certificate, 0, -1) != 0 ||
           mbedtls_x509write_crt_set_key_usage(
               &certificate,
               MBEDTLS_X509_KU_DIGITAL_SIGNATURE) != 0 ||
           set_subject_alternative_names(certificate) != 0)
        {
            break;
        }

        std::vector<unsigned char> certificate_buffer(2048);
        std::vector<unsigned char> private_key_buffer(1024);
        if(mbedtls_x509write_crt_pem(
               &certificate,
               certificate_buffer.data(),
               certificate_buffer.size(),
               mbedtls_ctr_drbg_random,
               &random) != 0 ||
           mbedtls_pk_write_key_pem(
               &key,
               private_key_buffer.data(),
               private_key_buffer.size()) != 0)
        {
            break;
        }

        certificate_pem = reinterpret_cast<const char*>(certificate_buffer.data());
        private_key_pem = reinterpret_cast<const char*>(private_key_buffer.data());
        success = true;
    } while(false);

    mbedtls_mpi_free(&serial);
    mbedtls_x509write_crt_free(&certificate);
    mbedtls_pk_free(&key);
    mbedtls_ctr_drbg_free(&random);
    mbedtls_entropy_free(&entropy);
    return success;
}

bool tls_certificate_load(String& certificate, String& private_key)
{
    if(read_file(certificate_path, certificate) &&
       read_file(private_key_path, private_key))
    {
        return true;
    }

    LittleFS.remove(certificate_path);
    LittleFS.remove(private_key_path);

    Serial.println("Generating self-signed TLS certificate");
    if(!generate_certificate(certificate, private_key) ||
       !write_file(certificate_path, certificate) ||
       !write_file(private_key_path, private_key))
    {
        Serial.println("TLS certificate generation failed");
        return false;
    }

    Serial.println("Self-signed TLS certificate generated");
    return true;
}