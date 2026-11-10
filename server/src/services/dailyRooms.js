// Video rooms for consultations made with the Daily REST API.
//
// Each accepted booking gets its own private room. It is made the first time someone joins.
// The room name is random so it cannot be guessed.
// Guests knock and the lawyer admits them. Nothing is recorded.
// A room and its tokens end after four hours.
//
// The service is optional. With no DAILY_API_KEY or DAILY_DOMAIN the join route answers with the lawyer's Google Meet link.
// The server then makes no request to Daily.
import crypto from 'crypto';

const DEFAULT_API_BASE = 'https://api.daily.co/v1';
const TIMEOUT_MS = 8000;
const FOUR_HOURS_S = 4 * 60 * 60;
const DEFAULT_ROOMS_PER_DAY = 20;

// Read at call time so a changed setting is seen without a restart.
export function dailyAvailable() {
  return Boolean(process.env.DAILY_API_KEY && process.env.DAILY_DOMAIN);
}

// The most rooms that may be made in one day, in Kigali time. Unset uses the default. A value
// that is not a whole number gives 0, so a typo stops new rooms and does not spend free minutes.
export function roomsPerDay() {
  const raw = (process.env.VIDEO_ROOMS_PER_DAY ?? '').trim();
  if (raw === '') return DEFAULT_ROOMS_PER_DAY;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

// The address a guest or lawyer opens in the browser. The room name is the last part.
export function roomUrl(roomName) {
  return `https://${process.env.DAILY_DOMAIN}.daily.co/${roomName}`;
}

// One call to the Daily API. A failed call or a slow one throws. Nothing from the reply is logged.
async function callDaily(path, body) {
  const base = (process.env.DAILY_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, '');
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Daily answered ${res.status}`);
  return res.json();
}

// Makes a private room and returns its name. Recording is never switched on.
// Daily records only when a room asks for it. This one does not so the property is left out.
export async function createRoom() {
  const name = crypto.randomBytes(16).toString('hex');
  const exp = Math.floor(Date.now() / 1000) + FOUR_HOURS_S;
  await callDaily('/rooms', {
    name,
    privacy: 'private',
    properties: {
      enable_knocking: true,
      enable_chat: false,
      exp,
      eject_at_room_exp: true,
      max_participants: 2,
    },
  });
  return name;
}

// A token for one person in the room. The lawyer is the owner, so only the lawyer can admit a
// guest. audioOnly starts the call with the camera off. The person can turn it on.
export async function createToken(roomName, { owner, audioOnly = false }) {
  const exp = Math.floor(Date.now() / 1000) + FOUR_HOURS_S;
  const reply = await callDaily('/meeting-tokens', {
    properties: {
      room_name: roomName,
      is_owner: owner,
      exp,
      start_video_off: audioOnly,
    },
  });
  return reply.token;
}
