import blink from './examples/blink.volt?raw';
import tasks from './examples/tasks.volt?raw';
import states from './examples/states.volt?raw';
import elevator from './examples/elevator.volt?raw';
import distance from './examples/distance.volt?raw';
import weather from './examples/weather.volt?raw';

export type Example = { id: string; name: string; about: string; source: string };

export const examples: Example[] = [
  { id: 'blink', name: 'Blink', about: 'Three LEDs, each on its own timer', source: blink },
  { id: 'tasks', name: 'Tasks', about: 'Wi-Fi, MQTT and a 1 ms motor loop', source: tasks },
  { id: 'states', name: 'State machine', about: 'An LED driven by states and timeouts', source: states },
  { id: 'elevator', name: 'Elevator', about: 'Three floors, doors and an emergency stop', source: elevator },
  { id: 'distance', name: 'Distance alert', about: 'An HC-SR04 sensor that lights an LED', source: distance },
  { id: 'weather', name: 'Weather station', about: 'Analog sensors, channels and saved counters', source: weather },
];
