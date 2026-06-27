# Machub Capture System — README

## Overview

`machub-capture` runs on the **classroom PC** connected to a USB or IP camera.
Every `SCAN_INTERVAL` seconds it captures a raw 1080p frame and POSTs it to your
Hugging Face Space backend for face detection + attendance marking.

---

## Quick Start

```bat
REM 1. Copy and fill environment file
copy .env.example .env
notepad .env

REM 2. Launch (installs deps automatically)
start.bat
```

Or manually:

```bat
pip install -r requirements.txt
python capture.py
```

Press **Q** in the camera window to stop cleanly.

---

## Environment Variables (.env)

| Variable | Default | Description |
|---|---|---|
| `HF_SPACE_URL` | — | Full URL to your HF Space (no trailing slash) |
| `API_SECRET_KEY` | — | Must match `API_SECRET_KEY` secret on HF Space |
| `DIVISION` | `BCA-A` | Class division being monitored |
| `CAMERA_SOURCE` | `0` | `0` = default webcam, `1` = 2nd camera, or RTSP URL |
| `SCAN_INTERVAL` | `5` | Seconds between frame uploads |

---

## Why 1080p? (No Compression)

| Scenario | Resolution | Back-row face size | Usable? |
|---|---|---|---|
| 640×480 | VGA | ~15×15 px | ❌ Too small for ArcFace |
| 1920×1080 | Full HD | ~60×60 px | ✅ Workable after server crop |

ArcFace requires **112×112 px minimum** after server-side crop + upscale.
Never resize or compress frames before uploading.

---

## Architecture & Threading

```
main thread                    backup daemon thread (every 60 s)
───────────                    ────────────────────────────────
[camera read]                  if upload_lock.locked() → skip sweep
     ↓                         else → retry failed_frames/*.jpg
[is_school_hours?]
     ↓
[get_current_period()]
     ↓
[SCAN_INTERVAL elapsed?]
     ↓
[upload_lock.acquire(blocking=False)]  ← shared lock
     ↓
[GET /status  (5 s timeout)]
     │ unreachable → local_backup.save_failed_frame()
     │ busy       → skip (server alive, just busy)
     ↓
[POST /scan 1080p JPEG (45 s timeout)]
     ↓
[upload_lock.release()]  ← always in finally block
```

**Key invariant**: only ONE 1080p upload can be in-flight at a time.
The backup retry daemon always checks `upload_lock.locked()` before starting.

---

## Period Schedule (IST)

| Period | Time | Subject |
|---|---|---|
| 1 | 09:00 – 09:50 | Data Structures |
| 2 | 09:50 – 10:40 | Mathematics |
| 3 | 10:50 – 11:40 | Operating Systems |
| 4 | 11:40 – 12:30 | Web Technologies |
| 5 | 13:20 – 14:10 | Indian Constitution |
| 6 | 14:10 – 15:00 | English |

School hours gate: **08:30 – 15:30 IST**. Outside this window the loop
sleeps 60 s and shows "Outside school hours" in the overlay.

---

## Student Photo Guide for Enrollment

Collect **3–5 photos** per student for best recognition accuracy.

| Photo | Angle | Notes |
|---|---|---|
| 1 | Front — neutral | Look directly at camera |
| 2 | Slight left ~15° | Turn head gently |
| 3 | Slight right ~15° | Turn head gently |
| 4 | Slight downward | Look toward desk |
| 5 | With glasses | If student wears them |

**Why multiple angles?**  
ArcFace averages all embeddings into one master embedding.  
More angles → stronger embedding → better tolerance for CCTV viewing angles.  
Minimum: 1 photo. Strongly recommended: 3+.

---

## Overlay Status Guide

| Status | Meaning |
|---|---|
| `Server: ONLINE` | Last upload succeeded |
| `Server: BUSY` | HF Space is processing another frame — safe, no data loss |
| `Server: OFFLINE` | Server unreachable — frame saved to `failed_frames/` |
| `Last scan: success HH:MM:SS — N marked` | N students recognised |
| `Skipped: server busy` | Frame dropped (server was processing) |
| `Upload failed: saved locally` | Network issue — will retry automatically |

---

## Local Backup

Frames that fail to upload are saved to `failed_frames/` as:
- `YYYY-MM-DD_HH-MM-SS_PN_DIVISION.jpg` — raw JPEG
- `YYYY-MM-DD_HH-MM-SS_PN_DIVISION.json` — metadata

The daemon retries these every **60 seconds**.  
After **5 failed attempts** a frame is permanently discarded.  
Maximum **100 frames** stored at once (oldest deleted when full).

---

## Crash Recovery

The main loop is wrapped in a `try/except`. On any unhandled exception:
1. Error is logged to `capture.log`
2. Process waits 5 seconds
3. Loop restarts automatically

The only clean exit is **Q** in the preview window or **Ctrl+C**.

---

## Files

```
machub-capture/
├── capture.py        Main loop — camera, overlay, upload orchestration
├── config.py         IST timezone, periods, env vars
├── uploader.py       FrameUploader — lock, /status probe, /scan POST
├── local_backup.py   Disk save + daemon retry thread
├── requirements.txt  Python dependencies
├── start.bat         Windows one-click launcher
├── .env.example      Environment template
└── README.md         This file
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Cannot open camera source: 0" | Check USB cable; try `CAMERA_SOURCE=1` |
| Preview freezes for 45 s | Should not happen — unreachable server routes to backup immediately |
| "No active period" shown at class time | Verify system clock is set to IST |
| Frames piling up in `failed_frames/` | Check `HF_SPACE_URL` and `API_SECRET_KEY` in `.env` |
| Very low resolution (e.g. 640×480) | Camera doesn't support 1080p; system uses max available |
