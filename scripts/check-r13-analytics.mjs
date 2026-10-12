/**
 * Round 13 · R8 analytics check (People for managers / founders, Profile for individuals).
 *
 *   npx vite build --base ./ && npx vite preview --port 5714 --strictPort &
 *   node scripts/check-r13-analytics.mjs        # BASE_URL=http://localhost:5714/ by default
 *
 * Starts from clean demo data and checks: People filters (Daily / Weekly / Monthly, KPI selector, period picker),
 * the team table (alphabetical by default, sortable by every column, change vs previous period, trend), the
 * "⭐ Acknowledge" / "🚩 Needs support" badges for day, week and month (current and previous), "Where time goes" by
 * project and by task type, assignment difficulty by assigner, the person profile modal (line graph with the same
 * filters, KPI tiles, where time goes, task history with resubmits and timelines, day-by-day track), and Profile
 * (line graph with filters, KPI tiles vs previous, where my time goes, task history, task calendar, review log).
 * Light, dark and a fun theme. Fails on page errors, console errors, em/en dashes or session wording.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5714/';
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

const shot = async (name, full = true) => page.screenshot({ path: path.join(OUT, `r13-analytics-${name}.png`), fullPage: full });
const shotOf = async (loc, name) => loc.screenshot({ path: path.join(OUT, `r13-analytics-${name}.png`) });
const go = async (hash) => { await page.goto(`${BASE}#${hash}`); await page.waitForTimeout(300); };
const as = async (id, hash) => {
  await page.selectOption('select[aria-label="Viewing as"]', id);
  await page.waitForTimeout(150);
  await go(hash);
};
const textOf = async (loc) => (await loc.innerText()).replace(/\s+/g, ' ');
const checkWording = async (loc, where) => {
  const t = await loc.innerText();
  expect(!/[–—]/.test(t), `${where}: no em or en dashes in visible text`);
  expect(!/\b(log ?in|log ?out|sign ?in|sign ?out)\b/i.test(t), `${where}: no session wording`);
};
/** WCAG contrast of an element's text against its nearest opaque background. */
const contrastOf = (loc) => loc.evaluate((el) => {
  const parse = (c) => (c.match(/[\d.]+/g) ?? []).map(Number);
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  let bgEl = el; let bg = getComputedStyle(el).backgroundColor;
  while (bgEl && (parse(bg).length === 4 && parse(bg)[3] < 0.5 || bg === 'transparent')) { bgEl = bgEl.parentElement; bg = bgEl ? getComputedStyle(bgEl).backgroundColor : 'rgb(255,255,255)'; }
  const fg = el instanceof SVGElement ? (el.getAttribute('fill') || getComputedStyle(el).fill) : getComputedStyle(el).color;
  const a = lum(parse(fg)); const b = lum(parse(bg));
  return { ratio: Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100, fg, bg };
});
const setTheme = async (name) => {
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: new RegExp(`^${name}`) }).first().click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
};

const TEAM = ['Abisho', 'Alok', 'Bharath', 'Bheeshma', 'Prajwal', 'Sachi', 'Udhaya'];
const people = () => page.locator('main');
const table = () => page.getByTestId('team-table');
const rowNames = async () => table().locator('tbody tr').evaluateAll((trs) => trs.map((tr) => tr.querySelector('td .font-semibold')?.textContent?.trim()));
const colValues = async (kpi) => table().locator(`tbody td[data-kpi="${kpi}"]`).evaluateAll((tds) => tds.map((td) => {
  const t = td.textContent.trim();
  return t === 'n/a' ? null : Number(t.replace(/[^\d.-]/g, ''));
}));
const radio = (scope, group, name) => scope.getByRole('radiogroup', { name: group }).getByRole('radio', { name, exact: true });

// ---------------------------------------------------------------------------------------------
section('boot: clean demo data');
await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(400);

