/*
 * EcoWatt Distribution Box (DB) Board
 * -----------------------------------
 * Role: ESP-NOW Sender (Board A)
 */

#include <esp_now.h>
#include <WiFi.h>
#include <esp_wifi.h>

// --- Configuration ---
uint8_t broadcastAddress[] = {0xD4, 0x8A, 0xFC, 0xCC, 0x97, 0xAC}; // Main Hub MAC
const char* targetSSID = "Summer-1"; // Hub's WiFi network

#define NUM_ROOMS 6
const int SENSOR_PINS[] = {34, 35, 32, 33, 25, 26}; 

typedef struct struct_message {
  float roomAmps[NUM_ROOMS];
  float totalKW;
  bool isTripping;
  char alertMsg[50];
  uint32_t uptime;
} struct_message;

struct_message myData;
esp_now_peer_info_t peerInfo;

// Function to find the WiFi channel of the Access Point
int32_t getWiFiChannel(const char *ssid) {
  if (int32_t n = WiFi.scanNetworks()) {
    for (uint8_t i = 0; i < n; i++) {
      if (!strcmp(ssid, WiFi.SSID(i).c_str())) return WiFi.channel(i);
    }
  }
  return 1; // Default to 1
}

float readCurrent(int pin) {
  int raw = analogRead(pin);
  float voltage = raw * (3.3 / 4095.0);
  float amps = (voltage - 1.65) / 0.066; 
  if (amps < 0.15) amps = 0;
  return abs(amps);
}

void OnDataSent(const wifi_tx_info_t *info, esp_now_send_status_t status) {
  // Optional: Serial.println(status == ESP_NOW_SEND_SUCCESS ? "OK" : "FAIL");
}

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);

  // CRITICAL: ESP-NOW only works if both devices are on the same channel
  int32_t channel = getWiFiChannel(targetSSID);
  esp_wifi_set_promiscuous(true);
  esp_wifi_set_channel(channel, WIFI_SECOND_CHAN_NONE);
  esp_wifi_set_promiscuous(false);
  Serial.printf("Locked to Channel: %d\n", channel);

  if (esp_now_init() != ESP_OK) return;
  esp_now_register_send_cb(OnDataSent);
  
  memcpy(peerInfo.peer_addr, broadcastAddress, 6);
  peerInfo.channel = channel;  
  peerInfo.encrypt = false;
  esp_now_add_peer(&peerInfo);
}

void loop() {
  float currentTotalAmps = 0;
  myData.isTripping = false;
  strcpy(myData.alertMsg, "Normal");

  for (int i = 0; i < NUM_ROOMS; i++) {
    myData.roomAmps[i] = readCurrent(SENSOR_PINS[i]);
    currentTotalAmps += myData.roomAmps[i];
    if (myData.roomAmps[i] > 16.0) { // Limit
      myData.isTripping = true;
      snprintf(myData.alertMsg, 50, "Room %d Overload", i+1);
    }
  }

  myData.totalKW = (currentTotalAmps * 230.0) / 1000.0;
  myData.uptime = millis() / 1000;

  esp_now_send(broadcastAddress, (uint8_t *) &myData, sizeof(myData));
  delay(1000); // Send faster for "real-time" feel
}
