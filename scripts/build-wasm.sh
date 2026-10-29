#!/bin/sh
# Build the compiler for the browser: public/volt.wasm plus Go's loader.
# Device descriptors come from the volt repo next to this one.
set -eu
PLAY=$(cd "$(dirname "$0")/.." && pwd)
DEVICES="$PLAY/../volt/devices"
cd "$PLAY"

rm -rf wasm/devices
mkdir -p wasm/devices public
for f in "$DEVICES"/*/device.json; do
	d=$(basename "$(dirname "$f")")
	mkdir -p "wasm/devices/$d"
	cp "$f" "wasm/devices/$d/device.json"
done

GOOS=js GOARCH=wasm go build -trimpath -ldflags="-s -w" -o public/volt.wasm ./wasm
cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" public/wasm_exec.js
echo "public/volt.wasm $(du -h public/volt.wasm | cut -f1) ($(gzip -9c public/volt.wasm | wc -c | awk '{printf "%.1f MB gzipped", $1/1e6}'))"
