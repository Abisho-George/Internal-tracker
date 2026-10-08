/**
 * Resource screens check (My Day + My Progress), driven in headless Chromium.
 *
 *   npx vite --port 5401 --strictPort &       # in another shell
 *   BASE_URL=http://localhost:5401 node scripts/check-resource.mjs
 *
 * Starts from a clean seed as Asha and walks spec §11 step 1 (start a task, mark it
 * done with the 45m chip → Better + toast; mark a reviewable task done → "sent to
 * Meera for review"; write a daily note; "Jump to end of day" → wrap-up + Day
 * complete), plus every other My Day interaction (Add task, voice-entry tooltip,
 * "Mark done again" after a review note, Waiting on me, Tomorrow peek, Adjusted
 * tag, all-caught-up banner, all three toast tones) and My Progress (KPIs, charts,
 * streak, the 3 sent feedback reports). It also simulates §11 step 4 through the real
 * store actions (Meera approves, Kabir sends this week's feedback) and checks that
 * Asha sees the approval notification, "Approved ✓" and the new report.
 * Fails on console errors, page errors, forbidden words or horizontal overflow.
 * Screenshots: e2e/screenshots/resource-*.png (light and dark, desktop and tablet).
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs'));
}

const BASE = process.env.BASE_URL ?? 'http://localhost:5401';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'e2e', 'screenshots');
mkdirSync(OUT, { recursive: true });

const FORBIDDEN =
  /\b(late|failed|missed|behind|poor|flagged|overdue|slow|rank|ranked|ranking|leaderboard|worst|top performer)\b/i;
const ESCALATION = /hasn't marked|escalat|nudge/i;
const STORAGE_KEY = 'ls-tracker-v1';

const issues = [];
const otherWarnings = new Set();
const log = (...a) => console.log('·', ...a);
const ok = (msg) => console.log('✓', msg);
const fail = (msg) => {
  issues.push(msg);
  console.log('✗', msg);
};
const expect = (cond, msg) => (cond ? ok(msg) : fail(msg));
let step = 'boot';

const browser = await chromium.launch();

function watch(page) {
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') fail(`[${step}] console.error: ${text}`);
    else if (type === 'warning') {
      if (/Warning:|Maximum update depth|getSnapshot|act\(|Future Flag/.test(text)) fail(`[${step}] console.warn: ${text}`);
      else otherWarnings.add(text.slice(0, 200));
    }
  });
  page.on('pageerror', (err) => fail(`[${step}] pageerror: ${err.message}`));
}

const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
watch(page);

async function shot(name, opts = {}) {
  if (opts.fullPage) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path: path.join(OUT, `resource-${name}.png`), ...opts });
}

/** Runs a function against the app's real Zustand store (same module instance Vite serves the app). */
async function withStore(src, arg) {
  return page.evaluate(
    async ([code, a]) => {
      const mod = await import('/src/store/index.ts');
      // eslint-disable-next-line no-new-func
      return new Function('store', 'arg', code)(mod, a);
    },
    [src, arg],
  );
}

/** True when no dialog or modal overlay is left in the DOM. */
async function noDialogLeft() {
  return page.evaluate(() => document.querySelectorAll('[role="dialog"], body > div.fixed.inset-0.z-50').length === 0);
}
const pathname = () => new URL(page.url()).pathname;

async function settle() {
  await page.locator('main h1').first().waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(600);
}

async function checkPage(label) {
  const text = await page.locator('body').innerText();
  const hit = text.match(FORBIDDEN);
  if (hit) fail(`[${label}] forbidden word in UI copy: "${hit[0]}"`);
  const esc = text.match(ESCALATION);
  if (esc) fail(`[${label}] escalation copy shown to a resource: "${esc[0]}"`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) fail(`[${label}] horizontal overflow of ${overflow}px`);
}

async function setTheme(mode) {
  const current = await page.evaluate(() => document.documentElement.dataset.theme ?? 'light');
  if (current === mode) return;
  await page.locator(`header button[aria-label="Switch to ${mode} mode"]`).click();
  await page.waitForTimeout(400);
}

/** Edits the persisted store (as a PM / another screen would) and reloads. */
async function patchStore(fn, arg) {
  await page.evaluate(
    ([key, src, a]) => {
      const raw = JSON.parse(localStorage.getItem(key));
      // eslint-disable-next-line no-new-func
      const patch = new Function('s', 'arg', src);
      patch(raw.state, a);
      localStorage.setItem(key, JSON.stringify(raw));
    },
    [STORAGE_KEY, fn, arg],
  );
  await page.reload();
  await settle();
}

const card = (title) => page.locator(`[data-testid="task-card"][data-task-title="${title}"]`);
const toasts = () => page.locator('[role="status"][aria-live="polite"] li');

/** Dismisses every toast so screenshots aren't covered. */
async function dismissToasts() {
  const buttons = page.locator('[role="status"][aria-live="polite"] li button[aria-label="Dismiss"]');
  for (let i = 0; i < 8 && (await buttons.count()) > 0; i++) {
    await buttons.first().click({ timeout: 1000, force: true }).catch(() => {});
    await page.waitForTimeout(250);
  }
}

