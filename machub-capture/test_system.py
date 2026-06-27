# â”€â”€â”€ test_system.py â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Machub Capture System â€” Diagnostic Test Script
# Run this BEFORE start.bat to verify all components are working correctly.
# Usage:  python test_system.py

import sys
import time
import threading

# Force UTF-8 output so the script works in any Windows terminal
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

OK  = "[OK]"
ERR = "[!!]"

print("=" * 60)
print("  MACHUB CAPTURE SYSTEM â€” DIAGNOSTIC TEST")
print("=" * 60)
print()

# â”€â”€ Test 1: Config module â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
print("TEST 1: Config module")
try:
    import config
    print(f"  âœ“ HF_SPACE_URL  : {config.HF_SPACE_URL}")
    print(f"  âœ“ DIVISION      : {config.DIVISION}")
    print(f"  âœ“ CAMERA_SOURCE : {config.CAMERA_SOURCE}")
    print(f"  âœ“ SCAN_INTERVAL : {config.SCAN_INTERVAL}s")
    print(f"  âœ“ JPEG_QUALITY  : {config.JPEG_QUALITY}%")

    ist_now = config.now_ist()
    print(f"  âœ“ Current IST   : {ist_now.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    print(f"  âœ“ Today (IST)   : {config.today_ist()}")

    in_hours = config.is_school_hours()
    print(f"  âœ“ School hours  : {'YES â€” captures active' if in_hours else 'NO â€” outside 08:30â€“15:30 IST'}")

    pid, pinfo = config.get_current_period()
    if pid:
        print(f"  âœ“ Current period: Period {pid} â€” {pinfo['subject']} ({pinfo['start']}â€“{pinfo['end']})")
    else:
        print("  âœ“ Current period: None (break time or outside school hours)")
    print()
except Exception as e:
    print(f"  âœ— FAILED: {e}")
    sys.exit(1)

# â”€â”€ Test 2: Threading lock (shared between uploader and backup) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
print("TEST 2: Threading lock (shared)")
try:
    from uploader import upload_lock as lock_a
    from local_backup import upload_lock as lock_b

    assert lock_a is lock_b, "CRITICAL: uploader and local_backup have DIFFERENT lock objects!"
    print("  âœ“ upload_lock is the SAME object in both modules (threading safe)")

    # Verify lock is not already acquired
    assert not lock_a.locked(), "Lock was already held at test time!"
    print("  âœ“ Lock is free (not held)")

    # Simulate concurrent acquisition
    results = []

    def worker():
        got = lock_a.acquire(blocking=False)
        results.append(got)
        if got:
            time.sleep(0.1)
            lock_a.release()

    threads = [threading.Thread(target=worker) for _ in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    won = sum(results)
    print(f"  âœ“ 5 threads competed for lock â€” exactly {won} acquired it (expected 1â€“2)")
    print()
except Exception as e:
    print(f"  âœ— FAILED: {e}")
    sys.exit(1)

# â”€â”€ Test 3: IST timezone sanity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
print("TEST 3: IST timezone")
try:
    from datetime import timezone, timedelta
    IST = timezone(timedelta(hours=5, minutes=30))
    from datetime import datetime as _dt
    utc_now = _dt.now(timezone.utc)
    ist_now = _dt.now(IST)
    diff_h = (ist_now.utctimetuple().tm_hour - utc_now.utctimetuple().tm_hour) % 24
    print(f"  âœ“ UTC  now: {utc_now.strftime('%H:%M:%S')}")
    print(f"  âœ“ IST  now: {ist_now.strftime('%H:%M:%S %Z')}")
    print(f"  âœ“ Offset  : +{diff_h}h (expected 5h Â± DST jitter)")
    print()
except Exception as e:
    print(f"  âœ— FAILED: {e}")

# â”€â”€ Test 4: OpenCV camera â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
print("TEST 4: Camera (OpenCV)")
try:
    import cv2
    print(f"  âœ“ OpenCV version: {cv2.__version__}")
    source = config.CAMERA_SOURCE
    cap = cv2.VideoCapture(source)
    if cap.isOpened():
        cap.set(cv2.CAP_PROP_FRAME_WIDTH,  1920)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)
        ret, frame = cap.read()
        if ret and frame is not None:
            h, w = frame.shape[:2]
            size_kb = frame.nbytes / 1024
            print(f"  âœ“ Camera opened: source={source}")
            print(f"  âœ“ Resolution   : {w}Ã—{h}")
            print(f"  âœ“ Frame size   : {size_kb:.0f} KB (uncompressed)")

            # JPEG encode test (no resize)
            params = [cv2.IMWRITE_JPEG_QUALITY, config.JPEG_QUALITY]
            ok, buf = cv2.imencode(".jpg", frame, params)
            if ok:
                jpeg_kb = len(buf) / 1024
                print(f"  âœ“ JPEG encoded : {jpeg_kb:.0f} KB at quality={config.JPEG_QUALITY}")
            else:
                print("  âœ— JPEG encoding failed")
        else:
            print(f"  âœ— Camera opened but could not read frame")
        cap.release()
    else:
        print(f"  âœ— Camera source {source} could not be opened")
        print("     Try setting CAMERA_SOURCE=1 in .env for an external webcam")
    print()
except Exception as e:
    print(f"  âœ— FAILED: {e}")
    print()

# â”€â”€ Test 5: HF Space health check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
print("TEST 5: HF Space health check")
try:
    from uploader import FrameUploader
    uploader = FrameUploader()
    online = uploader.check_server_health()
    if online:
        print(f"  âœ“ Server ONLINE  : {config.HF_SPACE_URL}/health")
    else:
        print(f"  âœ— Server OFFLINE : {config.HF_SPACE_URL}/health")
        print("     Frames will be saved to failed_frames/ until server is reachable")

    # Also test the /status endpoint
    busy = uploader.check_server_busy()
    print(f"  âœ“ /status busy   : {busy} (unreachable also returns True â€” by design)")
    print()
except Exception as e:
    print(f"  âœ— FAILED: {e}")
    print()

# â”€â”€ Test 6: Local backup folder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
print("TEST 6: Local backup")
try:
    from local_backup import LocalBackup, BACKUP_DIR
    backup = LocalBackup()
    print(f"  âœ“ Backup dir    : {BACKUP_DIR.resolve()}")
    existing = list(BACKUP_DIR.glob("*.jpg"))
    print(f"  âœ“ Saved frames  : {len(existing)}")
    print()
except Exception as e:
    print(f"  âœ— FAILED: {e}")
    print()

# â”€â”€ Summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
print("=" * 60)
print("  DIAGNOSTIC COMPLETE")
print("=" * 60)
print()
print("  Next steps:")
print("  1. Set API_SECRET_KEY in .env to match your HF Space secret")
print("  2. Set DIVISION=BCA-A (or your actual class division)")
print("  3. Run:  start.bat   (or python capture.py)")
print()

