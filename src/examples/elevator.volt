hardware {
    pin motor_up: Output = 32
    pin motor_down: Output = 33
    pin door_open: Output = 23
    pin door_close: Output = 4
    pin call_0: PullUpInput = 18
    pin call_1: PullUpInput = 19
    pin call_2: PullUpInput = 21
    pin beam: PullUpInput = 22
    pin estop: PullUpInput = 17
    pin reset: PullUpInput = 16
    pin level: Analog = 34
}

var floor: int = 0

var target: int = 0

every 20ms {
    floor = level.read() / 1365
    if call_0.is_pressed() {
        target = 0
    }
    if call_1.is_pressed() {
        target = 1
    }
    if call_2.is_pressed() {
        target = 2
    }
}

machine elevator {
    initial state idle {
        on target > floor -> going_up
        on target < floor -> going_down
    }

    state going_up {
        enter { motor_up.on() }
        exit { motor_up.off() }
        on estop.is_pressed() -> stopped
        on floor == target -> doors_open
    }

    state going_down {
        enter { motor_down.on() }
        exit { motor_down.off() }
        on estop.is_pressed() -> stopped
        on floor == target -> doors_open
    }

    state doors_open {
        enter { door_open.on() }
        exit { door_open.off() }
        after 5s -> doors_closing
    }

    state doors_closing {
        enter { door_close.on() }
        exit { door_close.off() }
        on beam.is_pressed() -> doors_open
        after 3s -> idle
    }

    state stopped {
        on reset.is_pressed() -> idle
    }
}
