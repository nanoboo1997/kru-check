"""Export non-sensitive 31x31 accepted-mark masks for the browser runtime.

This does not modify the Python source archive.  It only converts the `masks`
uint8 array from accepted_marks.npz into deterministic base64 JSON.
"""
from __future__ import annotations

import argparse
import base64
import json
from pathlib import Path

import numpy as np


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path)
    args = parser.parse_args()
    with np.load(args.source, allow_pickle=False) as archive:
        masks = archive["masks"]
    if masks.shape != (17, 31, 31) or masks.dtype != np.uint8:
        raise SystemExit(f"Unexpected accepted-marks array: {masks.shape} {masks.dtype}")
    payload = {
        "source": "accepted_marks.npz:masks",
        "shape": list(masks.shape),
        "encoding": "base64-uint8",
        "data": base64.b64encode(masks.tobytes(order="C")).decode("ascii"),
    }
    args.target.parent.mkdir(parents=True, exist_ok=True)
    args.target.write_text(json.dumps(payload, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
