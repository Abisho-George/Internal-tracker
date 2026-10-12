/**
 * Round 13 · R3 project page check (Projects, LeadProjects, ProjectSetup, TargetsTable).
 *
 *   npx vite build --base ./ && npx vite preview --port 5712 --strictPort &
 *   node scripts/check-r13-projects.mjs        # BASE_URL=http://localhost:5712/ by default
 *
 * Starts from clean demo data and checks: bar-chart progress (weekly/monthly, week dropdown with past and
 * future planned weeks, number filter, tiles toggle), week planning (pre-plan a future week, save and lock),
 * locked "This week's numbers" with finalised days and Edit/Save, the Edit project details modal (visible
 * standard inputs, custom standard tasks add/delete, typed decimal hours, add-person picker, week preview,
 * admins, handover with confirm), role permissions (owner, admin, member, manager), light + dark + a fun theme.
 * Fails on page errors, console errors, em/en dashes or session wording in the visible text.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5712/';
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

const shot = async (name, full = true) => page.screenshot({ path: path.join(OUT, `r13-projects-${name}.png`), fullPage: full });
const go = async (hash) => { await page.goto(`${BASE}#${hash}`); await page.waitForTimeout(250); };
const as = async (id, hash = '/projects') => {
  await page.selectOption('select[aria-label="Viewing as"]', id);
  await page.waitForTimeout(150);
  await go(hash);
};
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('ls-tracker-v2') ?? '{}').state);
const card = (id) => page.locator(`[data-project="${id}"]`);
const textOf = async (loc) => (await loc.innerText()).replace(/\s+/g, ' ');
const checkWording = async (where) => {
  const t = await page.locator('body').innerText();
  expect(!/[–—]/.test(t), `${where}: no em or en dashes in visible text`);
  expect(!/\b(log ?in|log ?out|sign ?in|sign ?out)\b/i.test(t), `${where}: no session wording`);
};
/** WCAG contrast ratio between an element's text colour and its own (or nearest) background. */
const contrastOf = (sel) => page.locator(sel).first().evaluate((el) => {
  const parse = (c) => (c.match(/[\d.]+/g) ?? []).map(Number);
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  let bgEl = el; let bg = getComputedStyle(el).backgroundColor;
  while (bgEl && (parse(bg)[3] === 0 || bg === 'transparent')) { bgEl = bgEl.parentElement; bg = bgEl ? getComputedStyle(bgEl).backgroundColor : 'rgb(255,255,255)'; }
  const a = lum(parse(getComputedStyle(el).color)); const b = lum(parse(bg));
  return { ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), color: getComputedStyle(el).color, bg, size: getComputedStyle(el).fontSize };
});
const setTheme = async (name) => {
  await page.click('button[aria-label="Theme"]');
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).first().click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
};

// ------------------------------------------------------------------------------------------------
section('boot');
await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector('select[aria-label="Viewing as"]');
ok('app loaded with clean data');

// ------------------------------------------------------------------------------------------------
section('owner: hero, progress bar chart');
await as('bheeshma');
const nw = card('northwind');
await nw.waitFor();
const hero = await textOf(nw.getByTestId('project-hero'));
expect(/Owner\s*Bheeshma/.test(await textOf(nw.getByTestId('hero-owner'))), 'hero shows the owner (Bheeshma)');
expect(/Admin\b.*Prajwal/.test(await textOf(nw.getByTestId('hero-admins'))), 'hero shows the admins (Prajwal)');
expect(await nw.getByRole('button', { name: 'Edit project details' }).isVisible(), 'owner sees Edit project details');
const prog = nw.getByTestId('project-progress');
const rows = prog.locator('ul[aria-label="Progress against targets"] > li');
expect((await rows.count()) >= 6, `bar-chart list has a row per number (${await rows.count()})`);
const first = await textOf(rows.first());
expect(/\d+ \/ \d+/.test(first) && /\d+%/.test(first), `row shows value / target and a % badge: "${first}"`);
expect((await rows.first().locator('[role="progressbar"]').count()) === 1, 'row has a coloured bar');
const weekOpts = await prog.locator('select[aria-label="Week"] option').allInnerTexts();
expect(weekOpts.some((o) => /^Week \d+ · \d+ \w+ to \d+ \w+ \(this week\)/.test(o)), 'week dropdown has "Week N · d Mon to d Mon (this week)"');
expect(weekOpts.some((o) => /\(next week\)/.test(o)), 'week dropdown has next week');
expect(weekOpts.some((o) => /\(last week\)/.test(o)), 'week dropdown has past weeks');
expect(weekOpts.filter((o) => /plan saved/.test(o)).length >= 2, 'week dropdown marks pre-planned weeks');
expect(await prog.getByText("Using this week's saved plan").count() === 0, 'this week (no saved plan) does not claim a plan');
await shot('owner-progress-light');

