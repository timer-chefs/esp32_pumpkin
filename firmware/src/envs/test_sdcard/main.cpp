#include <Arduino.h>
#include "sd_card.h"
#include "config.h"

void setup()
{
  Serial.begin(baud_rate);
  delay(1000);
  
  Serial.println("\n\n=== SD Card Module Test ===\n");
  
  // Initialize SD card
  sd_card_init();
  
  // Test 1: Write file
  Serial.println("\n--- Test 1: Write File ---");
  File* file = open_file("/test.txt", FILE_WRITE);
  if (file) {
    const uint8_t data[] = "Hello from SD Card Module!";
    size_t written = write_file(file, data, sizeof(data) - 1);
    Serial.printf("Wrote %u bytes\n", written);
    close_file(file);
  }
  
  // Test 2: Check if file exists
  Serial.println("\n--- Test 2: File Exists ---");
  if (file_exists("/test.txt")) {
    Serial.println("File exists: /test.txt");
  } else {
    Serial.println("File NOT found: /test.txt");
  }
  
  // Test 3: Get file size
  Serial.println("\n--- Test 3: Get File Size ---");
  uint32_t size = get_file_size("/test.txt");
  Serial.printf("File size: %lu bytes\n", size);
  
  // Test 4: Read file
  Serial.println("\n--- Test 4: Read File ---");
  file = open_file("/test.txt", FILE_READ);
  if (file) {
    uint8_t buffer[256] = {0};
    size_t bytes_read = read_file(file, buffer, sizeof(buffer));
    Serial.printf("Read %u bytes: ", bytes_read);
    for (size_t i = 0; i < bytes_read; i++) {
      Serial.write(buffer[i]);
    }
    Serial.println();
    close_file(file);
  }
  
  // Test 5: Rename file
  Serial.println("\n--- Test 5: Rename File ---");
  if (rename_file("/test.txt", "/renamed.txt")) {
    Serial.println("File renamed successfully");
  } else {
    Serial.println("Rename failed");
  }
  
  // Test 6: Verify renamed file exists
  Serial.println("\n--- Test 6: Verify Renamed File ---");
  if (file_exists("/renamed.txt")) {
    Serial.println("Renamed file exists: /renamed.txt");
  }
  if (!file_exists("/test.txt")) {
    Serial.println("Original file no longer exists: /test.txt");
  }
  
  // Test 7: Delete file
  Serial.println("\n--- Test 7: Delete File ---");
  if (delete_file("/renamed.txt")) {
    Serial.println("File deleted successfully");
  } else {
    Serial.println("Delete failed");
  }
  
  // Test 8: Verify deletion
  Serial.println("\n--- Test 8: Verify Deletion ---");
  if (!file_exists("/renamed.txt")) {
    Serial.println("File successfully removed: /renamed.txt");
  }
  
  Serial.println("\n=== All Tests Complete ===\n");
}

void loop()
{
  delay(1000);
}
