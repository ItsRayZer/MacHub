# ─── capture.py ──────────────────────────────────────────────────────────────
# Machub Capture System v1.0 — Main Entry Point
#
# Runs on the classroom PC. Opens the webcam at 1920×1080, shows a live
# preview with an IST-stamped overlay, and uploads a frame every SCAN_INTERVAL
# seconds to the Machub HF Space /scan endpoint.
#
# All times are in IST.  No UTC anywhere.
#
# Controls:
#   Q  — quit cleanly
#
# Crash recovery:
#   The main capture loop is wrapped in a try/except.  On any unhandled
#   exception the error is logged, the process waits 5 s, then restarts.
#   The only clean exit is the Q key.

import logging
import sys
import time

import cv2
import numpy as np

from config import (
    CAMERA_SOURCE, CAPTURE_WIDTH, CAPTURE_HEIGHT,
    DIVISION, SCAN_INTERVAL,
    get_current_period, is_school_hours,
    today_ist, time_hhmmss_ist, now_ist,
)
from uploader import FrameUploader
from local_backup import LocalBackup

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("capture.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)

# ── Overlay constants ─────────────────────────────────────────────────────────
FONT       = cv2.FONT_HERSHEY_SIMPLEX
WHITE      = (255, 255, 255)
GREEN      = (0, 200, 100)
RED        = (60, 60, 220)
YELLOW     = (0, 200, 230)
INDIGO     = (200, 100, 99)
DARK_BG    = (18, 18, 30)
ALPHA      = 0.65          # overlay transparency

WINDOW_NAME = "Machub Attendance — Press Q to Quit"


# ── Banner ────────────────────────────────────────────────────────────────────
def print_banner():
    banner = r"""
╔══════════════════════════════════════════════════════════╗
║         MACHUB ATTENDANCE CAPTURE  v1.0                  ║
║   AI Face Recognition Attendance System — Classroom PC   ║
╚══════════════════════════════════════════════════════════╝
"""
    print(banner)


# ── Camera open + resolution set ─────────────────────────────────────────────
def open_camera(source) -> cv2.VideoCapture:
    logger.info(f"Opening camera source: {source}")
    cap = cv2.VideoCapture(source)

    if not cap.isOpened():
        logger.error(f"Cannot open camera source: {source}")
        raise RuntimeError(f"Camera source '{source}' could not be opened.")

    # Request 1080p — camera firmware may give less; we log what we actually got
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  CAPTURE_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CAPTURE_HEIGHT)

    # Read a test frame to confirm the real resolution
    ret, test = cap.read()
    if ret and test is not None:
        actual_h, actual_w = test.shape[:2]
        logger.info(f"Camera opened. Requested 1920×1080 → Actual: {actual_w}×{actual_h}")
        print(f"  Camera resolution: {actual_w}×{actual_h}")
    else:
        logger.warning("Could not read a test frame from camera.")

    return cap


# ── Reconnect camera on disconnect ────────────────────────────────────────────
def reconnect_camera(source, old_cap: cv2.VideoCapture) -> cv2.VideoCapture:
    """Release old handle and reopen. Retries every 3 s up to 20 times."""
    try:
        old_cap.release()
    except Exception:
        pass

    logger.warning("[Camera] Disconnected. Attempting reconnect…")
    for attempt in range(1, 21):
        time.sleep(3)
        try:
            cap = open_camera(source)
            logger.info(f"[Camera] Reconnected on attempt {attempt}.")
            return cap
        except Exception as exc:
            logger.warning(f"[Camera] Reconnect attempt {attempt}/20 failed: {exc}")

    raise RuntimeError("Camera reconnect failed after 20 attempts.")


