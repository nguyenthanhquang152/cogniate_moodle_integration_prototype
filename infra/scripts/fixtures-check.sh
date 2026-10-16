#!/usr/bin/env bash
# Check the two Cogniate course exports (not in git) against the SHA-256 values in infra/fixtures/courses.sha256.
# Folder: COURSE_FIXTURES_DIR (default docs/raw/data/courses). Usage: npm run fixtures:check
set -euo pipefail
source "$(dirname "$0")/lib.sh"
LIST="$INFRA_DIR/fixtures/courses.sha256"
sha() { if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }
rc=0
echo "COURSE_FIXTURES_DIR=$COURSE_FIXTURES_DIR"
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  want="${line%%  *}"; name="${line#*  }"
  file="$COURSE_FIXTURES_DIR/$name"
  if [[ ! -f "$file" ]]; then echo "MISSING  $name"; rc=1; continue; fi
  have="$(sha "$file")"
  if [[ "$have" == "$want" ]]; then echo "OK       $name"; else echo "MISMATCH $name (sha256 $have)"; rc=1; fi
done < "$LIST"
if (( rc != 0 )); then
  cat >&2 <<MSG

The course fixtures are not in git. To get them:
  1. Ask the product owner (or the Lead) for the two Cogniate exports named above
     (SCORM 1.2 "-scorm-v2.zip" and plain HTML "-html.zip").
  2. Copy them, unchanged, into $COURSE_FIXTURES_DIR
     or set COURSE_FIXTURES_DIR=/path/to/folder before the command.
  3. Run npm run fixtures:check again. The SHA-256 values must match infra/fixtures/courses.sha256.
MSG
fi
exit "$rc"
