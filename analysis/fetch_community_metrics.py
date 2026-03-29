#!/usr/bin/env python3
"""
CLI: запрос метрик GitHub/npm и запись в analysis/community_metrics.json
(для офлайн-запуска или если в ноутбуке нет сети).

Примеры:
  python analysis/fetch_community_metrics.py
  python analysis/fetch_community_metrics.py --output analysis/community_metrics.json
  GITHUB_TOKEN=ghp_... python analysis/fetch_community_metrics.py
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def project_root_from(start: Path) -> Path:
    for p in [start, *start.parents]:
        if (p / "bundle-analysis.json").exists():
            return p
    return start


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch community metrics from GitHub and npm")
    parser.add_argument(
        "--libraries",
        nargs="+",
        default=["ethers", "viem"],
        help="Keys of libraries (must exist in community_sources or defaults)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output JSON path (default: <root>/analysis/community_metrics.json)",
    )
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    root = project_root_from(script_dir)
    analysis_dir = root / "analysis"
    out_path = args.output or (analysis_dir / "community_metrics.json")

    sys.path.insert(0, str(analysis_dir))
    from community_api import fetch_community_metrics  # noqa: E402

    data = fetch_community_metrics(list(args.libraries), analysis_dir)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Wrote", out_path.resolve())
    if data.get("_sources_missing"):
        print("Warning: no source mapping for:", data["_sources_missing"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
