# 🚀 EcoWatt Hackathon: ESP-NOW Distribution System

This branch of the project splits the hardware into two specialized units to improve reliability, reduce wiring complexity, and implement **MCB Protection**.

## 🏗️ Architecture
1.  **DB Board (Distribution Box):** Sits near your MCBs. Measures current for 6 rooms and checks for overloading. Sends data via **ESP-NOW** (no WiFi router needed for this link).
2.  **Main Hub (Control Board):** Receives the fast ESP-NOW packets and bridges them to the **MQTT Broker** so the Dashboard can show live stats.

## 📁 New Components
- `EcoWatt_ESPNow/DB_Board.ino`: Flash this to the ESP32 in your Distribution Box.
- `EcoWatt_ESPNow/MainHub_Board.ino`: Flash this to your Main Mocha Hub ESP32.
- `new tryyyy/index_live.html`: The new "Live" Dashboard that connects to real board data.

## 🛠️ Setup Instructions

### 1. Identify MAC Addresses
To use ESP-NOW, the DB Board needs the MAC address of the Main Hub.
1. Flash `MainHub_Board.ino` first.
2. Open Serial Monitor (115200) and copy the **MAC Address** printed at startup.
3. Open `DB_Board.ino`, find `broadcastAddress[]`, and replace the values with your MAC address.

### 2. Hardware Mapping (DB Board)
| Room | Pin (ADC) | MCB Limit |
| :--- | :--- | :--- |
| Living | GPIO 34 | 16A |
| Kitchen| GPIO 35 | 16A |
| Master | GPIO 32 | 10A |
| Office | GPIO 33 | 10A |
| Laundry| GPIO 25 | 6A |
| Garage | GPIO 26 | 6A |

### 3. Dashboard Integration
Use the new `new tryyyy/index_live.html` for your demo. It will:
- Smoothly transition the Gauge when `room/stats/total_power` changes.
- Update Room Bar Charts when `room/stats/rooms` (JSON) is received.
- Show "MCB Overload" alerts in the Notification panel.

## 🛡️ MCB Protection Logic
The DB Board automatically calculates if any room exceeds its limit or if the total house draw is too high (>32A). If it detects an overload, it immediately sends an alert packet, which the Main Hub then pushes to the UI as a toast notification.
