#!/usr/bin/env bash
# T5-spike (throwaway): stage the untrusted course packages and scorm-again into .tmp/player-spike/ (git-ignored,
# ignored by ESLint). The zips are copied into a new empty folder, the entry names are checked, then each zip is
# extracted into its own empty folder. Usage: bash apps/player-spike/stage.sh
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="${COURSE_FIXTURES_DIR:-$REPO/docs/raw/data/courses}"
D="$REPO/.tmp/player-spike"
rm -rf "$D/zips" "$D/pkg-scorm" "$D/pkg-html" "$D/scorm-again"
mkdir -p "$D/zips" "$D/pkg-scorm" "$D/pkg-html" "$D/scorm-again"
cp "$SRC/Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-scorm-v2.zip" "$D/zips/scorm.zip"
cp "$SRC/Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-html.zip" "$D/zips/html.zip"
for z in scorm html; do
  if zipinfo -1 "$D/zips/$z.zip" | grep -qE '(^/|(^|/)\.\.(/|$)|\\|^[A-Za-z]:)'; then echo "Unsafe entry name in $z.zip" >&2; exit 1; fi
  if zipinfo "$D/zips/$z.zip" | awk '$1 ~ /^l/' | grep -q .; then echo "Symlink entry in $z.zip" >&2; exit 1; fi
  unzip -q "$D/zips/$z.zip" -d "$D/pkg-$z"
done
(cd "$D/scorm-again" && npm pack scorm-again@3.4.6 --silent >/dev/null && tar -xzf scorm-again-3.4.6.tgz)
echo "Staged: $D/{pkg-scorm,pkg-html,scorm-again/package}"
