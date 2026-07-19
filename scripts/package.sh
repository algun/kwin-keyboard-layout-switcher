#!/usr/bin/env bash
# Build a KWin Script package (.kwinscript) from the repo root.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v jq >/dev/null 2>&1; then
    echo "error: jq is required" >&2
    exit 1
fi

zip_package() {
    local stage="$1"
    local out="$2"
    if command -v zip >/dev/null 2>&1; then
        (
            cd "$stage"
            zip -r "$out" metadata.json LICENSE README.md contents >/dev/null
        )
        return
    fi

    python3 - "$stage" "$out" <<'PY'
import sys
import zipfile
from pathlib import Path

stage = Path(sys.argv[1])
out = Path(sys.argv[2])
with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    for path in sorted(stage.rglob("*")):
        if path.is_file():
            zf.write(path, path.relative_to(stage).as_posix())
PY
}
PLUGIN_ID="$(jq -r '.KPlugin.Id' metadata.json)"
VERSION="$(jq -r '.KPlugin.Version' metadata.json)"

if [[ -z "$PLUGIN_ID" || "$PLUGIN_ID" == "null" ]]; then
    echo "error: missing KPlugin.Id in metadata.json" >&2
    exit 1
fi

if [[ -z "$VERSION" || "$VERSION" == "null" ]]; then
    echo "error: missing KPlugin.Version in metadata.json" >&2
    exit 1
fi

OUT="${1:-${PLUGIN_ID}-${VERSION}.kwinscript}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

STAGE="$TMP/package"
mkdir -p "$STAGE"

cp metadata.json LICENSE README.md "$STAGE/"
cp -a contents "$STAGE/contents"

# Validate required package layout
test -f "$STAGE/metadata.json"
test -f "$STAGE/contents/code/main.js"
test -f "$STAGE/contents/config/main.xml"
test -f "$STAGE/contents/ui/config.ui"

rm -f "$OUT"
zip_package "$STAGE" "$ROOT/$OUT"

echo "Built $OUT"
if command -v unzip >/dev/null 2>&1; then
    unzip -l "$OUT"
else
    python3 - "$OUT" <<'PY'
import sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as zf:
    for info in zf.infolist():
        print(f"{info.file_size:8d}  {info.filename}")
PY
fi
