/**
 * PM planning screens check: New project wizard, Plan the day, Task library, Light days.
 *
 *   npx vite --port 5303 --strictPort &      # in another shell
 *   node scripts/check-pm-plan.mjs           # BASE_URL=http://localhost:5303 by default
 *
 * From a clean seed, as Meera: creates a project through the wizard with < 10 real inputs
 * (and a second one exercising every control), plans tomorrow for Rohan via "Copy yesterday's
 * plan" (two quantity edits, overrides, pills, reviewer, add/remove rows, unsaved-changes guard),
 * checks Rohan's My Day peek, edits / adds / archives / restores task types, adds and removes
 * light days, and checks Asha's My Day progress line shows the reduced light-day target.
 * Fails on console errors, page errors, forbidden words or horizontal overflow (1280 and 768).
 * Screenshots (light + dark) go to e2e/screenshots/pm-plan-*.png.
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

const BASE = process.env.BASE_URL ?? 'http://localhost:5303';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'e2e', 'screenshots');
mkdirSync(OUT, { recursive: true });

const FORBIDDEN =
  /\b(late|failed|missed|behind|poor|flagged|overdue|slow|rank|ranked|ranking|leaderboard|worst|top performer)\b/i;

const issues = [];
const otherWarnings = new Set();
const log = (...a) => console.log('·', ...a);
const ok = (msg) => console.log('✓', msg);
const fail = (msg) => {
  issues.push(msg);
  console.log('✗', msg);
};
const expect = (cond, msg) => (cond ? ok(msg) : fail(`[${step}] ${msg}`));
let step = 'boot';

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

page.on('console', (msg) => {
  const type = msg.type();
  const text = msg.text();
  if (type === 'error') fail(`[${step}] console.error: ${text}`);
  else if (type === 'warning') {
    if (/Warning:|Maximum update depth|getSnapshot|act\(|Future Flag|blocker/i.test(text)) fail(`[${step}] console.warn: ${text}`);
    else otherWarnings.add(text.slice(0, 200));
  }
});
page.on('pageerror', (err) => fail(`[${step}] pageerror: ${err.message}`));

const shot = (name, opts = {}) => page.screenshot({ path: path.join(OUT, `pm-plan-${name}.png`), ...opts });
const pathname = () => new URL(page.url()).pathname;
const main = () => page.locator('main');

async function settle() {
  await page.locator('main h1').first().waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(600);
}

async function checkPage(label) {
  const text = await page.locator('body').innerText();
  const hit = text.match(FORBIDDEN);
  if (hit) fail(`[${label}] forbidden word in UI copy: "${hit[0]}" …${text.slice(Math.max(0, hit.index - 40), hit.index + 40).replace(/\s+/g, ' ')}…`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) fail(`[${label}] horizontal page overflow of ${overflow}px`);
}

async function switchTo(name, home) {
  step = `switch:${name}`;
  await page.locator('header button[aria-label^="Viewing as"]').click();
  await page.getByRole('menuitemradio', { name: new RegExp(name) }).click();
  await page.waitForURL((u) => u.pathname === home, { timeout: 5000 }).catch(() => fail(`[${step}] expected ${home}, got ${pathname()}`));
  await settle();
}

async function nav(label, href) {
  await page.locator(`aside nav[aria-label="Main"] a[href="${href}"]`).click();
  await page.waitForURL((u) => u.pathname === href, { timeout: 5000 }).catch(() => fail(`[${step}] nav ${label} → ${pathname()}`));
  await settle();
}

async function setTheme(theme) {
  const current = await page.evaluate(() => document.documentElement.dataset.theme ?? 'light');
  if (current === theme) return;
  await page.locator(`header button[aria-label="Switch to ${theme} mode"]`).click();
  await page.waitForTimeout(450);
}

/** Runs `fn(store, arg)` in the page against the app's own store module. */
async function withStore(fn, arg) {
  return page.evaluate(
    async ({ src, arg }) => {
      const mod = await import('/src/store/index.ts');
      // eslint-disable-next-line no-new-func
      return new Function('store', 'arg', 'mod', `return (${src})(store, arg, mod);`)(mod.useApp, arg, mod);
    },
    { src: fn.toString(), arg },
  );
}

async function toastSeen(re, label) {
  const t = page.locator('[role="status"] li').filter({ hasText: re }).first();
  try {
    await t.waitFor({ state: 'visible', timeout: 3000 });
    ok(`${label}: toast ${re}`);
  } catch {
    fail(`[${step}] ${label}: expected toast ${re}`);
  }
}

async function dismissToasts() {
  const buttons = page.locator('[role="status"] li button[aria-label="Dismiss"]');
  for (let i = (await buttons.count()) - 1; i >= 0; i--) await buttons.nth(i).click().catch(() => {});
  await page.waitForTimeout(250);
}

