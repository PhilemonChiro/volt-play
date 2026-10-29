#!/bin/sh
# Renders figure stills (art/*.html with ?still) to PNGs in the given folder.
#   sh art/render.sh OUTDIR [name ...]
set -eu
OUT=$1; shift
G="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DIR=$(cd "$(dirname "$0")" && pwd)
for n in "$@"; do
  "$G" --headless=new --hide-scrollbars --user-data-dir="$(mktemp -d)" --force-device-scale-factor=2 \
    --window-size=600,400 --virtual-time-budget=3000 --screenshot="$OUT/$n.png" "file://$DIR/$n.html?still" 2>/dev/null
done
