/*
 * EcoWatt Main Hub / Control Board
 * --------------------------------
 * Role: ESP-NOW Receiver + MQTT Bridge (Board B)
 */

#include <esp_now.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <esp_wifi.h>

// --- Configuration ---
const char* ssid          = "Summer-1";
const char* password      = "Summer@2025";
const char* mqtt_broker   = "192.168.1.90"; 

// --- Pin Mapping (Must match your physical relays) ---
const int RELAYS[] = {19, 18, 5, 17, 16}; 

typedef struct struct_message {
  float roomAmps[6];
  float totalKW;
  bool isTripping;
  char alertMsg[50];
  uint32_t uptime;
} struct_message;

struct_message incomingData;
WiFiClient espClient;
PubSubClient client(espClient);

unsigned long lastSensorUpdate = 0;
unsigned long lastHeartbeat = 0;

// --- MQTT Callback (NEW: Handles Relay Commands) ---
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (int i = 0; i < length; i++) msg += (char)payload[i];
  Serial.printf("MQTT Command: %s -> %s\n", topic, msg.c_str());

  for (int i = 0; i < 5; i++) {
    String target = "room/switch/relay_" + String(i + 1) + "/command";
    if (String(topic) == target) {
      bool state = (msg == "ON");
      digitalWrite(RELAYS[i], state ? LOW : HIGH); // Low Level Trigger
      client.publish(("room/switch/relay_" + String(i + 1) + "/state").c_str(), state ? "ON" : "OFF", true);
    }
  }
}

void publishStats() {
  if (!client.connected()) return;
  client.publish("room/stats/total_power", String(incomingData.totalKW).c_str(), true);
  
  String json = "{";
  for(int i=0; i<6; i++) {
    json += "\"room" + String(i+1) + "\":" + String(incomingData.roomAmps[i]);
    if(i<5) json += ",";
  }
  json += "}";
  client.publish("room/stats/rooms", json.c_str(), true);

  if (incomingData.isTripping) {
    client.publish("room/stats/alert", incomingData.alertMsg, true);
    client.publish("room/notify", incomingData.alertMsg);
  }
}

void OnDataRecv(const esp_now_recv_info *info, const uint8_t *incoming, int len) {
  memcpy(&incomingData, incoming, sizeof(incomingData));
  lastSensorUpdate = millis();
  
  if (client.connected()) {
    client.publish("room/db/status", "online", true);
    client.publish("room/db/uptime", String(incomingData.uptime).c_str(), true);
  }
  publishStats();
}

void setup() {
  Serial.begin(115200);
  
  for(int i=0; i<5; i++) {
    pinMode(RELAYS[i], OUTPUT);
    digitalWrite(RELAYS[i], HIGH); // Default OFF
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  
  // CRITICAL: Force the WiFi channel to stay fixed for ESP-NOW
  int channel = WiFi.channel();
  esp_wifi_set_promiscuous(true);
  esp_wifi_set_channel(channel, WIFI_SECOND_CHAN_NONE);
  esp_wifi_set_promiscuous(false);

  client.setServer(mqtt_broker, 1883);
  client.setCallback(mqttCallback);

  if (esp_now_init() != ESP_OK) {
    Serial.println("Error initializing ESP-NOW");
    return;
  }
  esp_now_register_recv_cb(OnDataRecv);
}

void loop() {
  if (!client.connected()) {
    if (client.connect("EcoWattHubClient")) {
      client.publish("room/hub/status", "online", true);
      for(int i=1; i<=5; i++) {
        client.subscribe(("room/switch/relay_" + String(i) + "/command").c_str());
      }
    }
  }
  client.loop();

  if (millis() - lastHeartbeat > 5000) {
    if (client.connected()) {
      client.publish("room/hub/heartbeat", String(millis()/1000).c_str());
      if (millis() - lastSensorUpdate > 15000 && lastSensorUpdate != 0) {
        client.publish("room/db/status", "offline", true);
      }
    }
    lastHeartbeat = millis();
  }
}
