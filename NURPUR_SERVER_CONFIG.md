# 🖥️ Nurpur Server Configuration

This document outlines the complete hardware, storage, and software stack for the **Nurpur Server**, serving as a quick reference for explaining the setup.

## ⚙️ System Overview
*   **Operating System:** Debian Linux (Headless)
*   **Management Interface:** Standard Debian Web Dashboard (Cockpit) accessible via port `:9090`
*   **Application Manager:** CasaOS (Provides a unified web UI for container management)
*   **Remote Access:** Tailscale (Zero-config VPN, running natively on Debian, IP: `100.85.3.45`)

## 💾 Hardware & Storage Stack
*   **Physical Drive:** 1.00 TB HDD (Model: WDC WD10EZEX-00WN4A0)
*   **Partition Map & Mount Points:**
    *   **`/dev/sda1` (ext4) - Debian_OS**
        *   **Mount:** `/` (Root)
        *   **Size:** 100 GB (~22 GB used)
    *   **`/dev/sda2` (ntfs) - Anish**
        *   **Mount:** `/mnt/photos/anish`
        *   **Size:** 220 GB (~85 GB used)
        *   **Note:** Deprecated/Unreliable storage.
    *   **`/dev/sda3` (ntfs) - Ansh**
        *   **Mount:** `/mnt/photos/ansh`
        *   **Size:** 220 GB (~46 GB used)
        *   **Note:** PRIMARY STORAGE. Contains `Music_Bucket`.
    *   **`/dev/sda4` (ntfs) - Savi**
        *   **Mount:** `/mnt/photos/savi`
        *   **Size:** 220 GB (~74 GB used)
        *   **Note:** Hosts Immich Database and Media Uploads.
    *   *Note: ~224 GB of unallocated free space remains on the drive.*

## 📦 Software & Services
The server relies on **Docker** for containerization, with **CasaOS** acting as the primary orchestrator for almost all applications.

### Core Apps (Managed via CasaOS)
1.  **Immich:** High-performance, self-hosted photo and video backup solution. Leverages Machine Learning for automatic duplicate sifting (stored on `Savi` partition).
2.  **AdGuard Home:** Network-wide ad blocking and local DNS resolution.
3.  **Mocha Scheduler:** Custom Node.js service bridging MQTT commands for the "Cozy Deck" smart room and handling Spotify API automation.

### Native Services (Managed via Debian)
1.  **Tailscale:** Installed directly on the host OS (bypassing CasaOS) to ensure secure, uninterrupted remote access to all internal services and the Cockpit dashboard.
2.  **Cockpit:** The primary Debian dashboard on `:9090` used for low-level system monitoring, terminal access, and storage management outside of CasaOS.