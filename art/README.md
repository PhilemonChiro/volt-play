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

Open a figure in a browser to turn it round and see its loop: each figure has one short motion (`anim.js`,
3.6 s) that shows its course's idea: the lamp switching on, the LED blinking, the gears turning in mesh, the
pendulum beating, the lights cycling, the anemometer spinning, the dial turning, a letter going in, the router
retrying and connecting.

`sh art/render.sh [course ...]` makes the tiles. It lays the 36 frames of a figure's loop out on one page
(`still.js`, `?still&sheet=36`), shoots it once with headless Chrome on a transparent background, cuts the
frames apart, crops them all to the same box around the drawing, and writes `public/learn/<course>.webp`
(the still) and `<course>-loop.webp` (the loop, which the gallery plays while a tile is pointed at or focused).
