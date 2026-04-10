# Mocha Hub - Cozy Deck & Hardware Core

A complete ecosystem transforming a room into a smart, cozy deck. It consists of a custom hardware firmware, a Node.js MQTT scheduler, Spotify integration, and a beautiful wood-themed UI.

## Architecture Overview

### 1. Mocha Hub Core (ESP32 Firmware)
Custom Arduino C++ core (`MochaHubCore.ino`) for lightning-fast control.
*   **Pin-point Mapping:** Directly controls 5 relays, DHT22, and physical switches.
*   **OTA Ready:** Web-based firmware uploads at `http://192.168.1.50/update`.

### 2. Cozy Deck UI (`index_v5.html`)
Tablet-optimized command center with a walnut-and-glass aesthetic.
*   **Features:** Smart Media Center (Spotify), Organic Memos (WhatsApp integration), and Relay controls.

### 3. Nurpur Pro Scheduler (`scheduler.js`)
Headless Node.js service for automation and Spotify API bridging.

### 4. Music Vibe Engine (`Music_Vibe_Engine/`)
A dedicated subsystem for organizing and tagging local music.
*   **Status:** Phase 1 complete. 4.1GB of music organized into categorized folders (Old Hindi, Sufi, Punjabi, Bhajans).

## Deployment
1.  **ESP32:** Flash `MochaHubCore.ino`.
2.  **Scheduler:** Deployed via Docker.
3.  **UI:** Serve `index_v5.html`.
