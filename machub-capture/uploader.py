# ─── uploader.py ─────────────────────────────────────────────────────────────
# Machub Capture System — Frame Uploader
#
# THREADING FIX: A module-level shared lock (upload_lock) ensures only ONE
# upload can be in progress at any time.  local_backup.py imports this same
# lock object so the backup-retry thread can honour it too.
#
# CRITICAL FIX — UNREACHABLE = BUSY:
# If the /status probe raises ANY exception (timeout, connection refused, DNS
# failure …) we treat the server as busy and route the frame to local backup
# immediately.  This prevents a 45-second preview freeze while waiting for a
# 1080p upload that will never succeed.

import io
import threading
import time
import logging

import cv2
import requests
import numpy as np

from config import HF_SPACE_URL, API_SECRET_KEY, HF_TOKEN, JPEG_QUALITY, today_ist, time_hhmmss_ist

logger = logging.getLogger(__name__)

# ── Shared threading lock (imported by local_backup.py too) ──────────────────
upload_lock = threading.Lock()


class FrameUploader:
    """Uploads raw 1080p JPEG frames to the Machub HF Space /scan endpoint."""

    def __init__(self):
        self.base_url      = HF_SPACE_URL.rstrip("/")
        self.headers       = {"X-API-Key": API_SECRET_KEY}
        if HF_TOKEN:
            self.headers["Authorization"] = f"Bearer {HF_TOKEN}"
        self.timeout_upload = 45        # seconds — full 1080p POST
        self.timeout_status  = 5        # seconds — lightweight /status GET
        self.max_retries   = 2
        self.upload_lock   = upload_lock  # reference to module-level shared lock

    # ── /status probe ────────────────────────────────────────────────────────

    def check_server_busy(self) -> bool:
        """
        Probe GET /status with a 5-second timeout.

        Returns
        -------
        True   — server is busy OR unreachable (safe to skip upload)
        False  — server is idle and ready to accept a frame
        """
        try:
            resp = requests.get(
                f"{self.base_url}/status",
                headers=self.headers,
                timeout=self.timeout_status,
            )
            if resp.ok:
                data = resp.json()
                return bool(data.get("busy", False))
            # Non-2xx → treat as busy
            logger.warning(f"[Uploader] /status returned {resp.status_code}. Treating as busy.")
            return True

        except Exception as exc:
            # Connection error / timeout / DNS failure — go straight to backup
            logger.warning(f"[Uploader] Server unreachable ({type(exc).__name__}). Saving locally.")
            return True   # ← CRITICAL: unreachable = busy

    # ── /health probe ────────────────────────────────────────────────────────

    def check_server_health(self) -> bool:
        """
        Lightweight health check used at startup.

        Returns True if the server responds OK, False otherwise.
        """
        try:
            resp = requests.get(
                f"{self.base_url}/health",
                headers=self.headers,
                timeout=10,
            )
            return resp.status_code == 200
        except Exception as exc:
            logger.warning(f"[Uploader] Health check failed: {exc}")
            return False

    # ── Main upload ──────────────────────────────────────────────────────────

    def upload_frame(
        self,
        frame_array: np.ndarray,
        period: int,
        division: str,
        date: str,
    ) -> dict | None:
        """
        Attempt to upload a raw 1080p frame to /scan.

        Pipeline
        --------
        1. Try to acquire the shared lock (non-blocking).
           Skip if another upload is already in progress.
        2. Check /status — if busy or unreachable, release lock and return skip.
        3. Encode frame as JPEG (quality 90, NO RESIZE).
        4. POST multipart/form-data to /scan with a 45-second timeout.
        5. Always release lock in the finally block.

        Returns
        -------
        dict   — JSON response from server on success
        {"skipped": True, ...}  — if skipped (lock held or server busy)
        None   — on upload exception (caller should save to backup)
        """

        # ── STEP 1: Acquire lock (non-blocking) ──────────────────────────────
        acquired = self.upload_lock.acquire(blocking=False)
        if not acquired:
            logger.info("[Uploader] Upload already in progress. Skipping this frame.")
            return {"skipped": True, "reason": "lock_held"}

        try:
            # ── STEP 2: Server busy / unreachable check ───────────────────────
            if self.check_server_busy():
                return {"skipped": True, "reason": "server_busy"}

            # ── STEP 3: Encode raw 1080p JPEG — NO RESIZE ─────────────────────
            encode_params = [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY]
            success, buffer = cv2.imencode(".jpg", frame_array, encode_params)
            if not success:
                logger.error("[Uploader] JPEG encoding failed.")
                return None

            jpeg_bytes = buffer.tobytes()
            frame_size_kb = len(jpeg_bytes) / 1024
            logger.info(
                f"[Uploader] Uploading {frame_size_kb:.0f} KB frame "
                f"(period={period}, division={division}, date={date})"
            )

            # ── STEP 4: POST multipart/form-data ──────────────────────────────
            files   = {"frame": ("frame.jpg", io.BytesIO(jpeg_bytes), "image/jpeg")}
            payload = {"period": period, "division": division, "date": date}

            for attempt in range(1, self.max_retries + 1):
                try:
                    resp = requests.post(
                        f"{self.base_url}/scan",
                        files=files,
                        data=payload,
                        headers=self.headers,
                        timeout=self.timeout_upload,
                    )
                    resp.raise_for_status()
                    result = resp.json()
                    logger.info(
                        f"[Uploader] Scan success — "
                        f"faces={result.get('faces_detected', 0)}, "
                        f"marked={result.get('students_marked', [])}"
                    )
                    return result

                except requests.exceptions.Timeout:
                    logger.warning(f"[Uploader] Upload attempt {attempt} timed out.")
                except requests.exceptions.RequestException as exc:
                    logger.warning(f"[Uploader] Upload attempt {attempt} failed: {exc}")

                if attempt < self.max_retries:
                    time.sleep(2)
                    # Re-seek the BytesIO so the retry can re-read the frame
                    files["frame"][1].seek(0)

            # All retries exhausted
            logger.error("[Uploader] All upload attempts failed.")
            return None

        except Exception as exc:
            logger.error(f"[Uploader] Unexpected error during upload: {exc}")
            return None

        finally:
            # ── STEP 5: Always release lock ───────────────────────────────────
            self.upload_lock.release()