// ---------------------------------------------------------------------------------------------
section('People: filters and defaults (Komala, manager)');
await as('komala', '/people');
const main = people();
await main.getByRole('heading', { name: 'People', level: 1 }).waitFor();
for (const g of ['Daily', 'Weekly', 'Monthly']) expect(await radio(main, 'Granularity', g).count() === 1, `granularity option "${g}"`);
for (const k of ['Tasks on time %', 'Tasks done', 'Hours logged', 'Extra hours', 'Resubmits']) expect(await radio(main, 'KPI', k).count() === 1, `KPI option "${k}"`);
expect(await radio(main, 'Granularity', 'Weekly').getAttribute('aria-checked') === 'true', 'Weekly is selected by default');
const periodSel = main.locator('select[aria-label="Period"]').first();
const periodOpts = await periodSel.locator('option').allInnerTexts();
expect(periodOpts[0].startsWith('This week') && periodOpts[1].startsWith('Last week'), `period picker lists current and previous weeks (${periodOpts.slice(0, 2).join(' | ')})`);
expect(periodOpts.length >= 8, `period picker goes back several weeks (${periodOpts.length})`);
expect((await rowNames()).join(',') === TEAM.join(','), `team table alphabetical by default (${(await rowNames()).join(', ')})`);
expect(await table().locator('thead th[aria-sort="ascending"]').count() === 1, 'Person column marked as sorted ascending');
const headers = await table().locator('thead th').allInnerTexts();
for (const h of ['PERSON', 'ON TIME', 'TASKS DONE', 'HOURS LOGGED', 'EXTRA HOURS', 'RESUBMITS', 'VS PREVIOUS', 'TREND', 'FLAG']) expect(headers.some((x) => x.toUpperCase().includes(h)), `column "${h}"`);
expect(await table().locator('tbody svg[role="img"]').count() >= 5, 'trend sparklines in the rows');
expect(await page.getByTestId('team-total').count() === 1, 'team total row');
await shot('people-week-light');

// ---------------------------------------------------------------------------------------------
section('People: sorting by every column');
for (const k of ['onTime', 'tasks', 'hours', 'extra', 'resubmits']) {
  await table().locator(`button[data-sort="${k}"]`).click();
  let v = await colValues(k);
  const nn = v.filter((x) => x != null);
  expect(nn.every((x, i) => i === 0 || nn[i - 1] >= x) && v.indexOf(null) === -1 || v.slice(v.indexOf(null)).every((x) => x == null), `sort ${k} high to low (${v.join(', ')})`);
  await table().locator(`button[data-sort="${k}"]`).click();
  v = await colValues(k);
  const nn2 = v.filter((x) => x != null);
  expect(nn2.every((x, i) => i === 0 || nn2[i - 1] <= x), `sort ${k} low to high (${v.join(', ')})`);
  expect(await table().locator(`th:has(button[data-sort="${k}"])`).getAttribute('aria-sort') === 'ascending', `aria-sort on ${k}`);
}
await table().locator('button[data-sort="change"]').click();
const ch = await table().locator('tbody td[data-col="change"]').allInnerTexts();
expect(ch.length === 7, `sort by change vs previous (${ch.join(' | ')})`);
await table().locator('button[data-sort="tag"]').click();
const tags = await table().locator('tbody td[data-col="tag"]').allInnerTexts();
expect(tags[0].includes('Acknowledge'), `sort by flag puts Acknowledge first (${tags.join(' | ')})`);
await table().locator('button[data-sort="name"]').click();
if ((await table().locator('th:has(button[data-sort="name"])').getAttribute('aria-sort')) !== 'ascending') await table().locator('button[data-sort="name"]').click();
expect((await rowNames()).join(',') === TEAM.join(','), 'back to alphabetical');

