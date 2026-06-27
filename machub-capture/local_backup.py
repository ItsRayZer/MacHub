# ─── local_backup.py ─────────────────────────────────────────────────────────
# Machub Capture System — Local Backup & Retry
#
# THREADING FIX: Imports the same upload_lock from uploader.py.
# The retry thread ALWAYS checks if the lock is free before attempting to
# re-send a saved frame.  This prevents the backup thread from racing with
# the main capture loop.

import json
import logging
import os
import threading
import time
from pathlib import Path

import cv2
import numpy as np

# Import the shared lock — same object, not a copy
from uploader import upload_lock

logger = logging.getLogger(__name__)

BACKUP_DIR   = Path("failed_frames")
MAX_STORED   = 100       # max frames kept on disk
MAX_ATTEMPTS = 5         # permanently discard after this many failed retries
RETRY_EVERY  = 60        # seconds between retry sweeps


class LocalBackup:
    """
    Saves frames that could not be uploaded (server offline / all retries
    exhausted) to disk, and re-attempts upload in a background daemon thread
    when the server comes back online.
    """

    def __init__(self):
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        self.upload_lock = upload_lock   # shared reference — NOT a new lock
        logger.info(f"[Backup] Local backup directory: {BACKUP_DIR.resolve()}")

    # ── Save failed frame ────────────────────────────────────────────────────

    def save_failed_frame(
        self,
        frame_array: np.ndarray,
        period: int,
        division: str,
        date: str,
        timestamp: str,
    ) -> None:
        """
        Persist a JPEG + sidecar JSON to the failed_frames/ folder.
        Enforces a maximum of MAX_STORED frames; oldest are deleted when full.
        """
        # Enforce storage cap — delete oldest if at limit
        existing = sorted(BACKUP_DIR.glob("*.jpg"), key=lambda p: p.stat().st_mtime)
        while len(existing) >= MAX_STORED:
            oldest_jpg  = existing.pop(0)
            oldest_json = oldest_jpg.with_suffix(".json")
            oldest_jpg.unlink(missing_ok=True)
            oldest_json.unlink(missing_ok=True)
            logger.warning(f"[Backup] Storage cap reached. Deleted oldest: {oldest_jpg.name}")

        # Build filename from timestamp
        safe_ts   = timestamp.replace(":", "-")
        stem      = f"{date}_{safe_ts}_P{period}_{division}"
        jpg_path  = BACKUP_DIR / f"{stem}.jpg"
        json_path = BACKUP_DIR / f"{stem}.json"

        # Save JPEG (quality 90, NO resize)
        encode_params = [cv2.IMWRITE_JPEG_QUALITY, 90]
        success, buf  = cv2.imencode(".jpg", frame_array, encode_params)
        if not success:
            logger.error("[Backup] JPEG encode failed. Frame not saved.")
            return

        jpg_path.write_bytes(buf.tobytes())

        # Save sidecar metadata
        meta = {
            "period":    period,
            "division":  division,
            "date":      date,
            "timestamp": timestamp,
            "attempts":  0,
        }
        json_path.write_text(json.dumps(meta, indent=2))

        logger.info(
            f"[Backup] Saved frame locally: {jpg_path.name} "
            f"({len(buf) / 1024:.0f} KB)"
        )

    # ── Retry saved frames ───────────────────────────────────────────────────

    def retry_failed_uploads(self, uploader) -> None:
        """
        Attempt to re-upload every saved frame in order.

        CRITICAL FIX — RESPECT SHARED LOCK:
        If the main loop is currently uploading (lock held), skip the sweep
        entirely and return immediately.  This avoids concurrent 1080p POSTs.
        """
        # Check lock without acquiring — bail if main loop is uploading
        if self.upload_lock.locked():
            logger.debug("[Backup] Main loop uploading. Backup retry paused.")
            return

        pending = sorted(BACKUP_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime)
        if not pending:
            return

        logger.info(f"[Backup] Retrying {len(pending)} saved frame(s)…")

        for json_path in pending:
            jpg_path = json_path.with_suffix(".jpg")

            if not jpg_path.exists():
                # Orphaned metadata — clean up
                json_path.unlink(missing_ok=True)
                continue

            # Load metadata
            try:
                meta = json.loads(json_path.read_text())
            except Exception as exc:
                logger.error(f"[Backup] Bad metadata {json_path.name}: {exc}")
                continue

            attempts = meta.get("attempts", 0)
            if attempts >= MAX_ATTEMPTS:
                logger.warning(
                    f"[Backup] {json_path.stem} exceeded {MAX_ATTEMPTS} attempts. "
                    "Discarding permanently."
                )
                jpg_path.unlink(missing_ok=True)
                json_path.unlink(missing_ok=True)
                continue

            # Load frame from disk
            frame_bytes = jpg_path.read_bytes()
            nparr = np.frombuffer(frame_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is None:
                logger.error(f"[Backup] Cannot decode {jpg_path.name}. Discarding.")
                jpg_path.unlink(missing_ok=True)
                json_path.unlink(missing_ok=True)
                continue

            # Attempt upload — uploader.upload_frame() manages its own lock
            result = uploader.upload_frame(
                frame_array=frame,
                period=meta["period"],
                division=meta["division"],
                date=meta["date"],
            )

            if result and not result.get("skipped"):
                # Success — remove local files
                jpg_path.unlink(missing_ok=True)
                json_path.unlink(missing_ok=True)
                logger.info(f"[Backup] Retry succeeded: {json_path.stem}")
            else:
                # Still failing — increment attempt counter
                meta["attempts"] = attempts + 1
                json_path.write_text(json.dumps(meta, indent=2))
                logger.warning(
                    f"[Backup] Retry failed: {json_path.stem} "
                    f"(attempt {meta['attempts']}/{MAX_ATTEMPTS})"
                )

            # Pause between retries so we don't hammer the server
            time.sleep(1)

    # ── Background daemon thread ─────────────────────────────────────────────

    def start_retry_daemon(self, uploader) -> None:
        """
        Start a daemon thread that calls retry_failed_uploads() every
        RETRY_EVERY seconds.  Daemon flag ensures it dies with the main process.
        """
        def _loop():
            logger.info("[Backup] Retry daemon started.")
            while True:
                time.sleep(RETRY_EVERY)
                try:
                    self.retry_failed_uploads(uploader)
                except Exception as exc:
                    logger.error(f"[Backup] Unhandled exception in retry loop: {exc}")

        t = threading.Thread(target=_loop, daemon=True, name="BackupRetryDaemon")
        t.start()
        logger.info(f"[Backup] Retry daemon running (interval: {RETRY_EVERY}s).")
