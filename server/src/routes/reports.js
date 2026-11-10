// Reports of a problem. Anyone can send one, with or without an email address.
// A report never stores who sent it: no account id and no IP address. A code-only report keeps
// a hash of its code. An email report keeps the address only until the admin's reply is sent.
import { Router } from 'express';
import { q, pool } from '../db.js';
import { requireAuth, normalizeEmail } from '../middleware/auth.js';
import { requireIntParam } from '../middleware/validate.js';
import { createLimiter } from '../middleware/rateLimit.js';
import { hashAnonToken } from '../services/anonToken.js';
import { makeReportCode, normalizeReportCode } from '../services/reportCode.js';
import { sendMail } from '../services/mailer.js';

// What a person sends. These routes are public.
const router = Router();
// What the admin does. Mounted at /api/admin/reports.
export const adminReports = Router();

const TYPES = ['info', 'office', 'broken', 'safety', 'idea'];
const TYPE_LABELS = {
  info: 'Wrong or out-of-date information',
  office: 'A wrong office or number',
  broken: 'Something is broken',
  safety: 'A safety or abuse concern',
  idea: 'A suggestion',
};
const STATUSES = ['received', 'in_progress', 'resolved'];
const ABOUT_KINDS = ['guide', 'route', 'provider', 'page'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Each route has its own limiter so one does not use up the budget of another.
const submitLimiter = createLimiter({
  max: 5,
  message: 'Too many reports. Please wait 15 minutes and try again.',
});
// The code is the only key to a report, so guessing is capped harder than other lookups.
const checkLimiter = createLimiter({
  max: 20,
  message: 'Too many tries. Please wait 15 minutes and try again.',
});


const text = (value) => (typeof value === 'string' ? value.trim() : '');

// Returns the clean fields or { error }.
function cleanReport(body) {
  const type = body?.type;
  if (!TYPES.includes(type)) return { error: 'Choose what this is about.' };

  const message = text(body.message);
  if (message.length < 10) return { error: 'Please tell us a little more. Use at least 10 characters.' };
  if (message.length > 2000) return { error: 'Keep the message under 2000 characters.' };

  let aboutKind = null;
  let aboutId = null;
  if (body.about_kind !== undefined && body.about_kind !== null) {
    if (!ABOUT_KINDS.includes(body.about_kind)) return { error: 'That page cannot be reported on.' };
    aboutKind = body.about_kind;
    if (aboutKind !== 'page') {
      if (!Number.isInteger(body.about_id) || body.about_id < 1 || body.about_id > 2147483647) {
        return { error: 'That page cannot be reported on.' };
      }
      aboutId = body.about_id;
    }
  }
  const aboutLabel = text(body.about_label).slice(0, 200) || null;

  // A person answers either with a code or with an email address, never both.
  const replyBy = body.reply_by;
  if (replyBy !== 'code' && replyBy !== 'email') return { error: 'Choose how we should reach you.' };
  let email = null;
  if (replyBy === 'email') {
    email = normalizeEmail(body.email);
    if (!email) return { error: 'Enter your email address.' };
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) return { error: 'That is not a valid email address.' };
  } else if (text(body.email)) {
    return { error: 'Send either an email address or ask for a code, not both.' };
  }

  return { type, message, aboutKind, aboutId, aboutLabel, replyBy, email };
}

// POST /api/reports : anyone. The code is in this one reply and nowhere else.
router.post('/', submitLimiter, async (req, res) => {
  const r = cleanReport(req.body);
  if (r.error) return res.status(400).json({ error: r.error });

  if (r.replyBy === 'email') {
    const [row] = await q(
      `INSERT INTO reports (type, about_kind, about_id, about_label, message, reply_channel, contact_email)
       VALUES ($1,$2,$3,$4,$5,'email',$6) RETURNING id`,
      [r.type, r.aboutKind, r.aboutId, r.aboutLabel, r.message, r.email]);
    return res.status(201).json({ id: row.id });
  }

  const code = makeReportCode();
  const [row] = await q(
    `INSERT INTO reports (type, about_kind, about_id, about_label, message, reply_channel, code_hash)
     VALUES ($1,$2,$3,$4,$5,'code',$6) RETURNING id`,
    [r.type, r.aboutKind, r.aboutId, r.aboutLabel, r.message, hashAnonToken(code)]);
  res.status(201).json({
    id: row.id,
    code,
    warning: 'Save this code now. It is the only way to see the answer and it cannot be recovered.',
  });
});

// POST /api/reports/check { code } : anyone with the code. A POST so the code is never in a URL.
router.post('/check', checkLimiter, async (req, res) => {
  const NOT_FOUND = { error: 'We could not find a report for that code. Check it and try again.' };
  const code = normalizeReportCode(req.body?.code);
  if (!code) return res.status(404).json(NOT_FOUND);
  const [report] = await q(
    `SELECT type, about_label, status, created_at, read_at, resolved_at, admin_reply
       FROM reports WHERE code_hash = $1`, [hashAnonToken(code)]);
  if (!report) return res.status(404).json(NOT_FOUND);
  res.json(report);
});

// ------------------------------------------------------------------------------ admin

// The columns of the list. No code hash and no email address.
const LIST_COLUMNS = `id, type, about_kind, about_id, about_label, status, reply_channel,
  left(message, 160) AS excerpt, read_at, resolved_at, created_at`;