// ---------------------------------------------------------------------------------------------
section('People: Acknowledge and Needs support for day / week / month, current and previous');
for (const g of ['Daily', 'Weekly', 'Monthly']) {
  await radio(main, 'Granularity', g).click();
  await page.waitForTimeout(150);
  for (const idx of [0, 1]) {
    await periodSel.selectOption(String(idx));
    await page.waitForTimeout(150);
    const label = (await periodSel.locator('option:checked').innerText()).trim();
    const flagText = await textOf(table().locator('tbody'));
    expect(flagText.includes('⭐ Acknowledge'), `${g} / ${label}: someone to acknowledge`);
    expect(flagText.includes('🚩 Needs support'), `${g} / ${label}: someone who needs support`);
    const ackCallout = await textOf(page.getByTestId('callout-acknowledge'));
    const supCallout = await textOf(page.getByTestId('callout-support'));
    expect(!ackCallout.includes('Nobody') && !supCallout.includes('Nobody'), `${g} / ${label}: callouts list people with reasons`);
    const showing = await textOf(page.getByTestId('people-filters').locator('..'));
    expect(showing.includes('compared with the previous'), `${g} / ${label}: period summary line`);
  }
  await periodSel.selectOption('0');
}
await radio(main, 'Granularity', 'Daily').click();
await page.waitForTimeout(150);
expect((await periodSel.locator('option').first().innerText()).includes('Today'), 'daily period picker starts with today');
await shot('people-day-light');
await radio(main, 'Granularity', 'Monthly').click();
await page.waitForTimeout(150);
const monthOpts = await periodSel.locator('option').allInnerTexts();
expect(monthOpts[0].startsWith('This month') && monthOpts.some((m) => m.includes('July')), `monthly periods back to July (${monthOpts.join(' | ')})`);
await shot('people-month-light');
await radio(main, 'Granularity', 'Weekly').click();

// ---------------------------------------------------------------------------------------------
section('People: KPI selector and period picker drive the table');
for (const [label, k] of [['Tasks done', 'tasks'], ['Hours logged', 'hours'], ['Extra hours', 'extra'], ['Resubmits', 'resubmits'], ['Tasks on time %', 'onTime']]) {
  await radio(main, 'KPI', label).click();
  await page.waitForTimeout(100);
  const hl = await table().locator(`tbody td[data-kpi="${k}"]`).first().getAttribute('class');
  expect(hl.includes('bg-accent-soft'), `${label}: column highlighted`);
  const spark = await table().locator('tbody svg[role="img"]').first().getAttribute('aria-label');
  expect(spark?.startsWith(label), `${label}: trend follows the KPI (${spark?.slice(0, 60)})`);
  const hint = await table().locator('button[data-sort="change"]').getAttribute('title');
  expect(hint?.includes(label), `${label}: change column is for the KPI`);
}
const before = await colValues('tasks');
await periodSel.selectOption('1');
await page.waitForTimeout(150);
const after = await colValues('tasks');
expect(before.join() !== after.join(), `previous week shows different numbers (${before.join(',')} vs ${after.join(',')})`);
expect((await textOf(main.locator('h2').filter({ hasText: 'Team,' }))).includes('to'), 'table heading names the period');
await periodSel.selectOption('0');

// ---------------------------------------------------------------------------------------------
section('People: where time goes and assignment difficulty');
const wtg = main.getByTestId('where-time-goes').first();
expect(Number(await wtg.getAttribute('data-total')) > 0, `team time recorded this week (${await wtg.getAttribute('data-total')} min)`);
const byProject = await textOf(wtg.getByTestId('time-by-project'));
expect(/Northwind|Helios|Lead Strategus/.test(byProject), 'time by project lists projects');
expect(await wtg.getByTestId('time-by-project').locator('.recharts-bar-rectangle').count() >= 2, 'project bars drawn');
expect(await wtg.getByTestId('time-by-task-type').locator('.recharts-bar-rectangle').count() >= 3, 'task type bars drawn');
expect(/\d+h.*·\s*\d+%/.test(await textOf(wtg.getByTestId('time-by-task-type'))), 'bars are labelled with time and share');
const mix = main.getByTestId('assignment-mix');
expect(await mix.locator('[data-assigner]').count() >= 3, `assignment mix per assigner (${await mix.locator('[data-assigner]').count()})`);
expect(/Easy.*Standard.*Challenging/.test(await textOf(mix)), 'difficulty legend');
await shotOf(page.locator('section').filter({ has: page.getByTestId('where-time-goes') }).first(), 'people-time-light');
await checkWording(main, 'People');

