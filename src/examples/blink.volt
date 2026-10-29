/* Three LEDs blinking at different rates */

hardware {
    pin green = 23
    pin red = 22
    pin yellow = 21
}

every 100ms { red.toggle() }
every 400ms { green.toggle() }
every 600ms { yellow.toggle() }
