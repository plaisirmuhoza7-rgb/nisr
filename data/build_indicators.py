"""Build the public, source-backed insight bundle from curated NISR aggregates."""
from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
INPUT = ROOT / "data" / "curated_aggregates.json"
OUTPUT = ROOT / "data" / "insights.json"
REQUIRED = {
    "id", "label", "value", "unit", "year", "definition", "population",
    "locator", "sourceTitle", "sourceUrl", "limitation", "productImplication",
}


def main() -> None:
    record = json.loads(INPUT.read_text(encoding="utf-8"))
    ids: set[str] = set()
    for item in record["indicators"]:
        missing = REQUIRED - item.keys()
        if missing:
            raise ValueError(f"{item.get('id', '<unknown>')} missing {sorted(missing)}")
        if item["id"] in ids:
            raise ValueError(f"duplicate indicator id: {item['id']}")
        ids.add(item["id"])
        if not isinstance(item["value"], (int, float)) or not 0 <= item["value"] <= 100:
            raise ValueError(f"invalid percentage for {item['id']}")
        if not item["locator"].strip() or not item["definition"].strip() or not item["limitation"].strip():
            raise ValueError(f"incomplete provenance or interpretation for {item['id']}")
        if urlparse(item["sourceUrl"]).scheme != "https":
            raise ValueError(f"non-HTTPS source for {item['id']}")
    output = {k: record[k] for k in ("indicators", "sources", "methodology", "competition")}
    OUTPUT.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
