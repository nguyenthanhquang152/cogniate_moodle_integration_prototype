#!/usr/bin/env bash
# Makes the narrated explainer video from script.json. One command, local and free.
#   Needs: macOS (say, afinfo), Docker, Node, and `npm ci` at the repo root (for playwright-core).
#   Usage: bash docs/human_review/video/build.sh [en|vi|all]      (default: all)
#   Output: docs/human_review/video/explainer-<lang>.mp4
#   Scratch: .tmp/docs/video/<lang>/ (git-ignored; delete it at any time)
# Steps per language: say -> one AIFF per slide; Playwright -> one PNG per slide;
# ffmpeg -> still slides at 5 fps, H.264 CRF 30, mono AAC 64 kbit/s. Slide time = clip time + PAD.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
SCRIPT="$HERE/script.json"
PW_IMAGE="mcr.microsoft.com/playwright:v1.56.0-noble"
FF_IMAGE="linuxserver/ffmpeg@sha256:742e17516dd4d7b76b939d774bd08f0f6b7cab8bce1c014b95ab2fb992fd0a1f"
PAD=0.8
MAX_SECONDS=240
MAX_BYTES=8000000

for tool in say afinfo docker node; do
  command -v "$tool" >/dev/null || { echo "Missing tool: $tool (this script needs macOS, Docker and Node)." >&2; exit 1; }
done
[[ -f "$REPO/node_modules/playwright-core/package.json" ]] || { echo "Run npm ci at the repo root first." >&2; exit 1; }

build_lang() {
  local lang="$1" work="$REPO/.tmp/docs/video/$1"
  rm -rf "$work" && mkdir -p "$work"
  local voice rate
  voice=$(node -e 'const s=require(process.argv[1]);console.log(s.meta.voices[process.argv[2]].voice)' "$SCRIPT" "$lang")
  rate=$(node -e 'const s=require(process.argv[1]);console.log(s.meta.voices[process.argv[2]].rate)' "$SCRIPT" "$lang")

  # 1. Narration: one clip per slide.
  local texts=() durs=() i=0 line
  while IFS= read -r line; do texts+=("$line"); done < <(node -e \
    'const s=require(process.argv[1]);for(const x of s.slides)console.log(x.say[process.argv[2]].replace(/\s+/g," "))' "$SCRIPT" "$lang")
  for line in "${texts[@]}"; do
    i=$((i + 1))
    local clip; clip="$work/a$(printf %02d "$i").aiff"
    say -v "$voice" -r "$rate" -o "$clip" "$line"
    durs+=("$(afinfo "$clip" | awk -v pad="$PAD" '/estimated duration/ {printf "%.3f", $3 + pad}')")
  done
  local n=${#texts[@]}
  echo "[$lang] $n clips, voice $voice, rate $rate"

  # 2. Slides: one PNG per slide.
  docker run --rm --ipc=host -v "$REPO:/repo:ro" -v "$work:/out" "$PW_IMAGE" \
    node /repo/docs/human_review/video/render.cjs "$lang" /out

  # 3. Merge: still images with durations + padded clips.
  local list="$work/images.txt" inputs=() filter="" joins=""
  : > "$list"
  for ((k = 1; k <= n; k++)); do
    printf "file 'slide-%02d.png'\nduration %s\n" "$k" "${durs[k - 1]}" >> "$list"
    inputs+=(-i "/w/a$(printf %02d "$k").aiff")
    filter+="[$k:a]apad=whole_dur=${durs[k - 1]}[a$k];"
    joins+="[a$k]"
  done
  printf "file 'slide-%02d.png'\n" "$n" >> "$list"   # the concat demuxer needs the last file twice
  filter+="${joins}concat=n=$n:v=0:a=1,aresample=44100[a];[0:v]fps=5,format=yuv420p[v]"
  local out="explainer-$lang.mp4"
  docker run --rm -v "$work:/w" -v "$HERE:/o" "$FF_IMAGE" -hide_banner -loglevel error -y \
    -f concat -safe 0 -i /w/images.txt "${inputs[@]}" -filter_complex "$filter" -map "[v]" -map "[a]" \
    -c:v libx264 -preset slow -tune stillimage -crf 30 -c:a aac -b:a 64k -ac 1 \
    -metadata title="Cogniate x Moodle prototype ($lang)" -movflags +faststart "/o/$out"

  # 4. Check length and size.
  local secs bytes
  secs=$(docker run --rm --entrypoint ffprobe -v "$HERE:/o" "$FF_IMAGE" -v error -show_entries format=duration -of csv=p=0 "/o/$out")
  bytes=$(stat -f %z "$HERE/$out")
  echo "[$lang] $HERE/$out: ${secs%.*} s, $((bytes / 1024)) KB"
  awk -v s="$secs" -v m="$MAX_SECONDS" 'BEGIN { exit !(s <= m) }' || { echo "[$lang] too long: limit $MAX_SECONDS s" >&2; return 1; }
  (( bytes <= MAX_BYTES )) || { echo "[$lang] too big for git: limit $MAX_BYTES bytes. Keep it out of git." >&2; return 1; }
}

case "${1:-all}" in
  en | vi) build_lang "$1" ;;
  all) build_lang en && build_lang vi ;;
  *) echo "Usage: $0 [en|vi|all]" >&2; exit 2 ;;
esac
