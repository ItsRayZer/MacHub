# ─── config.py ───────────────────────────────────────────────────────────────
# Machub Capture System — Configuration & Period Schedule
# All times are in IST (UTC+5:30). NEVER use UTC.

import os
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

# ── Load environment variables ────────────────────────────────────────────────
load_dotenv()

# ── IST Timezone ──────────────────────────────────────────────────────────────
IST = timezone(timedelta(hours=5, minutes=30))


def now_ist() -> datetime:
    """Return the current time as an IST-aware datetime."""
    return datetime.now(IST)


def today_ist() -> str:
    """Return today's date as YYYY-MM-DD in IST."""
    return now_ist().strftime("%Y-%m-%d")


def time_hhmm_ist() -> str:
    """Return current IST time as HH:MM string for period matching."""
    return now_ist().strftime("%H:%M")


def time_hhmmss_ist() -> str:
    """Return current IST time as HH:MM:SS for display."""
    return now_ist().strftime("%H:%M:%S")


# ── Period Schedule (IST) ──────────────────────────────────────────────────────
# No lunch period — just academic periods with explicit start/end in HH:MM 24h.
PERIODS: dict[int, dict] = {
    1: {"start": "09:00", "end": "09:50", "subject": "Data Structures"},
    2: {"start": "09:50", "end": "10:40", "subject": "Mathematics"},
    3: {"start": "10:50", "end": "11:40", "subject": "Operating Systems"},
    4: {"start": "11:40", "end": "12:30", "subject": "Web Technologies"},
    5: {"start": "13:20", "end": "14:10", "subject": "Indian Constitution"},
    6: {"start": "14:10", "end": "15:00", "subject": "English"},
}

# School hours gate — capture only runs within this window
SCHOOL_START = "08:30"
SCHOOL_END   = "15:30"


def _hhmm_to_minutes(hhmm: str) -> int:
    """Convert 'HH:MM' string to total minutes since midnight."""
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def get_current_period() -> tuple[int, dict] | tuple[None, None]:
    """
    Determine the active period based on IST wall-clock time.

    Returns:
        (period_number, period_dict)  — if inside a period
        (None, None)                  — if between periods or outside schedule
    """
    now_hhmm = time_hhmm_ist()
    now_min  = _hhmm_to_minutes(now_hhmm)

    for pid, info in PERIODS.items():
        start_min = _hhmm_to_minutes(info["start"])
        end_min   = _hhmm_to_minutes(info["end"])
        if start_min <= now_min < end_min:
            return pid, info

    return None, None


def is_school_hours() -> bool:
    """
    Return True if the current IST time is within school operating hours
    (08:30 – 15:30).  Capture loop sleeps when this returns False.
    """
    now_min   = _hhmm_to_minutes(time_hhmm_ist())
    start_min = _hhmm_to_minutes(SCHOOL_START)
    end_min   = _hhmm_to_minutes(SCHOOL_END)
    return start_min <= now_min <= end_min


# ── Environment settings ──────────────────────────────────────────────────────
HF_SPACE_URL    = os.getenv("HF_SPACE_URL",    "https://mrrayzer-machub.hf.space").rstrip("/")
API_SECRET_KEY  = os.getenv("API_SECRET_KEY",  "")
HF_TOKEN        = os.getenv("HF_TOKEN",        "")
DIVISION        = os.getenv("DIVISION",        "BCA-A")
CAMERA_SOURCE   = os.getenv("CAMERA_SOURCE",   "0")
SCAN_INTERVAL   = int(os.getenv("SCAN_INTERVAL", "5"))

# Camera source: convert to int if numeric, else keep as string (RTSP URL)
try:
    CAMERA_SOURCE = int(CAMERA_SOURCE)
except ValueError:
    pass  # RTSP URL — leave as string


# ── Resolution — NO COMPRESSION ───────────────────────────────────────────────
# Why: Back-row face at 640x480 = ~15x15 px  → unusable by ArcFace
#      Back-row face at 1080p    = ~60x60 px  → workable after server crop
#      ArcFace minimum input     = 112x112 px (crop + upscale on server)
CAPTURE_WIDTH  = 1920
CAPTURE_HEIGHT = 1080
JPEG_QUALITY   = 90   # high quality, no visible artefacts