// ---------------------------------------------------------------------------------------------
section('People: person profile modal (Bharath)');
await table().locator('tr[data-person="bharath"]').click();
const dlg = page.getByRole('dialog');
await dlg.getByTestId('person-modal').waitFor();
expect((await textOf(dlg.locator('h2').first())).includes('Bharath'), 'modal opens for Bharath');
await page.waitForTimeout(400);
await shot('people-modal-top', false);
for (const g of ['Daily', 'Weekly', 'Monthly']) expect(await radio(dlg, 'Granularity', g).count() === 1, `modal granularity "${g}"`);
expect(await dlg.getByRole('radiogroup', { name: 'KPI' }).getByRole('radio').count() === 5, 'modal KPI selector');
expect(await dlg.locator('[data-kpi]').count() >= 5, 'modal KPI tiles');
expect(await dlg.locator('.recharts-line-curve').count() === 1, 'modal keeps the line graph');
expect(await dlg.getByTestId('kpi-trend').locator('.recharts-line-dots circle, .recharts-line g circle').count() >= 5, 'line graph has dots');
await radio(dlg, 'Granularity', 'Daily').click();
await radio(dlg, 'KPI', 'Resubmits').click();
await page.waitForTimeout(150);
expect(await dlg.getByTestId('kpi-trend').getAttribute('data-kpi') === 'resubmits', 'chart follows the KPI selector');
const ticksDaily = await dlg.getByTestId('kpi-trend').locator('.recharts-xAxis .recharts-cartesian-axis-tick').count();
await radio(dlg, 'Granularity', 'Monthly').click();
await page.waitForTimeout(150);
const ticksMonthly = await dlg.getByTestId('kpi-trend').locator('.recharts-xAxis .recharts-cartesian-axis-tick').count();
expect(ticksMonthly >= 3 && ticksMonthly <= 6 && ticksDaily > ticksMonthly, `chart follows granularity (daily ${ticksDaily} ticks, monthly ${ticksMonthly})`);
const tickText = (await dlg.getByTestId('kpi-trend').locator('.recharts-xAxis').evaluate((el) => [...el.querySelectorAll('text')].map((t) => t.textContent).join(' ')));
expect(/Jul|Aug|Sep/.test(tickText) && tickText.includes('Oct'), `monthly axis (${tickText})`);
await radio(dlg, 'KPI', 'Tasks on time %').click();
await radio(dlg, 'Granularity', 'Weekly').click();
await page.waitForTimeout(150);
const tag = await dlg.getByTestId('person-tag').count() ? await textOf(dlg.getByTestId('person-tag')) : '';
expect(tag.includes('Needs support'), `Bharath flagged as needing support this week (${tag})`);
const hist = dlg.getByTestId('task-history');
const histText = await textOf(hist);
expect(/Resubmits/.test(histText) && /Feedback rounds/.test(histText) && /Approved first time/.test(histText), 'task history summary tiles');
expect(/All history since .*resubmit/.test(await textOf(dlg.getByTestId('history-all-time'))), `all-time resubmits line (${await textOf(dlg.getByTestId('history-all-time'))})`);
// Use the monthly view so there are resubmitted tasks to expand.
await radio(dlg, 'Granularity', 'Monthly').click();
await page.waitForTimeout(150);
const bumpy = hist.locator('li[data-task]');
expect(await bumpy.count() >= 1, `tasks sent back and resubmitted are listed (${await bumpy.count()})`);
expect(/Resubmitted \dx/.test(await textOf(hist)), 'shows "Resubmitted Nx"');
await bumpy.first().locator('button').first().click();
const tl = bumpy.first().locator('ol[aria-label="Task history"]');
expect(await tl.count() === 1, 'timeline expands');
const tlText = await textOf(tl);
expect(/Assigned by/.test(tlText) && /Sent for approval/.test(tlText) && /Feedback from/.test(tlText), `timeline shows assigned, sent for approval and feedback (${tlText.slice(0, 140)})`);
expect(/\d{1,2} [A-Z][a-z]{2}, \d{2}:\d{2}/.test(tlText), 'timeline shows times');
const track = dlg.getByTestId('track-table');
expect(await track.locator('tbody tr').count() === 20, 'day-by-day track: 20 working days');
expect(/Sent \d{2}:\d{2}/.test(await textOf(track)), 'day-by-day track shows end of day sent times');
const mwtg = dlg.getByTestId('where-time-goes');
expect(Number(await mwtg.getAttribute('data-total')) > 0, 'person where time goes has data');
await mwtg.scrollIntoViewIfNeeded();
await shotOf(mwtg, 'people-modal-time');
await track.scrollIntoViewIfNeeded();
await shotOf(track, 'people-modal-track');
await shot('people-modal-light', false);
await dlg.evaluate((el) => el.querySelector('.overflow-y-auto, [class*="overflow-y"]')?.scrollTo(0, 99999));
await checkWording(dlg, 'Person modal');
await page.keyboard.press('Escape');
await page.waitForTimeout(250);
// Callout opens the modal too.
await page.getByTestId('callout-acknowledge').locator('button').first().click();
await dlg.getByTestId('person-modal').waitFor();
expect((await textOf(dlg.getByTestId('person-tag'))).includes('Acknowledge'), 'acknowledged person opens with the Acknowledge badge');
await page.keyboard.press('Escape');
await page.waitForTimeout(250);