# ── Overlay drawing ───────────────────────────────────────────────────────────
def draw_overlay(
    frame: np.ndarray,
    period_num: int | None,
    subject: str | None,
    actual_w: int,
    actual_h: int,
    server_state: str,      # "online" | "offline" | "busy"
    last_scan_status: str,  # e.g. "success 09:05:31" | "skipped: busy" | "—"
) -> np.ndarray:
    """Draw a semi-transparent info panel in the top-left corner of the frame."""

    overlay = frame.copy()
    panel_h, panel_w = 160, 420

    # Dark background rectangle
    cv2.rectangle(overlay, (8, 8), (panel_w, panel_h), DARK_BG, -1)
    frame = cv2.addWeighted(overlay, ALPHA, frame, 1 - ALPHA, 0)

    def put(text, y, color=WHITE, scale=0.52, thickness=1):
        cv2.putText(frame, text, (16, y), FONT, scale, color, thickness, cv2.LINE_AA)

    # Title
    ist_time = time_hhmmss_ist()
    put("MACHUB ATTENDANCE", 30, INDIGO, scale=0.62, thickness=2)

    # Period & subject
    if period_num:
        put(f"Period {period_num}  |  {subject or '—'}", 55, YELLOW)
    else:
        put("No active period  (between classes)", 55, (120, 120, 140))

    # Resolution
    put(f"Resolution: {actual_w}x{actual_h}", 78, WHITE, scale=0.46)

    # Server state
    state_color = GREEN if server_state == "online" else (RED if server_state == "offline" else YELLOW)
    put(f"Server: {server_state.upper()}", 100, state_color)

    # Last scan
    put(f"Last scan: {last_scan_status}", 122, WHITE, scale=0.46)

    # IST clock (bottom-right of panel)
    put(f"{ist_time} IST", 148, (160, 160, 180), scale=0.44)

    # Q-to-quit reminder (bottom of frame)
    h_frame = frame.shape[0]
    cv2.putText(
        frame, "Press  Q  to quit",
        (12, h_frame - 14), FONT, 0.45, (100, 100, 110), 1, cv2.LINE_AA
    )

    return frame