// GET /api/admin/reports?status=&type=
adminReports.get('/', requireAuth('admin'), async (req, res) => {
  const { status, type } = req.query;
  if (status !== undefined && !STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status.' });
  if (type !== undefined && !TYPES.includes(type)) return res.status(400).json({ error: 'Unknown type.' });

  const rows = await q(
    `SELECT ${LIST_COLUMNS} FROM reports
      WHERE ($1::text IS NULL OR status = $1) AND ($2::text IS NULL OR type = $2)
      ORDER BY (type = 'safety' AND status <> 'resolved') DESC, created_at DESC, id DESC`,
    [status ?? null, type ?? null]);
  const [counts] = await q(
    `SELECT count(*) FILTER (WHERE status = 'received')::int AS received,
            count(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
            count(*) FILTER (WHERE status = 'resolved')::int AS resolved,
            count(*) FILTER (WHERE status = 'resolved' AND resolved_at >= date_trunc('month', now()))::int AS resolved_this_month,
            count(*) FILTER (WHERE type = 'safety' AND status <> 'resolved')::int AS unresolved_safety
       FROM reports`);
  res.json({ reports: rows, counts });
});

// Does the page a report is about still exist? The admin gets a link only when it does.
async function aboutExists(report) {
  const tables = { guide: 'guides', route: 'matter_routes', provider: 'providers' };
  const table = tables[report.about_kind];
  if (!table) return false;
  const rows = await q(`SELECT 1 FROM ${table} WHERE id = $1`, [report.about_id]);
  return rows.length > 0;
}

// ---- CSV download. Never the code hash, never an address.

const EXPORT_COLUMNS = ['id', 'type', 'about_kind', 'about_label', 'status', 'reply_channel', 'created_at', 'read_at', 'resolved_at', 'message', 'admin_reply'];

// One CSV cell. Always quoted. A cell that starts with = + - @ tab or CR gets a leading quote so
// a spreadsheet never runs it as a formula.
export function csvCell(value) {
  if (value === null || value === undefined) return '""';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

// GET /api/admin/reports/export?status=&type= : before /:id so "export" is not read as an id.
adminReports.get('/export', requireAuth('admin'), async (req, res) => {
  const { status, type } = req.query;
  if (status !== undefined && !STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status.' });
  if (type !== undefined && !TYPES.includes(type)) return res.status(400).json({ error: 'Unknown type.' });
  const rows = await q(
    `SELECT ${EXPORT_COLUMNS.join(', ')} FROM reports
      WHERE ($1::text IS NULL OR status = $1) AND ($2::text IS NULL OR type = $2)
      ORDER BY (type = 'safety' AND status <> 'resolved') DESC, created_at DESC, id DESC`,
    [status ?? null, type ?? null]);
  const lines = [EXPORT_COLUMNS.join(','), ...rows.map((r) => EXPORT_COLUMNS.map((c) => csvCell(r[c])).join(','))];
  // The BOM lets Excel read the file as UTF-8.
  const body = `﻿${lines.join('\r\n')}\r\n`;
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="reports-${new Date().toISOString().slice(0, 10)}.csv"`,
    'Cache-Control': 'no-store',
  });
  res.send(body);
});

// GET /api/admin/reports/:id : opening a report marks it read.
adminReports.get('/:id', requireAuth('admin'), requireIntParam('id'), async (req, res) => {
  const [report] = await q(
    `UPDATE reports SET read_at = COALESCE(read_at, now()) WHERE id = $1
     RETURNING id, type, about_kind, about_id, about_label, message, status, reply_channel,
               contact_email, admin_reply, read_at, resolved_at, created_at, updated_at`,
    [req.params.id]);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.json({ ...report, about_exists: await aboutExists(report) });
});

// The email the sender gets. It holds the reply and the kind of report and never the message.
function resolvedMail(report, reply) {
  return {
    to: report.contact_email,
    subject: 'Your report on ALU Legal Companion has been resolved',
    text: [
      'Hello,',
      '',
      `Your report (${TYPE_LABELS[report.type]}) has been resolved.`,
      '',
      reply ? `Reply from the admin:\n${reply}` : 'The admin did not add a reply.',
      '',
      'This address was used only for this message and has now been removed from our records.',
      '',
      'Legal information, not legal advice.',
    ].join('\n'),
  };
}

// PUT /api/admin/reports/:id { status, admin_reply }
// When an email report is resolved, one email goes out. The address is erased only after the
// send worked. If the send fails the address stays and saving again tries once more.
adminReports.put('/:id', requireAuth('admin'), requireIntParam('id'), async (req, res) => {
  const status = req.body?.status;
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Choose a status.' });
  const reply = text(req.body?.admin_reply);
  if (reply.length > 1000) return res.status(400).json({ error: 'Keep the reply under 1000 characters.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // The row stays locked while the mail is sent so two saves cannot send it twice.
    const { rows: [report] } = await client.query('SELECT * FROM reports WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!report) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Report not found' });
    }

    let delivery = null;
    let eraseEmail = false;
    if (status === 'resolved' && report.contact_email) {
      try {
        await sendMail(resolvedMail(report, reply));
        delivery = 'sent';
        eraseEmail = true;
      } catch (err) {
        console.error('[reports] could not send the resolved mail', { id: report.id, name: err.name });
        delivery = 'failed';
      }
    }

    const { rows: [saved] } = await client.query(
      `UPDATE reports
          SET status = $1::text, admin_reply = $2, updated_at = now(),
              read_at = COALESCE(read_at, now()),
              resolved_at = CASE WHEN $1 = 'resolved' THEN COALESCE(resolved_at, now()) ELSE NULL END,
              contact_email = CASE WHEN $3::boolean THEN NULL ELSE contact_email END
        WHERE id = $4
        RETURNING id, type, status, reply_channel, admin_reply, read_at, resolved_at, updated_at,
                  (contact_email IS NOT NULL) AS has_email`,
      [status, reply || null, eraseEmail, report.id]);
    await client.query('COMMIT');
    res.json(delivery ? { ...saved, delivery } : saved);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});

export default router;