async function lastToastText() {
  await toasts().last().waitFor({ state: 'visible', timeout: 3000 });
  return (await toasts().last().innerText()).replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// Clean seed as Asha
// ---------------------------------------------------------------------------
step = 'boot';
await page.goto(`${BASE}/`);
await page.evaluate(() => {
  localStorage.clear();
  sessionStorage.clear();
});
await page.reload();
await settle();
expect(pathname() === '/my-day', `boot lands on /my-day (got ${pathname()})`);
const viewer = await page.locator('header button[aria-label^="Viewing as"]').getAttribute('aria-label');
expect(viewer?.includes('Asha Rao'), 'viewing as Asha Rao');

// --- Header ------------------------------------------------------------------
step = 'my-day:header';
const h1 = await page.locator('main h1').innerText();
expect(/^Good (morning|afternoon|evening), Asha 👋$/.test(h1), `greeting h1 "${h1}"`);
const summary = await page.getByTestId('day-summary').innerText();
expect(summary === '3 of 8 tasks done · 2h 38m logged', `summary "${summary}"`);
const eyebrow = await page.locator('main header').innerText();
expect(/(Monday|Tuesday|Wednesday|Thursday|Friday), \d{1,2} \w+/.test(eyebrow), 'header shows the demo date');
const progressbar = page.getByRole('progressbar', { name: 'Day progress' });
expect((await progressbar.getAttribute('aria-valuenow')) === '158', 'day progress line at 158 min');
const lightChip = page.getByTestId('light-day-soon');
if (await lightChip.count()) {
  const t = await lightChip.innerText();
  expect(/^\w{3} \d{1,2} \w{3} is a light day · Team offsite – targets at 50%$/.test(t), `light-day heads-up "${t}"`);
} else fail('light-day heads-up chip missing (seed has one next week)');

// --- Time blocks -------------------------------------------------------------
const blocks = await page.$$eval('[data-testid^="block-"]', (els) => els.map((e) => e.getAttribute('data-testid')));
expect(JSON.stringify(blocks) === JSON.stringify(['block-morning', 'block-afternoon', 'block-anytime']), `blocks in order ${blocks}`);
const blockTitles = await page.$$eval('[data-testid^="block-"] h2', (els) => els.map((e) => e.textContent));
expect(blockTitles[0] === 'Morning – first 4 hours', `morning block title "${blockTitles[0]}"`);
expect((await page.locator('[data-testid="task-card"]').count()) === 8, '8 task cards');
const modelCard = card('Model building – 3 companies');
expect((await modelCard.getAttribute('data-status')) === 'inProgress', 'seeded in-progress task');
const t1 = await modelCard.getByTestId('running-timer').innerText();
await page.waitForTimeout(1300);
const t2 = await modelCard.getByTestId('running-timer').innerText();
expect(/\d\d:\d\d/.test(t1) && t1 !== t2, `running timer ticks (${t1} → ${t2})`);
const doneCard = card('Prospect searching – 25 prospects');
expect((await doneCard.locator('[data-rating]').count()) === 1, 'done card shows a rating chip');
expect((await doneCard.innerText()).includes('Took 1h 5m'), 'done card shows the actual time');
const l1Text = await card('First-level message – 30 messages').innerText();
expect(/30 messages/.test(l1Text) && /Std 1h 30m/.test(l1Text) && /P2/.test(l1Text), 'card shows quantity, standard and priority');
await checkPage('my-day');
await shot('my-day-light', { fullPage: true });

// --- Voice entry (future) ---------------------------------------------------
step = 'my-day:voice';
const mic = page.getByTestId('voice-entry');
expect((await mic.getAttribute('aria-disabled')) === 'true', 'mic button is aria-disabled');
await mic.hover();
await page.waitForTimeout(400);
const tip = await page.getByRole('tooltip').innerText().catch(() => '');
expect(tip === 'Voice entry — coming in v2', `mic tooltip on hover "${tip}"`);
const micBox = await mic.boundingBox();
await shot('voice-tooltip', { clip: { x: Math.max(0, micBox.x - 260), y: Math.max(0, micBox.y - 70), width: 520, height: 160 } });
await page.mouse.move(10, 10);
await mic.click({ force: true });
expect(pathname() === '/my-day' && (await page.getByRole('dialog').count()) === 0, 'mic click does nothing');
// Keyboard: Tab onto the mic shows the same tooltip (aria-disabled keeps it focusable).
await page.locator('main h1').click();
let micFocused = false;
for (let i = 0; i < 40 && !micFocused; i++) {
  await page.keyboard.press('Tab');
  micFocused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'voice-entry');
}
await page.waitForTimeout(150);
const kbTip = await page.getByRole('tooltip').innerText().catch(() => '');
expect(micFocused && kbTip === 'Voice entry — coming in v2', `mic tooltip on keyboard focus "${kbTip}"`);
await page.keyboard.press('Escape');

// --- §11.1: start a task, mark it done with the 45m chip ---------------------
step = 'my-day:start';
const p20 = card('Prospect searching – 20 prospects');
await p20.getByRole('button', { name: /^Start/ }).click();
await page.waitForTimeout(300);
expect((await p20.getAttribute('data-status')) === 'inProgress', 'Start → in progress');
expect(await p20.getByTestId('running-timer').isVisible(), 'started card shows a running timer');
expect((await p20.innerText()).includes('In progress'), 'started card status chip "In progress"');

