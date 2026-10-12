/**
 * Round 13 · end-to-end browser journeys (R1 to R8) against a production build.
 *
 *   npx vite build --base ./ && npx vite preview --port 5740 --strictPort &
 *   node scripts/e2e-r13.mjs            # BASE_URL=http://localhost:5740/ by default
 *
 * Starts from clean demo data (localStorage cleared) and walks through:
 *   1. Udhaya (resource): Tasks update plan with actual time per block, an extra-hours row, today's targets by task type,
 *      submit a task from the dashboard (Submit, choose reviewer, send), send end of day (actual column fills), weekly bar list.
 *   2. Bheeshma (PM, Northwind owner): review queue with history and resubmit count, approve; Assign pulls the previous
 *      working day, difficulty badges, Assign all; Projects bar-chart progress, week pre-planning, locked numbers with
 *      Edit / Save, Edit project details (standards, custom standards add + delete, typed hours, admins, handover options).
 *   3. Prajwal (Northwind admin): can edit Northwind numbers and targets.
 *   4. Komala and Kingshuk: team Tasks update (2 KPI tiles, target vs actual, blanks until sent), People filters, badges,
 *      Where time goes, lead dashboard assignment difficulty.
 *   5. Theme: mascot on by default, toggle, sarcasm / motivation alternation, Professional Dark readability.
 *   6. Global: every visited page has no em / en dashes, no session wording, and no page errors.
 * The handover (transfer) runs last so it cannot break the other steps.
 *
 * Prints a JSON list of failures at the end (step, expected, actual, screenshot, likely file).
 * Screenshots: e2e/screenshots/r13-e2e-*.png
 */
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5740/';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'e2e', 'screenshots');
mkdirSync(OUT, { recursive: true });
// Failure screenshots from an earlier run would be misleading.
readdirSync(OUT).filter((f) => /^r13-e2e-fail-\d+\.png$/.test(f)).forEach((f) => rmSync(path.join(OUT, f)));
const KEY = 'ls-tracker-v2';

// ---------------------------------------------------------------------------------------------
// Dates (same rules as the app: weekends skipped)
// ---------------------------------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isWork = (d) => d.getDay() !== 0 && d.getDay() !== 6;
const now = new Date();
const TODAY = iso(now);
const lastWork = (() => { const d = new Date(now); while (!isWork(d)) d.setDate(d.getDate() - 1); return d; })();
const prevWork = (() => { const d = new Date(now); do d.setDate(d.getDate() - 1); while (!isWork(d)); return d; })();
const PREV = iso(prevWork);
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PREV_WEEKDAY = WEEKDAYS[prevWork.getDay()];
const monday = (d0, plusWeeks = 0) => { const d = new Date(d0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + plusWeeks * 7); return iso(d); };
const THIS_MON = monday(now);
const NEXT_MON = monday(now, 1);
const IN2_MON = monday(now, 2);
const TODAY_IS_WORKDAY = isWork(now);

// ---------------------------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------------------------
const failures = [];
const warnings = [];
let stepName = 'boot';
let failN = 0;
let page;

const shotPath = (name) => path.join(OUT, `r13-e2e-${name}.png`);
async function shot(name, full = true) {
  const p = shotPath(name);
  await page.screenshot({ path: p, fullPage: full }).catch(() => {});
  return p;
}
function step(name) { stepName = name; console.log(`\n# ${name}`); }
async function check(cond, expected, actual, file) {
  if (cond) { console.log('  ok  ', expected); return true; }
  const s = await shot(`fail-${pad(++failN)}`);
  failures.push({ step: stepName, expected, actual: String(actual ?? ''), screenshot: path.relative(ROOT, s), file: file ?? '' });
  console.log('  FAIL', expected, '| actual:', actual);
  return false;
}
function warn(msg) { warnings.push(`[${stepName}] ${msg}`); console.log('  warn', msg); }
async function guard(label, file, fn) {
  try { await fn(); } catch (e) { await check(false, `${label} completes without a script / UI error`, (e?.message ?? String(e)).split('\n')[0], file); }
}

// ---------------------------------------------------------------------------------------------
// Browser helpers
// ---------------------------------------------------------------------------------------------
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => { pageErrors.push({ step: stepName, msg: e.message }); console.log('  PAGEERROR', e.message); });
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::|Failed to load resource/i.test(m.text())) warn(`console.error: ${m.text().slice(0, 200)}`); });
page.on('dialog', (d) => d.dismiss().catch(() => {}));

