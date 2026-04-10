# 🏠 Home Server Context: Bunty Smart Hub - Cozy Deck (v5.8.0)

This document serves as the primary source of truth for the Bunty Smart Hub ecosystem.

## 📡 Network Architecture
| Component | Local IP | Tailscale IP | Role |
| :--- | :--- | :--- | :--- |
| **Mi Pad Mocha** | `192.168.1.90` | `100.125.241.104` | Central MQTT Broker (v1883) |
| **Nurpur Server** | - | `100.85.3.45` | Web & Logic Host (v8080), Docker Host |
| **Mocha Hub Core**| `192.168.1.50` | - | ESP32 Hardware Controller |
| **Ryzen 5 (PC)** | - | - | Music Vibe Engine (Heavy Processing) |

---

## 🛠️ System Components

### 1. Mocha Hub Core (ESP32 Firmware)
*   **Version:** 1.3.5
*   **Hardware:** ESP32 DevKit
*   **Logic:** Pure Arduino C++ (replaced ESPHome).
*   **Mapping:** 
    *   **Relays:** GPIO 19, 18, 5, 17, 16 (Inv logic)
    *   **Buttons:** GPIO 22, 23 (Physical wall switches)
    *   **Sensor:** DHT22 on GPIO 21 (Temp/Humidity)
*   **Update:** OTA available at `http://192.168.1.50/update`

### 2. Nurpur Pro Scheduler (Logic Layer)
*   **Tech:** Node.js, MQTT, Docker
*   **Functions:**
    *   **Spotify Bridge:** Polls currently playing track, handles playback commands.
    *   **Routines:** Manages scheduled tasks and timers (JSON based).
    *   **Memos:** WhatsApp-style organic memo storage.
*   **Storage:** `routines.json`, `memos.json`

### 3. Cozy Deck UI (Dashboard)
*   **File:** `index_v5.html`
*   **Theme:** "Cozy Deck" (Walnut grain, Glass buttons, Amber glow).
*   **Optimization:** Legacy ES5 JS for tablet compatibility.
*   **MQTT Topics:**
    *   `room/media/status`: Spotify metadata
    *   `room/media/command`: Control Spotify (TOGGLE, NEXT, PREV)
    *   `room/routine/cmd`: Add/Delete timers and schedules
    *   `room/dashboard/memo`: Save new memos

### 4. Music Vibe Engine (Media Processing)
*   **Status:** Phase 1 COMPLETED.
*   **Data:** ~800 files (4.1GB) organized by genre.
*   **Genres:** Old Hindi, Sufi, Punjabi, Bhajans, 00s_Hindi.
*   **Stack:** Beets (tagging), Custom Python (deduplication/organization).
*   **Location:** `D:\buntyxhardware\Music_Vibe_Engine\`

---

## 🏗️ Storage Topology (The "Three Brothers")
1.  **Ansh (sda3):** PRIMARY STORAGE. Contains organized music library.
2.  **Savi (sda4):** Hosting Immich DB and Uploads.
3.  **Anish (sda2):** UNRELIABLE/DEPRECATED.

---

## 📅 Roadmap & Recent Progress
- **Done:** Music organization and tagging.
- **Done:** Firmware performance optimization (Arduino C++).
- **Dropped:** Manual duplicate image sifting (Immich ML handles this).
- **Pending:** SSD Migration for Immich DB (Move from Savi).
- **Pending:** Syncthing backup setup.

---

## 💡 Maintenance Commands
- **Music Tagging (Beets):**
  ```powershell
  $env:PATH += ";D:\buntyxhardware\Music_Vibe_Engine\fpcalc_dir\chromaprint-fpcalc-1.5.1-windows-x86_64"; $env:BEETSDIR = "D:\buntyxhardware\Music_Vibe_Engine"; & beet -c beets_config_local.yaml import -s [Folder]
  ```
