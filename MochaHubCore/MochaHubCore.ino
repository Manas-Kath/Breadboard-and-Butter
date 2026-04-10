/*
 * Mocha Hub Core v1.3.5
 * ---------------------
 * Features: Static IP, MQTT (Non-blocking), ArduinoOTA, Web Debug UI
 * Hardware: ESP32 + 5 Relays + 2 Buttons + DHT22
 */

#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <HTTPUpdateServer.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoOTA.h>

// --- Configuration ---
const char* ssid          = "Excitel_ASURAAS";
const char* password      = "Utsaah@8769";
const char* mqtt_broker   = "192.168.1.90"; 
const char* hostName      = "mocha-hub";

IPAddress local_IP(192, 168, 1, 50);
IPAddress gateway(192, 168, 1, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress primaryDNS(8, 8, 8, 8); 

// --- Pin Mapping ---
const int RELAYS[]  = {19, 18, 5, 17, 16}; // R1 to R5
const int BUTTONS[] = {22, 23};            // Sw1, Sw2
#define DHTPIN 21
#define DHTTYPE DHT22

// --- Objects ---
WiFiClient espClient;
PubSubClient client(espClient);
WebServer server(80);
HTTPUpdateServer httpUpdater;
DHT dht(DHTPIN, DHTTYPE);

// --- State Variables ---
unsigned long lastSensorUpdate = 0;
unsigned long lastMqttRetry = 0;
bool lastBtnState[] = {HIGH, HIGH};
float currentTemp = 0, currentHumi = 0;

// --- UI Logic ---
String getDashboardHTML() {
  String ptr = "<!DOCTYPE html><html><head><title>Mocha Hub Debug</title>";
  ptr += "<meta name='viewport' content='width=device-width, initial-scale=1'><meta http-equiv='refresh' content='10'>";
  ptr += "<style>body{font-family: Arial; text-align: center; background-color: #1a1a1a; color: white;}";
  ptr += ".card{background: #2d2d2d; padding: 20px; border-radius: 15px; display: inline-block; margin: 10px; min-width: 280px; border: 1px solid #444;}";
  ptr += ".status-on{color: #00ff00;} .status-off{color: #ff4444;}";
  ptr += "hr{border: 0.5px solid #444;}</style></head><body>";
  ptr += "<h1>☕ Mocha Hub v1.3.5</h1>";
  
  // Sensor Card
  ptr += "<div class='card'><h2>Sensors</h2><p>Temperature: " + String(currentTemp) + " &deg;C</p>";
  ptr += "<p>Humidity: " + String(currentHumi) + " %</p></div><br>";

  // Relay Card
  ptr += "<div class='card'><h2>Relay States</h2><table style='width:100%'>";
  for(int i=0; i<5; i++) {
    bool state = !digitalRead(RELAYS[i]); 
    ptr += "<tr><td>Relay " + String(i+1) + "</td><td class='" + (state ? "status-on":"status-off") + "'>" + (state ? "ON":"OFF") + "</td></tr>";
  }
  ptr += "</table></div><br>";

  // System Card
  ptr += "<div class='card'><h2>System Info</h2>";
  ptr += "<p>IP: " + WiFi.localIP().toString() + "</p>";
  ptr += "<p>MQTT: " + String(client.connected() ? "CONNECTED" : "DISCONNECTED") + "</p>";
  ptr += "<hr><a href='/update' style='color: #3498db;'>Web Firmware Update</a>";
  ptr += "<p style='font-size: 0.8em; color: #888;'>ArduinoOTA Enabled (Network Port)</p></div>";
  ptr += "</body></html>";
  return ptr;
}

// --- MQTT Callback ---
void callback(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (int i = 0; i < length; i++) msg += (char)payload[i];
  
  for (int i = 0; i < 5; i++) {
    String target = "room/switch/relay_" + String(i + 1) + "/command";
    if (String(topic) == target) {
      bool state = (msg == "ON");
      digitalWrite(RELAYS[i], state ? LOW : HIGH); 
      client.publish(("room/switch/relay_" + String(i + 1) + "/state").c_str(), state ? "ON" : "OFF", true);
    }
  }
}

// --- Setup Functions ---
void setupOTA() {
  ArduinoOTA.setHostname(hostName);
  ArduinoOTA.onStart([]() { Serial.println("OTA Start"); });
  ArduinoOTA.onEnd([]() { Serial.println("\nOTA End"); });
  ArduinoOTA.begin();
}

void setupWiFi() {
  WiFi.mode(WIFI_STA);
  if (!WiFi.config(local_IP, gateway, subnet, primaryDNS)) {
    Serial.println("Static IP Failed to Configure");
  }
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nWiFi Connected. IP: " + WiFi.localIP().toString());
}

void maintainMqtt() {
  if (!client.connected() && (millis() - lastMqttRetry > 5000)) {
    lastMqttRetry = millis();
    if (client.connect("MochaHubClient")) {
      client.publish("room/status", "online", true);
      for(int i=1; i<=5; i++) {
        client.subscribe(("room/switch/relay_" + String(i) + "/command").c_str());
      }
    }
  }
}

void setup() {
  Serial.begin(115200);
  
  for (int i = 0; i < 5; i++) {
    pinMode(RELAYS[i], OUTPUT);
    digitalWrite(RELAYS[i], HIGH);
  }
  for (int i = 0; i < 2; i++) pinMode(BUTTONS[i], INPUT_PULLUP);
  
  dht.begin();
  setupWiFi();
  setupOTA();
  MDNS.begin(hostName);

  httpUpdater.setup(&server);
  server.on("/", []() { server.send(200, "text/html", getDashboardHTML()); });
  server.begin();

  client.setServer(mqtt_broker, 1883);
  client.setCallback(callback);
}

void loop() {
  ArduinoOTA.handle(); // Check for incoming code updates
  server.handleClient();
  maintainMqtt();
  client.loop();

  // Physical Button Logic
  for(int i=0; i<2; i++) {
    bool currentState = digitalRead(BUTTONS[i]);
    if(currentState != lastBtnState[i]) {
      delay(30); // Debounce
      if(digitalRead(BUTTONS[i]) == currentState) {
        int relayIdx = i + 1; // Sw1->R2, Sw2->R3
        bool newRelayState = !digitalRead(RELAYS[relayIdx]);
        digitalWrite(RELAYS[relayIdx], newRelayState);
        
        if(client.connected()) {
          client.publish(("room/switch/relay_" + String(relayIdx + 1) + "/state").c_str(), 
                        (newRelayState == LOW ? "ON" : "OFF"), true);
        }
        lastBtnState[i] = currentState;
      }
    }
  }

  // Sensor Loop (Every 30s)
  if (millis() - lastSensorUpdate > 30000) {
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    if (!isnan(h) && !isnan(t)) {
      currentTemp = t; currentHumi = h;
      client.publish("room/sensor/temp/state", String(t).c_str(), true);
      client.publish("room/sensor/humi/state", String(h).c_str(), true);
    }
    lastSensorUpdate = millis();
  }
}