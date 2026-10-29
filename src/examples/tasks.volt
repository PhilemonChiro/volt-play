hardware {
    pin led = 2
    pin motor: PWM = 4
    pin battery: Analog = 35
}

setup {
    wifi.connect("home", "secret") or retry(10)
    mqtt.connect("mqtt://broker.local") or retry(5)
}

task blink {
    every 500ms { led.toggle() }
}

task report {
    every 5s {
        mqtt.send_int("volt/battery", battery.read())
    }
}

task drive {
    every 1ms strict { motor.set_pwm(512) }
}
