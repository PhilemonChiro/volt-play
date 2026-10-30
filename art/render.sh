#!/bin/sh
# Renders the course tiles: for each figure, the FRAMES frames of its loop laid out on one page (art/still.js,
# ?sheet), shot once by headless Chrome on a transparent background and cut apart, cropped together to the
# drawing, padded to 3:2, and written to
# public/learn/<course>.webp (the still, at the figure's best moment) and <course>-loop.webp (the loop from there).
#   sh art/render.sh [course ...]
set -eu
G="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DIR=$(cd "$(dirname "$0")" && pwd)
OUT="$DIR/../public/learn"
FRAMES=36                    # 3.6 s at 10 frames a second (art/anim.js ANIM_LOOP_MS), on a 6 x 6 sheet
TMP=$(mktemp -d)

# course figure still-frame
TILES="tour desk-lamp 18
pins breadboard 0
time metronome 0
machines traffic-light 0
tasks gears 0
devices weather-station 0
storage safe 0
channels mailbox 25
failures router 0"

echo "$TILES" | while read -r c n still; do
  [ $# -gt 0 ] && ! echo " $* " | grep -q " $c " && continue
  mkdir -p "$TMP/$c"
  "$G" --headless=new --hide-scrollbars --user-data-dir="$(mktemp -d)" --force-device-scale-factor=2 --default-background-color=00000000 \
    --window-size=3600,2400 --virtual-time-budget=5000 --screenshot="$TMP/$c/sheet.png" \
    "file://$DIR/$n.html?still&t=0&sheet=$FRAMES&first=$still" 2>/dev/null
  magick "$TMP/$c/sheet.png" -crop 1200x800 +repage "$TMP/$c/%02d.png"
  rm "$TMP/$c/sheet.png"
  # one crop for every frame: the box around everything drawn in any of them
  box=$(magick "$TMP/$c"/*.png -background none -layers merge -trim -format '%wx%h%X%Y' info:)
  magick "$TMP/$c"/*.png -crop "$box" +repage -bordercolor none -border 50 -background none -gravity center \
    -resize 675x450 -extent 720x480 "$TMP/$c/f%02d.png"
  magick "$TMP/$c/f00.png" -quality 88 -define webp:alpha-quality=100 "$OUT/$c.webp"
  magick -delay 10 -loop 0 "$TMP/$c"/f*.png -quality 72 -define webp:alpha-quality=80 -define webp:method=6 "$OUT/$c-loop.webp"
  echo "$c: $(du -h "$OUT/$c-loop.webp" | cut -f1)"
done
rm -rf "$TMP"