// Next week uses the saved plan (Messages sent 320).
const nextWeek = await prog.locator('select[aria-label="Week"] option', { hasText: '(next week)' }).getAttribute('value');
await prog.locator('select[aria-label="Week"]').selectOption(nextWeek);
const msgRow = prog.locator('li[data-metric="Messages sent"]');
expect(/target 320/.test(await textOf(msgRow)) && /Planned/.test(await textOf(msgRow)), 'next week shows the planned target (320) as Planned');
expect(await prog.getByText("Using this week's saved plan").isVisible(), 'chip says the week plan is used');
// A past week shows history against target.
const lastWeek = await prog.locator('select[aria-label="Week"] option', { hasText: '(last week)' }).getAttribute('value');
await prog.locator('select[aria-label="Week"]').selectOption(lastWeek);
expect(/\d+ \/ 300/.test(await textOf(msgRow)), 'last week falls back to the default weekly target (300)');
// Number filter, monthly, tiles.
await prog.locator('select[aria-label="Filter numbers"]').selectOption({ label: 'Meetings scheduled' });
expect((await rows.count()) === 1, 'number filter shows one row');
await prog.locator('select[aria-label="Filter numbers"]').selectOption('all');
await prog.getByRole('button', { name: 'Monthly' }).click();
expect(await prog.locator('select[aria-label="Month"]').isVisible(), 'monthly toggle shows the month dropdown');
expect(/\(this month\)/.test(await prog.locator('select[aria-label="Month"]').inputValue().then(() => prog.locator('select[aria-label="Month"] option:checked').innerText())), 'current month selected');
expect(/\d+ \/ 1200/.test(await textOf(msgRow)), 'monthly bar uses the monthly target (1200)');
await prog.getByRole('button', { name: 'Tiles view' }).click();
expect((await rows.count()) === 0 && (await prog.locator('.grid > div.rounded-2xl').count()) >= 6, 'tiles toggle swaps to tiles');
await prog.getByRole('button', { name: 'Bar chart view' }).click();
await prog.getByRole('button', { name: 'Weekly' }).click();
expect(await nw.getByText(/Week \d+ of \d+/).first().isVisible(), 'timeline shows the project week');

