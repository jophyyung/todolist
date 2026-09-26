import { addDays, atTime, HOUR, MINUTE, nextOccurrence, startOfDay } from './dates';
import type { Priority, Repeat } from './types';

export type QuickAdd = {
  title: string;
  dueAt: number | null;
  repeat: Repeat;
  priority: Priority;
  /** True if any date, time, repeat or priority was recognised. */
  matched: boolean;
};

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const WEEKDAY = '(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|sday|urday)?';
const END = '(?=\\s|$|[,.;])';

function weekdayIndex(word: string): number {
  return WEEKDAYS.indexOf(word.slice(0, 3).toLowerCase());
}

/**
 * Pulls a due date, repeat and priority out of free text, e.g.
 * "gym tomorrow 6pm", "stand-up every weekday 9:30", "call mum fri at 5 !".
 * Dates are day-first (25/12). Anything not recognised stays in the title.
 */
export function parseQuickAdd(input: string, now: number): QuickAdd {
  let text = ` ${input} `;
  const take = (source: string): RegExpExecArray | null => {
    const m = new RegExp(`(^|\\s)${source}${END}`, 'i').exec(text);
    if (m) text = text.slice(0, m.index) + ' '.repeat(m[0].length) + text.slice(m.index + m[0].length);
    return m;
  };

  let priority: Priority = 0;
  const bang = take('(!{1,3})');
  if (bang) priority = bang[2].length >= 2 ? 2 : 1;

  let repeat: Repeat = 'none';
  let day: number | null = null;
  const today = startOfDay(now);
  const upcomingWeekday = (idx: number, forceNext: boolean) => {
    let ahead = (idx - new Date(today).getDay() + 7) % 7;
    if (ahead === 0 && forceNext) ahead = 7;
    return addDays(today, ahead);
  };

  const rep = take(`(every\\s+(day|weekday|week|${WEEKDAY})|daily|weekly|weekdays)`);
  if (rep) {
    const what = (rep[3] ?? rep[2]).toLowerCase();
    if (what === 'day' || what === 'daily') repeat = 'daily';
    else if (what === 'weekday' || what === 'weekdays') repeat = 'weekdays';
    else if (what === 'week' || what === 'weekly') repeat = 'weekly';
    else {
      repeat = 'weekly';
      day = upcomingWeekday(weekdayIndex(what), false);
    }
  }

  const rel = take('in\\s+(\\d+)\\s*(m|mins?|minutes?|h|hrs?|hours?|d|days?)');
  if (rel) {
    const n = Number(rel[2]);
    const unit = rel[3][0].toLowerCase();
    const dueAt = unit === 'm' ? now + n * MINUTE : unit === 'h' ? now + n * HOUR : addDays(now, n);
    return { title: cleanTitle(text, input), dueAt, repeat, priority, matched: true };
  }

  let defaultHour = 9;
  const dayWord = take(`(?:on\\s+)?(today|tonight|tomorrow|tmrw?|next\\s+week|(next\\s+)?${WEEKDAY})`);
  if (dayWord) {
    const w = dayWord[2].toLowerCase();
    if (w === 'today') day = today;
    else if (w === 'tonight') {
      day = today;
      defaultHour = 20;
    } else if (w.startsWith('tom') || w.startsWith('tmr')) day = addDays(today, 1);
    else if (w.replace(/\s+/, ' ') === 'next week') day = upcomingWeekday(1, true);
    else day = upcomingWeekday(weekdayIndex(dayWord[4]), Boolean(dayWord[3]));
  }

  const date = take('(?:on\\s+)?(\\d{1,2})/(\\d{1,2})');
  if (date) {
    const d = new Date(today);
    d.setMonth(Number(date[3]) - 1, Number(date[2]));
    if (d.getTime() < today) d.setFullYear(d.getFullYear() + 1);
    day = d.getTime();
  }

  let hour: number | null = null;
  let minute = 0;
  const ampm = take('(?:at\\s+|@)?(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)');
  const clock = ampm ? null : take('(?:at\\s+|@)?(\\d{1,2}):(\\d{2})');
  const bare = ampm || clock ? null : take('(?:at|@)\\s*(\\d{1,2})');
  const word = ampm || clock || bare ? null : take('(noon|midnight|morning|afternoon|evening)');
  if (ampm) {
    hour = (Number(ampm[2]) % 12) + (ampm[4].toLowerCase() === 'pm' ? 12 : 0);
    minute = Number(ampm[3] ?? 0);
  } else if (clock) {
    hour = Number(clock[2]);
    minute = Number(clock[3]);
  } else if (bare) {
    hour = Number(bare[2]);
    if (hour >= 1 && hour <= 7) hour += 12; // "at 5" almost always means 5pm
  } else if (word) {
    hour = { noon: 12, midnight: 0, morning: 9, afternoon: 15, evening: 19 }[word[2].toLowerCase()]!;
  }
  if (hour != null && (hour > 23 || minute > 59)) hour = null;

  let dueAt: number | null = null;
  if (day != null || hour != null || repeat !== 'none') {
    const explicitDay = day != null;
    dueAt = atTime(day ?? today, hour ?? defaultHour, hour != null ? minute : 0);
    if (dueAt <= now) {
      if (repeat !== 'none') dueAt = nextOccurrence(dueAt, repeat, now);
      else if (!explicitDay) dueAt = addDays(dueAt, 1);
      else if (hour == null && day === today) dueAt = Math.ceil((now + 1) / HOUR) * HOUR;
    }
  }

  const matched = dueAt != null || priority !== 0;
  return { title: cleanTitle(text, input), dueAt, repeat, priority, matched };
}

function cleanTitle(remaining: string, original: string): string {
  const title = remaining
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+(at|on|by|in|every|,)$/i, '')
    .trim();
  return title || original.trim();
}
