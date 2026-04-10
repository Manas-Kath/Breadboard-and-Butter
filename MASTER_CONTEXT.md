# MASTER CONTEXT: Bunty Smart Hub - Cozy Deck (v5.8.0)

## 1. System Architecture
*   **Central Broker:** Mi Pad Mocha (Delhi).
    *   **Local IP:** `192.168.1.90:1883` (J7 & ESP32 Direct Link).
    *   **Tailscale IP:** `100.125.241.104:1883` (Nurpur Scheduler Link).
*   **Web & Logic Host:** Nurpur Home Server.
    *   **Dashboard URL:** `http://100.85.3.45:8080`.
    *   **Path:** `/DATA/AppData/mocha-dashboard/`.
    *   **Hardware:** Core 2 Duo (Debian Minimal).

## 2. Smart Hub Firmware (Mocha Hub Core v1.3.5)
*   **Hardware:** ESP32 DevKit.
*   **Framework:** Pure Arduino C++ (Replaced ESPHome for performance and control).
*   **Networking:** Static IP `192.168.1.50`.
*   **Hardware Mapping:** Relays 19, 18, 5, 17, 16; Buttons 22, 23; DHT22 on 21.

## 3. Media Processing: The Music Vibe Engine (COMPLETED)
*   **Context:** All music processing consolidated on Ryzen 5 (Windows).
*   **Status:** ~800 files (4.1GB) organized and tagged.
*   **Directory:** `D:\buntyxhardware\Music_Vibe_Engine\`
*   **Structure:**
    *   `Old Hindi/`: Classics up to mid-2000s.
    *   `Sufi/`: Qawwalis, Nusrat, Rahat, etc.
    *   `Punjabi/`: Modern and classic Punjabi tracks.
    *   `Bhajans/`: Devotional music.
    *   `00s_Hindi/`: Modern Bollywood and leftovers.
*   **Tools Archive:** `beets` configs, `deduplicate_music.py` (Safe Size-Check), and `organize_remaining.py` are archived in the engine folder.

## 4. Duplicate Image Sifting
*   **Status:** DROPPED. Immich ML handles this effectively.

## 5. Cozy Hub Dashboard (UI)
*   **File:** `index_v5.html` (Latest Iteration).
*   **Theme:** "Cozy Deck" (Walnut grain, Glass buttons, Amber glow).
*   **Legacy Support:** Written in ES5 JS for older tablet browser compatibility.
