/**
 * Round 13 · R4 (Assign: previous working day, difficulty vs standard) and R5 (task history, resubmits) check,
 * plus the lead dashboard's "Assignment difficulty" and "This week at a glance" cards.
 *
 *   npx vite build --base ./ && npx vite preview --port 5713 --strictPort &
 *   node scripts/check-r13-assign-history.mjs      # BASE_URL=http://localhost:5713/ by default
 *
 * Starts from clean demo data. As Bheeshma: the "Yesterday's tasks" strip pulls the previous working day (Monday
 * pulls Friday) and the toast names the day; project custom standards appear as task types with unit and minutes;
 * every cart item has a difficulty badge (Standard / Easy (+x% time) / Challenging (-x% time)) with the standard
 * minutes and the cart footer sums them; assigned tasks in "Still open" show the badge and an expandable History.
 * Review flow: feedback, resubmit twice ("Resubmitted 2x"), forward to Komala, approve; every step shows up with
 * exact times in the History timeline on the task row and on the review row (open by default for resubmits).
 * As Komala: lead dashboard cards (per-PM difficulty mix for the last 4 weeks, week at a glance). Light and dark.
 * Fails on page errors, console errors, em/en dashes or session wording in the checked areas.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5713/';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'e2e', 'screenshots');
mkdirSync(OUT, { recursive: true });

const issues = [];
let step = 'boot';
const ok = (m) => console.log('  ok  ', m);
const fail = (m) => { issues.push(`[${step}] ${m}`); console.log('  FAIL', `[${step}]`, m); };
const expect = (c, m) => (c ? ok(m) : fail(m));
const section = (s) => { step = s; console.log(`\n# ${s}`); };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const page = await context.newPage();
page.on('pageerror', (e) => fail(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') fail(`console.error: ${m.text()}`); });

const shot = async (name, full = true) => page.screenshot({ path: path.join(OUT, `r13-assign-history-${name}.png`), fullPage: full });
const shotOf = async (loc, name) => { await loc.scrollIntoViewIfNeeded(); await loc.screenshot({ path: path.join(OUT, `r13-assign-history-${name}.png`) }); };
const go = async (hash) => { await page.goto(`${BASE}#${hash}`); await page.waitForTimeout(250); };
const as = async (id, hash = '/') => {
  await page.selectOption('select[aria-label="Viewing as"]', id);
  await page.waitForTimeout(150);
  await go(hash);
};
const textOf = async (loc) => (await loc.innerText()).replace(/\s+/g, ' ').trim();
const lastToast = async () => {
  await page.waitForTimeout(200);
  const t = page.locator('[role="status"] li[data-tone]');
  const n = await t.count();
  return n ? textOf(t.nth(n - 1)) : '';
};
const checkWording = async (loc, where) => {
  const t = await loc.innerText();
  expect(!/[\u2013\u2014]/.test(t), `${where}: no em or en dashes`);
  expect(!/\b(log ?in|log ?out|sign ?in|sign ?out)\b/i.test(t), `${where}: no session wording`);
};
const setTheme = async (name) => {
  await page.click('button[aria-label="Theme"]');
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).first().click();
  const done = page.getByRole('button', { name: 'Done' });
  if (await done.count()) await done.click(); else await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
};
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('ls-tracker-v2') ?? '{}').state);

// Previous working day in the browser's local time (Monday gives Friday).
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WDS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = new Date();
const prev = new Date(today); do prev.setDate(prev.getDate() - 1); while (prev.getDay() === 0 || prev.getDay() === 6);
const prevIso = iso(prev);
const prevLabel = `${WDS[prev.getDay()]} ${prev.getDate()} ${MON[prev.getMonth()]}`;
const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
const prevIsYesterday = iso(yesterday) === prevIso;
console.log(`today ${iso(today)} (${WDS[today.getDay()]}), previous working day ${prevIso} (${prevLabel})`);

// ------------------------------------------------------------------------------------------------
section('boot');
await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector('select[aria-label="Viewing as"]');
ok('app loaded with clean data');

// ------------------------------------------------------------------------------------------------
section('assign: yesterday = previous working day');
await as('bheeshma', '/assign');
const strip = page.locator('section[aria-label="Yesterday\'s tasks"]');
await strip.waitFor();
const stripText = await textOf(strip);
expect(stripText.includes("Yesterday's tasks") && stripText.includes(prevLabel), `strip names the day: "${stripText.slice(0, 120)}"`);
if (!prevIsYesterday) expect(/previous working day/.test(stripText), 'strip says it is the previous working day (weekend skipped)');
const s0 = await state();
const expectedPrev = s0.tasks.filter((t) => t.assignedById === 'bheeshma' && t.date === prevIso && ['northwind', 'bd'].includes(t.projectId));
expect(expectedPrev.length > 0, `Bheeshma assigned ${expectedPrev.length} tasks on ${prevLabel} in the seed`);
expect(stripText.includes(`${expectedPrev.length} task`), 'strip shows how many tasks were assigned that day');
const projBtns = await page.locator('main').getByRole('button', { name: /Northwind SaaS - US|Lead Strategus - Internal BD/ }).allInnerTexts();
expect(projBtns.some((t) => /Northwind/.test(t) && /owner/.test(t)) && projBtns.some((t) => /Internal BD/.test(t) && /admin/.test(t)), `owner and admin projects both selectable (${projBtns.join(' | ').replace(/\s+/g, ' ')})`);
await shot('assign-top');

const pullBtn = strip.getByRole('button', { name: /^Use / });
expect((await textOf(pullBtn)).includes(prevIsYesterday ? "yesterday's" : `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][prev.getDay()]}'s`), `button names the day: "${await textOf(pullBtn)}"`);
await pullBtn.click();
const t1 = await lastToast();
expect(t1.includes(`from ${prevLabel}`) && (prevIsYesterday || t1.includes('previous working day')), `toast says which day was pulled: "${t1}"`);
const cartItems = page.locator('[data-cart-item]');
expect((await cartItems.count()) === expectedPrev.length, `cart has the ${expectedPrev.length} tasks from ${prevLabel} (${await cartItems.count()})`);
const badges = page.locator('[data-cart-item] [data-difficulty]');
expect((await badges.count()) === expectedPrev.length, 'every cart item has a difficulty badge');
const badgeTexts = (await badges.allInnerTexts()).map((t) => t.replace(/\s+/g, ' '));
expect(badgeTexts.every((t) => /^(Standard|Easy \(\+\d+% time\)|Challenging \(-\d+% time\)|No standard)( standard \d+h?( \d+m)?m?)?$/.test(t.trim())), `badge wording ok (${[...new Set(badgeTexts.map((t) => t.split(' (')[0].split(' standard')[0]))].join(', ')})`);
expect(badgeTexts.every((t) => /standard \d/.test(t) || /No standard/.test(t)), 'every badge shows the standard minutes');
const mixText = await textOf(page.getByTestId('cart-mix'));
const nums = [...mixText.matchAll(/(\d+) (challenging|standard|easy|no standard)/g)].reduce((s, m) => s + Number(m[1]), 0);
expect(/\d+ challenging/.test(mixText) && /\d+ standard/.test(mixText) && /\d+ easy/.test(mixText) && nums === expectedPrev.length, `cart footer sums difficulty: "${mixText}"`);
// Matching levels: the first cart item's badge agrees with its target vs standard.
const challengingCount = badgeTexts.filter((t) => t.startsWith('Challenging')).length;
expect(mixText.includes(`${challengingCount} challenging`), 'footer challenging count matches the badges');

await pullBtn.click();
expect(/already in today's list/.test(await lastToast()), 'pulling twice does not duplicate');
expect((await cartItems.count()) === expectedPrev.length, 'cart unchanged after second pull');

// Quantity change keeps the difficulty (pace per unit kept).
const firstItem = cartItems.first();
const before = await textOf(firstItem.locator('[data-difficulty]'));
const qtyInput = firstItem.locator('input[type="number"]').first();
const q0 = Number(await qtyInput.inputValue());
await qtyInput.fill(String(q0 * 2));
const after = await textOf(firstItem.locator('[data-difficulty]'));
expect(before.split(' standard')[0].split(' (')[0] === after.split(' standard')[0].split(' (')[0], `doubling the quantity keeps the level (${before} -> ${after})`);
await qtyInput.fill(String(q0));
await page.getByRole('button', { name: 'Clear' }).click();
expect((await cartItems.count()) === 0, 'cart cleared');

// ------------------------------------------------------------------------------------------------
section('assign: custom standards + live difficulty');
const main = page.locator('main');
await main.getByRole('button', { name: /^Northwind SaaS - US/ }).click();
const liBtn = main.locator('[data-custom-standard="cs-li"]');
expect(await liBtn.isVisible(), 'Northwind custom standard is a task type');
expect(/LinkedIn connection request.*0\.5 min per request/.test(await textOf(liBtn)), `shows unit and minutes: "${await textOf(liBtn)}"`);
await main.getByRole('button', { name: /^Lead Strategus - Internal BD/ }).click();
expect((await main.locator('[data-custom-standard]').count()) === 0, 'BD (no custom standards) shows none');
await main.getByRole('button', { name: /^Northwind SaaS - US/ }).click();
await liBtn.click();
const draft = page.getByTestId('draft-difficulty');
await main.getByLabel('Quantity', { exact: true }).fill('60');
let dt = await textOf(draft);
expect(/Standard for 60 requests on this project: 30m/.test(dt) && /Standard/.test(dt), `standard from core logic (60 x 0.5 min): "${dt}"`);
await main.getByLabel('Target time (min)').fill('20');
dt = await textOf(draft);
expect(/Challenging \(-33% time\)/.test(dt), `tighter target shows Challenging (-33% time): "${dt}"`);
await main.getByRole('button', { name: /Udhaya/ }).first().click();
await main.getByRole('button', { name: 'Add to list' }).click();
// Easy: model build 10 = 30m standard, give 40m.
await main.getByRole('button', { name: 'Model build', exact: true }).click();
await main.getByLabel('Quantity', { exact: true }).fill('10');
await main.getByLabel('Target time (min)').fill('40');
dt = await textOf(draft);
expect(/Easy \(\+33% time\)/.test(dt), `looser target shows Easy (+33% time): "${dt}"`);
await main.getByRole('button', { name: /Bharath/ }).first().click();
await main.getByRole('button', { name: 'Add to list' }).click();
// Standard: prospect mapping 30 at the project standard.
await main.getByRole('button', { name: 'Prospect mapping', exact: true }).click();
dt = await textOf(draft);
expect(/your target 1h/.test(dt) && /Standard/.test(dt), `default target equals the standard: "${dt}"`);
await main.getByRole('button', { name: 'Add to list' }).click();
// Free-form custom task: no standard unless the name matches one.
await main.getByRole('button', { name: '+ Custom task' }).click();
await main.getByLabel('Custom task name').fill('Profile audit');
await main.getByLabel('Custom task unit').fill('profiles');
dt = await textOf(draft);
expect(/No standard/.test(dt) && /Edit project details/.test(dt), `free-form custom task has no standard: "${dt}"`);
await shotOf(draft, 'draft-no-standard');
await main.getByLabel('Custom task name').fill('linkedin connection request');
dt = await textOf(draft);
expect(/Matches the project task "LinkedIn connection request"/.test(dt), 'custom name matching a project standard uses it');
await main.getByLabel('Custom task name').fill('Profile audit');
await main.getByRole('button', { name: 'Add to list' }).click();
const cartLabels = await cartItems.allInnerTexts();
expect(cartLabels.some((t) => /60 LinkedIn connection request/.test(t) && /Challenging \(-33% time\)/.test(t) && /standard 30m/.test(t)), 'cart: custom-standard item is Challenging with standard 30m');
expect(cartLabels.some((t) => /10 model build/i.test(t) && /Easy \(\+33% time\)/.test(t)), 'cart: model build item is Easy');
expect(cartLabels.some((t) => /30 prospect mapping/i.test(t) && /Standard\s+standard 1h/.test(t)), 'cart: prospect item is Standard');
expect(cartLabels.some((t) => /Profile audit/.test(t) && /No standard/.test(t)), 'cart: free-form custom item says No standard');
const mix2 = await textOf(page.getByTestId('cart-mix'));
expect(/1 challenging/.test(mix2) && /1 standard/.test(mix2) && /1 easy/.test(mix2) && /1 no standard/.test(mix2), `footer: "${mix2}"`);
await shotOf(page.locator('main .xl\\:sticky'), 'assign-cart');
await shot('assign-cart-full');
await checkWording(main, 'assign page');

await main.getByRole('button', { name: /Assign all/ }).click();
expect(/Assigned 4 tasks/.test(await lastToast()), 'assigned all 4');
const s1 = await state();
const made = s1.tasks.filter((t) => t.assignedById === 'bheeshma' && t.date === iso(today) && !['t1', 't2', 't3', 't4', 't8', 't10', 't15', 't22'].includes(t.id));
const li = made.find((t) => t.customStandardId === 'cs-li');
expect(li && li.standardMinutes === 30 && li.targetMinutes === 20 && li.unit === 'requests' && li.history?.[0]?.action === 'assigned', 'store: custom standard task saved with standardMinutes 30 and an assigned event');

// ------------------------------------------------------------------------------------------------
section('assign: still open rows');
const open = page.getByTestId('still-open');
const liRow = open.locator('li[data-assigned]', { hasText: '60 LinkedIn connection request' });
await liRow.waitFor();
expect(/Challenging \(-33% time\)\s*standard 30m/.test(await textOf(liRow)), 'still-open row shows difficulty and standard minutes');
const rowsWithBadge = await open.locator('li[data-assigned] [data-difficulty]').count();
expect(rowsWithBadge === (await open.locator('li[data-assigned]').count()), `every still-open task has a difficulty badge (${rowsWithBadge})`);
await liRow.getByRole('button', { name: /^Edit/ }).click();
await liRow.getByLabel('Target minutes').fill('34');
expect(/Easy \(\+13% time\)/.test(await textOf(liRow.locator('form'))), 'editing the target updates the badge live');
await liRow.getByRole('button', { name: 'Save' }).click();
await liRow.getByRole('button', { name: /Remind/ }).click();
await liRow.getByRole('button', { name: /History/ }).click();
const liHist = liRow.getByTestId('task-history');
const liHistText = await textOf(liHist);
expect(/Assigned by Bheeshma to Udhaya/.test(liHistText) && /Edited by Bheeshma/.test(liHistText) && /target 20m to 34m/.test(liHistText) && /Reminder sent by Bheeshma/.test(liHistText), `history lists assigned, edited and reminded: "${liHistText.slice(0, 200)}"`);
expect(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d+ \w{3}, \d\d:\d\d/.test(liHistText), 'history shows exact date and time');
await shotOf(open, 'still-open');

// ------------------------------------------------------------------------------------------------
section('review row: resubmitted task shows history before approving');
await as('bheeshma', '/');
const t8 = page.locator('li[data-review="t8"]');
await t8.waitFor();
const t8Text = await textOf(t8);
expect(/Resubmitted 1x/.test(t8Text), 'review row shows "Resubmitted 1x"');
expect(await t8.getByTestId('task-history').isVisible(), 'history is open by default for a resubmitted task');
expect(/Sent for approval by Bharath to Bheeshma/.test(t8Text) && /Feedback from Bheeshma/.test(t8Text) && /Resubmitted for approval by Bharath/.test(t8Text), 'review history: sent, feedback (by whom), resubmitted');
expect(/Sent for approval (Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d+ \w{3}, \d\d:\d\d/.test(t8Text) && /first sent/.test(t8Text), 'review row shows exact submit time and first sent time');
const t2r = page.locator('li[data-review="t2"]');
expect(!(await t2r.getByTestId('task-history').isVisible()), 'first-time submission keeps history folded');
await shotOf(page.locator('li[data-review]').first().locator('xpath=ancestor::section[1]'), 'review-queue');

// Round 1 feedback on t2.
await t2r.getByRole('button', { name: 'Feedback' }).click();
await t2r.getByPlaceholder('What should they change?').fill('Add the company size column.');
await t2r.getByRole('button', { name: 'Send' }).click();

section('task row: resubmit twice, forward, approve');
await as('udhaya', '/');
let t2 = page.locator('li[data-task="t2"]');
await t2.waitFor();
expect(/Feedback to address/.test(await textOf(t2)), 't2 back with Udhaya as feedback');
await t2.getByRole('button', { name: 'Resubmit' }).click();
expect(await page.getByRole('dialog').getByText('Resubmit for approval').isVisible(), 'modal title says Resubmit for approval');
await page.getByRole('dialog').getByRole('button', { name: /Send to/ }).click();
await page.getByRole('dialog').waitFor({ state: 'detached' });
expect(/Resubmitted 1x/.test(await textOf(t2)), 'task row shows "Resubmitted 1x"');

await as('bheeshma', '/');
await page.locator('li[data-review="t2"]').getByRole('button', { name: 'Feedback' }).click();
await page.locator('li[data-review="t2"]').getByPlaceholder('What should they change?').fill('Two duplicates left.');
await page.locator('li[data-review="t2"]').getByRole('button', { name: 'Send' }).click();

await as('udhaya', '/');
t2 = page.locator('li[data-task="t2"]');
await t2.getByRole('button', { name: 'Resubmit' }).click();
await page.getByRole('dialog').getByRole('button', { name: /Send to/ }).click();
await page.getByRole('dialog').waitFor({ state: 'detached' });
expect(/Resubmitted 2x/.test(await textOf(t2)), 'task row shows "Resubmitted 2x"');
await t2.getByRole('button', { name: /History/ }).click();
let h = await textOf(t2.getByTestId('task-history'));
expect(/Assigned by Bheeshma to Udhaya/.test(h) && /Sent for approval by Udhaya to Bheeshma/.test(h), 'history: assigned, sent for approval');
expect((h.match(/Feedback from Bheeshma/g) ?? []).length === 2 && /"Add the company size column\."/.test(h), 'history: both feedback rounds with the note');
expect(/resubmit 1/.test(h) && /resubmit 2/.test(h), 'history: resubmit 1 and resubmit 2');
expect(/2 feedback rounds/.test(h), 'history summary counts feedback rounds');
await shotOf(t2, 'task-row-history');

await as('bheeshma', '/');
const t2b = page.locator('li[data-review="t2"]');
expect(/Resubmitted 2x/.test(await textOf(t2b)) && (await t2b.getByTestId('task-history').isVisible()), 'reviewer sees "Resubmitted 2x" and the history before approving');
await t2b.getByRole('button', { name: 'Forward' }).click();
await t2b.locator('select[aria-label="Forward to"]').selectOption('komala');
await t2b.getByPlaceholder('Note (optional)').fill('Client-facing, please check.');
await t2b.locator('form').getByRole('button', { name: 'Forward' }).click();

section('lead: approve the forwarded task, dashboard cards');
await as('komala', '/');
const t2k = page.locator('li[data-review="t2"]');
await t2k.waitFor();
const t2kText = await textOf(t2k);
expect(/Forwarded by Bheeshma/.test(t2kText) && /Forwarded by Bheeshma to Komala/.test(t2kText) && /"Client-facing, please check\."/.test(t2kText), 'forwarded review row shows who forwarded, to whom and the note');
await t2k.getByRole('button', { name: 'Approve' }).click();
expect(/Approved, Udhaya notified/.test(await lastToast()), 'approve toast has no dash');

const glance = page.getByTestId('week-glance');
await glance.waitFor();
const gt = await textOf(glance);
expect(/Tasks done \d+/.test(gt) && /On time (\d+%|No tasks yet)/.test(gt) && /Hours logged [\d.]+h/.test(gt) && /Extra hours [\d.]+h/.test(gt) && (gt.match(/Last week/g) ?? []).length === 4, `week at a glance: "${gt}"`);
const ad = page.getByTestId('assignment-difficulty');
const bhe = await textOf(ad.locator('[data-assigner="bheeshma"]'));
const abi = await textOf(ad.locator('[data-assigner="abisho"]'));
expect(/\d+% challenging/.test(bhe) && /\d+% standard/.test(bhe) && /\d+% easy/.test(bhe), `per-PM percentages: "${bhe}"`);
expect(/Sets tight targets/.test(bhe), 'Bheeshma tagged as setting tight targets');
expect(/Sets easy targets/.test(abi), `Abisho tagged as setting easy targets: "${abi}"`);
expect((await ad.locator('[data-assigner]').count()) >= 4, 'one row per assigner (PMs and manager)');
const order1 = await ad.locator('[data-assigner]').evaluateAll((els) => els.map((e) => e.getAttribute('data-assigner')));
expect(order1.indexOf('komala') === order1.length - 1 && order1.indexOf('bheeshma') >= 0, `PMs listed first, manager last (${order1.join(', ')})`);
const pcts = [...bhe.matchAll(/(\d+)%/g)].map((m) => Number(m[1]));
expect(Math.abs(pcts.reduce((a, b) => a + b, 0) - 100) <= 2, `percentages add up to about 100 (${pcts.join('+')})`);
const adCard = ad.locator('xpath=ancestor::section[1]');
expect(/Last 4 weeks/.test(await textOf(adCard)) && /Whole team: \d+% challenging/.test(await textOf(adCard)), 'card says last 4 weeks and shows the whole-team mix');
await checkWording(adCard, 'assignment difficulty card');
await checkWording(glance.locator('xpath=ancestor::section[1]'), 'week at a glance card');
const teamToday = page.locator('section', { hasText: 'Team today' }).last();
const counts = [...(await textOf(teamToday)).matchAll(/(\d+) done/g)].map((m) => Number(m[1]));
expect(counts.every((n) => n < 30), `Team today counts only today's work (${counts.join(', ')})`);
await shot('lead-dashboard-light');
await shotOf(adCard, 'lead-difficulty-light');

await as('kingshuk', '/');
expect(await page.getByTestId('assignment-difficulty').isVisible() && await page.getByTestId('week-glance').isVisible(), 'founder sees assignment difficulty and the week at a glance');
await as('komala', '/');

section('dark theme');
await setTheme('Professional Dark');
await page.waitForTimeout(200);
await shotOf(adCard, 'lead-difficulty-dark');
await shotOf(glance.locator('xpath=ancestor::section[1]'), 'lead-glance-dark');
await go('/assign');
await page.locator('section[aria-label="Yesterday\'s tasks"]').getByRole('button', { name: /^Use / }).click();
await shot('assign-dark');
await setTheme('Professional');

await as('udhaya', '/');
await setTheme('Professional Dark');
t2 = page.locator('li[data-task="t2"]');
await t2.getByRole('button', { name: /History/ }).click();
h = await textOf(t2.getByTestId('task-history'));
expect(/Forwarded by Bheeshma to Komala/.test(h) && /Approved by Komala/.test(h) && /Assigned to approved in/.test(h), 'final history: forwarded, approved, total time');
const order = ['assigned', 'submitted', 'feedback', 'resubmitted', 'feedback', 'resubmitted', 'forwarded', 'approved'];
const actions = await t2.locator('[data-testid="task-history"] li[data-action]').evaluateAll((els) => els.map((e) => e.getAttribute('data-action')));
expect(JSON.stringify(actions) === JSON.stringify(order), `timeline order ${actions.join(' > ')}`);
const s2 = await state();
const st2 = s2.tasks.find((t) => t.id === 't2');
expect(st2.resubmits === 2 && st2.status === 'done' && !!st2.approvedAt && !!st2.submittedAt, 'store: resubmits 2, approvedAt and submittedAt recorded');
await shotOf(t2, 'task-row-history-dark');
await setTheme('Professional');

section('fun theme still renders');
await as('bheeshma', '/assign');
await setTheme('Cartoon');
await page.locator('section[aria-label="Yesterday\'s tasks"]').waitFor();
await shot('assign-cartoon', false);
await setTheme('Professional');

section('narrow screen');
await page.setViewportSize({ width: 420, height: 900 });
await go('/assign');
const overflow = await page.evaluate(() => {
  const m = document.querySelector('main');
  return Math.max(...[...m.querySelectorAll('section')].map((el) => el.getBoundingClientRect().right - document.documentElement.clientWidth));
});
expect(overflow <= 1, `assign sections fit at 420px (${overflow}px)`);
await page.evaluate(() => window.scrollTo(0, 0));
await shot('assign-mobile', false);
await shotOf(page.getByTestId('still-open').locator('li').first(), 'still-open-mobile');
await as('bheeshma', '/');
await shotOf(page.locator('li[data-review="t8"]'), 'review-row-mobile');

await browser.close();
console.log(`\n${issues.length ? `${issues.length} issue(s):\n- ${issues.join('\n- ')}` : 'All R4/R5 assign + history checks passed.'}`);
process.exit(issues.length ? 1 : 0);
