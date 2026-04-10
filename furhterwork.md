# 🛠️ Home Server: Phase 1 - The Great Consolidation
**Status:** Phase A Complete. Phase B Dropped.

---

## 🏗️ Storage Topology (The "Three Brothers")
1. **Anish (sda2):** LOST/Unreliable.
2. **Ansh (sda3):** PRIMARY STORAGE. Contains `Music_Bucket`.
3. **Savi (sda4):** Hosting Immich DB and Uploads.

---

## 🎯 Implementation Plan (Q1 2026)

### Phase A: The "Music Vibe" Engine (DONE ✅)
- **Goal:** Organize music into `Bhajans`, `Old Hindi`, `00s_Hindi`, `Sufi`, `Punjabi`.
- **Outcome:** ~800 files sorted on Ryzen 5. Assets moved to `Music_Vibe_Engine/`.

### Phase B: Duplicate Image Sifting (DROPPED ❌)
- **Reason:** Immich handles this automatically via Machine Learning.

### Phase C: System Optimization (PENDING)
- **Goal:** Move `immich_db` from Savi (HDD) to an SSD.
- **Goal:** Set up Syncthing backup.

---

## 🛠️ Maintenance Command
```powershell
# If adding more music to the staging area:
cd Music_Vibe_Engine
# Run beets for auto-tagging (40% threshold)
$env:PATH += ";D:\buntyxhardware\Music_Vibe_Engine\fpcalc_dir\chromaprint-fpcalc-1.5.1-windows-x86_64"; $env:BEETSDIR = "D:\buntyxhardware\Music_Vibe_Engine"; & "C:\Users\hp\AppData\Local\Packages\PythonSoftwareFoundation.Python.3.12_qbz5n2kfra8p0\LocalCache\local-packages\Python312\Scripts\beet.exe" -c beets_config_local.yaml import -s [New_Folder]
```
