// The weekly consultation hours a lawyer sets. No React here, so the rules can be tested on their own.
// Days are numbered 1 (Monday) to 7 (Sunday), as the server numbers them. Times are 'HH:MM' on the
// half hour, in Kigali time.

export const MAX_WINDOWS = 14;

export const WEEKDAY_NAMES = [null, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Every half hour of the day, from 00:00 to 23:30.
export const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = String(Math.floor(i / 2)).padStart(2, '0');
  return `${hour}:${i % 2 ? '30' : '00'}`;
});

// The end of a window is after its start. It runs from 00:30 to midnight, written 24:00.
export const END_OPTIONS = [...TIME_OPTIONS.slice(1), '24:00'];

// A new window starts at nine and runs three hours. The lawyer can change both times.
const NEW_START = '09:00';
const NEW_END = '12:00';

const minutesOf = (hhmm) => {
  const [hour, minute] = hhmm.split(':').map(Number);
  return hour * 60 + minute;
};

// The first problem with a set of windows, as one plain sentence, or null when the set is fine.
// The server checks the same rules. This check saves a round trip and names the day.
export function validateWindows(windows) {
  if (windows.length > MAX_WINDOWS) return `You can add at most ${MAX_WINDOWS} windows.`;
  for (const w of windows) {
    if (minutesOf(w.end) <= minutesOf(w.start)) {
      return `The end time must be after the start time on ${WEEKDAY_NAMES[w.weekday]}.`;
    }
  }
  for (let i = 0; i < windows.length; i += 1) {
    for (let j = i + 1; j < windows.length; j += 1) {
      const a = windows[i];
      const b = windows[j];
      if (a.weekday !== b.weekday) continue;
      // Windows that only touch, such as 09:00 to 12:00 and 12:00 to 13:00, do not overlap.
      if (minutesOf(a.start) < minutesOf(b.end) && minutesOf(b.start) < minutesOf(a.end)) {
        return `Two windows on ${WEEKDAY_NAMES[a.weekday]} overlap. Change one of them.`;
      }
    }
  }
  return null;
}

let lastKey = 0;
const nextKey = () => {
  lastKey += 1;
  return lastKey;
};

// A new row for one day. The key only tells React the rows apart. It is never sent.
export function newWindow(weekday) {
  return { key: nextKey(), weekday, start: NEW_START, end: NEW_END };
}

// The rows of the editor from the windows the server sent.
export function toDraft(windows = []) {
  return windows.map((w) => ({ key: nextKey(), weekday: w.weekday, start: w.start, end: w.end }));
}

// The body of the save request: every row, in day then time order, with no keys.
export function toSaveBody(rows) {
  const windows = rows
    .map(({ weekday, start, end }) => ({ weekday, start, end }))
    .sort((a, b) => a.weekday - b.weekday || (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  return { windows };
}
