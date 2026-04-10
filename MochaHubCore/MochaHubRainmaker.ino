/*
 * Mocha Hub Core + RainMaker Integration
 * ---------------------
 * Features: ESP RainMaker (Google Assistant), MQTT, Static IP, ArduinoOTA, Web Debug UI
 * Hardware: ESP32 + 5 Relays + 2 Buttons + DHT22
 */

#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <HTTPUpdateServer.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoOTA.h>
#include <RMaker.h>

// --- Configuration ---
const char* ssid          = "Excitel_ASURAAS";
const char* password      = "Utsaah@8769";
const char* mqtt_broker   = "192.168.1.90"; 
const char* hostName      = "mocha-hub-pro";

IPAddress local_IP(192, 168, 1, 50);
IPAddress gateway(192, 168, 1, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress primaryDNS(8, 8, 8, 8); 

// --- Pin Mapping ---
const int RELAYS[]  = {19, 18, 5, 17, 16}; 
const char* DEVICE_NAMES[] = {"Charger", "Lamp", "Outlet", "Fan", "Work"};
const int BUTTONS[] = {22, 23};            
#define DHTPIN 21
#define DHTTYPE DHT22

// --- Objects ---
WiFiClient espClient;
PubSubClient client(espClient);
WebServer server(80);
HTTPUpdateServer httpUpdater;
DHT dht(DHTPIN, DHTTYPE);

// RainMaker Devices
static Switch *my_switches[5];

// --- State Variables ---
unsigned long lastSensorUpdate = 0;
unsigned long lastMqttRetry = 0;
bool lastBtnState[] = {HIGH, HIGH};
float currentTemp = 0, currentHumi = 0;

// --- RainMaker Write Callback ---
void write_callback(Device *device, Param *param, const param_val_t val, void *priv_data, write_ctx_t *ctx) {
    int relayIdx = (int)priv_data;
    if (strcmp(param->getParamName(), "Power") == 0) {
        bool state = val.val.b;
        Serial.printf("RainMaker: %s set to %s\n", DEVICE_NAMES[relayIdx], state ? "ON" : "OFF");
        
        digitalWrite(RELAYS[relayIdx], state ? LOW : HIGH); // LOW is ON
        param->updateAndNotify(val);

        // Sync with MQTT
        if(client.connected()) {
            String topic = "room/switch/relay_" + String(relayIdx + 1) + "/state";
            client.publish(topic.c_str(), state ? "ON" : "OFF", true);
        }
    }
}

// --- Dashboard UI ---
String getDashboardHTML() {
  String ptr = "<!DOCTYPE html><html><head><title>Mocha Hub Pro</title>";
  ptr += "<meta name='viewport' content='width=device-width, initial-scale=1'><meta http-equiv='refresh' content='10'>";
  ptr += "<style>body{font-family: Arial; text-align: center; background-color: #1a1a1a; color: white;}";
  ptr += ".card{background: #2d2d2d; padding: 20px; border-radius: 15px; display: inline-block; margin: 10px; min-width: 280px; border: 1px solid #444;}";
  ptr += ".status-on{color: #00ff00;} .status-off{color: #ff4444;}";
  ptr += "hr{border: 0.5px solid #444;}</style></head><body>";
  ptr += "<h1>☕ Mocha Hub Pro</h1><p>RainMaker + MQTT Edition</p>";
  ptr += "<div class='card'><h2>Sensors</h2><p>Temp: " + String(currentTemp) + " &deg;C | Humi: " + String(currentHumi) + " %</p></div><br>";
  ptr += "<div class='card'><h2>Relays</h2><table style='width:100%'>";
  for(int i=0; i<5; i++) {
    bool state = !digitalRead(RELAYS[i]); 
    ptr += "<tr><td>" + String(DEVICE_NAMES[i]) + "</td><td class='" + (state ? "status-on":"status-off") + "'>" + (state ? "ON":"OFF") + "</td></tr>";
  }
  ptr += "</table></div><br></body></html>";
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
      
      // Sync RainMaker App
      if(my_switches[i]) {
          my_switches[i]->updateAndNotifyParam("Power", state);
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

  // WiFi Setup
  WiFi.mode(WIFI_STA);
  WiFi.config(local_IP, gateway, subnet, primaryDNS);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nWiFi Connected.");

  // RainMaker Node Setup
  Node my_node = RMaker.initNode("Mocha Hub Pro");
  
  for(int i=0; i<5; i++) {
      my_switches[i] = new Switch(DEVICE_NAMES[i], (void *)i);
      my_switches[i]->addCb(write_callback);
      my_node.addDevice(*my_switches[i]);
      // Set initial state
      my_switches[i]->updateAndNotifyParam("Power", false);
  }
  
  RMaker.start();

  ArduinoOTA.setHostname(hostName);
  ArduinoOTA.begin();
  MDNS.begin(hostName);

  httpUpdater.setup(&server);
  server.on("/", []() { server.send(200, "text/html", getDashboardHTML()); });
  server.begin();

  client.setServer(mqtt_broker, 1883);
  client.setCallback(callback);
}

void loop() {
  ArduinoOTA.handle();
  server.handleClient();
  
  // Maintain MQTT
  if (!client.connected() && (millis() - lastMqttRetry > 5000)) {
    lastMqttRetry = millis();
    if (client.connect("MochaHubClientPro")) {
      client.publish("room/status", "online", true);
      for(int i=1; i<=5; i++) client.subscribe(("room/switch/relay_" + String(i) + "/command").c_str());
    }
  }
  client.loop();

  // Physical Buttons (Syncs both MQTT and RainMaker)
  for(int i=0; i<2; i++) {
    bool currentState = digitalRead(BUTTONS[i]);
    if(currentState != lastBtnState[i]) {
      delay(30);
      if(digitalRead(BUTTONS[i]) == currentState) {
        int relayIdx = i + 1; // Maps Sw1->R2, Sw2->R3
        bool newStateIsOn = digitalRead(RELAYS[relayIdx]) == HIGH; // Flip current state
        digitalWrite(RELAYS[relayIdx], newStateIsOn ? LOW : HIGH);
        
        if(client.connected()) {
          client.publish(("room/switch/relay_" + String(relayIdx + 1) + "/state").c_str(), newStateIsOn ? "ON" : "OFF", true);
        }
        if(my_switches[relayIdx]) {
            my_switches[relayIdx]->updateAndNotifyParam("Power", newStateIsOn);
        }
        lastBtnState[i] = currentState;
      }
    }
  }

  // Sensors
  if (millis() - lastSensorUpdate > 30000) {
    float h = dht.readHumidity(), t = dht.readTemperature();
    if (!isnan(h) && !isnan(t)) {
      currentTemp = t; currentHumi = h;
      client.publish("room/sensor/temp/state", String(t).c_str(), true);
      client.publish("room/sensor/humi/state", String(h).c_str(), true);
    }
    lastSensorUpdate = millis();
  }
}