const store = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}').state, KEY);
const sleep = (ms) => page.waitForTimeout(ms);
async function as(id) {
  try {
    if (!(await page.locator('select[aria-label="Viewing as"]').count())) await gotoRetry(BASE);
    await page.selectOption('select[aria-label="Viewing as"]', id, { timeout: 10000 });
    await sleep(300);
  } catch (e) {
    await check(false, `switch persona to ${id}`, (e?.message ?? String(e)).split('\n')[0], 'src/v2/App.tsx');
  }
}
/** page.goto with a few retries (the preview server can be restarted while the run is in progress). */
async function gotoRetry(url) {
  for (let i = 0; ; i++) {
    try { return await page.goto(url); } catch (e) {
      if (i >= 4 || !/ERR_CONNECTION|ECONNREFUSED/.test(String(e))) throw e;
      warn(`server not reachable, retrying (${i + 1})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}
const DASH = /[–—]/;
const SESSION = /\b(log ?in|log ?out|logged ?in|logged ?out|sign ?in|sign ?out|signed ?in|signed ?out)\b/i;
const wordingSeen = new Map();
/** R6: no em / en dashes and no session wording in visible text (incl. placeholders and dropdown options). */
async function wording(where, file) {
  const { text, extra } = await page.evaluate(() => {
    const extra = [];
    document.querySelectorAll('[placeholder]').forEach((el) => extra.push(el.getAttribute('placeholder') ?? ''));
    document.querySelectorAll('option, optgroup').forEach((el) => extra.push(el.tagName === 'OPTGROUP' ? el.getAttribute('label') ?? '' : el.textContent ?? ''));
    document.querySelectorAll('[title],[aria-label]').forEach((el) => { extra.push(el.getAttribute('title') ?? ''); extra.push(el.getAttribute('aria-label') ?? ''); });
    return { text: document.body.innerText, extra };
  });
  const lines = text.split('\n');
  const dash = [...lines.filter((l) => DASH.test(l)), ...extra.filter((l) => DASH.test(l))];
  const sess = [...lines.filter((l) => SESSION.test(l)), ...extra.filter((l) => SESSION.test(l))];
  wordingSeen.set(where, true);
  await check(dash.length === 0, `${where}: no em or en dashes in visible text`, dash.slice(0, 3).join(' | '), file);
  await check(sess.length === 0, `${where}: no login / logout / sign in / sign out wording`, sess.slice(0, 3).join(' | '), file);
  const errs = pageErrors.filter((e) => !e.reported);
  errs.forEach((e) => { e.reported = true; });
  await check(errs.length === 0, `${where}: no page errors`, errs.map((e) => e.msg).join(' | '), file);
  await check(await page.getByText('Something went wrong').count() === 0, `${where}: no error boundary`, 'error boundary shown', file);
}
async function visit(hash, where, file) {
  await gotoRetry(`${BASE}#${hash}`);
  await sleep(500);
  const at = await page.evaluate(() => location.hash);
  await check(at === `#${hash}`, `${where}: stays on #${hash}`, at, file);
  await wording(where, file);
}
async function seeToast(re, timeout = 4000) {
  try { await page.locator('[role="status"]').filter({ hasText: re }).first().waitFor({ state: 'visible', timeout }); return true; } catch { return false; }
}
async function setTheme(name) {
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  await sleep(300);
  await page.getByRole('dialog').getByRole('button', { name: new RegExp(`^${name}`) }).first().click();
  await sleep(200);
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click();
  await sleep(300);
}
/** WCAG contrast of an element's text against its effective (composited) background. */
async function contrast(locator) {
  return locator.evaluate((el) => {
    const parse = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const layers = [];
    let n = el;
    while (n && n.nodeType === 1) {
      const bg = parse(getComputedStyle(n).backgroundColor);
      if (bg && bg.a > 0) { layers.push(bg); if (bg.a >= 1) break; }
      n = n.parentElement;
    }
    let base = { r: 255, g: 255, b: 255 };
    if (!layers.length || layers[layers.length - 1].a < 1) {
      const root = parse(getComputedStyle(document.body).backgroundColor);
      if (root) base = root;
    }
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      base = { r: l.r * l.a + base.r * (1 - l.a), g: l.g * l.a + base.g * (1 - l.a), b: l.b * l.a + base.b * (1 - l.a) };
    }
    const fgRaw = parse(getComputedStyle(el).color) ?? { r: 0, g: 0, b: 0, a: 1 };
    const fg = { r: fgRaw.r * fgRaw.a + base.r * (1 - fgRaw.a), g: fgRaw.g * fgRaw.a + base.g * (1 - fgRaw.a), b: fgRaw.b * fgRaw.a + base.b * (1 - fgRaw.a) };
    const lum = ({ r, g, b }) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const [a, b] = [lum(fg), lum(base)].sort((x, y) => y - x);
    return { ratio: Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100, fg: getComputedStyle(el).color, bg: `rgb(${Math.round(base.r)}, ${Math.round(base.g)}, ${Math.round(base.b)})` };
  });
}
async function readable(locator, label, file, min = 4.5) {
  if (!(await locator.count())) return check(false, `${label}: element present for the contrast check`, 'not found', file);
  const c = await contrast(locator.first());
  return check(c.ratio >= min, `${label}: text contrast >= ${min} (got ${c.ratio})`, `${c.ratio} (${c.fg} on ${c.bg})`, file);
}

// =============================================================================================
// Boot
// =============================================================================================
step('0 boot: clean demo data');
await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.reload();
await sleep(800);
await check(await page.locator('select[aria-label="Viewing as"]').count() === 1, 'app boots with the Viewing as picker', 'no picker', 'src/v2/App.tsx');
await check(!DASH.test(await page.title()), 'document title has no dashes', await page.title(), 'index.html');
if (!TODAY_IS_WORKDAY) warn('Today is a weekend; some checks assume a working day.');

// =============================================================================================
// 1. Udhaya
// =============================================================================================
step('1a Udhaya: plan your day with actual time per block + extra hours');
await as('udhaya');
await guard('Udhaya plan', 'src/v2/pages/DailyUpdate.tsx', async () => {
  await visit('/daily', 'Udhaya Tasks update', 'src/v2/pages/DailyUpdate.tsx');
  const blocks = page.locator('[data-block]');
  const nBlocks = await blocks.count();
  await check(nBlocks >= 3, 'day plan shows the seeded time blocks', nBlocks, 'src/v2/pages/DailyUpdate.tsx');
  const actual = page.locator('[data-block] input[aria-label="Actual time"]');
  await check(await actual.count() === nBlocks, 'every planned block has an Actual time field', `${await actual.count()} fields for ${nBlocks} blocks`, 'src/v2/pages/DailyUpdate.tsx');
  const want = ['2h 45m', '1:30', '135'];
  for (let i = 0; i < Math.min(3, nBlocks); i++) { await actual.nth(i).fill(want[i]); await actual.nth(i).press('Tab'); }
  await sleep(150);
  const shown = await actual.evaluateAll((els) => els.map((e) => e.value));
  await check(shown[0] === '2h 45m' && shown[1] === '1h 30m' && shown[2] === '2h 15m', 'actual time accepts 2h 45m, 1:30 and 135 and shows them as durations', shown.join(', '), 'src/v2/pages/DailyViews.tsx');

  await page.getByRole('button', { name: 'Add extra hours' }).click();
  const row = page.locator('[data-extra]').last();
  await row.locator('input[aria-label="Extra start"]').fill('19:00');
  await row.locator('input[aria-label="Extra end"]').fill('20:30');
  await row.locator('input[aria-label="Extra work"]').fill('Proposal edits for Northwind');
  await row.locator('select[aria-label="Extra project"]').selectOption('northwind');
  await sleep(150);
  const dur = await row.locator('input[aria-label="Extra duration"]').inputValue();
  await check(dur === '1h 30m', 'extra hours row computes the duration from start and end', dur, 'src/v2/pages/DailyUpdate.tsx');
  await page.getByRole('button', { name: 'Save plan and times' }).click();
  await check(await seeToast(/Plan and times saved/), 'Save plan and times shows a success toast', 'no toast', 'src/v2/pages/DailyUpdate.tsx');
  const s = await store();
  const d = s.daily[`udhaya|${TODAY}`];
  const mins = (d?.plan ?? []).map((b) => b.actualMinutes);
  await check(mins.includes(165) && mins.includes(90) && mins.includes(135), 'actual minutes per block are stored (165, 90, 135)', JSON.stringify(mins), 'src/v2/store.ts');
  await check(d?.extra?.length === 1 && d.extra[0].minutes === 90 && d.extra[0].work.includes('Proposal'), 'extra hours row stored with 90 minutes and the work', JSON.stringify(d?.extra), 'src/v2/store.ts');
  const stats = (await page.getByTestId('hours-stats').first().innerText()).replace(/\s+/g, ' ');
  await check(/Extra 1h 30m/.test(stats), 'hours stats show Extra 1h 30m', stats, 'src/v2/pages/DailyViews.tsx');
  await shot('udhaya-plan');
});

step("1b Udhaya: today's targets table by task type");
await guard("Udhaya today's targets", 'src/v2/pages/DailyUpdate.tsx', async () => {
  const sec = page.locator('section[aria-label="Today\'s targets"]');
  await check(await sec.count() === 1, "Today's targets section is shown", await sec.count(), 'src/v2/pages/DailyUpdate.tsx');
  const rows = sec.locator('table tr[data-row]');
  const labels = (await rows.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
  console.log('    rows:', labels);
  await check(labels.length >= 3, "Today's targets lists one row per task type", labels.length, 'src/v2/pages/DailyViews.tsx');
  const l1 = sec.locator('tr[data-row="l1:Personalised"]');
  await check(await l1.count() === 1, 'a "1st level messages (personalised)" row exists', labels.join(' | '), 'src/v2/analytics.ts');
  if (await l1.count()) {
    const tgt = (await l1.locator('[data-cell="target"]').innerText()).trim();
    await check(/^30(\D|$)/.test(tgt), '1st level messages target is 30', tgt, 'src/v2/pages/DailyViews.tsx');
  }
  await shot('udhaya-targets');
});

step('1c Udhaya: submit a task from the dashboard');
let submittedId = 't3';
await guard('Udhaya submit', 'src/v2/pages/TaskCard.tsx', async () => {
  await visit('/', 'Udhaya dashboard', 'src/v2/pages/Dashboard.tsx');
  let row = page.locator('li[data-task="t3"]');
  if (!(await row.count())) {
    warn('seed task t3 not on the dashboard, using the first task with a Submit button');
    row = page.locator('li[data-task]').filter({ has: page.getByRole('button', { name: /^Submit$/ }) }).first();
    submittedId = await row.getAttribute('data-task');
  }
  await row.getByRole('button', { name: /Submit/ }).click();
  const dlg = page.getByRole('dialog');
  await dlg.waitFor({ state: 'visible', timeout: 3000 });
  await check(/Submit for approval/.test(await dlg.innerText()), 'Submit opens the "Submit for approval" dialog', (await dlg.innerText()).slice(0, 80), 'src/v2/pages/TaskCard.tsx');
  await dlg.locator('select').first().selectOption('bheeshma');
  const nums = dlg.locator('input[type="number"]');
  await nums.nth(0).fill('28');
  await nums.nth(1).fill('55');
  await wording('Udhaya submit dialog', 'src/v2/pages/TaskCard.tsx');
  await shot('udhaya-submit-dialog', false);
  await dlg.getByRole('button', { name: /Send to Bheeshma/ }).click();
  await check(await seeToast(/Sent to Bheeshma for approval/), 'sending shows "Sent to Bheeshma for approval"', 'no toast', 'src/v2/pages/TaskCard.tsx');
  await sleep(300);
  const t = (await store()).tasks.find((x) => x.id === submittedId);
  await check(t?.status === 'in_review' && t?.reviewerId === 'bheeshma' && t?.doneQty === 28 && t?.minutes === 55, 'task is in review with Bheeshma, 28 done in 55 min', JSON.stringify({ s: t?.status, r: t?.reviewerId, q: t?.doneQty, m: t?.minutes }), 'src/v2/store.ts');
  await check((t?.history ?? []).some((e) => e.action === 'submitted' && e.to === 'bheeshma'), 'task history records "submitted" to Bheeshma with a time', JSON.stringify(t?.history?.map((e) => e.action)), 'src/v2/store.ts');
  const rowText = await page.locator(`li[data-task="${submittedId}"]`).innerText().catch(() => '');
  await check(/with Bheeshma since/.test(rowText), 'task row says "with Bheeshma since <time>"', rowText.replace(/\s+/g, ' ').slice(0, 160), 'src/v2/pages/TaskCard.tsx');
  await shot('udhaya-dashboard-after-submit');
});

step('1d Udhaya: send end of day, actual column fills');
await guard('Udhaya end of day', 'src/v2/pages/DailyUpdate.tsx', async () => {
  await visit('/daily', 'Udhaya Tasks update before EOD', 'src/v2/pages/DailyUpdate.tsx');
  const eod = page.locator('section[aria-label="End of day update"]');
  const before = await eod.locator('td[data-cell="actual"]').allInnerTexts();
  await check(before.length > 0 && before.every((x) => x.trim() === ''), 'before sending, every Actual cell is blank', JSON.stringify(before), 'src/v2/pages/DailyViews.tsx');
  await check(await eod.getByTestId('pending-hint').count() > 0, 'a "fills in when you send" hint is shown', 'no hint', 'src/v2/pages/DailyUpdate.tsx');
  await eod.locator('textarea').fill('Solid day, L1s nearly done.');
  await eod.getByRole('button', { name: /Send & lock/ }).click();
  await check(await seeToast(/End of day sent/), 'Send & lock shows the end of day toast', 'no toast', 'src/v2/pages/DailyUpdate.tsx');
  await sleep(300);
  const after = await eod.locator('td[data-cell="actual"]').allInnerTexts();
  await check(after.length > 0 && after.every((x) => x.trim() !== ''), 'after sending, every Actual cell is filled', JSON.stringify(after), 'src/v2/pages/DailyViews.tsx');
  const l1 = eod.locator('tr[data-row="l1:Personalised"]');
  if (await l1.count()) {
    const a = (await l1.locator('[data-cell="actual"]').innerText()).trim();
    const p = (await l1.locator('[data-cell="pct"]').innerText()).trim();
    await check(a === '28' && p === '93%', '1st level messages shows actual 28 and 93%', `${a} / ${p}`, 'src/v2/analytics.ts');
  } else await check(false, 'end of day table has the 1st level messages row', 'missing', 'src/v2/pages/DailyViews.tsx');
  const time = eod.locator('table[aria-label="Time"]');
  const timeText = (await time.innerText().catch(() => '')).replace(/\s+/g, ' ');
  await check(/EXTRA/.test(timeText) && /2h 45m/.test(timeText), 'sent update shows planned vs actual per block and the extra row', timeText.slice(0, 200), 'src/v2/pages/TaskUpdateSections.tsx');
  const d = (await store()).daily[`udhaya|${TODAY}`];
  await check(!!d?.eodAt && !!d?.eodSnapshot, 'end of day is stored with a frozen snapshot', JSON.stringify({ eodAt: d?.eodAt, snap: !!d?.eodSnapshot }), 'src/v2/store.ts');
  await shot('udhaya-eod-sent');
});

step('1e Udhaya: weekly bar list');
await guard('Udhaya weekly', 'src/v2/pages/TaskUpdateSections.tsx', async () => {
  const wk = page.locator('section[aria-label="Weekly targets"]');
  await check(await wk.count() === 1, 'Weekly targets section is shown', await wk.count(), 'src/v2/pages/TaskUpdateSections.tsx');
  const items = wk.locator('ul[aria-label="Week progress"] li');
  const n = await items.count();
  await check(n >= 3, 'weekly targets show a bar-chart list (one row per task type)', n, 'src/v2/pages/DailyViews.tsx');
  if (n) {
    const first = (await items.first().innerText()).replace(/\s+/g, ' ');
    await check(/target \d+|\d+ \/ \d+/.test(first), 'each bar row shows "target N" or "actual / target"', first, 'src/v2/pages/DailyViews.tsx');
    await check(await items.first().locator('div').last().count() > 0, 'each bar row has a progress bar', 'no bar', 'src/v2/pages/DailyViews.tsx');
  }
  await wk.scrollIntoViewIfNeeded();
  await shot('udhaya-weekly');
  await visit('/profile', 'Udhaya profile', 'src/v2/pages/Profile.tsx');
  const prog = page.getByTestId('my-progress');
  await check(await prog.count() === 1 && await prog.getByRole('radiogroup', { name: 'Granularity' }).count() === 1 && await prog.getByRole('radiogroup', { name: 'KPI' }).count() === 1,
    'Profile "my progress" has Daily / Weekly / Monthly and KPI filters', 'missing', 'src/v2/pages/Profile.tsx');
  await shot('udhaya-profile');
});

// =============================================================================================
// 2. Bheeshma
// =============================================================================================
step('2a Bheeshma: review queue with history + resubmits, approve one');
await as('bheeshma');
await guard('Bheeshma review', 'src/v2/pages/TaskCard.tsx', async () => {
  await visit('/', 'Bheeshma dashboard', 'src/v2/pages/Dashboard.tsx');
  const queue = page.locator('li[data-review]');
  const ids = await queue.evaluateAll((els) => els.map((e) => e.getAttribute('data-review')));
  console.log('    review queue:', ids);
  await check(ids.includes(submittedId), "Udhaya's submitted task is in Bheeshma's review queue", ids.join(','), 'src/v2/pages/Dashboard.tsx');
  const t8 = page.locator('li[data-review="t8"]');
  if (await t8.count()) {
    const txt = (await t8.innerText()).replace(/\s+/g, ' ');
    await check(/Resubmitted 1x/.test(txt), 'resubmitted task shows "Resubmitted 1x"', txt.slice(0, 200), 'src/v2/pages/TaskCard.tsx');
    await check(await t8.getByTestId('task-history').isVisible(), 'resubmitted task opens its history straight away', 'history closed', 'src/v2/pages/TaskCard.tsx');
    const acts = await t8.locator('[data-action]').evaluateAll((els) => els.map((e) => e.getAttribute('data-action')));
    await check(['assigned', 'submitted', 'feedback', 'resubmitted'].every((a) => acts.includes(a)), 'history lists assigned, sent for approval, feedback and resubmitted', acts.join(','), 'src/v2/pages/TaskCard.tsx');
    const times = await t8.locator('[data-testid="task-history"] time').allInnerTexts();
    await check(times.length >= 4 && times.every((x) => /\d{2}:\d{2}/.test(x)), 'every history event has an exact time', times.join(' | '), 'src/v2/pages/TaskCard.tsx');
  } else await check(false, 'seeded resubmitted task t8 is in the review queue', ids.join(','), 'src/v2/data.ts');
  const mine = page.locator(`li[data-review="${submittedId}"]`);
  if (await mine.count()) {
    const txt = (await mine.innerText()).replace(/\s+/g, ' ');
    await check(/Sent for approval \w{3} \d+ \w{3}, \d{2}:\d{2}/.test(txt), 'review row shows "Sent for approval <day date, time>"', txt.slice(0, 200), 'src/v2/pages/TaskCard.tsx');
    await mine.getByRole('button', { name: /History/ }).click();
    await sleep(150);
    await check(await mine.getByTestId('task-history').isVisible(), 'History toggle opens the timeline for a fresh submission', 'not visible', 'src/v2/pages/TaskCard.tsx');
  }
  await shot('bheeshma-review-queue');
  const target = (await page.locator('li[data-review="t2"]').count()) ? 't2' : submittedId;
  await page.locator(`li[data-review="${target}"]`).getByRole('button', { name: 'Approve', exact: true }).click();
  await check(await seeToast(/Approved, .* notified/), 'Approve shows "Approved, <name> notified"', 'no toast', 'src/v2/pages/TaskCard.tsx');
  await sleep(300);
  await check(await page.locator(`li[data-review="${target}"]`).count() === 0, 'approved task leaves the review queue', 'still listed', 'src/v2/pages/Dashboard.tsx');
  const t = (await store()).tasks.find((x) => x.id === target);
  await check(t?.status === 'done' && !!t?.approvedAt && (t?.history ?? []).some((e) => e.action === 'approved'), 'approval stored with approvedAt and an "approved" history event', JSON.stringify({ s: t?.status, at: t?.approvedAt }), 'src/v2/store.ts');
  await check(/Reviewed by you/.test(await page.locator('main').innerText()), 'the "Reviewed by you" log is shown', 'missing', 'src/v2/pages/Dashboard.tsx');
});

step("2b Bheeshma: Assign, Yesterday's tasks + difficulty + Assign all");
let assignedCount = 0;
await guard('Bheeshma assign', 'src/v2/pages/Assign.tsx', async () => {
  await visit('/assign', 'Bheeshma Assign', 'src/v2/pages/Assign.tsx');
  const y = page.locator('section[aria-label="Yesterday\'s tasks"]');
  const ytxt = (await y.innerText()).replace(/\s+/g, ' ');
  console.log('    yesterday:', ytxt.slice(0, 220));
  const label = `${PREV_WEEKDAY.slice(0, 3)} ${prevWork.getDate()}`;
  await check(ytxt.includes(label), `Yesterday's tasks points at the previous working day (${label})`, ytxt.slice(0, 160), 'src/v2/pages/Assign.tsx');
  if (PREV !== iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) {
    await check(/previous working day/.test(ytxt), 'Monday shows "previous working day" next to Friday', ytxt.slice(0, 160), 'src/v2/pages/Assign.tsx');
  }
  const s0 = await store();
  const prevTasks = s0.tasks.filter((t) => t.assignedById === 'bheeshma' && t.date === PREV && ['northwind', 'bd'].includes(t.projectId) && ['done', 'in_review'].includes(t.status));
  const useBtn = y.getByRole('button').first();
  const btnText = await useBtn.innerText();
  await check(prevTasks.length > 0 && btnText.includes(String(prevTasks.length)), `button offers the ${prevTasks.length} tasks from ${PREV}`, btnText, 'src/v2/pages/Assign.tsx');
  await useBtn.click();
  await check(await seeToast(/Added \d+ task/), 'pulling yesterday shows "Added N tasks from ..."', 'no toast', 'src/v2/pages/Assign.tsx');
  await sleep(200);
  const cart = page.locator('[data-cart-item]');
  await check(await cart.count() === prevTasks.length, 'the cart gets every task from the previous working day', `${await cart.count()} vs ${prevTasks.length}`, 'src/v2/pages/Assign.tsx');
  const levels = await cart.locator('[data-difficulty]').evaluateAll((els) => els.map((e) => e.getAttribute('data-difficulty')));
  await check(levels.length === await cart.count() && levels.every((l) => ['standard', 'easy', 'challenging', 'none'].includes(l)), 'every cart item has a difficulty badge', levels.join(','), 'src/v2/pages/Assign.tsx');

  // Two manual tasks: one challenging (target below standard), one easy (above).
  await page.locator('button', { hasText: 'Udhaya' }).first().click();
  await page.getByRole('button', { name: '1st level messages', exact: true }).click();
  await page.locator('input[aria-label="Quantity"]').first().fill('30');
  await sleep(100);
  const draft = (await page.getByTestId('draft-difficulty').innerText()).replace(/\s+/g, ' ');
  await check(/Standard for 30 messages on this project: 1h/.test(draft), 'draft shows the project standard for 30 personalised L1s (1h)', draft, 'src/v2/pages/Assign.tsx');
  await page.locator('input[aria-label="Target time (min)"]').fill('45');
  await sleep(100);
  const draft2 = (await page.getByTestId('draft-difficulty').innerText()).replace(/\s+/g, ' ');
  await check(/Challenging \(-25% time\)/.test(draft2), 'target 45 min vs standard 60 is "Challenging (-25% time)"', draft2, 'src/v2/pages/TaskCard.tsx');
  await page.getByRole('button', { name: /Add to list/ }).click();
  await page.locator('input[aria-label="Target time (min)"]').fill('80');
  await page.getByRole('button', { name: /Add to list/ }).click();
  await sleep(150);
  const mix = (await page.getByTestId('cart-mix').innerText()).replace(/\s+/g, ' ');
  await check(/[1-9]\d* challenging/.test(mix) && /[1-9]\d* easy/.test(mix), 'cart difficulty summary counts challenging and easy', mix, 'src/v2/pages/Assign.tsx');
  assignedCount = await cart.count();
  await shot('bheeshma-assign-cart');
  await page.getByRole('button', { name: /Assign all/ }).click();
  await check(await seeToast(/Assigned \d+ task/), 'Assign all shows "Assigned N tasks"', 'no toast', 'src/v2/pages/Assign.tsx');
  await sleep(300);
  await check(await page.locator('[data-cart-item]').count() === 0, 'cart is empty after Assign all', await page.locator('[data-cart-item]').count(), 'src/v2/pages/Assign.tsx');
  const s1 = await store();
  const fresh = s1.tasks.filter((t) => t.assignedById === 'bheeshma' && t.date === TODAY && !s0.tasks.some((o) => o.id === t.id));
  await check(fresh.length === assignedCount, `${assignedCount} new tasks stored for today`, fresh.length, 'src/v2/store.ts');
  await check(fresh.every((t) => t.standardMinutes > 0 || (t.typeId === 'custom' && !t.customStandardId)), 'new tasks store standardMinutes at assign time', JSON.stringify(fresh.map((t) => t.standardMinutes)), 'src/v2/store.ts');
  await check(fresh.every((t) => (t.history ?? []).some((e) => e.action === 'assigned')), 'new tasks record an "assigned" history event', 'missing', 'src/v2/store.ts');
  const open = page.getByTestId('still-open').locator('[data-assigned]');
  const withBadge = await open.locator('[data-difficulty]').count();
  await check(withBadge >= await open.count() && await open.count() > 0, 'every assigned task in "Still open" shows a difficulty badge', `${withBadge} badges, ${await open.count()} rows`, 'src/v2/pages/Assign.tsx');
  await shot('bheeshma-assign-done');
});

step('2c Bheeshma: Projects progress bar-chart list');
const nw = () => page.locator('[data-project="northwind"]');
const tab = (re) => nw().getByRole('tab', { name: re });
await guard('Bheeshma progress', 'src/v2/pages/Widgets.tsx', async () => {
  await visit('/projects', 'Bheeshma Projects', 'src/v2/pages/Projects.tsx');
  await check(await nw().count() === 1, 'Northwind card is shown', await nw().count(), 'src/v2/pages/Projects.tsx');
  const prog = nw().getByTestId('project-progress');
  const bars = prog.locator('ul[aria-label="Progress against targets"] li');
  const n = await bars.count();
  await check(n >= 5, 'progress shows a bar-chart list with one row per number', n, 'src/v2/pages/Widgets.tsx');
  const firstRow = (await bars.first().innerText()).replace(/\s+/g, ' ');
  await check(/\d+( \/ \d+)?.*(\d+%|No target)/.test(firstRow), 'each bar row shows value / target and % done', firstRow, 'src/v2/pages/Widgets.tsx');
  await check(await bars.first().locator('[role="progressbar"]').count() === 1, 'each bar row has a progress bar', 'missing', 'src/v2/pages/Widgets.tsx');
  const wkOpts = await prog.locator('select[aria-label="Week"] option').allInnerTexts();
  await check(wkOpts.some((o) => /^Week \d+ · \d+ \w{3} to \d+ \w{3}/.test(o)), 'week dropdown labels read "Week N · 12 Oct to 16 Oct"', wkOpts.slice(0, 3).join(' | '), 'src/v2/pages/Widgets.tsx');
  await shot('bheeshma-progress-weekly');
  await prog.getByRole('button', { name: 'Monthly', exact: true }).click();
  await sleep(150);
  await check(await prog.locator('select[aria-label="Month"]').count() === 1 && await prog.locator('ul[aria-label="Progress against targets"] li').count() > 0, 'Monthly filter shows the month dropdown and bars', 'missing', 'src/v2/pages/Widgets.tsx');
  await shot('bheeshma-progress-monthly');
  await prog.getByRole('button', { name: 'Weekly', exact: true }).click();
});

step('2d Bheeshma: Targets tab pre-plans next week');
await guard('Bheeshma week plan', 'src/v2/pages/Projects.tsx', async () => {
  await tab(/Targets/).click();
  await sleep(200);
  const wp = nw().getByTestId('week-planner');
  await check(await wp.count() === 1, 'Targets tab shows the week planner', await wp.count(), 'src/v2/pages/Projects.tsx');
  const ahead = await wp.locator('[aria-label="Plan ahead"] button').count();
  await check(ahead >= 4, 'at least the next 4 weeks are offered to plan ahead', ahead, 'src/v2/pages/Projects.tsx');
  const sel = wp.locator('select[aria-label="Plan week"]');
  const vals = await sel.locator('option').evaluateAll((os) => os.map((o) => o.value));
  await check(vals.includes(NEXT_MON), `week dropdown includes next week (${NEXT_MON})`, vals.slice(0, 6).join(','), 'src/v2/pages/Widgets.tsx');
  await sel.selectOption(NEXT_MON);
  await sleep(150);
  await wp.getByRole('button', { name: /Plan week \d+|Edit this week/ }).click();
  const inputs = wp.locator('input[type="number"]');
  await check(await inputs.count() >= 3, 'planning a week shows number inputs', await inputs.count(), 'src/v2/pages/Projects.tsx');
  await inputs.nth(0).fill('321');
  await readable(inputs.nth(0), 'week plan input (light)', 'src/v2/pages/Projects.tsx');
  await wp.getByRole('button', { name: /Save and lock week/ }).click();
  await check(await seeToast(/plan saved and locked/), 'saving shows "Week N plan saved and locked"', 'no toast', 'src/v2/pages/Projects.tsx');
  await sleep(200);
  await check(/Plan saved, locked/.test(await wp.innerText()), 'saved week is shown as "Plan saved, locked"', (await wp.innerText()).slice(0, 120), 'src/v2/pages/Projects.tsx');
  await check(await wp.locator('input[type="number"]').count() === 0, 'saved week plan is read-only until Edit', 'inputs still shown', 'src/v2/pages/Projects.tsx');
  const p = (await store()).projects.find((x) => x.id === 'northwind');
  await check(Object.values(p?.weekPlans?.[NEXT_MON] ?? {}).includes(321), 'next week plan stored per week', JSON.stringify(p?.weekPlans?.[NEXT_MON]), 'src/v2/store.ts');
  const opt = await sel.locator(`option[value="${NEXT_MON}"]`).innerText();
  await check(/plan saved/.test(opt), 'dropdown marks the week "plan saved"', opt, 'src/v2/pages/Projects.tsx');
  await shot('bheeshma-week-plan');
  // Progress for that week uses its plan.
  await tab(/Progress/).click();
  await sleep(150);
  const prog = nw().getByTestId('project-progress');
  await prog.locator('select[aria-label="Week"]').selectOption(NEXT_MON).catch(() => {});
  await sleep(150);
  const ptxt = (await prog.innerText()).replace(/\s+/g, ' ');
  await check(/target 321/.test(ptxt) && /Using this week's saved plan/.test(ptxt), "progress for next week shows that week's planned targets", ptxt.slice(0, 220), 'src/v2/pages/Widgets.tsx');
});

step("2e Bheeshma: This week's numbers locked, Edit unlocks, Save locks");
await guard('Bheeshma numbers', 'src/v2/pages/Projects.tsx', async () => {
  await tab(/This week's numbers/).click();
  await sleep(200);
  const wn = nw().getByTestId('week-numbers');
  await check(await wn.locator('input').count() === 0, "This week's numbers are read-only by default (no inputs)", await wn.locator('input').count(), 'src/v2/pages/Projects.tsx');
  await check(/Read-only/.test(await wn.innerText()), 'a "Read-only" chip is shown', 'missing', 'src/v2/pages/Projects.tsx');
  await check(/Finalised days this week/i.test(await wn.innerText()), 'finalised days are listed', 'missing', 'src/v2/pages/Projects.tsx');
  const before = Number(await wn.locator('span[aria-label="Responses received this week"]').innerText());
  await wn.getByRole('button', { name: 'Edit', exact: true }).click();
  await sleep(150);
  const inp = wn.locator('input[aria-label="Responses received this week"]');
  await check(await inp.count() === 1, 'Edit unlocks the numbers', await inp.count(), 'src/v2/pages/Projects.tsx');
  await readable(inp, 'numbers edit input (light)', 'src/v2/pages/Projects.tsx');
  await inp.fill(String(before + 2));
  await shot('bheeshma-numbers-editing');
  await wn.getByRole('button', { name: /Save and finalise/ }).click();
  await check(await seeToast(/saved and today finalised|today is finalised/), 'Save shows the finalised toast', 'no toast', 'src/v2/pages/Projects.tsx');
  await sleep(200);
  await check(await wn.locator('input').count() === 0, 'Save locks the numbers again', await wn.locator('input').count(), 'src/v2/pages/Projects.tsx');
  const after = Number(await wn.locator('span[aria-label="Responses received this week"]').innerText());
  await check(after === before + 2, `Responses received updated ${before} to ${before + 2}`, after, 'src/v2/pages/Projects.tsx');
  if (TODAY_IS_WORKDAY) {
    const fin = await wn.locator('ol[aria-label="Finalised days"] li').evaluateAll((els) => els.map((e) => [e.innerText.split('\n')[0], e.getAttribute('data-finalized')]));
    await check(fin.some(([l, f]) => /^Today/.test(l) && f === 'yes'), 'today is marked finalised after Save', JSON.stringify(fin), 'src/v2/pages/Projects.tsx');
  }
  await shot('bheeshma-numbers-locked');
});

step('2f Bheeshma: Edit project details');
await guard('Bheeshma edit details', 'src/v2/pages/ProjectSetup.tsx', async () => {
  await nw().getByRole('button', { name: /Edit project details/ }).click();
  const dlg = page.getByRole('dialog');
  await dlg.waitFor({ state: 'visible', timeout: 3000 });
  await check(/Edit project details/.test(await dlg.innerText()), 'Edit project details dialog opens', 'not open', 'src/v2/pages/ProjectSetup.tsx');
  for (const f of ['Prospect mapping', '1st level message', '2nd level message']) {
    const el = dlg.locator(`input[aria-label="${f} standard minutes"]`);
    await check(await el.isVisible(), `${f} standard input is visible`, 'hidden', 'src/v2/pages/ProjectSetup.tsx');
    await check((await el.inputValue()).trim() !== '', `${f} standard input shows its value`, `"${await el.inputValue()}"`, 'src/v2/pages/ProjectSetup.tsx');
    await readable(el, `${f} standard input (light)`, 'src/v2/pages/ProjectSetup.tsx');
  }
  const list = dlg.locator('ul[aria-label="Custom standard tasks"] li');
  const n0 = await list.count();
  await dlg.locator('input[aria-label="New custom task name"]').fill('Email warmup');
  await dlg.locator('input[aria-label="New custom task unit"]').fill('emails');
  await dlg.locator('input[aria-label="New custom task minutes per unit"]').fill('1.5');
  await dlg.getByRole('button', { name: /Add task/ }).click();
  await sleep(150);
  await check(await list.count() === n0 + 1, 'custom standard task can be added', `${n0} to ${await list.count()}`, 'src/v2/pages/ProjectSetup.tsx');
  const delBtn = dlg.getByRole('button', { name: 'Delete Email warmup' });
  await check(await delBtn.count() === 1, 'added custom task has a delete button', await delBtn.count(), 'src/v2/pages/ProjectSetup.tsx');
  await delBtn.click();
  await sleep(150);
  await check(await list.count() === n0, 'custom standard task can be deleted', await list.count(), 'src/v2/pages/ProjectSetup.tsx');
  // Keep one new custom task to check it reaches Assign.
  await dlg.locator('input[aria-label="New custom task name"]').fill('Loom video');
  await dlg.locator('input[aria-label="New custom task unit"]').fill('videos');
  await dlg.locator('input[aria-label="New custom task minutes per unit"]').fill('4');
  await dlg.getByRole('button', { name: /Add task/ }).click();
  await sleep(150);
  const minsInput = dlg.locator('input[aria-label="Minutes per unit for Loom video"]');
  if (await minsInput.count()) await readable(minsInput, 'custom task minutes input (light)', 'src/v2/pages/ProjectSetup.tsx');

  const hours = dlg.locator('input[aria-label="Hours per day for Udhaya"]');
  await check(await hours.count() === 1 && (await hours.getAttribute('type')) === 'number', 'team hours are a typed number field', await hours.count(), 'src/v2/pages/ProjectSetup.tsx');
  await hours.fill('1.5');
  await sleep(100);
  const hoursRow = (await hours.locator('xpath=ancestor::li[1]').innerText()).replace(/\s+/g, ' ');
  await check(/= 1h 30m/.test(hoursRow), 'typing 1.5 shows "= 1h 30m"', hoursRow, 'src/v2/pages/ProjectSetup.tsx');
  await readable(hours, 'hours input (light)', 'src/v2/pages/ProjectSetup.tsx');

  await dlg.locator('select[aria-label="Add an admin"]').selectOption('sachi');
  await sleep(100);
  await check(await dlg.locator('[data-admin="sachi"]').count() === 1, 'Sachi can be added as an admin', 'not added', 'src/v2/pages/ProjectSetup.tsx');
  await check(await dlg.getByRole('button', { name: /Remove Prajwal as admin/ }).count() === 1, 'existing admin Prajwal can be removed (button shown)', 'missing', 'src/v2/pages/ProjectSetup.tsx');

  // Handover options are there (not completed here; done at the very end).
  const owner = dlg.locator('select[aria-label="New owner"]');
  await check(await owner.count() === 1, 'Handover has a New owner picker', await owner.count(), 'src/v2/pages/ProjectSetup.tsx');
  for (const l of ['Transfer and remove myself', 'Transfer and stay as admin', 'Transfer and stay as team member']) {
    await check(await dlg.getByRole('button', { name: new RegExp(l) }).count() === 1, `handover option "${l}" is shown`, 'missing', 'src/v2/pages/ProjectSetup.tsx');
  }
  await owner.selectOption('alok');
  await dlg.getByRole('button', { name: /Transfer and stay as admin/ }).click();
  await sleep(100);
  await check(await dlg.getByRole('alertdialog', { name: 'Confirm handover' }).count() === 1, 'picking an option asks to confirm the handover', 'no confirm', 'src/v2/pages/ProjectSetup.tsx');
  await wording('Edit project details dialog', 'src/v2/pages/ProjectSetup.tsx');
  await shot('bheeshma-edit-details', false);
  await dlg.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  await owner.selectOption('');
  await dlg.getByRole('button', { name: 'Save changes' }).click();
  await check(await seeToast(/Project details updated/), 'Save changes shows "Project details updated"', 'no toast', 'src/v2/pages/ProjectSetup.tsx');
  await sleep(300);
  const p = (await store()).projects.find((x) => x.id === 'northwind');
  await check(p?.hours?.udhaya === 1.5, 'Udhaya hours stored as 1.5', p?.hours?.udhaya, 'src/v2/store.ts');
  await check(p?.admins?.includes('sachi') && p?.admins?.includes('prajwal'), 'admins stored (Prajwal and Sachi)', JSON.stringify(p?.admins), 'src/v2/store.ts');
  await check((p?.customStandards ?? []).some((c) => c.name === 'Loom video' && c.minutes === 4) && !(p?.customStandards ?? []).some((c) => c.name === 'Email warmup'), 'custom standards stored (Loom video kept, Email warmup deleted)', JSON.stringify(p?.customStandards), 'src/v2/store.ts');
  await check(p?.pmId === 'bheeshma', 'owner unchanged after a cancelled handover', p?.pmId, 'src/v2/store.ts');
  const hero = (await nw().getByTestId('hero-admins').innerText()).replace(/\s+/g, ' ');
  await check(/Sachi/.test(hero), 'project header lists the new admin', hero, 'src/v2/pages/Projects.tsx');
  await shot('bheeshma-project-after-edit');
  await visit('/assign', 'Bheeshma Assign after edit', 'src/v2/pages/Assign.tsx');
  await check(await page.locator('[data-custom-standard]', { hasText: 'Loom video' }).count() === 1, 'new custom standard appears as a task type in Assign', 'missing', 'src/v2/pages/Assign.tsx');
});

// =============================================================================================
// 3. Prajwal (Northwind admin)
// =============================================================================================
step('3 Prajwal: admin of Northwind can edit numbers and targets');
await as('prajwal');
await guard('Prajwal admin', 'src/v2/pages/Projects.tsx', async () => {
  const hrefs = await page.locator('nav a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  await check(hrefs.includes('#/assign'), 'Prajwal (admin) sees Assign', hrefs.join(','), 'src/v2/App.tsx');
  await visit('/projects', 'Prajwal Projects', 'src/v2/pages/Projects.tsx');
  await check(await nw().count() === 1, 'Prajwal sees the Northwind card', await nw().count(), 'src/v2/pages/Projects.tsx');
  await check(/You are a project admin/i.test(await nw().getByTestId('project-hero').innerText()), 'header says "You are a project admin"', 'missing', 'src/v2/pages/Projects.tsx');
  await check(await nw().getByRole('button', { name: /Edit project details/ }).count() === 1, 'admin can open Edit project details', 'missing', 'src/v2/pages/Projects.tsx');
  await tab(/This week's numbers/).click();
  await sleep(150);
  const wn = nw().getByTestId('week-numbers');
  const before = Number(await wn.locator('span[aria-label="Tele calls made this week"]').innerText());
  await wn.getByRole('button', { name: 'Edit', exact: true }).click();
  await wn.locator('input[aria-label="Tele calls made this week"]').fill(String(before + 3));
  await wn.getByRole('button', { name: /Save and finalise/ }).click();
  await sleep(300);
  const after = Number(await wn.locator('span[aria-label="Tele calls made this week"]').innerText());
  await check(after === before + 3, `admin edits this week's Tele calls ${before} to ${before + 3}`, after, 'src/v2/pages/Projects.tsx');
  await tab(/Targets/).click();
  await sleep(150);
  const wp = nw().getByTestId('week-planner');
  await wp.locator('select[aria-label="Plan week"]').selectOption(IN2_MON);
  await wp.getByRole('button', { name: /Plan week \d+|Edit this week/ }).click();
  await wp.locator('input[type="number"]').nth(1).fill('77');
  await wp.getByRole('button', { name: /Save and lock week/ }).click();
  await sleep(200);
  let p = (await store()).projects.find((x) => x.id === 'northwind');
  await check(Object.values(p?.weekPlans?.[IN2_MON] ?? {}).includes(77), 'admin pre-plans the week after next', JSON.stringify(p?.weekPlans?.[IN2_MON]), 'src/v2/store.ts');
  // Default weekly target: unlock, change, lock.
  const box = nw().locator('div.rounded-2xl', { has: page.getByText('📅 Default weekly target') }).last();
  if (await box.getByRole('button', { name: 'Edit', exact: true }).count()) await box.getByRole('button', { name: 'Edit', exact: true }).click();
  await sleep(150);
  const msg = box.locator('input[aria-label="Messages sent week target"]');
  await check(await msg.count() === 1, 'admin can unlock the default weekly target', await msg.count(), 'src/v2/pages/Projects.tsx');
  if (await msg.count()) {
    await msg.fill('555');
    await box.getByRole('button', { name: /Lock targets/ }).click();
    await sleep(200);
    p = (await store()).projects.find((x) => x.id === 'northwind');
    await check(p?.weekTarget?.messages === 555 && p?.weekLocked === true, 'admin changes and locks the default weekly target', JSON.stringify({ m: p?.weekTarget?.messages, locked: p?.weekLocked }), 'src/v2/store.ts');
  }
  await shot('prajwal-targets');
  await visit('/assign', 'Prajwal Assign', 'src/v2/pages/Assign.tsx');
  await check(/Northwind/.test(await page.locator('main').innerText()), 'admin can assign on Northwind', 'Northwind not offered', 'src/v2/pages/Assign.tsx');
});

// =============================================================================================
// 4. Komala and Kingshuk
// =============================================================================================
async function teamView(who) {
  await visit('/daily', `${who} team Tasks update (daily)`, 'src/v2/pages/TeamDaily.tsx');
  for (const view of ['Daily', 'Weekly']) {
    if (view === 'Weekly') {
      await page.getByRole('tab', { name: 'Weekly' }).click();
      await sleep(250);
      await wording(`${who} team Tasks update (weekly)`, 'src/v2/pages/TeamDaily.tsx');
    }
    const tiles = page.getByTestId('kpi-tile');
    const labels = (await tiles.allInnerTexts()).map((t) => t.replace(/\s+/g, ' '));
    await check(labels.length === 2, `${view}: exactly 2 KPI tiles`, labels.length, 'src/v2/pages/TeamDaily.tsx');
    const want = view === 'Daily' ? ['Set morning targets', 'Sent end of day'] : ['Set weekly targets', 'Sent end of week'];
    await check(want.every((w, i) => labels[i]?.includes(w)), `${view}: tiles are "${want.join('" and "')}"`, labels.join(' | '), 'src/v2/pages/TeamDaily.tsx');
    await check(labels.every((l) => /\d+\/7/.test(l)), `${view}: tiles read X/7`, labels.join(' | '), 'src/v2/pages/TeamDaily.tsx');
    const cards = page.locator('section[data-person]');
    const ids = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-person')));
    await check(ids.length === 7, `${view}: one card per team member (7)`, ids.join(','), 'src/v2/pages/TeamDaily.tsx');
    let bad = [];
    let sentWithValues = 0;
    let pendingBlank = 0;
    for (const id of ids) {
      const c = page.locator(`section[data-person="${id}"]`);
      const status = (await c.getByTestId('status').innerText()).trim();
      const sent = /sent/i.test(status);
      const act = (await c.locator('td[data-cell="actual"]').allInnerTexts()).map((x) => x.trim());
      const tgt = await c.locator('td[data-cell="target"]').count();
      if (sent && act.some((x) => x === '')) bad.push(`${id} sent but blank actual`);
      if (!sent && act.some((x) => x !== '')) bad.push(`${id} not sent but actual "${act.join(',')}"`);
      if (act.length && tgt !== act.length) bad.push(`${id} target/actual columns mismatch`);
      if (sent && act.length) sentWithValues++;
      if (!sent && act.length) pendingBlank++;
    }
    await check(bad.length === 0, `${view}: actual is blank until sent, filled once sent`, bad.join(' | '), 'src/v2/pages/TeamDaily.tsx');
    if (view === 'Daily') {
      const u = page.locator('section[data-person="udhaya"]');
      const ut = (await u.innerText()).replace(/\s+/g, ' ');
      await check(/End of day sent/.test(ut) && /1st level messages \(personalised\)/.test(ut), "Udhaya's card shows her sent end of day and the L1 row", ut.slice(0, 200), 'src/v2/pages/TeamDaily.tsx');
      const l1 = u.locator('tr[data-row="l1:Personalised"]');
      if (await l1.count()) {
        const t = (await l1.locator('[data-cell="target"]').innerText()).trim();
        const a = (await l1.locator('[data-cell="actual"]').innerText()).trim();
        await check(/^30/.test(t) && a === '28', 'Udhaya L1 row reads target 30, actual 28', `${t} / ${a}`, 'src/v2/pages/TeamDaily.tsx');
      }
      await check(/Extra hours 1h 30m/.test(ut), "Udhaya's card shows her extra hours", ut.slice(-200), 'src/v2/pages/TeamDaily.tsx');
      await check(pendingBlank > 0, 'Daily: at least one pending person shows blanks', pendingBlank, 'src/v2/pages/TeamDaily.tsx');
    }
    await shot(`${who}-team-${view.toLowerCase()}`);
  }
}

step('4a Komala: team Tasks update');
await as('komala');
await guard('Komala team view', 'src/v2/pages/TeamDaily.tsx', async () => { await teamView('komala'); });

step('4b Kingshuk: team Tasks update');
await as('kingshuk');
await guard('Kingshuk team view', 'src/v2/pages/TeamDaily.tsx', async () => { await teamView('kingshuk'); });

step('4c Kingshuk: People analytics');
await guard('Kingshuk People', 'src/v2/pages/People.tsx', async () => {
  await visit('/people', 'Kingshuk People', 'src/v2/pages/People.tsx');
  const table = page.getByTestId('team-table');
  const rows = table.locator('tbody tr[data-person]');
  await check(await rows.count() === 7, 'People table has everyone on the team (7)', await rows.count(), 'src/v2/pages/People.tsx');
  const gran = page.getByRole('radiogroup', { name: 'Granularity' });
  const kpi = page.getByRole('radiogroup', { name: 'KPI' });
  await check(await gran.getByRole('radio').count() === 3 && await kpi.getByRole('radio').count() === 5, 'filters: Daily / Weekly / Monthly and 5 KPIs', `${await gran.getByRole('radio').count()} / ${await kpi.getByRole('radio').count()}`, 'src/v2/pages/analytics/controls.tsx');
  const snap = async () => ({
    table: (await table.locator('tbody').innerText()).replace(/\s+/g, ' '),
    period: await page.locator('select[aria-label="Period"] option').first().innerText(),
    spark: await table.locator('tbody svg[role="img"]').first().getAttribute('aria-label'),
    time: await page.getByTestId('where-time-goes').getAttribute('data-total'),
  });
  const wk = await snap();
  await gran.getByRole('radio', { name: 'Daily' }).click();
  await sleep(250);
  const dy = await snap();
  await gran.getByRole('radio', { name: 'Monthly' }).click();
  await sleep(250);
  const mo = await snap();
  console.log('    periods:', wk.period, '|', dy.period, '|', mo.period, ' time totals:', wk.time, dy.time, mo.time);
  await check(wk.table !== dy.table && dy.table !== mo.table && wk.table !== mo.table, 'Daily / Weekly / Monthly change the table values', 'tables identical', 'src/v2/pages/People.tsx');
  await check(/week/i.test(wk.period) && /(Today|latest)/.test(dy.period) && /month/i.test(mo.period), 'period dropdown follows the granularity', `${wk.period} | ${dy.period} | ${mo.period}`, 'src/v2/pages/analytics/controls.tsx');
  await check(wk.spark !== dy.spark && dy.spark !== mo.spark, 'trend chart (sparklines) changes with the granularity', `${wk.spark} | ${mo.spark}`, 'src/v2/pages/People.tsx');
  await check(Number(mo.time) >= Number(wk.time) && Number(wk.time) >= Number(dy.time) && Number(mo.time) > 0, 'Where time goes total grows from day to week to month', `${dy.time} / ${wk.time} / ${mo.time}`, 'src/v2/pages/analytics/charts.tsx');
  await shot('kingshuk-people-monthly');
  // KPI selector changes the highlighted column and the chart.
  for (const [label, key] of [['Tasks done', 'tasks'], ['Hours logged', 'hours'], ['Extra hours', 'extra'], ['Resubmits', 'resubmits'], ['Tasks on time %', 'onTime']]) {
    await kpi.getByRole('radio', { name: label, exact: true }).click();
    await sleep(200);
    const cls = await table.locator(`tbody tr[data-person] td[data-kpi="${key}"]`).first().getAttribute('class');
    const spark = await table.locator('tbody svg[role="img"]').first().getAttribute('aria-label');
    await check(/bg-accent-soft/.test(cls ?? '') && (spark ?? '').startsWith(label), `KPI "${label}" highlights its column and drives the trend chart`, `${cls} | ${spark}`, 'src/v2/pages/People.tsx');
  }
  // Badges: look across all three granularities.
  const tags = new Set();
  for (const g of ['Daily', 'Weekly', 'Monthly']) {
    await gran.getByRole('radio', { name: g }).click();
    await sleep(200);
    (await table.locator('[data-col="tag"]').allInnerTexts()).forEach((t) => tags.add(t.trim()));
    if (g === 'Weekly') {
      const ack = (await page.getByTestId('callout-acknowledge').innerText()).replace(/\s+/g, ' ');
      const sup = (await page.getByTestId('callout-support').innerText()).replace(/\s+/g, ' ');
      await check(/Acknowledge/.test(ack) && /Needs support/.test(sup), 'Acknowledge and Needs support call-outs are shown', `${ack.slice(0, 60)} | ${sup.slice(0, 60)}`, 'src/v2/pages/People.tsx');
      await shot('kingshuk-people-weekly');
    }
  }
  await check([...tags].some((t) => /Acknowledge/.test(t)) && [...tags].some((t) => /Needs support/.test(t)), 'table shows "⭐ Acknowledge" and "🚩 Needs support" badges', [...tags].join(' | '), 'src/v2/analytics.ts');
  // Sorting.
  await table.locator('button[data-sort="tasks"]').click();
  await sleep(150);
  await check(await table.locator('th[aria-sort="descending"], th[aria-sort="ascending"]').count() === 1, 'clicking a column sorts the table', 'no aria-sort', 'src/v2/pages/People.tsx');
  // Where time goes.
  const wtg = page.getByTestId('where-time-goes');
  const figs = await wtg.locator('figure[data-testid^="time-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
  await check(figs.length >= 2, 'Where time goes splits by project and by task type', figs.join(','), 'src/v2/pages/analytics/charts.tsx');
  await check(await page.getByTestId('assignment-mix').count() === 1, 'People shows assigned vs standard time by assigner', 'missing', 'src/v2/pages/People.tsx');
  // Person drill-down follows the KPI.
  await kpi.getByRole('radio', { name: 'Extra hours', exact: true }).click();
  await rows.first().click();
  await sleep(300);
  const modal = page.getByTestId('person-modal');
  await check(await modal.count() === 1 && (await modal.getByTestId('kpi-trend').getAttribute('data-kpi')) === 'extra', 'person drill-down opens with the selected KPI line chart', await modal.getByTestId('kpi-trend').getAttribute('data-kpi').catch(() => 'no modal'), 'src/v2/pages/analytics/PersonModal.tsx');
  await wording('People person drill-down', 'src/v2/pages/analytics/PersonModal.tsx');
  await shot('kingshuk-person-modal', false);
  await page.keyboard.press('Escape');
  await sleep(200);
});

step('4d Komala: lead dashboard assignment difficulty');
await as('komala');
await guard('Komala dashboard', 'src/v2/pages/Dashboard.tsx', async () => {
  await visit('/', 'Komala dashboard', 'src/v2/pages/Dashboard.tsx');
  const card = page.getByTestId('assignment-difficulty');
  const who = await card.locator('[data-assigner]').evaluateAll((els) => els.map((e) => e.getAttribute('data-assigner')));
  await check(who.includes('bheeshma') && who.length >= 3, 'Assignment difficulty lists each assigner (Bheeshma included)', who.join(','), 'src/v2/pages/Dashboard.tsx');
  const bt = (await card.locator('[data-assigner="bheeshma"]').innerText()).replace(/\s+/g, ' ');
  await check(/\d+% challenging/.test(bt) && /\d+% standard/.test(bt) && /\d+% easy/.test(bt), 'shows % challenging / standard / easy per PM', bt, 'src/v2/pages/Dashboard.tsx');
  await card.scrollIntoViewIfNeeded();
  await shot('komala-dashboard');
  await visit('/people', 'Komala People', 'src/v2/pages/People.tsx');
  await visit('/projects', 'Komala Projects', 'src/v2/pages/LeadProjects.tsx');
  await visit('/assign', 'Komala Assign', 'src/v2/pages/Assign.tsx');
  await visit('/profile', 'Komala Profile', 'src/v2/pages/Profile.tsx');
});

// =============================================================================================
// 5. Theme
// =============================================================================================
step('5a Theme: mascot on by default, alternates, toggle hides');
await as('udhaya');
await guard('mascot', 'src/v2/theme.tsx', async () => {
  await visit('/', 'Udhaya dashboard (mascot)', 'src/v2/theme.tsx');
  const m = page.getByTestId('mascot');
  await check(await m.isVisible(), 'mascot is visible by default', 'hidden', 'src/v2/theme.tsx');
  const kinds = [];
  const texts = [];
  for (let i = 0; i < 4; i++) {
    await m.click({ force: true });
    await sleep(150);
    const b = page.getByTestId('mascot-line');
    kinds.push(await b.getAttribute('data-kind'));
    texts.push((await b.innerText()).replace(/\s+/g, ' '));
  }
  console.log('    mascot:', texts);
  await check(kinds.join(',') === 'sarcastic,motivation,sarcastic,motivation', 'clicks alternate sarcasm and motivation', kinds.join(','), 'src/v2/theme.tsx');
  await check(texts.every((t) => !DASH.test(t)), 'mascot lines have no dashes', texts.join(' | '), 'src/v2/theme.tsx');
  await shot('mascot-bubble', false);
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  await sleep(300);
  const tog = page.getByTestId('mascot-toggle');
  await check(await tog.isChecked(), 'Theme menu "Show mascot" is ticked by default', 'unticked', 'src/v2/theme.tsx');
  await wording('Theme menu', 'src/v2/theme.tsx');
  await tog.uncheck();
  await sleep(200);
  await check(await page.getByTestId('mascot').count() === 0, 'unticking Show mascot hides him', 'still shown', 'src/v2/theme.tsx');
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click();
  await page.reload();
  await sleep(600);
  await check(await page.getByTestId('mascot').count() === 0, 'hidden mascot stays hidden after reload', 'shown again', 'src/v2/store.ts');
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  await sleep(300);
  await page.getByTestId('mascot-toggle').check();
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click();
  await sleep(200);
  await check(await page.getByTestId('mascot').count() === 1, 'ticking it brings him back', 'not shown', 'src/v2/theme.tsx');
});

step('5b Theme: Professional Dark readability (Tasks update)');
await guard('dark tasks update', 'src/v2/pages/DailyViews.tsx', async () => {
  await setTheme('Professional Dark');
  await check(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'Professional Dark applies data-theme=dark', await page.evaluate(() => document.documentElement.dataset.theme), 'src/v2/theme.tsx');
  await visit('/daily', 'Udhaya Tasks update (dark)', 'src/v2/pages/DailyUpdate.tsx');
  const F = 'src/v2/pages/DailyViews.tsx';
  await readable(page.locator('table[aria-label="Today\'s targets"] tbody td span').first(), "dark: Today's targets task name", F);
  await readable(page.locator('table[aria-label="Today\'s targets"] td[data-cell="target"] b').first(), "dark: Today's targets target number", F);
  await readable(page.locator('table[aria-label="End of day"] td[data-cell="actual"]').first(), 'dark: End of day actual number', F);
  await readable(page.locator('table[aria-label="End of day"] th').first(), 'dark: table header', F, 3);
  await readable(page.locator('table[aria-label="Time"] td').nth(1), 'dark: time breakdown row', 'src/v2/pages/TaskUpdateSections.tsx');
  await readable(page.locator('[data-block] input[aria-label="Actual time"]').first(), 'dark: Actual time input', 'src/v2/pages/DailyViews.tsx');
  await readable(page.locator('[data-block] select[aria-label="Start"]').first(), 'dark: block start select', 'src/v2/pages/DailyUpdate.tsx');
  await readable(page.locator('[data-extra] input[aria-label="Extra work"]').first(), 'dark: extra hours work input', 'src/v2/pages/DailyUpdate.tsx');
  await readable(page.locator('ul[aria-label="Week progress"] li span').first(), 'dark: weekly bar list label', F);
  await readable(page.locator('table[aria-label="Hours by day"] td').first(), 'dark: hours by day table', 'src/v2/pages/TaskUpdateSections.tsx', 3);
  await shot('dark-udhaya-daily');
});

step('5c Theme: Professional Dark readability (team view, Komala)');
await as('komala');
await guard('dark team view', 'src/v2/pages/TeamDaily.tsx', async () => {
  await setTheme('Professional Dark');
  await visit('/daily', 'Komala team view (dark)', 'src/v2/pages/TeamDaily.tsx');
  const u = page.locator('section[data-person="udhaya"]');
  await readable(u.locator('tbody td span').first(), 'dark team: task name', 'src/v2/pages/DailyViews.tsx');
  await readable(u.locator('td[data-cell="actual"]').first(), 'dark team: actual number', 'src/v2/pages/DailyViews.tsx');
  await readable(page.getByTestId('kpi-value').first(), 'dark team: KPI tile value', 'src/v2/pages/TeamDaily.tsx');
  await shot('dark-komala-team');
  await setTheme('Professional');
});

step('5d Theme: Professional Dark readability (Edit project details, Bheeshma)');
await as('bheeshma');
await guard('dark edit details', 'src/v2/pages/ProjectSetup.tsx', async () => {
  await setTheme('Professional Dark');
  await visit('/projects', 'Bheeshma Projects (dark)', 'src/v2/pages/Projects.tsx');
  await nw().getByRole('button', { name: /Edit project details/ }).click();
  const dlg = page.getByRole('dialog');
  await dlg.waitFor({ state: 'visible', timeout: 3000 });
  for (const f of ['Prospect mapping', '1st level message', '2nd level message']) {
    await readable(dlg.locator(`input[aria-label="${f} standard minutes"]`), `dark: ${f} standard input`, 'src/v2/pages/ProjectSetup.tsx');
  }
  await readable(dlg.locator('input[aria-label^="Minutes per unit for"]').first(), 'dark: custom task minutes input', 'src/v2/pages/ProjectSetup.tsx');
  await readable(dlg.locator('input[aria-label="Custom task name"]').first(), 'dark: custom task name input', 'src/v2/pages/ProjectSetup.tsx');
  await readable(dlg.locator('input[aria-label^="Hours per day for"]').first(), 'dark: team hours input', 'src/v2/pages/ProjectSetup.tsx');
  await readable(dlg.locator('select[aria-label="New owner"]'), 'dark: handover picker', 'src/v2/pages/ProjectSetup.tsx');
  await dlg.locator('input[aria-label="Prospect mapping standard minutes"]').scrollIntoViewIfNeeded();
  await shot('dark-edit-details', false);
  await dlg.locator('input[aria-label="Hours per day for Udhaya"]').scrollIntoViewIfNeeded();
  await shot('dark-edit-details-team', false);
  await dlg.getByRole('button', { name: 'Cancel', exact: true }).click();
  await sleep(200);
  await tab(/This week's numbers/).click();
  await sleep(150);
  await nw().getByTestId('week-numbers').getByRole('button', { name: 'Edit', exact: true }).click();
  await readable(nw().locator('input[aria-label="Responses received this week"]'), 'dark: numbers edit input', 'src/v2/pages/Projects.tsx');
  await nw().getByTestId('week-numbers').getByRole('button', { name: 'Cancel', exact: true }).click();
  await shot('dark-bheeshma-projects');
});

step('5e Theme: a fun theme still works');
await guard('fun theme', 'src/v2/theme.tsx', async () => {
  await setTheme('Cartoon');
  await check(await page.evaluate(() => document.documentElement.dataset.fun) === 'cartoon', 'Cartoon theme applies data-fun=cartoon', await page.evaluate(() => document.documentElement.dataset.fun), 'src/v2/theme.tsx');
  await visit('/daily', 'Bheeshma Tasks update (cartoon)', 'src/v2/pages/DailyUpdate.tsx');
  await shot('cartoon-bheeshma-daily');
  await setTheme('Professional');
  await check(await page.evaluate(() => document.documentElement.dataset.theme) === 'light' && !(await page.evaluate(() => document.documentElement.dataset.fun)), 'switching back to Professional restores the light look', 'still themed', 'src/v2/theme.tsx');
});

// =============================================================================================
// 6. Remaining routes sweep (wording + errors) and the handover, last
// =============================================================================================
step('6a sweep remaining pages');
await guard('sweep', 'src/v2', async () => {
  for (const [who, routes] of [['bheeshma', ['/profile']], ['kingshuk', ['/', '/projects', '/assign', '/profile']], ['udhaya', ['/projects']]]) {
    await as(who);
    for (const r of routes) await visit(r, `${who} ${r}`, 'src/v2');
  }
});

step('6b Bheeshma: handover (transfer and stay as admin), done last');
await as('bheeshma');
await guard('handover', 'src/v2/pages/ProjectSetup.tsx', async () => {
  await visit('/projects', 'Bheeshma Projects before handover', 'src/v2/pages/Projects.tsx');
  await nw().getByRole('button', { name: /Edit project details/ }).click();
  const dlg = page.getByRole('dialog');
  await dlg.waitFor({ state: 'visible', timeout: 3000 });
  await dlg.locator('select[aria-label="New owner"]').selectOption('alok');
  await dlg.getByRole('button', { name: /Transfer and stay as admin/ }).click();
  await dlg.getByRole('button', { name: /Confirm handover/ }).click();
  await check(await seeToast(/handed over to Alok/), 'handover shows "handed over to Alok"', 'no toast', 'src/v2/pages/ProjectSetup.tsx');
  await sleep(300);
  const s = await store();
  const p = s.projects.find((x) => x.id === 'northwind');
  await check(p?.pmId === 'alok' && p?.admins?.includes('bheeshma'), 'Alok owns Northwind and Bheeshma stays admin', JSON.stringify({ owner: p?.pmId, admins: p?.admins }), 'src/v2/store.ts');
  await check(s.notices.some((n) => n.to === 'alok' && /Northwind/.test(n.text)), 'the new owner gets a notification', JSON.stringify(s.notices.filter((n) => n.to === 'alok').map((n) => n.text).slice(0, 3)), 'src/v2/store.ts');
  const hero = (await nw().getByTestId('project-hero').innerText()).replace(/\s+/g, ' ');
  await check(/Owner Alok/.test(hero) && /You are a project admin/i.test(hero), 'header shows Owner Alok and "You are a project admin"', hero.slice(0, 200), 'src/v2/pages/Projects.tsx');
  await check(/Bheeshma|handed|handover|transferred/i.test((await nw().getByTestId('project-updates').innerText().catch(() => ''))), 'handover shows up in the project updates', 'missing', 'src/v2/pages/Projects.tsx');
  await wording('Bheeshma Projects after handover', 'src/v2/pages/Projects.tsx');
  await shot('bheeshma-after-handover');
});

// =============================================================================================
// Report
// =============================================================================================
step('report');
const leftover = pageErrors.filter((e) => !e.reported);
for (const e of leftover) await check(false, 'no page errors', `${e.step}: ${e.msg}`, 'src/v2');
await browser.close();
console.log(`\nPages checked for wording: ${wordingSeen.size}`);
if (warnings.length) console.log(`\nWarnings (${warnings.length}):\n${warnings.join('\n')}`);
console.log(failures.length ? `\n${failures.length} FAILURE(S):\n${JSON.stringify(failures, null, 2)}` : '\nAll R13 e2e journeys passed.');
process.exit(failures.length ? 1 : 0);
