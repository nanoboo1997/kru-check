"""Generate fresh question-level reference decisions from production Python OMR."""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import cv2


FIXTURES = (
    ("crossed-20.png", "standard", False, 20, "expected-20.json", 20),
    ("crossed-shadow-20.jpg", "standard", False, 20, "expected-20.json", 20),
    ("tilted-shadow-20.jpg", "standard", False, 20, "expected-20.json", 20),
    ("standard-crossed-40.png", "legacy", False, 40, "expected-cross-40.json", 10),
    ("reference-crossed-shadow-40.jpg", "legacy", False, 40, "expected-cross-40.json", 10),
    ("real-thin-x-table-sanitized.png", "normalized", True, 40, "expected-cross-40.json", 10),
    ("real-q28-cancelled-change-sanitized.jpg", "legacy", False, 40, "expected-cross-40.json", 10),
    ("legacy-three-marker-iphone-sanitized.jpg", "legacy", False, 40, "expected-cross-40.json", 10),
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stable", type=Path, required=True)
    parser.add_argument("--fixtures", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    sys.path.insert(0, str(args.stable.resolve()))
    from omr import (  # pylint: disable=import-outside-toplevel
        answer_geometry,
        grade,
        read_answer_details,
        rectify,
        rectify_legacy,
    )

    cases = []
    for filename, mode, normalized_only, count, key_filename, maximum in FIXTURES:
        path = args.fixtures / filename
        key = json.loads((args.stable / "samples" / key_filename).read_text())["key"]
        started = time.perf_counter()
        image = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE if normalized_only else cv2.IMREAD_COLOR)
        if image is None:
            raise SystemExit(f"Cannot read fixture: {path}")
        if normalized_only:
            normalized = image
            alignment = {"success": True, "method": "pre-normalized-table"}
        elif mode == "legacy":
            _, normalized, _ = rectify_legacy(image)
            alignment = {
                "success": True,
                "method": "3-marker-recovery" if filename.startswith("legacy-three-marker") else "legacy-4-marker-or-table",
            }
        else:
            _, normalized, _ = rectify(image)
            alignment = {"success": True, "method": "4-marker"}
        answers, measurements, uncertain, reasons = read_answer_details(
            normalized, count, allow_legacy_table=mode == "legacy" or normalized_only
        )
        layout, _ = answer_geometry(normalized, count, allow_legacy_table=mode == "legacy" or normalized_only)
        grading = grade(answers, key, maximum)
        cases.append({
            "fixture": filename,
            "mode": mode,
            "normalizedOnly": normalized_only,
            "count": count,
            "key": key,
            "maximum": maximum,
            "alignment": alignment,
            "layout": layout,
            "answers": answers,
            "measurements": measurements,
            "uncertain": uncertain,
            "reasons": {str(index): reason for index, reason in reasons.items()},
            "score": grading["score"],
            "statuses": grading["statuses"],
            "pythonMs": round((time.perf_counter() - started) * 1000, 2),
        })
    payload = {
        "schema": 1,
        "reference": "production Python/OpenCV OMR",
        "cases": cases,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