// ------------------------------------------------------------------------------------------------
section('owner: targets tab, pre-plan a future week');
await nw.getByRole('tab', { name: /Targets/ }).click();
const planner = nw.getByTestId('week-planner');
const planOpts = await planner.locator('select[aria-label="Plan week"] option').allInnerTexts();
expect(planOpts[0].startsWith('Week 1 · '), `plan dropdown starts at Week 1 (${planOpts[0]})`);
const curIdx = planOpts.findIndex((o) => o.includes('(this week)'));
expect(planOpts.length - 1 - curIdx >= 4, 'plan dropdown reaches at least 4 weeks ahead');
expect((await planner.locator('[aria-label="Plan ahead"] button').count()) === 4, 'plan-ahead strip shows the next 4 weeks');
// Pick the 3rd week ahead (no plan yet).
const target3 = planOpts[curIdx + 3];
await planner.locator('[aria-label="Plan ahead"] button').nth(2).click();
expect((await planner.locator('select[aria-label="Plan week"] option:checked').innerText()) === target3, `strip selects ${target3}`);
expect(await planner.getByText('Using the default weekly target').isVisible(), 'unplanned week uses the default target');
expect((await planner.locator('input[type="number"]').count()) === 0, 'week targets are read-only until Plan/Edit');
await planner.getByRole('button', { name: /^Plan week \d+/ }).click();
await planner.getByLabel(/^Messages sent target for week/).fill('412');
await planner.getByRole('button', { name: /Save and lock week/ }).click();
expect(await planner.getByText('Plan saved, locked').isVisible(), 'saved week shows "Plan saved, locked"');
expect((await planner.locator('input[type="number"]').count()) === 0, 'saved week is locked (no inputs)');
expect(/plan saved/.test(await planner.locator('select[aria-label="Plan week"] option:checked').innerText()), 'dropdown marks it plan saved');
let st = await state();
const ws3 = await planner.locator('select[aria-label="Plan week"]').inputValue();
expect(st.projects.find((p) => p.id === 'northwind').weekPlans[ws3]?.messages === 412, 'store has the week plan (412)');
// Edit a past week too.
await planner.locator('select[aria-label="Plan week"]').selectOption({ index: Math.max(0, curIdx - 1) });
await planner.getByRole('button', { name: /^Plan week \d+/ }).click();
await planner.getByRole('button', { name: /^Copy week/ }).click();
await planner.getByRole('button', { name: /Save and lock week/ }).click();
expect(await planner.getByText('Plan saved, locked').isVisible(), 'past week can be planned / edited as well');
await planner.getByRole('button', { name: 'Use the default target instead' }).click();
expect(await planner.getByText('Using the default weekly target').isVisible(), 'a week plan can be cleared back to the default');
expect(await nw.getByText('What this project tracks').isVisible(), '"What this project tracks" editor is still there');
expect(await nw.getByText('🗓️ Monthly targets').isVisible(), 'monthly targets editor is still there');
await shot('owner-targets-light');
// Progress uses that week's plan.
await nw.getByRole('tab', { name: /Progress/ }).click();
await prog.locator('select[aria-label="Week"]').selectOption(ws3);
expect(/target 412/.test(await textOf(msgRow)), 'progress for that week uses its saved plan (412)');

