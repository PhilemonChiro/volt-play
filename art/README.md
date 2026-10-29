# Course illustrations

One figure per Learn Volt course, drawn with [Colorfigures](https://april-zhu.com/colorfigures)
by April Zhu (MIT, see LICENSE-colorfigures; `core.js` is its engine).

| Course | Figure |
|---|---|
| The tour | desk-lamp.html |
| Pins and modes | breadboard.html |
| Time | metronome.html |
| State machines | traffic-light.html |
| Tasks | gears.html |
| Sensors and parts | weather-station.html |
| Storage | safe.html |
| Channels | mailbox.html |
| When things fail | router.html |

Open a figure in a browser to turn it round. To make the tile images, render the stills
(`sh art/render.sh OUTDIR name...` takes `?still` screenshots with headless Chrome, on a transparent
background), then trim them and pad to 3:2, keeping the transparency, into `public/learn/<course>.webp`.