# ── Main capture loop ─────────────────────────────────────────────────────────
def capture_loop():
    uploader = FrameUploader()
    backup   = LocalBackup()

    # ── Health check at startup ───────────────────────────────────────────────
    logger.info("Checking HF Space health…")
    online = uploader.check_server_health()
    logger.info(f"Server health: {'ONLINE ✓' if online else 'OFFLINE — frames will be saved locally'}")
    print(f"  HF Space status: {'ONLINE' if online else 'OFFLINE'}")

    # ── Open camera ───────────────────────────────────────────────────────────
    cap          = open_camera(CAMERA_SOURCE)
    actual_w     = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    actual_h     = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # ── Start backup retry daemon ─────────────────────────────────────────────
    backup.start_retry_daemon(uploader)
    logger.info("Backup retry daemon started.")
    print("  Backup retry daemon: running")
    print("\n  System ready. Monitoring classroom…\n")

    # ── State variables ───────────────────────────────────────────────────────
    last_upload_time  = 0.0
    last_period_num   = None
    last_scan_status  = "—"
    server_state      = "online" if online else "offline"

    # ── Loop ──────────────────────────────────────────────────────────────────
    while True:
        # ── Read frame ───────────────────────────────────────────────────────
        ret, frame = cap.read()
        if not ret or frame is None:
            logger.warning("[Capture] Failed to read frame. Attempting camera reconnect…")
            cap      = reconnect_camera(CAMERA_SOURCE, cap)
            actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            continue

        # ── School hours gate ────────────────────────────────────────────────
        if not is_school_hours():
            disp = draw_overlay(frame, None, None, actual_w, actual_h,
                                server_state, "Outside school hours")
            cv2.imshow(WINDOW_NAME, disp)
            if cv2.waitKey(1000) & 0xFF == ord('q'):
                break
            time.sleep(59)   # sleep most of the 60 s before rechecking
            continue

        # ── Current period ───────────────────────────────────────────────────
        period_num, period_info = get_current_period()

        # Period change detection — reset state
        if period_num != last_period_num:
            if period_num:
                logger.info(f"[Capture] Period changed → Period {period_num}: {period_info['subject']}")
                print(f"\n  Period changed: {period_num}  {period_info['subject']}")
            else:
                logger.info("[Capture] No active period (break time).")
            last_period_num  = period_num
            last_scan_status = "—"  # reset overlay status

        if not period_num:
            disp = draw_overlay(frame, None, None, actual_w, actual_h,
                                server_state, "No active period")
            cv2.imshow(WINDOW_NAME, disp)
            if cv2.waitKey(1000) & 0xFF == ord('q'):
                break
            time.sleep(29)
            continue

        subject = period_info["subject"]

        # ── Interval check ───────────────────────────────────────────────────
        now_ts = time.monotonic()
        if now_ts - last_upload_time >= SCAN_INTERVAL:
            last_upload_time = now_ts
            date_str         = today_ist()
            ts_str           = time_hhmmss_ist()

            # ── Upload attempt ────────────────────────────────────────────────
            result = uploader.upload_frame(
                frame_array=frame,
                period=period_num,
                division=DIVISION,
                date=date_str,
            )

            if result is None:
                # Upload exception — all retries exhausted
                server_state     = "offline"
                last_scan_status = f"Upload failed: saved locally {ts_str}"
                backup.save_failed_frame(frame, period_num, DIVISION, date_str, ts_str)
                logger.warning("[Capture] Upload failed. Frame saved locally.")

            elif result.get("skipped"):
                reason = result.get("reason", "unknown")
                if reason == "server_busy":
                    # Server alive but processing — do NOT save locally
                    server_state     = "busy"
                    last_scan_status = f"Skipped: server busy {ts_str}"
                    logger.info("[Capture] Skipped: server busy.")
                else:
                    # lock_held — another upload was in progress
                    last_scan_status = f"Skipped: lock held {ts_str}"
                    logger.info("[Capture] Skipped: lock held by concurrent upload.")

            else:
                # Success
                server_state    = "online"
                marked          = result.get("students_marked", [])
                faces_detected  = result.get("faces_detected", 0)
                last_scan_status = f"success {ts_str} — {len(marked)} marked"
                logger.info(
                    f"[Capture] Scan OK — "
                    f"faces={faces_detected}, marked={marked}"
                )
                if marked:
                    print(f"  [{ts_str}] Marked present: {', '.join(marked)}")

        # ── Draw overlay & show ───────────────────────────────────────────────
        display = draw_overlay(
            frame,
            period_num, subject,
            actual_w, actual_h,
            server_state, last_scan_status,
        )
        cv2.imshow(WINDOW_NAME, display)

        # Q to quit
        if cv2.waitKey(1) & 0xFF == ord('q'):
            logger.info("[Capture] Q pressed — shutting down.")
            break

    # ── Cleanup ───────────────────────────────────────────────────────────────
    cap.release()
    cv2.destroyAllWindows()
    logger.info("[Capture] Stopped cleanly.")
    print("\n  Stopped cleanly. Goodbye.")


# ── Entry point with crash recovery ──────────────────────────────────────────
def main():
    print_banner()
    print(f"  Division  : {DIVISION}")
    print(f"  Interval  : every {SCAN_INTERVAL} s")
    print(f"  Camera    : {CAMERA_SOURCE}")
    print(f"  HF Space  : {__import__('config').HF_SPACE_URL}")
    print()

    while True:
        try:
            capture_loop()
            # capture_loop returns only on Q press
            sys.exit(0)

        except KeyboardInterrupt:
            logger.info("Interrupted by user (Ctrl+C). Exiting.")
            print("\n  Interrupted. Exiting.")
            sys.exit(0)

        except Exception as exc:
            logger.exception(f"[Capture] CRASH: {exc}")
            print(f"\n  !! Crash: {exc}")
            print("     Restarting in 5 seconds… (Press Ctrl+C to abort)")
            try:
                time.sleep(5)
            except KeyboardInterrupt:
                logger.info("Aborted restart. Exiting.")
                sys.exit(1)


if __name__ == "__main__":
    main()
