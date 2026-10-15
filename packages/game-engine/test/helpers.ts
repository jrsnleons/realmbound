import { advanceTo, applyAction, createHabit, createInitialState, type Action, type Habit, type HabitInput, type PlayerState } from '../src';

export const START = '2026-10-12'; // a Monday

export function makePlayer(inputs: HabitInput[] = defaultHabits(), start = START) {
  let habits: Habit[] = [];
  inputs.forEach((input, i) => {
    habits.push(createHabit(`h${i + 1}`, input, habits, start).habit);
  });
  const state = createInitialState({ seed: 42, today: start });
  return { state, habits };
}

export function defaultHabits(): HabitInput[] {
  return [
    { name: 'Walk home', days: [1, 2, 3, 4, 5] },
    { name: 'Avoid junk food after work', days: [1, 2, 3, 4, 5] },
    { name: 'Drink water' },
    { name: 'Study for 30 minutes', days: [1, 2, 3, 4, 5], isMain: false },
  ];
}

export class Sim {
  constructor(
    public state: PlayerState,
    public habits: Habit[],
  ) {}

  static start(inputs?: HabitInput[]) {
    const { state, habits } = makePlayer(inputs);
    return new Sim(state, habits);
  }

  goTo(date: string) {
    const r = advanceTo(this.state, this.habits, date);
    this.state = r.state;
    this.habits = r.habits;
    return r;
  }

  act(action: Action, hour = 18) {
    const r = applyAction(this.state, this.habits, action, { hour });
    this.state = r.state;
    return r;
  }

  habit(name: string) {
    const h = this.habits.find((x) => x.name === name);
    if (!h) throw new Error(`no habit ${name}`);
    return h;
  }

  /** Does every scheduled habit today (resisting avoid habits) and logs a good night. */
  perfectDay() {
    const wd = new Date(`${this.state.today}T00:00:00Z`).getUTCDay();
    for (const h of this.habits) {
      if (!h.days.includes(wd) || h.archived) continue;
      if (h.kind === 'avoid') this.act({ type: 'avoidCheckin', habitId: h.id, resisted: true });
      else this.act({ type: 'logHabit', habitId: h.id });
    }
    if (!this.state.sleep[this.state.today]) this.act({ type: 'logSleep', hours: 8 });
  }
}
