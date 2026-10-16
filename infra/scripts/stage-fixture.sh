#!/usr/bin/env bash
# Copy one course zip (untrusted data) into an emptied infra/.data/fixtures (mounted read-only in Moodle
# at /opt/cogniate/fixtures). No extraction on the host. The dir is emptied in place: it is bind-mounted.
# Usage: infra/scripts/stage-fixture.sh <path-to-zip> <target-name.zip>
set -euo pipefail
source "$(dirname "$0")/lib.sh"
src="$1"; name="$2"
[[ "$name" =~ ^[A-Za-z0-9._-]+\.zip$ ]] || { echo "target name must be a simple .zip name" >&2; exit 1; }
dir="$INFRA_DIR/.data/fixtures"
mkdir -p "$dir" && find "$dir" -mindepth 1 -delete
cp "$src" "$dir/$name"
chmod 444 "$dir/$name"
shasum -a 256 "$dir/$name"
echo "In the Moodle container: /opt/cogniate/fixtures/$name"