// ---------------------------------------------------------------------------
step = 'boot';
await page.goto(`${BASE}/`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await settle();
const seed = await withStore((store, _a, mod) => {
  const s = store.getState();
  return { today: s.demoDate, tomorrow: mod.nextWorkingDay(s.demoDate), yesterday: mod.previousWorkingDay(s.demoDate) };
});
log('demo today', seed.today, 'tomorrow', seed.tomorrow);

await switchTo('Meera Kulkarni', '/pm');

// ===========================================================================
// 1. New project wizard — the minimal path (< 10 real inputs)
// ===========================================================================
step = 'wizard:minimal';
let inputs = 0;
const real = async (fn) => {
  inputs++;
  await fn();
};
await nav('Projects', '/projects');
await real(() => main().getByRole('link', { name: 'New project' }).first().click()); // 1
await page.waitForURL((u) => u.pathname === '/projects/new');
await settle();
await checkPage(step);
expect(await main().getByText('⏱ ~3 min').isVisible(), 'wizard shows the "⏱ ~3 min" hint');
expect((await page.evaluate(() => document.activeElement?.getAttribute('placeholder'))) === 'e.g. Orbit Labs – US Outbound', 'name field is focused');
const steps = await main().locator('nav[aria-label="Wizard steps"] li').count();
expect(steps === 5, 'step indicator has 5 steps');
const startDate = await main().locator('input[type="date"]').inputValue();
expect(startDate === seed.tomorrow, `start date defaults to the next working day (${startDate})`);
await shot('wizard-1-basics-light');

await real(() => page.keyboard.type('Orbit Labs – US Outbound')); // 2
await real(() => main().getByPlaceholder('e.g. Orbit Labs', { exact: true }).fill('Orbit Labs')); // 3
await real(() => page.keyboard.press('Enter')); // 4 → Targets
await page.waitForTimeout(450);
expect(/Step 2 of 5/i.test(await main().innerText()), 'Enter advanced to step 2');
await real(() => main().getByRole('button', { name: /Next: Tasks/ }).click()); // 5
await page.waitForTimeout(450);
await real(() => main().getByRole('button', { name: /Next: Team/ }).click()); // 6
await page.waitForTimeout(450);
await real(() => main().getByText('Rohan Mehta').click()); // 7
await real(() => main().getByRole('button', { name: /Next: Review/ }).click()); // 8
await page.waitForTimeout(450);
const reviewText = await main().innerText();
expect(reviewText.includes('Orbit Labs – US Outbound') && /Team \(1\)/i.test(reviewText) && /Tasks \(8\)/i.test(reviewText), 'review summary shows name, 8 tasks and 1 person');
await real(() => main().getByRole('button', { name: 'Create project' }).click()); // 9
await page.waitForURL((u) => u.pathname === '/projects', { timeout: 5000 }).catch(() => fail(`[${step}] create should land on /projects`));
await toastSeen(/Orbit Labs – US Outbound is live/, 'create');
await settle();
expect(await main().getByText('Orbit Labs – US Outbound').first().isVisible(), 'new project card is visible in /projects');
expect(inputs < 10, `wizard done in ${inputs} real inputs (< 10)`);
const orbit = await withStore((store) => store.getState().projects.find((p) => p.name === 'Orbit Labs – US Outbound'));
expect(
  orbit && orbit.pmId === 'p-meera' && orbit.client === 'Orbit Labs' && orbit.geography === 'US' && orbit.startDate === seed.tomorrow &&
    orbit.resourceIds.join() === 'p-rohan' && orbit.taskTypeIds.length === 8 && orbit.targets.companies === 100 && orbit.defaultQuantities['tt-msg-l1'] === 30,
  'createProject got the wizard values (PM Meera, US, start tomorrow, Rohan, 8 tasks, standard targets)',
);
await shot('projects-new-card-light');
await dismissToasts();

// ===========================================================================
// 2. Wizard — every control
// ===========================================================================
step = 'wizard:full';
await main().getByRole('link', { name: 'New project' }).first().click();
await page.waitForURL((u) => u.pathname === '/projects/new');
await settle();
await main().getByRole('button', { name: /Next: Targets/ }).click();
expect(/Step 1 of 5/i.test(await main().innerText()) && /Give it a name/.test(await main().innerText()), 'Next without a name stays on step 1 with a friendly hint');
await main().getByPlaceholder('e.g. Orbit Labs', { exact: true }).fill('Zephyr Health');
await main().getByRole('button', { name: /Use “Zephyr Health – US Outbound” as the name/ }).click();
expect((await main().getByPlaceholder('e.g. Orbit Labs – US Outbound').inputValue()) === 'Zephyr Health – US Outbound', 'name suggestion fills the name');
await main().getByRole('radio', { name: 'APAC' }).click();
await main().locator('input[type="date"]').fill(seed.today);
await shot('wizard-1-basics-filled-light');
await main().getByRole('button', { name: /Next: Targets/ }).click();
await page.waitForTimeout(450);
expect((await main().getByRole('radio', { name: 'Standard outbound' }).getAttribute('aria-checked')) === 'true', '"Standard outbound" template selected');
const companies = main().getByRole('textbox', { name: 'Companies target' });
expect((await companies.inputValue()) === '100', 'companies prefilled with 100');
await main().getByRole('radio', { name: 'Light ABM' }).click();
await page.waitForTimeout(200);
expect((await companies.inputValue()) === '40', 'Light ABM template sets companies to 40');
await main().getByRole('button', { name: 'Increase Meetings target' }).click();
expect(/Customised/.test(await main().innerText()), 'editing a number marks the template as customised');
await shot('wizard-2-targets-light');
await main().getByRole('button', { name: 'Reset to template' }).click();
await main().getByRole('radio', { name: 'Standard outbound' }).click();
await main().getByRole('button', { name: 'Increase L1 messages target' }).click();
expect((await main().getByRole('textbox', { name: 'L1 messages target' }).inputValue()) === '325', 'L1 stepper +25');
await main().getByRole('button', { name: /Next: Tasks/ }).click();
await page.waitForTimeout(450);
expect(/8 of 1[12] ticked/.test(await main().innerText()), 'standard set pre-ticks 8 tasks');
await main().getByText('Telecalling', { exact: true }).click();
expect(/9 of 1[12] ticked/.test(await main().innerText()), 'ticking Telecalling → 9 ticked');
await main().getByRole('button', { name: 'Increase Default quantity for Telecalling' }).click();
expect((await main().getByRole('textbox', { name: 'Default quantity for Telecalling' }).inputValue()) === '25', 'Telecalling quantity 20 → 25');
const telRow = main().locator('li').filter({ hasText: 'Telecalling' }).first();
expect(/2h 30m/.test(await telRow.innerText()) && /No review/.test(await telRow.innerText()), 'row shows computed standard (25 × 6 = 2h 30m) and the default reviewer');
const l1Row = main().locator('li').filter({ hasText: 'First-level message' }).first();
expect(/Reviewed by PM/.test(await l1Row.innerText()), 'L1 shows "Reviewed by PM"');
await shot('wizard-3-tasks-light', { fullPage: true });
await main().getByRole('button', { name: 'Tick all' }).click();
await main().getByRole('button', { name: 'Standard set' }).click();
expect(/8 of 1[12] ticked/.test(await main().innerText()), '"Standard set" restores the 8');
await main().getByRole('button', { name: /Next: Team/ }).click();
await page.waitForTimeout(450);
const firstNames = await main().locator('ul[aria-label="Resources"] li').evaluateAll((els) => els.map((e) => e.getAttribute('data-person')));
expect(JSON.stringify(firstNames) === JSON.stringify([...firstNames].sort((a, b) => a.localeCompare(b))), `resources alphabetical (${firstNames.join(', ')})`);
expect(/On 2 projects/.test(await main().locator('ul[aria-label="Resources"] li').filter({ hasText: 'Asha Rao' }).innerText()), 'Asha shows "On 2 projects"');
await main().getByText('Vikram Shetty').click();
await main().getByText('Priya Nair').click();
await page.waitForTimeout(300);
await shot('wizard-4-team-light');
await main().getByRole('button', { name: 'Back' }).click();
await page.waitForTimeout(400);
expect(/Step 3 of 5/i.test(await main().innerText()), 'Back returns to step 3');
await main().getByRole('button', { name: /Step 4 of 5/ }).click();
await page.waitForTimeout(400);
expect(/Step 4 of 5/i.test(await main().innerText()), 'step indicator jumps forward to the reached Team step');
await main().getByRole('button', { name: /Next: Review/ }).click();
await page.waitForTimeout(400);
expect(/Team \(2\)/i.test(await main().innerText()), 'review shows 2 people');
await main().getByRole('button', { name: 'Edit basics' }).click();
await page.waitForTimeout(400);
expect(/Step 1 of 5/i.test(await main().innerText()), 'Edit on review jumps to Basics');
await main().getByRole('button', { name: /Step 5 of 5/ }).click();
await page.waitForTimeout(400);
await checkPage(step);
await shot('wizard-5-review-light', { fullPage: true });
await main().getByRole('button', { name: 'Create project' }).click();
await page.waitForURL((u) => u.pathname === '/projects', { timeout: 5000 }).catch(() => fail(`[${step}] second create should land on /projects`));
await toastSeen(/Zephyr Health – US Outbound is live/, 'create 2');
const zephyr = await withStore((store) => store.getState().projects.find((p) => p.client === 'Zephyr Health'));
expect(
  zephyr && zephyr.geography === 'APAC' && zephyr.targets.weeklyMessagesL1 === 325 && zephyr.resourceIds.length === 2 && zephyr.defaultQuantities['tt-telecalling'] === undefined,
  'second project saved APAC, L1 325, 2 people, standard task set',
);
await dismissToasts();

// ===========================================================================
// 3. Plan the day — tomorrow for Rohan
// ===========================================================================
step = 'plan';
await nav('Plan the day', '/plan');
await checkPage(step);
expect((await main().getByRole('radio', { name: 'Tomorrow' }).getAttribute('aria-checked')) === 'true', 'defaults to Tomorrow');
const avatarFirst = await main().locator('ul[aria-label="Team"] button').evaluateAll((els) => els.map((e) => e.getAttribute('data-person')));
expect(JSON.stringify(avatarFirst) === JSON.stringify([...avatarFirst].sort()), `team avatar row alphabetical (${avatarFirst.join(', ')})`);
await main().locator('ul[aria-label="Team"] button').filter({ hasText: 'Rohan' }).click();
await page.waitForTimeout(300);
await main().getByRole('radio', { name: 'Tomorrow' }).click();
expect(new URL(page.url()).searchParams.get('person') === 'p-rohan' && new URL(page.url()).searchParams.get('date') === seed.tomorrow, 'URL holds ?person=p-rohan&date=<tomorrow>');
const groupsShown = await main().locator('aside[aria-label="Task library"] section').count();
log('library sections for Rohan:', groupsShown);
expect(
  (await main().locator('aside[aria-label="Task library"]').innerText()).includes('First-level message'),
  "library lists the task types of Rohan's projects",
);
const rows = () => main().locator('[data-testid="plan-row"]');
expect((await rows().count()) === 0, 'nothing planned for Rohan tomorrow yet');
await shot('plan-empty-light');

const rohanToday = await withStore((store, a) => store.getState().tasks.filter((t) => t.assigneeId === 'p-rohan' && t.date === a).length, seed.today);
await main().getByRole('button', { name: "Copy yesterday's plan" }).first().click();
await toastSeen(new RegExp(`Copied ${rohanToday} tasks from today`), 'copy');
expect((await rows().count()) === rohanToday, `copied all ${rohanToday} of Rohan's tasks from today as rows`);
expect(/Unsaved changes/.test(await main().innerText()), 'shows unsaved changes');

// Two quantity edits.
const row0 = rows().nth(0);
const row1 = rows().nth(1);
const name0 = (await row0.locator('p').first().innerText()).replace(/\s*new$/i, '').trim();
const name1 = (await row1.locator('p').first().innerText()).replace(/\s*new$/i, '').trim();
const qty0Before = Number(await row0.getByRole('textbox', { name: /^Quantity for/ }).inputValue());
await row0.getByRole('button', { name: /^Increase Quantity for/ }).click();
const qty0After = Number(await row0.getByRole('textbox', { name: /^Quantity for/ }).inputValue());
expect(qty0After > qty0Before, `${name0}: quantity ${qty0Before} → ${qty0After}`);
const qty1 = row1.getByRole('textbox', { name: /^Quantity for/ });
await qty1.click();
await qty1.fill('12');
await qty1.press('Enter');
expect((await qty1.inputValue()) === '12', `${name1}: quantity typed to 12`);
const std1 = Number(await row1.getByRole('textbox', { name: /^Standard minutes for/ }).inputValue());
const per1 = await withStore((store, n) => store.getState().taskTypes.find((t) => t.name === n)?.standardMinutesPerUnit, name1);
expect(std1 === 12 * per1, `standard auto-updates with quantity (12 × ${per1} = ${std1})`);

// Override + reset to auto.
await row1.getByRole('button', { name: /^Increase Standard minutes for/ }).click();
expect(await row1.getByRole('button', { name: /^Reset standard for/ }).isVisible(), 'overriding the standard shows "reset to auto"');
await shot('plan-override-light');
await row1.getByRole('button', { name: /^Reset standard for/ }).click();
expect(Number(await row1.getByRole('textbox', { name: /^Standard minutes for/ }).inputValue()) === 12 * per1, 'reset to auto restores qty × per-unit');
// Keep one override for the save check.
await row0.getByRole('button', { name: /^Increase Standard minutes for/ }).click();
const std0 = Number(await row0.getByRole('textbox', { name: /^Standard minutes for/ }).inputValue());

// Priority, time block, reviewer.
await row0.getByRole('radio', { name: 'Priority 1' }).click();
await row0.getByRole('radio', { name: 'Afternoon' }).click();
await row1.getByRole('combobox', { name: /^Reviewer for/ }).selectOption({ label: 'No review' });
expect((await row0.getByRole('radio', { name: 'Priority 1' }).getAttribute('aria-checked')) === 'true', 'P1 pill selected');

// Add from the library, then remove a row.
const before = await rows().count();
await main().locator('aside[aria-label="Task library"]').getByRole('button', { name: /^Add Content piece/ }).first().click();
await main().locator('aside[aria-label="Task library"]').getByRole('button', { name: /^Add Proposal draft/ }).first().click();
await main().locator('aside[aria-label="Task library"]').getByRole('button', { name: /^Add Telecalling/ }).first().click();
await page.waitForTimeout(400);
expect((await rows().count()) === before + 3, 'clicking library tasks adds rows');
const hoursText = await main().locator('[role="meter"][aria-label="Planned hours"]').getAttribute('aria-valuetext');
log('planned:', hoursText);
expect(/more than a full day/.test(await main().innerText()), 'soft "more than a full day" warning when over 8h');
await page.waitForTimeout(500);
await shot('plan-over-light');
for (let i = 0; i < 3; i++) {
  await rows().last().getByRole('button', { name: /^Remove / }).click();
  await page.waitForTimeout(250);
}
await page.waitForTimeout(300);
expect((await rows().count()) === before, 'remove drops rows again');

// Unsaved-changes guard when switching person.
await main().locator('ul[aria-label="Team"] button').filter({ hasText: 'Asha' }).click();
const guard = page.getByRole('dialog', { name: /Save Rohan's plan first\?/ });
await guard.waitFor({ state: 'visible', timeout: 3000 }).catch(() => fail(`[${step}] unsaved-changes dialog did not open`));
await page.waitForTimeout(300);
await shot('plan-unsaved-guard-light');
await guard.getByRole('button', { name: 'Keep editing' }).click();
await guard.waitFor({ state: 'hidden', timeout: 3000 });
expect(new URL(page.url()).searchParams.get('person') === 'p-rohan' && (await rows().count()) === before, '"Keep editing" stays on Rohan with the draft');

// Save.
await main().getByRole('button', { name: 'Save plan' }).click();
await toastSeen(/Plan saved — Rohan will see it on My Day/, 'save');
expect(!/Unsaved changes/.test(await main().innerText()), 'unsaved marker cleared after save');
const saved = await withStore((store, a) => {
  const s = store.getState();
  return s.tasks
    .filter((t) => t.assigneeId === 'p-rohan' && t.date === a)
    .map((t) => ({ title: t.title, qty: t.quantity, std: t.standardMinutes, priority: t.priority, block: t.timeBlock, reviewerId: t.reviewerId ?? '' }));
}, seed.tomorrow);
expect(saved.length === before, `store has ${saved.length} tasks for Rohan tomorrow`);
expect(saved.some((t) => t.qty === qty0After && t.std === std0 && t.priority === 'P1' && t.block === 'afternoon'), 'edited row 1 saved (qty, overridden std, P1, afternoon)');
expect(saved.some((t) => t.qty === 12 && t.reviewerId === ''), 'edited row 2 saved (qty 12, no review)');
const planNote = await withStore((store) => store.getState().notifications.find((n) => n.toPersonId === 'p-rohan' && n.type === 'planReady')?.text);
expect(planNote === 'Your plan for tomorrow is ready', `Rohan notified: "${planNote}"`);
await page.waitForTimeout(300);
await shot('plan-saved-light', { fullPage: true });
await dismissToasts();

// Reload: existing up-next tasks come back as editable rows.
await page.goto(`${BASE}/plan?person=p-rohan&date=${seed.tomorrow}`);
await settle();
expect((await rows().count()) === before && !/Unsaved changes/.test(await main().innerText()), 'reload shows the saved plan as editable rows');

// Today: done / in-progress tasks are read-only.
await main().getByRole('radio', { name: 'Today' }).click();
await page.waitForTimeout(400);
expect(await main().getByRole('heading', { name: 'Already on the day' }).isVisible(), 'today shows done / in-progress tasks read-only');
await shot('plan-today-light', { fullPage: true });

// Discard path of the guard: edit, switch person, discard.
const firstRowToday = rows().first();
if ((await rows().count()) > 0) {
  await firstRowToday.getByRole('button', { name: /^Increase Quantity for/ }).click();
  await main().locator('ul[aria-label="Team"] button').filter({ hasText: 'Asha' }).click();
  await guard.waitFor({ state: 'visible', timeout: 3000 }).catch(() => fail(`[${step}] guard did not open for discard`));
  await guard.getByRole('button', { name: 'Discard' }).click();
  await page.waitForTimeout(400);
  expect(new URL(page.url()).searchParams.get('person') === 'p-asha', '"Discard" moves on to Asha');
} else {
  log('no editable rows today for Rohan; skipping discard path');
}
// Asha is on two of Meera's projects: library grouped by project.
step = 'plan:guard-nav';
await main().getByRole('radio', { name: 'Tomorrow' }).click();
await page.waitForTimeout(300);
await main().locator('aside[aria-label="Task library"]').getByRole('button', { name: /^Add Company research/ }).first().click();
await page.locator('aside nav[aria-label="Main"] a[href="/light-days"]').click();
const guardAsha = page.getByRole('dialog', { name: /Save Asha's plan first\?/ });
await guardAsha.waitFor({ state: 'visible', timeout: 3000 }).catch(() => fail(`[${step}] guard did not open when leaving the page`));
await guardAsha.getByRole('button', { name: 'Save & continue' }).click();
await page.waitForURL((u) => u.pathname === '/light-days', { timeout: 5000 }).catch(() => fail(`[${step}] "Save & continue" did not navigate`));
await toastSeen(/Plan saved — Asha will see it on My Day/, 'save & continue');
const ashaTomorrow = await withStore((store, a) => store.getState().tasks.filter((t) => t.assigneeId === 'p-asha' && t.date === a).map((t) => t.taskTypeId), seed.tomorrow);
expect(ashaTomorrow.includes('tt-company-research'), '"Save & continue" saved Asha\'s new row before leaving');
await settle();
await dismissToasts();
// Switching viewer with unsaved changes never gets stuck behind the guard.
await page.goto(`${BASE}/plan?person=p-asha&date=${seed.tomorrow}`);
await settle();
await main().locator('aside[aria-label="Task library"]').getByRole('button', { name: /^Add Telecalling/ }).first().click();
await switchTo('Arjun Pillai', '/pm');
expect(pathname() === '/pm' && (await page.getByRole('dialog').count()) === 0, 'switching to Arjun with a draft lands on his home without a dialog');
await switchTo('Meera Kulkarni', '/pm');
await page.goto(`${BASE}/plan?person=p-asha&date=${seed.tomorrow}`);
await settle();
step = 'plan';
expect((await main().locator('aside[aria-label="Task library"] section').count()) === 2, "Asha's library is grouped by her two projects");
await checkPage('plan:asha');

// ===========================================================================
// 4. Rohan sees tomorrow's plan
// ===========================================================================
await switchTo('Rohan Mehta', '/my-day');
step = 'rohan:my-day';
const peek = main().locator('[data-testid="tomorrow-peek"]');
if ((await peek.count()) > 0) {
  expect(new RegExp(`Tomorrow's plan is ready · ${before} tasks`).test(await peek.innerText()), `Rohan's My Day shows "Tomorrow's plan is ready · ${before} tasks"`);
  await peek.scrollIntoViewIfNeeded();
  await shot('rohan-tomorrow-peek-light');
} else {
  fail(`[${step}] Rohan's My Day has no tomorrow peek`);
}
await checkPage(step);

// ===========================================================================
// 5. Task library
// ===========================================================================
await switchTo('Meera Kulkarni', '/pm');
step = 'library';
await nav('Task library', '/library');
await checkPage(step);
expect(await main().getByText('Changes apply to new tasks only.').isVisible(), 'library note is shown');
// Inline number edit + save.
await main().getByRole('button', { name: 'Increase Standard minutes per prospect for Prospect searching' }).click();
const prospectRow = main().locator('[data-testid="tt-row-tt-prospect"]');
await prospectRow.getByRole('button', { name: 'Save Prospect searching' }).click();
await toastSeen(/Saved “Prospect searching”/, 'inline save');
expect((await withStore((s) => s.getState().taskTypes.find((t) => t.id === 'tt-prospect').standardMinutesPerUnit)) === 4, 'prospect standard 3 → 4 min');
// Edit row: name + reviewer + category.
await main().getByRole('button', { name: 'Edit Telecalling' }).click();
const telEdit = main().locator('[data-testid="tt-row-tt-telecalling"]');
await telEdit.getByRole('textbox', { name: 'Task name' }).fill('Telecalling (warm)');
await telEdit.getByRole('combobox', { name: /Default reviewer/ }).selectOption('PM');
await telEdit.getByRole('combobox', { name: /Category/ }).selectOption('Outreach');
await shot('library-edit-light');
await telEdit.getByRole('button', { name: /^Save / }).click();
await toastSeen(/Saved “Telecalling \(warm\)”/, 'edit save');
const tel = await withStore((s) => s.getState().taskTypes.find((t) => t.id === 'tt-telecalling'));
expect(tel.name === 'Telecalling (warm)' && tel.defaultReviewerRole === 'PM' && tel.category === 'Outreach', 'edit saved name, reviewer and category');
// Cancel restores.
await main().getByRole('button', { name: 'Edit CRM clean-up' }).click();
await main().locator('[data-testid="tt-row-tt-crm"]').getByRole('textbox', { name: 'Task name' }).fill('Something else');
await main().locator('[data-testid="tt-row-tt-crm"]').getByRole('button', { name: 'Cancel' }).click();
expect((await main().locator('[data-testid="tt-row-tt-crm"]').innerText()).includes('CRM clean-up'), 'Cancel keeps the original');
// Add.
await main().getByRole('button', { name: 'Add task type' }).first().click();
const addDialog = page.getByRole('dialog', { name: 'Add a task type' });
await addDialog.waitFor({ state: 'visible', timeout: 3000 });
await addDialog.getByLabel('Name', { exact: true }).fill('LinkedIn post');
await addDialog.getByLabel('Unit', { exact: true }).fill('posts');
await addDialog.getByRole('button', { name: 'Increase Standard minutes per unit' }).click();
await addDialog.getByRole('radio', { name: 'PM' }).click();
await addDialog.getByRole('radio', { name: 'Content' }).click();
await page.waitForTimeout(250);
await shot('library-add-light');
await addDialog.getByRole('button', { name: 'Add task type' }).click();
await toastSeen(/Added “LinkedIn post” to the library/, 'add');
const li = await withStore((s) => s.getState().taskTypes.find((t) => t.name === 'LinkedIn post'));
expect(li && li.unit === 'posts' && li.unitSingular === 'post' && li.standardMinutesPerUnit === 11 && li.defaultReviewerRole === 'PM' && li.category === 'Content', 'new task type saved (posts, 11 min, PM, Content)');
expect(await main().getByText('LinkedIn post').isVisible(), 'new type appears in the table');
// Archive + restore.
await main().getByRole('button', { name: 'Archive Internal training' }).click();
await toastSeen(/Archived “Internal training”/, 'archive');
expect((await main().locator('[data-testid="tt-row-tt-training"]').count()) === 0, 'archived type leaves the table');
await main().getByRole('button', { name: /Archived \(1\)/ }).click();
await page.waitForTimeout(300);
expect(await main().getByRole('button', { name: 'Restore Internal training' }).isVisible(), 'archived section lists it with Restore');
await dismissToasts();
await shot('library-archived-light', { fullPage: true });
await main().getByRole('button', { name: 'Archive Model building' }).click();
await main().getByRole('button', { name: 'Restore Internal training' }).click();
await toastSeen(/Restored “Internal training”/, 'restore');
expect((await withStore((s) => s.getState().taskTypes.find((t) => t.id === 'tt-training').archived)) === false, 'restore un-archives');
await checkPage(step);
await dismissToasts();

// Archived types disappear from planning; new types are offered under "More from the library".
step = 'plan:after-library';
await page.goto(`${BASE}/plan?person=p-rohan&date=${seed.tomorrow}`);
await settle();
const lib = main().locator('aside[aria-label="Task library"]');
expect(!(await lib.innerText()).includes('Model building'), 'archived "Model building" is not offered in Plan the day');
await lib.getByText(/More from the library/).first().click();
await lib.getByRole('button', { name: /^Add LinkedIn post/ }).first().click();
expect((await rows().count()) === before + 1, 'a newly added library type can be planned');
await rows().last().getByRole('button', { name: /^Remove / }).click();
await page.waitForTimeout(300);
expect(!/Unsaved changes/.test(await main().innerText()), 'removing it again leaves the plan unchanged');

// ===========================================================================
// 6. Light days
// ===========================================================================
step = 'light-days';
await nav('Light days', '/light-days');
await checkPage(step);
expect(await main().getByText("Light days show on everyone's My Day progress line.", { exact: false }).isVisible(), 'light-days note shown');
const seedLight = await withStore((s) => s.getState().lightDays[0]);
const upcoming = main().locator('aside[aria-labelledby="upcoming-light-days"]');
expect((await upcoming.innerText()).includes('Team offsite'), 'seeded light day listed under Upcoming');
await shot('light-days-light');
// Month navigation.
const monthHeading = async () => main().locator('h2').first().innerText();
const m0 = await monthHeading();
await main().getByRole('button', { name: 'Next month' }).click();
const m1 = await monthHeading();
await main().getByRole('button', { name: 'Previous month' }).click();
expect(m0 !== m1 && (await monthHeading()) === m0, `month navigation (${m0} → ${m1} → back)`);
// Keyboard: arrow moves focus.
await main().locator(`[data-date="${seed.today}"]`).focus();
await page.keyboard.press('ArrowRight');
const focusedDate = await page.evaluate(() => document.activeElement?.getAttribute('data-date'));
expect(focusedDate === (await withStore((_s, a, mod) => mod.addDaysISO(a, 1), seed.today)), `ArrowRight moves focus to the next day (${focusedDate})`);
// Weekend cells are not actionable.
const weekend = main().locator('[data-date][aria-disabled="true"]').first();
expect((await weekend.count()) === 1, 'weekend / past cells are aria-disabled');

// Add a light day for today: projects toggles, quick reason, 50%.
await main().locator(`[data-date="${seed.today}"]`).click();
const ldDialog = page.getByRole('dialog', { name: 'Add a light day' });
await ldDialog.waitFor({ state: 'visible', timeout: 3000 });
await ldDialog.getByRole('button', { name: 'Northwind' }).click();
expect((await ldDialog.getByRole('button', { name: 'All projects' }).getAttribute('aria-pressed')) === 'false', 'picking a project turns "All projects" off');
await ldDialog.getByRole('button', { name: 'Atlas Health' }).click();
await ldDialog.getByRole('button', { name: 'All projects' }).click();
await ldDialog.getByRole('button', { name: 'Training day' }).click();
expect((await ldDialog.getByRole('textbox', { name: 'Reason' }).inputValue()) === 'Training day', 'quick chip fills the reason');
await ldDialog.getByRole('radio', { name: '75%' }).click();
await ldDialog.getByRole('radio', { name: '50%' }).click();
await page.waitForTimeout(250);
await shot('light-days-add-light');
await ldDialog.getByRole('button', { name: 'Save light day' }).click();
await toastSeen(/Light day added/, 'add light day');
const todayLd = await withStore((s, a) => s.getState().lightDays.find((l) => l.date === a), seed.today);
expect(todayLd && todayLd.projectIds === 'all' && todayLd.reason === 'Training day' && todayLd.adjustedTargetPercent === 50, 'light day saved for today (all projects, Training day, 50%)');
expect(/light day: Training day/.test((await main().locator(`[data-date="${seed.today}"]`).getAttribute('aria-label')) ?? ''), "today's cell shows the light day");
expect((await upcoming.innerText()).includes('Training day'), 'new light day appears under Upcoming');

// A project-scoped one, then remove it from the details dialog.
const future = await withStore((_s, a, mod) => mod.nextWorkingDay(mod.nextWorkingDay(a)), seed.tomorrow);
const futureMonthDiffers = future.slice(0, 7) !== seed.today.slice(0, 7);
if (futureMonthDiffers) await main().getByRole('button', { name: 'Next month' }).click();
await main().locator(`[data-date="${future}"]`).click();
await ldDialog.waitFor({ state: 'visible', timeout: 3000 });
await ldDialog.getByRole('button', { name: 'Helios' }).click();
await ldDialog.getByRole('textbox', { name: 'Reason' }).fill('Diwali');
await ldDialog.getByRole('radio', { name: '75%' }).click();
await ldDialog.getByRole('button', { name: 'Save light day' }).click();
await page.waitForTimeout(400);
const diwali = await withStore((s) => s.getState().lightDays.find((l) => l.reason === 'Diwali'));
expect(diwali && Array.isArray(diwali.projectIds) && diwali.projectIds.join() === 'pr-helios' && diwali.adjustedTargetPercent === 75, 'project-scoped light day saved (Helios, 75%)');
await main().locator(`[data-date="${future}"]`).click();
const details = page.getByRole('dialog', { name: /Light day ·/ });
await details.waitFor({ state: 'visible', timeout: 3000 });
await page.waitForTimeout(250);
await shot('light-days-details-light');
await details.getByRole('button', { name: 'Remove light day: Diwali' }).click();
await toastSeen(/Light day removed/, 'remove light day');
expect((await withStore((s) => s.getState().lightDays.some((l) => l.reason === 'Diwali'))) === false, 'removeLightDay removed it');
if (futureMonthDiffers) await main().getByRole('button', { name: 'This month' }).click();
// Seeded one: details → Add another → cancel.
await upcoming.getByRole('button', { name: new RegExp(seedLight.reason.split(' ')[0]) }).first().click();
await details.waitFor({ state: 'visible', timeout: 3000 });
await details.getByRole('button', { name: 'Add another' }).click();
await page.getByRole('dialog', { name: 'Add a light day' }).waitFor({ state: 'visible', timeout: 3000 });
await page.getByRole('dialog', { name: 'Add a light day' }).getByRole('button', { name: 'Cancel' }).click();
await page.waitForTimeout(300);
await checkPage(step);
await dismissToasts();
await shot('light-days-after-light');
await dismissToasts();

// ===========================================================================
// 7. Asha's progress line shows the reduced target
// ===========================================================================
await switchTo('Asha Rao', '/my-day');
step = 'asha:light-day';
const line = main().locator('[role="progressbar"][aria-label="Day progress"]').first();
const valuetext = (await line.getAttribute('aria-valuetext')) ?? '';
expect(/Light day target · Training day/.test(valuetext), `Asha's progress line shows the light-day target ("${valuetext}")`);
await line.scrollIntoViewIfNeeded();
await shot('asha-light-day-line-light');

// ===========================================================================
// 8. Dark mode screenshots + tablet layout
// ===========================================================================
await switchTo('Meera Kulkarni', '/pm');
step = 'dark';
await setTheme('dark');
await page.goto(`${BASE}/projects/new`);
await settle();
await main().getByPlaceholder('e.g. Orbit Labs', { exact: true }).fill('Nimbus Retail');
await main().getByPlaceholder('e.g. Orbit Labs – US Outbound').fill('Nimbus Retail – UK Outbound');
await main().getByRole('radio', { name: 'UK' }).click();
await checkPage('dark:wizard-1');
await shot('wizard-1-basics-dark');
await main().getByRole('button', { name: /Next: Targets/ }).click();
await page.waitForTimeout(450);
await shot('wizard-2-targets-dark');
await main().getByRole('button', { name: /Next: Tasks/ }).click();
await page.waitForTimeout(450);
await checkPage('dark:wizard-3');
await shot('wizard-3-tasks-dark', { fullPage: true });
await main().getByRole('button', { name: /Next: Team/ }).click();
await page.waitForTimeout(450);
await main().getByText('Karan Desai').click();
await page.waitForTimeout(300);
await shot('wizard-4-team-dark');
await main().getByRole('button', { name: /Next: Review/ }).click();
await page.waitForTimeout(450);
await checkPage('dark:wizard-5');
await shot('wizard-5-review-dark', { fullPage: true });
// Leave without creating.
await main().getByRole('button', { name: 'Cancel' }).click();
await page.waitForURL((u) => u.pathname === '/projects');
await settle();
expect(!(await main().innerText()).includes('Nimbus Retail'), 'Cancel leaves the wizard without creating');

await page.goto(`${BASE}/plan?person=p-rohan&date=${seed.tomorrow}`);
await settle();
await rows().first().getByRole('button', { name: /^Increase Standard minutes for/ }).click();
await main().locator('aside[aria-label="Task library"]').getByRole('button', { name: /^Add Proposal draft/ }).first().click();
await main().locator('aside[aria-label="Task library"]').getByRole('button', { name: /^Add Content piece/ }).first().click();
await page.waitForTimeout(500);
await checkPage('dark:plan');
await shot('plan-dark');
await main().getByRole('button', { name: 'Discard changes' }).click();
await main().getByRole('radio', { name: 'Today' }).click();
await page.waitForTimeout(400);
await shot('plan-today-dark', { fullPage: true });

await page.goto(`${BASE}/library`);
await settle();
await main().getByRole('button', { name: 'Edit Proposal draft' }).click();
await checkPage('dark:library');
await shot('library-dark', { fullPage: true });
await main().getByRole('button', { name: 'Cancel' }).click();
await main().getByRole('button', { name: 'Add task type' }).first().click();
await page.getByRole('dialog', { name: 'Add a task type' }).waitFor({ state: 'visible', timeout: 3000 });
await page.waitForTimeout(300);
await shot('library-add-dark');
await page.keyboard.press('Escape');

await page.goto(`${BASE}/light-days`);
await settle();
await checkPage('dark:light-days');
await shot('light-days-dark');
await main().locator(`[data-date="${seed.tomorrow}"]`).click();
await page.getByRole('dialog', { name: 'Add a light day' }).waitFor({ state: 'visible', timeout: 3000 });
await page.getByRole('dialog', { name: 'Add a light day' }).getByRole('button', { name: 'Festival' }).click();
await page.waitForTimeout(300);
await shot('light-days-add-dark');
await page.keyboard.press('Escape');

// Tablet.
step = 'tablet';
await page.setViewportSize({ width: 768, height: 1024 });
for (const p of ['/projects/new', `/plan?person=p-asha&date=${seed.today}`, '/library', '/light-days']) {
  await page.goto(`${BASE}${p}`);
  await settle();
  await checkPage(`tablet:${p}`);
}
await shot('light-days-tablet-dark', { fullPage: true });
await page.goto(`${BASE}/plan?person=p-rohan&date=${seed.tomorrow}`);
await settle();
await checkPage('tablet:plan-rohan');
await shot('plan-tablet-dark', { fullPage: true });
await setTheme('light');
await page.goto(`${BASE}/library`);
await settle();
await shot('library-tablet-light', { fullPage: true });
await page.goto(`${BASE}/projects/new`);
await settle();
await main().getByPlaceholder('e.g. Orbit Labs', { exact: true }).fill('Tablet Co');
await main().getByPlaceholder('e.g. Orbit Labs – US Outbound').fill('Tablet Co – EU');
await main().getByRole('button', { name: /Next: Targets/ }).click();
await main().getByRole('button', { name: /Next: Tasks/ }).click();
await page.waitForTimeout(450);
await checkPage('tablet:wizard-tasks');
await shot('wizard-3-tasks-tablet-light', { fullPage: true });

await browser.close();

if (otherWarnings.size) console.log(`\nOther console warnings:\n${[...otherWarnings].map((w) => `  - ${w}`).join('\n')}`);
console.log(issues.length ? `\nPM PLAN CHECK FAILED — ${issues.length} issue(s)` : '\nPM PLAN CHECK PASSED');
process.exit(issues.length ? 1 : 0);
