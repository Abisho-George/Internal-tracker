/**
 * Round 13, R1 + R2: personal Tasks update and the managers / founders Team tasks update view.
 *
 *   npx vite build --base ./ && npx vite preview --port 5711 --strictPort &
 *   node scripts/check-r13-tasks-update.mjs
 *
 * Starts from a clean seed. Team view (Komala): exactly two KPI tiles per tab, tiles filter to who is pending,
 * one card per person in alphabetical order with a target vs actual table whose actual column is blank until the
 * end of day / end of week is sent, status chip, hours line and note; day and week navigation skip weekends.
 * Personal view (Udhaya, Bharath): actual time per block, extra hours (start / end or duration, work, project),
 * planned vs actual vs extra totals, target table, end of day blank until sent then frozen, weekly bar-chart list,
 * end of week hours. Fails on page errors, em / en dashes or banned words in the sections it owns.
 * Screenshots: e2e/screenshots/r13-tasks-update-*.png (light and dark).
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5711/';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'e2e', 'screenshots');
mkdirSync(OUT, { recursive: true });
const KEY = 'ls-tracker-v2';

const issues = [];
const ok = (m) => console.log('ok  ', m);
const fail = (m) => { issues.push(m); console.log('FAIL', m); };
const expect = (c, m) => (c ? ok(m) : fail(m));
const shot = async (page, name) => page.screenshot({ path: path.join(OUT, `r13-tasks-update-${name}.png`), fullPage: true });

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isWork = (d) => d.getDay() !== 0 && d.getDay() !== 6;
const today = new Date();
const lastWork = (() => { const d = new Date(today); while (!isWork(d)) d.setDate(d.getDate() - 1); return d; })();
const prevWork = (() => { const d = new Date(lastWork); do d.setDate(d.getDate() - 1); while (!isWork(d)); return d; })();
const TODAY = iso(lastWork);
const PREV = iso(prevWork);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => fail(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') console.log('console error:', m.text()); });

const store = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}').state, KEY);
const as = async (who, route = '#/daily') => {
  await page.selectOption('select[aria-label="Viewing as"]', who);
  await page.goto(BASE + route);
  await page.waitForTimeout(400);
};
const textOf = (sel) => page.locator(sel).first().innerText();
const cells = (scope, cell) => page.locator(`${scope} [data-cell="${cell}"]`).allInnerTexts();
const BANNED = /\b(log ?in|log ?out|sign ?in|sign ?out)\b/i;
const checkText = async (sel, label) => {
  const els = page.locator(sel);
  for (let i = 0; i < await els.count(); i++) {
    const t = await els.nth(i).innerText();
    if (/[\u2013\u2014]/.test(t)) fail(`${label}: em / en dash found: ${t.match(/.{0,30}[\u2013\u2014].{0,30}/)?.[0]}`);
    if (BANNED.test(t)) fail(`${label}: banned wording: ${t.match(BANNED)?.[0]}`);
  }
};
const setTheme = async (name) => {
  await page.click('button[aria-label="Theme"]');
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).first().click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
};

// ---------------------------------------------------------------------------------------------
// Clean seed
// ---------------------------------------------------------------------------------------------
await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(600);

// ---------------------------------------------------------------------------------------------
// Team view (Komala, manager)
// ---------------------------------------------------------------------------------------------
await as('komala');
expect(await page.getByRole('heading', { name: 'Team tasks update' }).isVisible(), 'Komala sees Team tasks update');
const s0 = await store();
const TEAM = ['bheeshma', 'alok', 'prajwal', 'abisho', 'udhaya', 'bharath', 'sachi'];
const sodN = TEAM.filter((id) => s0.daily[`${id}|${TODAY}`]?.sodAt).length;
const eodN = TEAM.filter((id) => s0.daily[`${id}|${TODAY}`]?.eodAt).length;

let tiles = page.locator('[data-testid="kpi-tile"]');
expect(await tiles.count() === 2, 'Daily tab has exactly two KPI tiles');
expect((await tiles.nth(0).innerText()).includes('Set morning targets') && (await tiles.nth(0).innerText()).includes(`${sodN}/7`), `Tile 1 "Set morning targets ${sodN}/7"`);
expect((await tiles.nth(1).innerText()).includes('Sent end of day') && (await tiles.nth(1).innerText()).includes(`${eodN}/7`), `Tile 2 "Sent end of day ${eodN}/7"`);
expect(!(await page.locator('main').innerText()).includes('Priority blocks'), 'No third "priority blocks" tile');

let cards = page.locator('section[data-person]');
expect(await cards.count() === 7, 'One card per person (7)');
const names = await page.locator('section[data-person] p.font-bold').allInnerTexts();
expect(JSON.stringify(names) === JSON.stringify([...names].sort((a, b) => a.localeCompare(b))), `Cards alphabetical: ${names.join(', ')}`);

// Udhaya: targets set, end of day not sent: actual blank, hint, "Targets set HH:MM".
const ud = 'section[data-person="udhaya"]';
expect(/Targets set \d\d:\d\d/.test(await textOf(`${ud} [data-testid="status"]`)), 'Udhaya status chip "Targets set 10:05"');
const udActual = await cells(ud, 'actual');
expect(udActual.length > 0 && udActual.every((t) => t.trim() === ''), `Udhaya actual column blank before end of day (${udActual.length} rows)`);
expect(await page.locator(`${ud} [data-testid="pending-hint"]`).count() === 1, 'Udhaya card shows the "fills in when end of day is sent" hint');
const udTargets = await cells(ud, 'target');
expect(udTargets.some((t) => /\d/.test(t)), 'Udhaya targets filled from assigned tasks');

// Bharath: end of day sent: actuals + %, status chip, extra hours on the hours line.
const bh = 'section[data-person="bharath"]';
expect(/End of day sent \d\d:\d\d/.test(await textOf(`${bh} [data-testid="status"]`)), 'Bharath status chip "End of day sent 18:40"');
const bhActual = await cells(bh, 'actual');
const bhPct = await cells(bh, 'pct');
expect(bhActual.length > 0 && bhActual.every((t) => /^\d+$/.test(t.trim())), `Bharath actuals filled (${bhActual.join(', ')})`);
expect(bhPct.some((t) => /\d+%/.test(t)), `Bharath % done shown (${bhPct.join(', ')})`);
const bhHours = await textOf(`${bh} [data-testid="hours-line"]`);
expect(/Planned \S+/.test(bhHours) && /Extra hours 1h 30m/.test(bhHours), `Bharath hours line: ${bhHours}`);
expect((await textOf(`${bh} [data-testid="note"]`)).includes('Great call day'), 'Bharath note on one line');
// Snapshot values match what the table shows.
const snapB = s0.daily[`bharath|${TODAY}`].eodSnapshot;
const firstKey = Object.keys(snapB.byType)[0];
const shownB = await page.locator(`${bh} tr[data-row="${firstKey}"] [data-cell="actual"]`).innerText();
expect(String(snapB.byType[firstKey].actual) === shownB.trim(), `Bharath actual comes from the frozen snapshot (${firstKey}: ${shownB})`);
await checkText('main', 'Team daily');
await shot(page, 'team-daily-light');

// Tiles filter to who is pending.
await tiles.nth(1).click();
expect(await tiles.nth(1).getAttribute('aria-pressed') === 'true', 'Clicking "Sent end of day" turns the filter on');
expect(await cards.count() === 7 - eodN, `Shows only the ${7 - eodN} people pending end of day`);
expect(await page.locator('[data-testid="filter-note"]').isVisible(), 'Filter note with "Show everyone"');
await shot(page, 'team-daily-filter');
await tiles.nth(1).click();
expect(await cards.count() === 7, 'Click again shows everyone');
await tiles.nth(0).click();
expect(await cards.count() === 7 - sodN, `"Set morning targets" filter shows ${7 - sodN} pending`);
if (sodN === 7) expect((await page.locator('main').innerText()).includes('Everyone is in'), 'Empty state "Everyone is in"');
await page.getByRole('button', { name: 'Show everyone', exact: true }).click();

// Day navigation skips weekends.
await page.click('button[aria-label="Previous day"]');
expect(await page.inputValue('input[aria-label="Date"]') === PREV, `Previous day goes to the previous working day (${PREV})`);
expect(await cards.count() === 7, 'Previous day still lists everyone');
await page.click('button[aria-label="Next day"]');
expect(await page.inputValue('input[aria-label="Date"]') === TODAY, 'Next day comes back to today');
expect(await page.locator('button[aria-label="Next day"]').isDisabled(), 'Cannot go past today');

// Weekly tab.
await page.getByRole('tab', { name: 'Weekly' }).click();
tiles = page.locator('[data-testid="kpi-tile"]');
expect(await tiles.count() === 2, 'Weekly tab has exactly two KPI tiles');
const wkT = await tiles.nth(0).innerText();
const wkS = await tiles.nth(1).innerText();
expect(wkT.includes('Set weekly targets') && /\d\/7/.test(wkT), `Tile "Set weekly targets": ${wkT.split('\n')[0]} ${wkT.match(/\d\/7/)?.[0]}`);
expect(wkS.includes('Sent end of week') && /\d\/7/.test(wkS), `Tile "Sent end of week": ${wkS.match(/\d\/7/)?.[0]}`);
expect(await cards.count() === 7, 'Weekly: one card per person');
const wActual = await cells('section[data-person="udhaya"]', 'actual');
expect(wActual.every((t) => t.trim() === ''), 'Weekly: actual blank until end of week is sent');
const wkHours = await textOf('section[data-person="bharath"] [data-testid="hours-line"]');
expect(/Planned \d/.test(wkHours) && /Extra hours \d/.test(wkHours), `Weekly hours line: ${wkHours}`);
await shot(page, 'team-weekly-light');
const wl0 = await textOf('[data-testid="week-label"]');
await page.click('button[aria-label="Previous week"]');
const wl1 = await textOf('[data-testid="week-label"]');
expect(wl0 !== wl1 && / to /.test(wl1), `Previous week: "${wl1}"`);
const lastWkT = await tiles.nth(1).innerText();
expect(lastWkT.includes('7/7'), 'Last week: everyone sent end of week (7/7)');
const lwActual = await cells('section[data-person="sachi"]', 'actual');
expect(lwActual.length > 0 && lwActual.every((t) => /^\d+$/.test(t.trim())), `Last week: Sachi actuals filled (${lwActual.join(', ')})`);
expect(/End of week sent \w{3} \d\d:\d\d/.test(await textOf('section[data-person="sachi"] [data-testid="status"]')), 'Status chip "End of week sent Fri 18:40"');
await tiles.nth(0).click();
expect(await cards.count() === 0 && (await page.locator('main').innerText()).includes('Everyone is in'), 'Weekly tile filter: nobody pending last week');
await tiles.nth(0).click();
await shot(page, 'team-weekly-last-week');
await checkText('main', 'Team weekly');

// Dark mode for the team view.
await page.getByRole('tab', { name: 'Daily' }).click();
await setTheme('Professional Dark');
expect(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'Dark theme applied');
await shot(page, 'team-daily-dark');
await setTheme('Professional');

// ---------------------------------------------------------------------------------------------
// Personal Tasks update (Udhaya: targets set, end of day not sent)
// ---------------------------------------------------------------------------------------------
await as('udhaya');
expect(await page.getByRole('heading', { name: 'Tasks update' }).isVisible(), 'Udhaya sees Tasks update');
const plan = page.locator('#plan-your-day');
expect((await plan.innerText()).includes('Lunch break'), 'Plan keeps the lunch row');
expect(await plan.locator('select[aria-label="What"] option[value="__custom"]').count() > 0, 'Custom / priority option in the dropdown');
const actualInputs = plan.locator('input[aria-label="Actual time"]');
const nBlocks = await actualInputs.count();
expect(nBlocks >= 2, `Every block has an Actual time field (${nBlocks})`);
expect((await textOf('#plan-your-day [data-testid="hours-stats"]')).includes('Planned'), 'Planned / actual / extra totals in the plan header');

// Today's targets: table by task type with target + time.
const sod = '#todays-targets';
const sodText = await textOf(sod);
expect(/Task\s+Target\s+Time/i.test(sodText.replace(/\n/g, ' ')), 'Today\'s targets table has Task / Target / Time columns');
const sodTargets = await cells(sod, 'target');
const sodTimes = await cells(sod, 'time');
expect(sodTargets.some((t) => /\d/.test(t)) && sodTimes.some((t) => /\d/.test(t)), `Target qty and time per task type (${sodTargets.slice(0, 3).join(', ')})`);
expect(sodText.includes('Case-study one-pager'), 'Custom target row shows in the targets table');

// End of day: blank actual + hint before sending.
const eod = '#end-of-day';
const eodActual0 = await cells(eod, 'actual');
expect(eodActual0.length > 0 && eodActual0.every((t) => t.trim() === ''), 'End of day actual column blank before sending');
expect((await textOf(eod)).includes('Fills in when you send your end of day'), 'Subtle "Fills in when you send your end of day" hint');
await shot(page, 'personal-before-eod');

// Actual time per block: minutes and h:mm.
await actualInputs.nth(0).fill('45');
await actualInputs.nth(1).fill('1:30');
await actualInputs.nth(1).blur();
expect(await actualInputs.nth(1).inputValue() === '1h 30m', 'Actual "1:30" reads as 1h 30m');
expect(await actualInputs.nth(0).inputValue() === '45m', 'Actual "45" reads as 45m');
await actualInputs.nth(2).fill('nonsense');
expect(await actualInputs.nth(2).getAttribute('aria-invalid') === 'true', 'Unreadable actual time is flagged');
await actualInputs.nth(2).fill('2h 15m');
await actualInputs.nth(2).blur();

// Extra hours: one with start / end, one with a duration only, one added then deleted.
await page.getByRole('button', { name: 'Add extra hours' }).click();
await page.getByRole('button', { name: 'Add extra hours' }).click();
await page.getByRole('button', { name: 'Add extra hours' }).click();
const rows = plan.locator('[data-extra]');
expect(await rows.count() === 3, 'Add extra hours adds rows');
await rows.nth(0).locator('input[aria-label="Extra start"]').fill('19:00');
await rows.nth(0).locator('input[aria-label="Extra end"]').fill('20:15');
await rows.nth(0).locator('input[aria-label="Extra work"]').fill('Polished the QBR deck');
await rows.nth(0).locator('select[aria-label="Extra project"]').selectOption({ label: 'Northwind SaaS - US' }).catch(() => rows.nth(0).locator('select[aria-label="Extra project"]').selectOption({ index: 1 }));
expect(await rows.nth(0).locator('input[aria-label="Extra duration"]').inputValue() === '1h 15m', 'Start / end gives the duration (1h 15m)');
expect(await rows.nth(0).locator('input[aria-label="Extra duration"]').isDisabled(), 'Duration is locked when start and end are set');
await rows.nth(1).locator('input[aria-label="Extra duration"]').fill('30m');
await rows.nth(1).locator('input[aria-label="Extra work"]').fill('Research for tomorrow');
await rows.nth(1).locator('select[aria-label="Extra project"]').selectOption('');
await rows.nth(2).locator('button[aria-label="Remove extra hours"]').click();
expect(await rows.count() === 2, 'Extra hours row can be deleted');
const stats = await textOf('#plan-your-day [data-testid="hours-stats"]');
expect(/Extra\s*1h 45m/.test(stats), `Extra total 1h 45m (${stats.replace(/\n/g, ' ')})`);
expect(/Actual\s*4h 30m/.test(stats), `Actual total 4h 30m (${stats.replace(/\n/g, ' ')})`);
await page.getByRole('button', { name: 'Save plan and times' }).click();
await page.waitForTimeout(300);
let s1 = await store();
let rec = s1.daily[`udhaya|${TODAY}`];
expect(rec.extra.length === 2 && rec.extra[0].minutes === 75 && rec.extra[1].minutes === 30 && !rec.extra[1].projectId && rec.extra[0].projectId, `Saved extra hours ${JSON.stringify(rec.extra.map((x) => [x.minutes, x.work, x.projectId ?? '']))}`);
const sortedPlan = [...rec.plan].sort((a, b) => a.start.localeCompare(b.start));
expect(sortedPlan[0].actualMinutes === 45 && sortedPlan[1].actualMinutes === 90, `Saved actual minutes ${sortedPlan.map((b) => b.actualMinutes).join(', ')}`);
await shot(page, 'personal-plan-times');

// Validation: extra hours without a description are refused.
await page.getByRole('button', { name: 'Add extra hours' }).click();
await rows.nth(2).locator('input[aria-label="Extra duration"]').fill('20m');
await page.getByRole('button', { name: 'Save plan and times' }).click();
await page.waitForTimeout(300);
expect((await page.locator('body').innerText()).includes('Say what the extra hours were for'), 'Extra hours without work are refused with a clear message');
await rows.nth(2).locator('button[aria-label="Remove extra hours"]').click();

// Send end of day: actuals auto-fill and freeze.
await page.locator(`${eod} textarea`).fill('Deck done, L1s carried over.');
await page.locator(eod).getByRole('button', { name: 'Send & lock' }).click();
await page.waitForTimeout(400);
s1 = await store();
rec = s1.daily[`udhaya|${TODAY}`];
expect(!!rec.eodAt && !!rec.eodSnapshot, 'End of day saved with a frozen snapshot');
const eodActual1 = await cells(eod, 'actual');
expect(eodActual1.length > 0 && eodActual1.every((t) => /^\d+$/.test(t.trim())), `Actuals auto-filled after sending (${eodActual1.join(', ')})`);
expect((await cells(eod, 'pct')).some((t) => /%/.test(t)), '% done shown after sending');
expect(!(await textOf(eod)).includes('Fills in when you send'), 'Hint gone after sending');
const eodText = await textOf(eod);
expect(eodText.includes('Polished the QBR deck') && eodText.includes('EXTRA'), 'End of day shows extra hours');
expect(/\d\d:\d\d to \d\d:\d\d/.test(eodText) && eodText.includes('1h 30m'), 'End of day shows block planned vs actual times');
expect(eodText.includes('Deck done, L1s carried over.'), 'End of day shows the note');
const firstRow = Object.keys(rec.eodSnapshot.byType)[0];
expect((await page.locator(`${eod} tr[data-row="${firstRow}"] [data-cell="actual"]`).innerText()).trim() === String(rec.eodSnapshot.byType[firstRow].actual), 'Shown actual equals the frozen snapshot');
expect(await page.locator(eod).getByRole('button', { name: 'Edit' }).isVisible(), 'End of day locked with an Edit button');
await shot(page, 'personal-after-eod');
await checkText('#todays-targets, #end-of-day, #weekly-targets, #end-of-week', 'Personal sections');

// Weekly targets: bar-chart list, actual blank until end of week; end of week hours.
const wt = '#weekly-targets';
const wtVals = await cells(wt, 'value');
expect(wtVals.length > 0 && wtVals.every((t) => /target \d+/.test(t)), `Weekly bar list shows targets only before end of week (${wtVals.slice(0, 2).join(' | ')})`);
expect((await textOf(wt)).includes('Actuals fill in when you send your end of week'), 'Weekly hint before end of week');
expect(await page.locator(`${wt} [role="progressbar"]`).count() === wtVals.length, 'One progress bar per task type');
const ew = '#end-of-week';
const ewText = await textOf(ew);
expect(ewText.includes('Hours this week') && /Planned\s*\d/.test(ewText) && /Extra\s*\d/.test(ewText), 'End of week shows planned / actual / extra hours for the week');
await page.locator(`${ew} textarea`).fill('Good week.');
await page.locator(ew).getByRole('button', { name: 'Send & lock' }).click();
await page.waitForTimeout(400);
const wtVals2 = await cells(wt, 'value');
const wtPct2 = await cells(wt, 'pct');
expect(wtVals2.every((t) => /^\d+ \/ /.test(t.trim())), `Weekly bar list shows "actual / target" after end of week (${wtVals2.slice(0, 2).join(' | ')})`);
expect(wtPct2.some((t) => /\d+%/.test(t)), 'Weekly bar list shows % after end of week');
expect(/\d+ of \d+/.test(await textOf(ew)), 'End of week shows targets met');
await shot(page, 'personal-weekly');

// Day navigation (skips weekends) and the previous day's sent update.
await page.click('button[aria-label="Previous day"]');
expect(await page.inputValue('input[aria-label="Date"]') === PREV, `Personal previous day goes to ${PREV}`);
const prevActual = await cells(eod, 'actual');
expect(prevActual.every((t) => /^\d+$/.test(t.trim())), 'Previous day: end of day already sent shows actuals');
await page.click('button[aria-label="Next day"]');

// Bharath: sent today with two extra-hours entries.
await as('bharath');
const bt = await textOf('#end-of-day');
expect(bt.includes('Call list cleanup before the shift') && bt.includes('Worked through lunch'), 'Bharath end of day lists both extra-hours entries');
expect(/Extra\s*1h 30m/.test(await textOf('#plan-your-day [data-testid="hours-stats"]')), 'Bharath extra total 1h 30m');

// Dark mode personal page (the theme is saved per person, so switch first).
await as('udhaya');
await setTheme('Professional Dark');
expect(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'Dark theme applied for Udhaya');
await shot(page, 'personal-dark');
await setTheme('Cartoon');
expect(await page.locator('#end-of-day [data-cell="actual"]').count() > 0, 'Fun theme (Cartoon) still renders the update sections');
await shot(page, 'personal-cartoon');
await setTheme('Professional');

// Prajwal has no weekly targets yet this week: lock them from the Tasks update page.
await as('prajwal');
expect((await textOf('#weekly-targets')).includes('Not sent yet'), 'Prajwal weekly targets not set yet');
expect((await cells('#weekly-targets', 'value')).every((t) => /target \d+/.test(t)), 'Prajwal weekly bar list shows targets');
await page.locator('#weekly-targets textarea').fill('Northwind emails and the Helios WhatsApp batch.');
await page.locator('#weekly-targets').getByRole('button', { name: 'Save & lock' }).click();
await page.waitForTimeout(300);
expect(await page.locator('#weekly-targets').getByRole('button', { name: 'Edit' }).isVisible(), 'Weekly targets locked with Edit');

// Team view reflects Udhaya's new end of day.
await as('komala');
const t2 = await page.locator('[data-testid="kpi-tile"]').nth(1).innerText();
await page.getByRole('tab', { name: 'Weekly' }).click();
expect((await page.locator('[data-testid="kpi-tile"]').nth(0).innerText()).includes('7/7'), 'Team weekly targets tile now 7/7 after Prajwal locks his');
await page.getByRole('tab', { name: 'Daily' }).click();
expect(t2.includes(`${eodN + 1}/7`), `Team tile updates to ${eodN + 1}/7 after Udhaya sends end of day`);
const ud2 = await cells('section[data-person="udhaya"]', 'actual');
expect(ud2.every((t) => /^\d+$/.test(t.trim())), 'Team card for Udhaya now shows actuals');
expect(/Extra hours 1h 45m/.test(await textOf('section[data-person="udhaya"] [data-testid="hours-line"]')), 'Team card shows Udhaya\'s extra hours');

// Phone width: no horizontal page scroll in the sections.
await page.setViewportSize({ width: 390, height: 900 });
await as('udhaya');
const over = await page.evaluate(() => [...document.querySelectorAll('#todays-targets, #end-of-day, #weekly-targets, #end-of-week')].some((el) => el.scrollWidth > el.clientWidth + 1));
expect(!over, 'Sections fit at phone width');
await shot(page, 'personal-phone');

await browser.close();
console.log(issues.length ? `\n${issues.length} issue(s)` : '\nAll checks passed');
process.exit(issues.length ? 1 : 0);