step = 'my-day:mark-done-45';
await p20.getByRole('button', { name: /^Mark done/ }).click();
let dialog = page.getByRole('dialog', { name: 'Mark done', exact: true });
await dialog.waitFor({ state: 'visible', timeout: 3000 });
await page.waitForTimeout(350);
const prefill = await dialog.getByLabel('Custom (h:mm)').inputValue();
expect(prefill === '0:05', `time prefilled from the timer, rounded to 5 min ("${prefill}")`);
expect((await dialog.getByRole('textbox', { name: 'Quantity done', exact: true }).inputValue()) === '20', 'quantity prefilled with 20');
for (const label of ['15m', '30m', '45m', '1h', '1h 30m', '2h']) {
  if ((await dialog.getByRole('button', { name: `${label} taken`, exact: true }).count()) !== 1) fail(`quick chip ${label} missing`);
}
await dialog.getByRole('button', { name: '45m taken', exact: true }).click();
expect((await dialog.getByRole('button', { name: '45m taken', exact: true }).getAttribute('aria-pressed')) === 'true', '45m chip pressed');
expect((await dialog.getByLabel('Custom (h:mm)').inputValue()) === '0:45', 'custom field follows the chip');
await checkPage('mark-done-modal');
await dismissToasts();
await page.waitForTimeout(300); // let the pressed-chip transition finish
await shot('mark-done-modal-light');
await page.evaluate(() => {
  window.__dialogTitles = new Set();
  const tick = () => {
    document.querySelectorAll('[role="dialog"] h2').forEach((h) => window.__dialogTitles.add(h.textContent));
    if (document.querySelector('[role="dialog"]')) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await dialog.getByRole('button', { name: 'Mark done', exact: true }).click();
await dialog.waitFor({ state: 'hidden', timeout: 3000 });
const seenTitles = await page.evaluate(() => [...window.__dialogTitles]);
expect(!seenTitles.includes('Mark done again'), `closing dialog keeps its title (${seenTitles.join(' | ')})`);
await page.waitForTimeout(300);
expect((await p20.getAttribute('data-status')) === 'done', 'task is done');
expect((await p20.locator('[data-rating]').getAttribute('data-rating')) === 'Better', 'rating chip = Better');
expect(
  (await page.evaluate(() => document.activeElement?.getAttribute('data-task-title'))) === 'Prospect searching – 20 prospects',
  'focus lands on the finished card',
);
let toastText = await lastToastText();
expect(toastText.includes('Nice! 20 prospects in 45m — Better ✦'), `toast "${toastText}"`);
await p20.scrollIntoViewIfNeeded();
await shot('rating-pop-light');

// --- Reviewable task → sent to Meera -----------------------------------------
step = 'my-day:review';
const l1 = card('First-level message – 30 messages');
await l1.getByRole('button', { name: /^Mark done/ }).click();
dialog = page.getByRole('dialog', { name: 'Mark done', exact: true });
await dialog.waitFor({ state: 'visible', timeout: 3000 });
expect((await dialog.getByLabel('Custom (h:mm)').inputValue()) === '', 'not-started task has no time prefill');
expect(await dialog.getByRole('button', { name: 'Mark done', exact: true }).isDisabled(), 'submit disabled until a time is chosen');
await dialog.getByLabel('Custom (h:mm)').fill('abc');
await dialog.getByRole('textbox', { name: /^Note/ }).click();
expect((await dialog.innerText()).includes('Try a time like'), 'friendly hint for an unreadable time');
await dialog.getByLabel('Custom (h:mm)').fill('1:20');
await dialog.getByRole('textbox', { name: /^Note/ }).fill('Two contacts swapped for fresher ones');
await dialog.getByRole('button', { name: 'Mark done', exact: true }).click();
await dialog.waitFor({ state: 'hidden', timeout: 3000 });
await page.waitForTimeout(300);
const l1After = await l1.innerText();
expect(l1After.includes('Done · sent to Meera for review'), 'card shows "Done · sent to Meera for review"');
expect(l1After.includes('Two contacts swapped for fresher ones'), 'card shows the note');
toastText = await lastToastText();
expect(toastText.includes('Nice! 30 messages in 1h 20m — Better ✦') && toastText.includes('Sent to Meera for review'), `toast "${toastText}"`);
expect((await page.getByTestId('day-summary').innerText()) === '5 of 8 tasks done · 4h 43m logged', 'summary updates');

// Optimal: the 15 L2 messages (std 1h) in exactly 1h — also reviewable.
step = 'my-day:optimal';
const l2 = card('Second-level message – 15 messages');
await l2.getByRole('button', { name: /^Mark done/ }).click();
dialog = page.getByRole('dialog', { name: 'Mark done', exact: true });
await dialog.waitFor({ state: 'visible', timeout: 3000 });
await dialog.getByRole('button', { name: '1h taken', exact: true }).click();
await dialog.getByRole('button', { name: 'Mark done', exact: true }).click();
await dialog.waitFor({ state: 'hidden', timeout: 3000 });
toastText = await lastToastText();
expect(
  toastText.includes('Right on standard — Optimal ✓') && toastText.includes('15 messages in 1h') && toastText.includes('Sent to Meera for review'),
  `Optimal toast "${toastText}"`,
);
expect((await l2.locator('[data-rating]').getAttribute('data-rating')) === 'Optimal', 'rating chip = Optimal');

// Can do better: the 30-min internal training in 1h — friendly wording.
step = 'my-day:can-do-better';
const training = card('Internal training – 1 session');
await training.getByRole('button', { name: /^Mark done/ }).click();
dialog = page.getByRole('dialog', { name: 'Mark done', exact: true });
await dialog.waitFor({ state: 'visible', timeout: 3000 });
await dialog.getByRole('button', { name: '1h taken', exact: true }).click();
await dialog.getByRole('button', { name: 'Mark done', exact: true }).click();
await dialog.waitFor({ state: 'hidden', timeout: 3000 });
toastText = await lastToastText();
expect(toastText.includes('Done! Internal training in 1h — Can do better ↗ · every bit counts'), `Can do better toast "${toastText}"`);
expect((await training.locator('[data-rating]').getAttribute('data-rating')) === 'Can do better', 'rating chip = Can do better');

// Everything done but the day isn't full yet → "All caught up ☀️".
step = 'my-day:all-caught-up';
expect((await page.getByTestId('all-caught-up').count()) === 0, 'no "All caught up" while tasks remain');
const model = card('Model building – 3 companies');
await model.getByRole('button', { name: /^Mark done/ }).click();
dialog = page.getByRole('dialog', { name: 'Mark done', exact: true });
await dialog.waitFor({ state: 'visible', timeout: 3000 });
expect(/^\d+:\d\d$/.test(await dialog.getByLabel('Custom (h:mm)').inputValue()), 'seeded in-progress task prefills from its timer');
await dialog.getByRole('button', { name: '45m taken', exact: true }).click();
await dialog.getByRole('button', { name: 'Mark done', exact: true }).click();
await dialog.waitFor({ state: 'hidden', timeout: 3000 });
await page.waitForTimeout(300);
expect((await page.getByTestId('day-summary').innerText()) === '8 of 8 tasks done · 7h 28m logged', 'summary: 8 of 8 done');
const caught = page.getByTestId('all-caught-up');
expect((await caught.count()) === 1 && (await caught.innerText()).includes('All caught up ☀️'), '"All caught up ☀️" banner');
expect((await page.getByTestId('wrap-up').count()) === 0, 'no wrap-up before the workday is logged');
await dismissToasts();
await shot('all-caught-up-light');

// --- Daily note --------------------------------------------------------------
step = 'my-day:note';
const note = page.getByTestId('daily-note');
expect((await note.innerText()).includes('Anything we should know about today?'), 'daily note prompt');
const textarea = note.getByLabel('Daily note');
expect((await textarea.getAttribute('placeholder')) === 'e.g. 25-min internal training', 'note placeholder');
expect(await note.getByRole('button', { name: 'Save note' }).isDisabled(), 'save disabled while empty');
await textarea.fill('25-min internal training after lunch');
await note.getByRole('button', { name: 'Save note' }).click();
toastText = await lastToastText();
expect(toastText.includes('Note saved'), `note toast "${toastText}"`);
expect((await note.innerText()).includes('Saved'), 'note shows "Saved"');
await note.getByRole('button', { name: /Anything we should know/ }).click();
await page.waitForTimeout(350);
expect((await note.getByLabel('Daily note').count()) === 0, 'note collapses');
await note.getByRole('button', { name: /Anything we should know/ }).click();
await page.waitForTimeout(350);

// --- Add task ----------------------------------------------------------------
step = 'my-day:add-task';
await page.getByRole('button', { name: 'Add task', exact: true }).click();
dialog = page.getByRole('dialog', { name: 'Add a task' });
await dialog.waitFor({ state: 'visible', timeout: 3000 });
await page.waitForTimeout(350);
const projectPills = dialog.getByRole('group', { name: 'Project' }).getByRole('button');
expect((await projectPills.count()) === 2, `Asha sees her 2 projects (${await projectPills.count()})`);
await projectPills.nth(1).click();
await dialog.getByTestId('task-type-tile').filter({ hasText: 'Company research' }).click();
await dialog.getByRole('button', { name: 'Increase Quantity', exact: true }).click();
await dialog.getByRole('radio', { name: 'Afternoon' }).click();
await dialog.getByRole('radio', { name: 'P1' }).click();
const std = await dialog.getByTestId('computed-standard').innerText();
expect(/1h 10m/.test(std) && /7 × 10 min/.test(std), `computed standard "${std.replace(/\s+/g, ' ')}"`);
await checkPage('add-task-modal');
await dismissToasts();
await shot('add-task-modal-light');
await dialog.getByRole('button', { name: 'Add to my day' }).click();
await dialog.waitFor({ state: 'hidden', timeout: 3000 });
await page.waitForTimeout(400);
expect(await noDialogLeft(), 'Add task dialog fully leaves the page (no invisible overlay)');
toastText = await lastToastText();
expect(toastText.includes('Company research – 7 companies'), `add toast "${toastText}"`);
const added = card('Company research – 7 companies');
expect((await added.count()) === 1, 'new task card appears');
expect((await page.getByTestId('block-afternoon').locator('[data-task-title="Company research – 7 companies"]').count()) === 1, 'new task is in the Afternoon block');
expect((await added.innerText()).includes('P1'), 'new task has P1');
expect((await page.getByTestId('all-caught-up').count()) === 0, '"All caught up" goes away when a new task is added');

// --- Keyboard: open Mark done with Enter, close with Escape -------------------
step = 'my-day:keyboard';
await added.getByRole('button', { name: /^Start/ }).focus();
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
expect((await added.getAttribute('data-status')) === 'inProgress', 'Start works from the keyboard');
await page.waitForTimeout(100);
const focusInfo = await page.evaluate(() => ({
  label: document.activeElement?.getAttribute('aria-label'),
  visible: document.activeElement?.matches(':focus-visible'),
  shadow: getComputedStyle(document.activeElement).boxShadow,
}));
expect(focusInfo.label === 'Mark done: Company research – 7 companies', `after Start, focus moves to Mark done (${focusInfo.label})`);
expect(focusInfo.visible && /0px 0px 0px 4px/.test(focusInfo.shadow), `focused button shows a focus ring (${focusInfo.shadow.slice(0, 50)})`);
await page.keyboard.press('Enter');
dialog = page.getByRole('dialog', { name: 'Mark done', exact: true });
await dialog.waitFor({ state: 'visible', timeout: 3000 });
await page.keyboard.press('Escape');
await dialog.waitFor({ state: 'hidden', timeout: 3000 });
ok('Mark done dialog opens with Enter and closes with Escape');

// --- Seeded scenarios from other roles (via the persisted store) --------------
step = 'my-day:scenarios';
const tomorrowSrc = `
  const d = new Date(s.demoDate + 'T00:00:00');
  do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
  const tomorrow = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const mins = [75, 60, 90, 45, 60, 60, 60];
  const blocks = ['morning', 'morning', 'afternoon', 'afternoon', 'anytime', 'morning', 'afternoon'];
  mins.forEach((m, i) => s.tasks.push({
    id: 't-check-tmrw-' + i, projectId: 'pr-northwind', taskTypeId: 'tt-prospect', title: 'Prospect searching – ' + (m / 3) + ' prospects',
    assigneeId: 'p-asha', quantity: m / 3, standardMinutes: m, priority: i === 0 ? 'P1' : 'P2', timeBlock: blocks[i], date: tomorrow, status: 'upNext',
  }));
  // Meera sends the L1 messages back with a note.
  const l1 = s.tasks.find((t) => t.assigneeId === 'p-asha' && t.date === s.demoDate && t.title === 'First-level message – 30 messages');
  l1.reviewStatus = 'changesRequested';
  l1.reviewNote = 'Please personalise the first line for the two CTOs';
  const rv = s.reviewTasks.find((r) => r.sourceTaskId === l1.id);
  rv.status = 'changesRequested'; rv.note = l1.reviewNote; rv.resolvedAt = new Date().toISOString();
  // Meera adjusted today's standard for the CRM clean-up.
  const crm = s.tasks.find((t) => t.assigneeId === 'p-asha' && t.date === s.demoDate && t.taskTypeId === 'tt-crm');
  crm.dayAdjustment = { newStandardMinutes: 35, reason: 'Tool outage', byPmId: 'p-meera', at: new Date().toISOString() };
  // A (rare) review waiting on Asha.
  const other = s.tasks.find((t) => t.assigneeId === 'p-rohan' && t.date === s.demoDate && t.status === 'done');
  s.reviewTasks.push({ id: 'rv-check-asha', sourceTaskId: other.id, reviewerId: 'p-asha', createdAt: new Date().toISOString(), status: 'pending', remindersSent: 0 });
  const other2 = s.tasks.find((t) => t.assigneeId === 'p-rohan' && t.date === s.demoDate && t.status === 'done' && t.id !== other.id);
  s.reviewTasks.push({ id: 'rv-check-asha-2', sourceTaskId: other2.id, reviewerId: 'p-asha', createdAt: new Date().toISOString(), status: 'pending', remindersSent: 0 });
`;
await patchStore(tomorrowSrc);
expect((await page.getByTestId('daily-note').getByLabel('Daily note').inputValue()) === '25-min internal training after lunch', 'daily note prefilled after reload');

// Tomorrow peek
const peek = page.getByTestId('tomorrow-peek');
const peekText = (await peek.innerText()).replace(/\s+/g, ' ');
expect(peekText.includes("Tomorrow's plan is ready · 7 tasks · 7h 30m"), `tomorrow peek "${peekText.slice(0, 60)}"`);
await peek.getByRole('button', { name: /Tomorrow's plan is ready/ }).click();
await page.waitForTimeout(350);
expect((await peek.locator('li').count()) === 7, 'tomorrow list shows 7 read-only rows');
expect((await peek.getByRole('button').count()) === 1, 'tomorrow list has no actions (read-only)');

// Adjusted for today
const crmCard = card('CRM clean-up – 15 records');
expect((await crmCard.getByTestId('adjusted-tag').count()) === 1, '"Adjusted for today" tag');
expect((await crmCard.innerText()).includes('Std 35m'), 'adjusted standard shown');
await crmCard.getByTestId('adjusted-tag').hover();
await page.waitForTimeout(400);
const adjTip = await page.getByRole('tooltip').innerText().catch(() => '');
expect(adjTip.includes('Meera') && adjTip.includes('Tool outage'), `adjustment tooltip "${adjTip}"`);
await page.mouse.move(10, 10);

// Changes requested → Mark done again
step = 'my-day:changes-requested';
const l1Again = card('First-level message – 30 messages');
const l1AgainText = await l1Again.innerText();
expect(l1AgainText.includes('Changes requested'), 'status "Changes requested"');
expect(l1AgainText.includes('Please personalise the first line for the two CTOs'), 'reviewer note shown');
expect(l1AgainText.includes("A quick tweak and it's good to go"), 'kind wording around the note');
const ratingBefore = await l1Again.locator('[data-rating]').getAttribute('data-rating');
await l1Again.scrollIntoViewIfNeeded();
await shot('changes-requested-light');
await l1Again.getByRole('button', { name: /^Mark done again/ }).click();
dialog = page.getByRole('dialog', { name: 'Mark done again' });
await dialog.waitFor({ state: 'visible', timeout: 3000 });
expect((await dialog.getByLabel('Custom (h:mm)').inputValue()) === '1:20', 'time prefilled with what was logged');
await dialog.getByRole('button', { name: 'Mark done again' }).click();
await dialog.waitFor({ state: 'hidden', timeout: 3000 });
await page.waitForTimeout(300);
expect((await l1Again.innerText()).includes('Done · sent to Meera for review'), 'resubmitted → sent to Meera for review');
expect((await l1Again.locator('[data-rating]').getAttribute('data-rating')) === ratingBefore, 'rating unchanged by the review round');

// Waiting on me
step = 'my-day:waiting-on-me';
const waiting = page.getByTestId('waiting-on-me');
expect((await waiting.count()) === 1, '"Waiting on me" shows when Asha has a review');
expect((await waiting.getByRole('listitem').count()) === 2, 'two reviews waiting on Asha');
await waiting.getByRole('button', { name: 'Approve' }).first().click();
toastText = await lastToastText();
expect(toastText.includes('Approved'), `approve toast "${toastText}"`);
await page.waitForTimeout(200);
await waiting.getByRole('button', { name: 'Send back with note' }).click();
await waiting.getByRole('textbox').fill('Could you add the call outcomes?');
await waiting.getByRole('button', { name: 'Send note' }).click();
toastText = await lastToastText();
expect(toastText.includes('Note sent to Rohan'), `send-back toast "${toastText}"`);
const sentBack = await withStore(`return store.useApp.getState().reviewTasks.find((r) => r.id === 'rv-check-asha-2')`);
expect(sentBack?.status === 'changesRequested' && sentBack?.note === 'Could you add the call outcomes?', 'send back stores the note');
await page.waitForTimeout(200);
expect((await page.getByTestId('waiting-on-me').count()) === 0, '"Waiting on me" disappears when empty');
await checkPage('my-day-scenarios');

// ---------------------------------------------------------------------------
// My Progress (before the end of the day)
// ---------------------------------------------------------------------------
step = 'my-progress';
await page.locator('aside nav[aria-label="Main"] a[href="/my-progress"]').click();
await page.waitForURL((u) => u.pathname === '/my-progress', { timeout: 5000 });
await settle();
const kpiLabels = await page.getByTestId('progress-kpis').innerText();
for (const label of ['Tasks done', 'Time vs standard', 'Rating mix', 'Discipline score']) {
  expect(kpiLabels.includes(label), `KPI tile "${label}"`);
}
expect(/\d+%\s+of standard time · lower is quicker/.test(kpiLabels), 'time vs standard hint');
expect(/vs (your last week|this point last week)/.test(kpiLabels), 'deltas are vs own last week');
expect(/Better/.test(kpiLabels) && /Optimal/.test(kpiLabels) && /Can do better/.test(kpiLabels), 'rating mix counts with labels');
expect((await page.getByTestId('kpi-last-week').count()) === 4, 'each KPI shows the own last-week number');
expect(/Last week by (Mon|Tue|Wed|Thu|Fri)/.test(kpiLabels), 'tasks done compares with last week up to the same weekday');
for (const id of ['chart-time-vs-standard', 'chart-rating-mix']) {
  const ticks = await page.$$eval(`[data-testid="${id}"] .recharts-xAxis .recharts-cartesian-axis-tick text`, (els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { t: e.textContent, l: r.left, r: r.right };
    }),
  );
  const overlap = ticks.some((a, i) => i > 0 && a.l < ticks[i - 1].r + 2);
  expect(ticks.length === 8 && ticks[7].t === 'This week' && !overlap, `${id}: all 8 week labels, no overlap (${ticks.map((x) => x.t).join(', ')})`);
}
const yTicks = await page.$$eval('[data-testid="chart-rating-mix"] .recharts-yAxis .recharts-cartesian-axis-tick text', (els) => els.map((e) => Number(e.textContent)));
expect(yTicks.length >= 3 && yTicks.every((v) => v % 5 === 0), `rating-mix y axis uses round ticks (${yTicks})`);
const lineDots = await page.locator('[data-testid="chart-time-vs-standard"] .recharts-line-dots circle').count();
expect(lineDots >= 7, `line chart has weekly points (${lineDots})`);
expect((await page.getByTestId('chart-time-vs-standard').innerText()).includes('Standard'), '100% "Standard" reference line label');
const barSegments = await page.locator('[data-testid="chart-rating-mix"] .recharts-bar-rectangle path').count();
expect(barSegments >= 8, `stacked bars render (${barSegments} segments)`);
const legend = (await page.getByTestId('chart-rating-mix').locator('[data-rating]').allInnerTexts()).map((t) => t.replace(/[^A-Za-z ]/g, '').trim());
expect(JSON.stringify(legend) === JSON.stringify(['Better', 'Optimal', 'Can do better']), `legend with icon + label ${legend}`);
const streak = await page.getByTestId('streak-card').innerText();
expect(/You've logged as you go for \d+ days in a row\./.test(streak), `streak "${streak.split('\n').find((l) => l.startsWith('You'))}"`);
expect(streak.includes('6 days in a row'), 'seeded streak is 6 days');
const otherNames = ['Rohan', 'Neha', 'Vikram', 'Priya', 'Karan'];
const progressText = await page.locator('main').innerText();
const leaked = otherNames.filter((n) => progressText.includes(n));
expect(leaked.length === 0, `no other person's data on My Progress (${leaked})`);
await checkPage('my-progress');
await dismissToasts();
await shot('my-progress-light', { fullPage: true });

// Chart tooltip
await page.locator('[data-testid="chart-time-vs-standard"] .recharts-line-dots circle').last().hover({ force: true });
await page.waitForTimeout(300);
const chartTip = await page.locator('[data-testid="chart-time-vs-standard"] .recharts-tooltip-wrapper').innerText().catch(() => '');
expect(/% of standard/.test(chartTip), `line chart tooltip "${chartTip.replace(/\s+/g, ' ')}"`);

// Feedback reports
step = 'my-progress:feedback';
const rows = page.getByTestId('feedback-row');
expect((await rows.count()) === 3, `3 sent feedback reports (${await rows.count()})`);
const weeks = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
log('feedback rows:', weeks.join(' | '));
for (let i = 0; i < 3; i++) {
  await rows.nth(i).click();
  const fb = page.getByRole('dialog', { name: /Your weekly feedback/ });
  await fb.waitFor({ state: 'visible', timeout: 3000 });
  await page.waitForTimeout(350);
  const text = await fb.innerText();
  expect(
    text.includes('Areas where you shone') && text.includes('Areas to grow') && text.includes('Next steps'),
    `report ${i + 1} shows shone / grow / next steps`,
  );
  expect((await fb.locator('input, textarea, [contenteditable="true"]').count()) === 0, `report ${i + 1} is read-only`);
  await checkPage(`feedback-${i + 1}`);
  if (i === 0) await shot('feedback-modal-light');
  await fb.getByRole('button', { name: 'Close', exact: true }).last().click();
  await fb.waitFor({ state: 'hidden', timeout: 3000 });
}

// ---------------------------------------------------------------------------
// §11 step 4: Meera approves, Kabir sends this week's feedback → Asha sees both
// (driven through the real store actions, as the PM / management screens would)
// ---------------------------------------------------------------------------
step = 'step4';
const step4 = await withStore(`
  const s = store.useApp.getState();
  const l1 = s.tasks.find((t) => t.assigneeId === 'p-asha' && t.date === s.demoDate && t.title === 'First-level message – 30 messages');
  const review = s.reviewTasks.find((r) => r.sourceTaskId === l1.id && r.status === 'pending');
  s.setCurrentUser('p-meera');
  store.useApp.getState().approveReview(review.id);
  store.useApp.getState().setCurrentUser('p-kabir');
  const fb = store.useApp.getState().weeklyFeedback.find((f) => f.personId === 'p-asha' && f.status === 'draft');
  store.useApp.getState().sendFeedback(fb.id);
  store.useApp.getState().setCurrentUser('p-asha');
  return { weekStart: fb.weekStart };
`);
await page.goto(`${BASE}/my-day`);
await settle();
expect(
  (await card('First-level message – 30 messages').innerText()).includes('Approved ✓'),
  'Asha\'s L1 card shows "Approved ✓" after Meera approves',
);
await page.locator('header button[aria-label^="Notifications"]').first().click();
await page.waitForTimeout(500);
const panelText = await page.locator('[role="dialog"]').last().innerText().catch(() => '');
expect(panelText.includes('Meera approved your 30 L1 messages ✓'), 'approval notification in the bell');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await page.locator('aside nav[aria-label="Main"] a[href="/my-progress"]').click();
await settle();
const fbRows = page.getByTestId('feedback-row');
expect((await fbRows.count()) === 4, `the newly sent report appears (${await fbRows.count()} reports)`);
const newestLabel = await fbRows.first().getAttribute('aria-label');
const [y, mo, d] = step4.weekStart.split('-').map(Number);
const expectedWeek = `Week of ${d} ${new Date(y, mo - 1, d).toLocaleString('en-GB', { month: 'short' })}`;
expect(newestLabel === `Open feedback: ${expectedWeek}`, `newest report first ("${newestLabel}")`);
await fbRows.first().click();
const fbNew = page.getByRole('dialog', { name: /Your weekly feedback/ });
await fbNew.waitFor({ state: 'visible', timeout: 3000 });
const fbNewText = await fbNew.innerText();
expect(fbNewText.includes(expectedWeek) && fbNewText.includes('Areas where you shone'), 'new report opens read-only');
expect((await fbNew.locator('input, textarea, [contenteditable="true"]').count()) === 0, 'new report is read-only');
await page.keyboard.press('Escape');
await fbNew.waitFor({ state: 'hidden', timeout: 3000 });

// ---------------------------------------------------------------------------
// End of day: wrap-up moment
// ---------------------------------------------------------------------------
step = 'my-day:end-of-day';
await page.locator('aside nav[aria-label="Main"] a[href="/my-day"]').click();
await settle();
expect(await page.getByRole('button', { name: 'Add task', exact: true }).isVisible(), '"Add task" visible before the wrap-up');
await page.locator('header button[aria-label^="Demo clock"]').click();
await page.getByRole('button', { name: 'Jump to end of day' }).click();
await page.getByTestId('wrap-up').waitFor({ state: 'visible', timeout: 4000 });
const wrap = await page.getByTestId('wrap-up').innerText();
expect(wrap.includes("That's a wrap for today 🎉") && wrap.includes('Close the laptop and go enjoy your evening.'), 'wrap-up card copy');
expect(await page.getByTestId('day-complete').isVisible(), '"Day complete" chip');
expect((await page.getByRole('button', { name: 'Add task', exact: true }).count()) === 0, '"Add task" hidden after the wrap-up');
expect((await page.getByTestId('voice-entry').count()) === 0, 'mic hidden with Add task');
expect(/^Good evening, Asha 👋$/.test(await page.locator('main h1').innerText()), 'greeting turns to Good evening');
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);
expect((await page.locator('body > canvas').count()) > 0, 'confetti fired');
await dismissToasts();
await shot('wrap-up-light');
const flag = await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.includes('wrap-up')));
expect(flag.length === 1, `confetti flag stored for this person + date (${flag})`);
await page.waitForTimeout(3500);
await page.reload();
await settle();
await page.waitForTimeout(800);
expect((await page.getByTestId('wrap-up').count()) === 1, 'wrap-up card persists after reload');
expect((await page.locator('body > canvas').count()) === 0, 'confetti does not fire again in this session');
await checkPage('wrap-up');

// Dark mode
step = 'dark';
await setTheme('dark');
await checkPage('my-day-dark');
await shot('my-day-dark', { fullPage: true });
await page.locator('aside nav[aria-label="Main"] a[href="/my-progress"]').click();
await settle();
await checkPage('my-progress-dark');
await shot('my-progress-dark', { fullPage: true });
await page.getByTestId('feedback-row').first().click();
await page.getByRole('dialog', { name: /Your weekly feedback/ }).waitFor({ state: 'visible' });
await page.waitForTimeout(350);
await shot('feedback-modal-dark');
await page.keyboard.press('Escape');
await page.locator('aside nav[aria-label="Main"] a[href="/my-day"]').click();
await settle();
await page.getByRole('button', { name: /Tomorrow's plan is ready/ }).click();
await page.waitForTimeout(300);
await shot('my-day-dark-bottom', { fullPage: true });

// Tablet
step = 'tablet';
await page.setViewportSize({ width: 768, height: 1024 });
await page.reload();
await settle();
await checkPage('tablet-my-day');
await shot('tablet-my-day-dark', { fullPage: true });
await setTheme('light');
await page.goto(`${BASE}/my-progress`);
await settle();
await checkPage('tablet-my-progress');
await shot('tablet-my-progress-light', { fullPage: true });

// Fresh light-mode My Day at tablet width (mid-day, before the wrap-up)
step = 'tablet:fresh';
await page.evaluate(() => {
  localStorage.clear();
  sessionStorage.clear();
});
await page.goto(`${BASE}/my-day`);
await settle();
await checkPage('tablet-fresh');
await shot('tablet-my-day-light', { fullPage: true });
await page.getByRole('button', { name: 'Add task', exact: true }).click();
await page.getByRole('dialog', { name: 'Add a task' }).waitFor({ state: 'visible' });
await page.waitForTimeout(350);
await checkPage('tablet-add-task');
await shot('tablet-add-task-light');
await page.keyboard.press('Escape');

// A light day today shows the reduced target on the progress line.
step = 'light-day-today';
await page.setViewportSize({ width: 1280, height: 900 });
// Any change makes the store save itself (it was just cleared).
await setTheme('dark');
await setTheme('light');
await patchStore(`
  s.lightDays.push({ id: 'ld-check-today', date: s.demoDate, projectIds: 'all', reason: 'Quarterly town hall', adjustedTargetPercent: 75 });
  const d = new Date(s.demoDate + 'T00:00:00');
  do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
  const next = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  s.lightDays.push({ id: 'ld-check-next', date: next, projectIds: 'all', reason: 'Team workshop', adjustedTargetPercent: 75 });
`);
const soonText = await page.getByTestId('light-day-soon').innerText();
expect(/^\w{3} \d{1,2} \w{3} is a light day · Team workshop – targets at 75%$/.test(soonText), `heads-up names the target ("${soonText}")`);
const progressCard = page.getByRole('progressbar', { name: 'Day progress' }).locator('xpath=ancestor::div[contains(@class,"card")][1]');
const lightText = (await progressCard.innerText()).replace(/\s+/g, ' ');
expect(lightText.includes("Light day target · Quarterly town hall"), `light-day target on the progress line ("${lightText.slice(0, 80)}")`);
await checkPage('light-day-today');
await shot('light-day-today-light', { clip: { x: 256, y: 64, width: 1024, height: 360 } });

// Another resource via the "Viewing as" switcher: their own day, note and progress only.
step = 'rohan';
await page.locator('header button[aria-label^="Viewing as"]').click();
await page.getByRole('menuitemradio', { name: /Rohan Mehta/ }).click();
await page.waitForURL((u) => u.pathname === '/my-day', { timeout: 5000 });
await settle();
expect(/, Rohan 👋$/.test(await page.locator('main h1').innerText()), 'Rohan sees his own My Day');
expect(
  (await page.getByTestId('daily-note').getByLabel('Daily note').inputValue()) === 'Client call ran long this morning',
  "Rohan's existing note is prefilled",
);
expect((await card('Telecalling – 20 calls').innerText()).includes('P1'), "Rohan's P1 task is listed (no escalation copy)");
await checkPage('rohan-my-day');
await page.locator('aside nav[aria-label="Main"] a[href="/my-progress"]').click();
await settle();
const rohanProgress = await page.locator('main').innerText();
expect(!/Asha|Neha|Vikram|Priya|Karan/.test(rohanProgress), "Rohan's progress shows no one else's data");
await checkPage('rohan-my-progress');

// Reduced motion: no confetti, no errors.
step = 'reduced-motion';
const rmContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
const rm = await rmContext.newPage();
watch(rm);
await rm.goto(`${BASE}/my-day`);
await rm.evaluate(() => {
  localStorage.clear();
  sessionStorage.clear();
});
await rm.reload();
await rm.locator('main h1').waitFor({ state: 'visible' });
await rm.waitForTimeout(600);
await rm.locator('header button[aria-label^="Demo clock"]').click();
await rm.getByRole('button', { name: 'Jump to end of day' }).click();
await rm.getByTestId('wrap-up').waitFor({ state: 'visible', timeout: 4000 });
await rm.waitForTimeout(600);
expect((await rm.locator('body > canvas').count()) === 0, 'no confetti with reduced motion');
await rmContext.close();

await browser.close();

if (otherWarnings.size) console.log(`\nOther console warnings:\n${[...otherWarnings].map((w) => `  - ${w}`).join('\n')}`);
console.log(issues.length ? `\nRESOURCE CHECK FAILED — ${issues.length} issue(s)` : '\nRESOURCE CHECK PASSED');
process.exit(issues.length ? 1 : 0);