// ------------------------------------------------------------------------------------------------
section("owner: this week's numbers locked, edit, save");
await nw.getByRole('tab', { name: /This week's numbers/ }).click();
const nums = nw.getByTestId('week-numbers');
expect(await nums.getByText('Locked', { exact: true }).isVisible(), 'shows a clear Locked state');
expect((await nums.locator('input').count()) === 0, 'no inputs while locked (auto-filled numbers included)');
const dayItems = nums.locator('ol[aria-label="Finalised days"] > li');
expect((await dayItems.count()) === 5, 'shows Monday to Friday');
expect((await nums.locator('li[data-finalized="yes"]').count()) >= 1, 'today is finalised from the end-of-day updates');
expect(/End of day sent today/.test(await textOf(nums)), 'shows who has sent end of day');
const meetBefore = +(await nums.locator('[data-metric="Meetings scheduled"] [aria-label="Meetings scheduled this week"]').innerText());
await shot('owner-numbers-locked-light');
await nums.getByRole('button', { name: 'Edit' }).click();
expect((await nums.locator('input[type="number"]').count()) >= 6, 'Edit unlocks the inputs');
// Lower than auto-counted is refused (when there is an auto count).
const autoMsg = await nums.locator('[data-metric="Messages sent"]').innerText();
if (/(\d+) auto-counted/.test(autoMsg)) {
  await nums.getByLabel('Messages sent this week').fill('0');
  await nums.getByRole('button', { name: 'Save and finalise' }).click();
  expect(await nums.getByRole('alert').isVisible(), 'cannot go below the auto-counted number');
  await nums.getByRole('button', { name: 'Cancel' }).click();
  await nums.getByRole('button', { name: 'Edit' }).click();
}
await nums.getByLabel('Meetings scheduled this week').fill(String(meetBefore + 2));
await shot('owner-numbers-editing-light', false);
await nums.getByRole('button', { name: 'Save and finalise' }).click();
expect((await nums.locator('input').count()) === 0, 'Save locks the numbers again');
const meetAfter = +(await nums.locator('[aria-label="Meetings scheduled this week"]').innerText());
expect(meetAfter === meetBefore + 2, `corrected number saved (${meetBefore} to ${meetAfter})`);
st = await state();
const todayIso = await page.evaluate(() => new Date().toLocaleDateString('sv'));
expect(!!st.projects.find((p) => p.id === 'northwind').finalized[todayIso], 'today stays finalised after Save');

// ------------------------------------------------------------------------------------------------
section('owner: edit project details modal');
await nw.getByRole('button', { name: 'Edit project details' }).click();
const dlg = page.getByRole('dialog');
await dlg.waitFor();
const stdInput = dlg.getByLabel('Prospect mapping standard minutes');
const c1 = await contrastOf('[role="dialog"] input[aria-label="Prospect mapping standard minutes"]');
expect(c1.ratio >= 7, `standard time digits are clearly visible in light (contrast ${c1.ratio.toFixed(1)}, ${c1.size})`);
expect(parseFloat(c1.size) >= 20, 'standard time digits are large');
await stdInput.fill('2.5');
await page.getByLabel('Minutes per unit for LinkedIn connection request').scrollIntoViewIfNeeded();
await shot('owner-edit-modal-standards-light', false);
// Week preview.
const preview = await dlg.locator('ul[aria-label="Week preview"] li').allInnerTexts();
expect(/^Week 1 · \d+ \w+ to \d+ \w+/.test(preview[0]) && /^Week 2 · /.test(preview[1]), `week preview lists weeks from the start (${preview[0]}, ${preview[1]})`);
// Custom standard tasks: add two, delete one.
expect(await dlg.getByLabel('Custom task name', { exact: true }).first().inputValue() === 'LinkedIn connection request', 'existing custom task listed');
await dlg.getByLabel('New custom task name').fill('Cold call script review');
await dlg.getByLabel('New custom task unit').fill('scripts');
await dlg.getByLabel('New custom task minutes per unit').fill('4');
await dlg.getByRole('button', { name: 'Add task' }).click();
await dlg.getByLabel('New custom task name').fill('Temp task');
await dlg.getByLabel('New custom task minutes per unit').fill('1');
await dlg.getByRole('button', { name: 'Add task' }).click();
expect((await dlg.getByLabel('Custom task name', { exact: true }).count()) === 3, 'two custom tasks added');
await dlg.getByRole('button', { name: 'Delete Temp task' }).click();
expect((await dlg.getByLabel('Custom task name', { exact: true }).count()) === 2, 'custom task deleted');
const c2 = await contrastOf('[role="dialog"] input[aria-label="Minutes per unit for Cold call script review"]');
expect(c2.ratio >= 7, `custom minutes visible (contrast ${c2.ratio.toFixed(1)})`);
// Team hours typed, decimals, add-person picker.
await dlg.getByLabel('Hours per day for Udhaya').fill('1.5');
expect(/1h 30m/.test(await dlg.locator('ul[aria-label="Team and hours"]').innerText()), 'typed 1.5 reads as 1h 30m');
await dlg.locator('select[aria-label="Add a person to the team"]').selectOption('sachi');
await dlg.getByLabel('Hours per day for Sachi').fill('0.75');
expect((await dlg.locator('button', { hasText: /^[0-8]h$/ }).count()) === 0, 'no fixed hour pills any more');
// Admins.
await dlg.locator('select[aria-label="Add an admin"]').selectOption('alok');
expect(await dlg.locator('[data-admin="alok"]').isVisible(), 'admin added to the list');
await shot('owner-edit-modal-light', false);
await page.getByRole('button', { name: 'Save changes' }).click();
await dlg.waitFor({ state: 'detached' });
st = await state();
let p = st.projects.find((x) => x.id === 'northwind');
expect(p.hours.udhaya === 1.5 && p.hours.sachi === 0.75 && p.teamIds.includes('sachi'), `hours saved as typed (udhaya ${p.hours.udhaya}, sachi ${p.hours.sachi})`);
expect(p.customStandards.some((c) => c.name === 'Cold call script review' && c.minutes === 4 && c.unit === 'scripts') && !p.customStandards.some((c) => c.name === 'Temp task'), 'custom standards saved (added + deleted)');
expect(p.standards.prospect === 2.5, 'standard time saved (2.5)');
expect(p.admins.includes('alok') && p.admins.includes('prajwal'), 'admins saved');
expect(/Admins\b.*Prajwal.*Alok/.test(await textOf(nw.getByTestId('hero-admins'))), 'hero lists both admins');

// Remove an admin again.
await nw.getByRole('button', { name: 'Edit project details' }).click();
await dlg.getByRole('button', { name: 'Remove Alok as admin' }).click();
await page.getByRole('button', { name: 'Save changes' }).click();
await dlg.waitFor({ state: 'detached' });
st = await state();
expect(!st.projects.find((x) => x.id === 'northwind').admins.includes('alok'), 'admin removed');

// ------------------------------------------------------------------------------------------------
section('owner: handover with confirm');
await nw.getByRole('button', { name: 'Edit project details' }).click();
const hand = ['Transfer and remove myself', 'Transfer and stay as admin', 'Transfer and stay as team member'];
for (const h of hand) expect(await dlg.getByRole('button', { name: new RegExp(`^${h}`) }).isDisabled(), `"${h}" waits for a new owner`);
await dlg.locator('select[aria-label="New owner"]').selectOption('alok');
await dlg.getByRole('button', { name: /^Transfer and stay as admin/ }).click();
const confirmBox = dlg.getByRole('alertdialog', { name: 'Confirm handover' });
expect(await confirmBox.isVisible(), 'confirm step appears');
expect(/Alok/.test(await confirmBox.innerText()), 'confirm names the new owner');
await dlg.locator('[role="alertdialog"]').scrollIntoViewIfNeeded();
await shot('owner-handover-confirm-light', false);
await confirmBox.getByRole('button', { name: 'Confirm handover' }).click();
await dlg.waitFor({ state: 'detached' });
st = await state();
p = st.projects.find((x) => x.id === 'northwind');
expect(p.pmId === 'alok' && p.admins.includes('bheeshma'), 'owner is Alok and Bheeshma stays as admin');
expect(st.notices.some((n) => n.to === 'alok' && /handed .* over to you/.test(n.text)), 'new owner is notified');
expect(/Owner\s*Alok/.test(await textOf(nw.getByTestId('project-hero'))), 'hero shows the new owner');
await nw.getByRole('tab', { name: /Progress/ }).click();
expect(/handed the project over to Alok and stays on as admin/.test(await textOf(nw.getByTestId('project-updates'))), 'handover shows in latest updates');
expect(await nw.getByRole('button', { name: 'Edit project details' }).isVisible(), 'Bheeshma (now admin) can still edit');
await nw.getByRole('button', { name: 'Edit project details' }).click();
expect((await dlg.getByText('Handover', { exact: true }).count()) === 0, 'admins do not see Handover');
expect(await dlg.getByRole('button', { name: 'Step down as admin' }).isVisible(), 'admin can step down');
await page.getByRole('button', { name: 'Cancel' }).click();

// Remove-myself variant on BD as Abisho (owner), handing to Sachi.
await as('abisho');
const bd = card('bd');
await bd.getByRole('button', { name: 'Edit project details' }).click();
await dlg.locator('select[aria-label="New owner"]').selectOption('sachi');
await dlg.getByRole('button', { name: /^Transfer and remove myself/ }).click();
await dlg.getByRole('button', { name: 'Confirm handover' }).click();
await dlg.waitFor({ state: 'detached' });
st = await state();
p = st.projects.find((x) => x.id === 'bd');
expect(p.pmId === 'sachi' && !p.teamIds.includes('abisho') && !p.admins.includes('abisho'), 'remove-myself: Abisho left BD');
expect((await card('bd').count()) === 0, 'BD no longer on Abisho\'s projects page');

// ------------------------------------------------------------------------------------------------
section('permissions: admin, member, manager');
await as('prajwal');
expect(await card('northwind').getByRole('button', { name: 'Edit project details' }).isVisible(), 'admin Prajwal can edit Northwind');
expect(await card('northwind').getByRole('tab', { name: /Targets/ }).isVisible(), 'admin sees Targets');
await card('northwind').getByRole('tab', { name: /This week's numbers/ }).click();
expect(await card('northwind').getByTestId('week-numbers').getByRole('button', { name: 'Edit' }).isVisible(), 'admin can Edit numbers');
expect((await card('helios').getByRole('button', { name: 'Edit project details' }).count()) === 0, 'Prajwal (member of Helios) cannot edit Helios');
await as('udhaya');
const nwU = card('northwind');
expect((await nwU.getByRole('button', { name: 'Edit project details' }).count()) === 0, 'member has no Edit project details');
expect((await nwU.getByRole('tab', { name: /Targets/ }).count()) === 0, 'member has no Targets tab');
await nwU.getByRole('tab', { name: /This week's numbers/ }).click();
expect((await nwU.getByTestId('week-numbers').getByRole('button', { name: 'Edit' }).count()) === 0, 'member cannot Edit numbers');
expect(await nwU.getByTestId('week-numbers').getByText('Locked', { exact: true }).isVisible(), 'member sees the Locked state');
expect(/you: 1\.5h \/ day/.test(await textOf(nwU.getByTestId('project-hero'))), 'member sees own typed hours (1.5h)');
await nwU.getByRole('tab', { name: /Progress/ }).click();
await shot('member-light');

await as('komala');
for (const id of ['northwind', 'helios', 'bd']) expect(await card(id).isVisible(), `manager sees ${id}`);
expect((await page.locator('ul[aria-label="Progress against targets"]').count()) === 3, 'LeadProjects uses the bar-chart progress');
expect(await card('helios').getByRole('button', { name: 'Edit project details' }).isVisible(), 'manager can edit project details');
await card('helios').getByRole('tab', { name: /This week's numbers/ }).click();
expect(await card('helios').getByTestId('week-numbers').getByRole('button', { name: 'Edit' }).isVisible(), 'manager can Edit numbers');
await card('helios').getByRole('tab', { name: /Progress/ }).click();
await checkWording('lead projects');
await shot('lead-light');
await card('helios').getByRole('button', { name: 'Edit project details' }).click();
expect(await dlg.getByRole('button', { name: /^Transfer and remove Alok/ }).isVisible(), 'manager handover wording names the owner');
await page.getByRole('button', { name: 'Cancel' }).click();
await go('/');
expect((await page.locator('[data-testid="project-progress"] ul[aria-label="Progress against targets"]').count()) >= 1, 'dashboard project blocks use the bar-chart list');
await shot('lead-dashboard');

// ------------------------------------------------------------------------------------------------
section('onboarding form: week preview + typed hours');
await as('udhaya');
await page.getByRole('button', { name: 'Propose a project' }).click();
await dlg.getByLabel('Project name').fill('Orbit AI - EU Outbound');
await dlg.getByLabel('Start date').fill('2026-10-19');
await dlg.getByLabel('End date').fill('2026-12-18');
const pv = await dlg.locator('ul[aria-label="Week preview"] li').allInnerTexts();
expect(pv[0].startsWith('Week 1 · 19 Oct to 23 Oct'), `preview Week 1 · 19 Oct to 23 Oct (${pv[0]})`);
expect(pv.some((x) => x.startsWith('Week 2 · 26 Oct to 30 Oct')), 'preview Week 2');
await dlg.locator('select[aria-label="Add a person to the team"]').selectOption('bharath');
await dlg.getByLabel('Hours per day for Bharath').fill('2.5');
await dlg.getByLabel('New custom task name').fill('Account research');
await dlg.getByLabel('New custom task minutes per unit').fill('6');
await dlg.getByRole('button', { name: 'Add task' }).click();
await checkWording('onboarding form');
await shot('propose-light', false);
await page.getByRole('button', { name: 'Send for approval' }).click();
await dlg.waitFor({ state: 'detached' });
st = await state();
p = st.projects.find((x) => x.name === 'Orbit AI - EU Outbound');
expect(p && p.status === 'pending' && p.hours.bharath === 2.5 && p.customStandards[0]?.name === 'Account research', 'proposal saved with typed hours and custom task');

// ------------------------------------------------------------------------------------------------
section('dark theme');
await as('bheeshma');
await setTheme('Professional Dark');
expect(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'dark theme on');
await card('northwind').waitFor();
await checkWording('projects dark');
await shot('owner-progress-dark');
await card('northwind').getByRole('tab', { name: /This week's numbers/ }).click();
await shot('owner-numbers-dark');
await card('northwind').getByRole('tab', { name: /Targets/ }).click();
await shot('owner-targets-dark');
await card('northwind').getByRole('button', { name: 'Edit project details' }).click();
const c3 = await contrastOf('[role="dialog"] input[aria-label="Prospect mapping standard minutes"]');
expect(c3.ratio >= 7, `standard time digits visible in dark (contrast ${c3.ratio.toFixed(1)})`);
const c4 = await contrastOf('[role="dialog"] input[aria-label^="Hours per day for"]');
expect(c4.ratio >= 7, `typed hours visible in dark (contrast ${c4.ratio.toFixed(1)})`);
await shot('owner-edit-modal-dark', false);
await page.getByLabel('Minutes per unit for LinkedIn connection request').scrollIntoViewIfNeeded();
await shot('owner-edit-modal-standards-dark', false);
await dlg.locator('[data-dialog-body]').evaluate((el) => el.scrollTo(0, el.scrollHeight));
await shot('owner-edit-modal-dark-bottom', false);
await page.getByRole('button', { name: 'Cancel' }).click();

section('fun theme (Cartoon)');
await setTheme('Cartoon');
await card('northwind').getByRole('button', { name: 'Edit project details' }).click();
const c5 = await contrastOf('[role="dialog"] input[aria-label="Prospect mapping standard minutes"]');
expect(c5.ratio >= 7, `standard time digits visible in Cartoon (contrast ${c5.ratio.toFixed(1)})`);
await shot('owner-edit-modal-cartoon', false);
await page.getByRole('button', { name: 'Cancel' }).click();
await setTheme('Space Cadet');
await card('northwind').getByRole('button', { name: 'Edit project details' }).click();
const c6 = await contrastOf('[role="dialog"] input[aria-label="Prospect mapping standard minutes"]');
expect(c6.ratio >= 7, `standard time digits visible in Space Cadet (contrast ${c6.ratio.toFixed(1)})`);
await page.getByRole('button', { name: 'Cancel' }).click();
await shot('owner-progress-space');
await setTheme('Professional');

section('narrow screen');
await page.setViewportSize({ width: 420, height: 900 });
await go('/projects');
// The app header (not part of this page) is checked elsewhere; here each project card must fit and not scroll sideways.
const overflow = await page.evaluate(() => Math.max(...[...document.querySelectorAll('[data-project]')].map((el) => Math.max(el.scrollWidth - el.clientWidth, el.getBoundingClientRect().right - document.documentElement.clientWidth))));
expect(overflow <= 1, `project cards fit at 420px (${overflow}px)`);
await shot('owner-progress-mobile');

await browser.close();
console.log(`\n${issues.length ? `${issues.length} issue(s):\n- ${issues.join('\n- ')}` : 'All R3 project checks passed.'}`);
process.exit(issues.length ? 1 : 0);