// ---------------------------------------------------------------------------------------------
section('People: dark theme');
await setTheme('Professional Dark');
expect(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'dark theme applied');
await go('/people');
await shot('people-week-dark');
const cell = table().locator('tbody td[data-kpi="onTime"]').first();
const c1 = await contrastOf(cell);
expect(c1.ratio >= 4.5, `table value contrast in dark ${c1.ratio}:1`);
const tick = page.getByTestId('time-by-project').locator('.recharts-yAxis .recharts-cartesian-axis-tick-value').first();
const c2 = await page.getByTestId('time-by-project').locator('.recharts-yAxis .recharts-cartesian-axis-tick-value').first().evaluate((el) => getComputedStyle(el).fill || el.getAttribute('fill'));
const surface = await page.evaluate(() => getComputedStyle(document.querySelector('main section')).backgroundColor);
expect(c2 !== surface, `chart labels are not the card colour (${c2} on ${surface})`);
const tickContrast = await tick.evaluate((el) => {
  const parse = (c) => (c.match(/[\d.]+/g) ?? []).map(Number);
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fg = getComputedStyle(el).fill; const bg = getComputedStyle(el.closest('section')).backgroundColor;
  const a = lum(parse(fg)); const b = lum(parse(bg));
  return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
});
expect(tickContrast >= 4.5, `chart axis label contrast in dark ${tickContrast}:1`);
await shotOf(page.locator('section').filter({ has: page.getByTestId('where-time-goes') }).first(), 'people-time-dark');
await table().locator('tr[data-person="udhaya"]').click();
await dlg.getByTestId('person-modal').waitFor();
await page.waitForTimeout(300);
await shot('people-modal-dark', false);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// ---------------------------------------------------------------------------------------------
section('People: fun theme still works');
await setTheme('Space Cadet');
await go('/people');
expect(await table().locator('tbody tr').count() === 7, 'table renders in Space Cadet');
expect(await page.getByTestId('where-time-goes').locator('.recharts-bar-rectangle').count() > 0, 'charts render in Space Cadet');
await shot('people-space');
await setTheme('Professional');

