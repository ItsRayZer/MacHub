import os
import sys
import json
import time
import random

# ── Make machin_backend importable ──────────────────────────────────────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "machin_backend"))

from machin_scraper import perform_sync  # perform_sync already pushes to Firebase internally

# ── Load student list ────────────────────────────────────────────────────────
STUDENTS_FILE = os.path.join(os.path.dirname(__file__), "students.json")

def load_students():
    with open(STUDENTS_FILE, "r") as f:
        return json.load(f)

# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    students = load_students()

    # On-demand mode: single student triggered by Cloudflare Worker / workflow_dispatch
    single_adm = os.environ.get("SINGLE_ADM", "").strip()
    single_pwd = os.environ.get("SINGLE_PWD", "").strip()

    if single_adm:
        pwd = single_pwd if single_pwd else single_adm  # BCA: password = admission_no
        students_to_scrape = [{"admission_no": single_adm, "password": pwd}]
        print(f"🎯 On-demand mode: scraping student {single_adm}")
    else:
        students_to_scrape = students
        print(f"📋 Batch mode: scraping {len(students_to_scrape)} students")

    success = 0
    failed  = 0

    for i, student in enumerate(students_to_scrape):
        adm = str(student["admission_no"])
        pwd = str(student.get("password", adm))  # default password = admission_no

        print(f"\n[{i+1}/{len(students_to_scrape)}] ▶ {adm}")
        try:
            data  = perform_sync(adm, pwd)
            name  = data.get("meta", {}).get("student_name", "Unknown")
            print(f"  ✅ {name} — synced & pushed to Firebase")
            success += 1
        except Exception as e:
            print(f"  ❌ Error: {e}")
            failed += 1

        # Throttle: 3-5 s random delay to avoid overloading the portal
        if i < len(students_to_scrape) - 1:
            delay = random.uniform(3.0, 5.0)
            print(f"  ⏳ Waiting {delay:.1f}s …")
            time.sleep(delay)

    print(f"\n{'='*45}")
    print(f"  ✅ Success : {success}")
    print(f"  ❌ Failed  : {failed}")
    print(f"{'='*45}")

    if success == 0 and failed > 0:
        sys.exit(1)  # signal failure to GitHub Actions

if __name__ == "__main__":
    main()
