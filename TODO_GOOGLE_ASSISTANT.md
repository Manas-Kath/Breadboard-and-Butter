# TODO: Google Assistant Integration (Mocha Hub)

## 🎯 Objective
Enable voice control ("Hey Google, turn on...") for 5 relays while maintaining the MQTT Dashboard sync.

## 🛠 Status & Progress
- **Current Firmware:** `MochaHubCore.ino` (v1.3.5) - Local MQTT only.
- **New Firmware Ready:** `MochaHubRainmaker.ino` - Integrated with ESP RainMaker.
- **Library Requirement:** ESP32 Board Package 2.0.3+ (includes RainMaker).
- **IDE Settings:** 
  - Board: `ESP32 Dev Module`
  - Partition Scheme: `RainMaker`
  - Core Debug Level: `Info`

## ⚠️ Critical Hardware Constraint (Postponed)
- **First-time Flash:** MUST be done via **USB Cable**. 
- **Reason:** Changing the partition scheme to `RainMaker` rewrites the memory map, which cannot be done via ArduinoOTA.
- **Future Updates:** Once the USB flash is done with the RainMaker partition, OTA will work again for future code changes.

## 🚀 Execution Steps (When ready)
1. **Flash:** Plug ESP32 into USB and upload `MochaHubRainmaker.ino`.
2. **Provision:** 
   - Open Serial Monitor (115200).
   - Find the RainMaker QR URL in the logs.
   - Scan with the **ESP RainMaker App** (iOS/Android).
3. **Link:** In the Google Home App, add "Works with Google" -> Search for **ESP RainMaker**.
4. **Sync:** Ensure `scheduler.js` is running to handle Dashboard updates (the new firmware automatically publishes state changes back to MQTT).

## 💡 Alternative Path (The "No-USB" Hack)
If the ESP32 remains inaccessible via USB, use the **SinricPro Multi-Switch** method:
- **How:** Create a single "Multi-Switch" device in SinricPro (stays free).
- **Logic:** Implement the bridge in `scheduler.js` (Server side).
- **Benefit:** No firmware changes or USB required.

---
### 🎵 Note on Spotify Sync
- **Status:** Integrated but unreliable (tempo fetching from Spotify API is inconsistent).
- **Current Code:** `scheduler.js` and `index_uiaa.html` contain high-precision phase-alignment logic, but often defaults to 120 BPM if Spotify data is missing.
- **Next Step:** If revisited, look into `libspotify` or direct Web Player metadata if possible.