// ---------------------------------------------------------------------------------------------
section('Profile: individual progress (Bharath)');
await as('bharath', '/profile');
const prog = page.getByTestId('my-progress');
await prog.waitFor();
for (const g of ['Daily', 'Weekly', 'Monthly']) expect(await radio(prog, 'Granularity', g).count() === 1, `profile granularity "${g}"`);
expect(await prog.getByRole('radiogroup', { name: 'KPI' }).getByRole('radio').count() === 5, 'profile KPI selector');
expect(await prog.locator('.recharts-line-curve').count() === 1, 'profile keeps the line graph');
expect(await prog.locator('[data-kpi]').count() === 6, 'five KPI tiles (plus the chart)');
expect((await textOf(prog)).includes('compared with the previous day'), 'tiles compare with the previous period');
expect((await textOf(prog)).includes('Day-by-day track'), 'daily track table');
await radio(prog, 'Granularity', 'Weekly').click();
await page.waitForTimeout(150);
expect((await textOf(prog)).includes('Week-by-week track'), 'weekly track after switching');
expect(await prog.getByTestId('track-table').locator('tbody tr').count() === 12, '12 weeks in the track');
await radio(prog, 'KPI', 'Hours logged').click();
await page.waitForTimeout(100);
expect(await prog.getByTestId('kpi-trend').getAttribute('data-kpi') === 'hours', 'chart shows hours logged');
expect((await prog.locator('button[data-kpi="hours"]').getAttribute('aria-pressed')) === 'true', 'hours tile highlighted');
await prog.locator('button[data-kpi="resubmits"]').click();
expect(await prog.getByTestId('kpi-trend').getAttribute('data-kpi') === 'resubmits', 'clicking a tile charts that KPI');
await radio(prog, 'KPI', 'Tasks on time %').click();
const pSel = prog.locator('select[aria-label="Period"]');
const tilesNow = await textOf(prog.locator('[aria-label="KPIs for the selected period"]'));
await pSel.selectOption('1');
await page.waitForTimeout(150);
const tilesPrev = await textOf(prog.locator('[aria-label="KPIs for the selected period"]'));
expect(tilesNow !== tilesPrev, 'period picker changes the tiles');
expect(await prog.getByTestId('track-table').locator('tbody tr[aria-current="true"]').count() === 1, 'selected period highlighted in the track');
await radio(prog, 'Granularity', 'Monthly').click();
await page.waitForTimeout(150);
const ptext = await textOf(page.locator('main'));
expect(ptext.includes('Where my time goes'), '"Where my time goes" card');
expect(Number(await page.locator('main').getByTestId('where-time-goes').getAttribute('data-total')) > 0, 'my time split has data');
expect(ptext.includes('My task history') && /Resubmitted \dx/.test(ptext), 'my task history with resubmits');
expect(ptext.includes('My task log') && ptext.includes('My review log'), 'task calendar and review log kept');
await shot('profile-bharath-light');
await checkWording(page.locator('main'), 'Profile (Bharath)');
await page.getByRole('button', { name: 'Dark', exact: true }).click();
await page.waitForTimeout(300);
await shot('profile-bharath-dark');
const pc = await contrastOf(prog.locator('[data-kpi="onTime"] p').nth(1));
expect(pc.ratio >= 4.5, `tile value contrast in dark ${pc.ratio}:1`);
await page.getByRole('button', { name: 'Light', exact: true }).click();

// ---------------------------------------------------------------------------------------------
section('Profile: PM and lead');
await as('prajwal', '/profile');
await page.getByTestId('my-progress').waitFor();
await radio(page.getByTestId('my-progress'), 'Granularity', 'Monthly').click();
await page.waitForTimeout(150);
expect((await textOf(page.locator('main'))).includes('How I assign vs standard time'), 'PM sees how they assign vs standard');
await shot('profile-prajwal');
await as('komala', '/profile');
expect((await textOf(page.locator('main'))).includes('My activity'), 'manager sees their activity');
expect(await page.getByTestId('assignment-mix').count() === 1, 'manager sees how they assign');
await checkWording(page.locator('main'), 'Profile (Komala)');
await shot('profile-komala');

// ---------------------------------------------------------------------------------------------
section('People only for managers and founders');
await as('kingshuk', '/people');
expect(await page.getByTestId('team-table').count() === 1, 'founder sees People');
await as('udhaya', '/people');
expect(await page.getByTestId('team-table').count() === 0, 'resource is sent away from People');

await browser.close();
console.log(`\n${issues.length ? `${issues.length} issue(s)` : 'All checks passed'}`);
if (issues.length) { issues.forEach((i) => console.log(' -', i)); process.exit(1); }
