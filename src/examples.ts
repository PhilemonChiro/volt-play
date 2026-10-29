import blink from './examples/blink.volt?raw';
import tasks from './examples/tasks.volt?raw';
import states from './examples/states.volt?raw';
import elevator from './examples/elevator.volt?raw';
import distance from './examples/distance.volt?raw';
import weather from './examples/weather.volt?raw';

export const examples = [
  { id: 'blink', name: 'Blink three LEDs', source: blink },
  { id: 'tasks', name: 'Tasks at different speeds', source: tasks },
  { id: 'states', name: 'State machine', source: states },
  { id: 'elevator', name: 'Elevator controller', source: elevator },
  { id: 'distance', name: 'Distance sensor alert', source: distance },
  { id: 'weather', name: 'Weather station', source: weather },
];
