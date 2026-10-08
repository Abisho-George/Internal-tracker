/**
 * Management overview, Insights explorer and Recognition check.
 *
 *   npx vite --port 5304 --strictPort &        # in another shell
 *   node scripts/check-mgmt-insights.mjs       # BASE_URL=http://localhost:5304 by default
 *
 * From a clean seed, as Kabir: Overview KPIs, project health cards and "Waiting on you"
 * (approve Priya's proposal → toast, card leaves, Arjun's dependent task clears; send
 * Neha's content piece back with a note; then, on a fresh seed, approve Neha's content
 * piece → Meera's 'Review & post content piece' clears). Insights → By Person → Neha:
 * week-5 dip, note marker revealing "AI tool outage" on hover and on keyboard focus,
 * notes list, deltas table, every range; By Project and By PM for every entity and range;
 * deep links. Recognition: banner, alphabetical table, both filters. As Anika: empty
 * "Waiting on you". Tablet width (768px) and dark mode too.
 * Fails on console errors, page errors, forbidden words or horizontal page overflow.
 * Screenshots (light + dark) go to e2e/screenshots/mgmt-insights-*.png.
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

const BASE = process.env.BASE_URL ?? 'http://localhost:5304';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'e2e', 'screenshots');
mkdirSync(OUT, { recursive: true });

const FORBIDDEN =
  /\b(late|later|lately|fail\w*|missed|behind|poor\w*|flag\w*|overdue|slow\w*|rank\w*|leaderboard|worst|top performer)\b/i;

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
    if (/Warning:|Maximum update depth|getSnapshot|act\(|Future Flag/.test(text)) fail(`[${step}] console.warn: ${text}`);
    else otherWarnings.add(text.slice(0, 200));
  }
});
page.on('pageerror', (err) => fail(`[${step}] pageerror: ${err.message}`));

const shot = (name, opts = {}) => page.screenshot({ path: path.join(OUT, `mgmt-insights-${name}.png`), ...opts });
const pathname = () => new URL(page.url()).pathname;
const main = () => page.locator('main');

async function settle() {
  await page.locator('main h1').first().waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(650);
}

async function checkPage(label) {
  const text = await page.locator('body').innerText();
  const hit = text.match(FORBIDDEN);
  if (hit)
    fail(
      `[${label}] forbidden word in UI copy: "${hit[0]}" …${text.slice(Math.max(0, hit.index - 40), hit.index + 40).replace(/\s+/g, ' ')}…`,
    );
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) fail(`[${label}] horizontal page overflow of ${overflow}px`);
}

async function switchTo(name, home) {
  step = `switch:${name}`;
  await page.locator('header button[aria-label^="Viewing as"]').click();
  await page.getByRole('menuitemradio', { name: new RegExp(name) }).click();
  await page
    .waitForURL((u) => u.pathname === home, { timeout: 5000 })
    .catch(() => fail(`[${step}] expected ${home}, got ${pathname()}`));
  await settle();
}

async function nav(href) {
  await page.locator(`aside nav[aria-label="Main"] a[href="${href}"]`).click();
  await page
    .waitForURL((u) => u.pathname === href, { timeout: 5000 })
    .catch(() => fail(`[${step}] expected ${href}, got ${pathname()}`));
  await settle();
}

async function go(p) {
  await page.goto(`${BASE}${p}`);
  await settle();
}

async function setTheme(theme) {
  const current = await page.evaluate(() => document.documentElement.dataset.theme ?? 'light');
  if (current === theme) return;
  await page.locator(`header button[aria-label="Switch to ${theme} mode"]`).click();
  await page.waitForTimeout(450);
}

/** Runs `fn(store)` in the page against the app's own store module. */
async function withStore(fn, arg) {
  return page.evaluate(
    async ({ src, arg }) => {
      const mod = await import('/src/store/index.ts');
      // eslint-disable-next-line no-new-func
      return new Function('store', 'arg', `return (${src})(store, arg);`)(mod.useApp, arg);
    },
    { src: fn.toString(), arg },
  );
}

async function toastSeen(re, label) {
  const t = page.locator('[role="status"], [role="alert"], li').filter({ hasText: re }).first();
  try {
    await t.waitFor({ state: 'visible', timeout: 3000 });
    ok(`${label}: toast ${re}`);
  } catch {
    fail(`[${step}] ${label}: expected toast ${re}`);
  }
}

async function radioNames(groupName) {
  return page
    .getByRole('radiogroup', { name: groupName })
    .getByRole('radio')
    .evaluateAll((els) => els.map((el) => el.querySelector('span.truncate')?.textContent?.trim() ?? ''));
}

const isSorted = (arr) => arr.every((v, i) => i === 0 || arr[i - 1].localeCompare(v) <= 0);

async function chartCount() {
  return main().locator('svg.recharts-surface').count();
}

// ---------------------------------------------------------------------------
// Clean seed → Kabir
// ---------------------------------------------------------------------------
step = 'boot';
await page.goto(`${BASE}/`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await settle();
await switchTo('Kabir Sen', '/overview');

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
step = 'kabir:overview';
const kpis = main().getByTestId('overview-kpis');
for (const label of ['Tasks done', 'Time vs standard (team)', 'Pending reviews', 'P1 tasks pending', 'Daily notes written']) {
  expect(await kpis.getByText(label, { exact: true }).isVisible(), `KPI tile "${label}"`);
}
const kpiText = await kpis.innerText();
expect(/Oldest waiting \d+h( \d+m)? \(working hours\)|Oldest waiting \d+m/.test(kpiText), 'pending reviews shows the oldest age');
expect(/\d+ \/ \d+/.test(kpiText), 'tasks done shows done / total');
const seedNums = await withStore((store) => {
  const s = store.getState();
  const resources = s.people.filter((p) => p.role === 'resource').map((p) => p.id);
  const todays = s.tasks.filter((t) => t.date === s.demoDate && resources.includes(t.assigneeId));
  return {
    done: todays.filter((t) => t.status === 'done').length,
    total: todays.length,
    pending: s.reviewTasks.filter((r) => r.status === 'pending').length,
    p1: todays.filter((t) => t.priority === 'P1' && t.status !== 'done').length,
    notes: new Set(s.dailyNotes.filter((n) => n.date === s.demoDate && resources.includes(n.personId)).map((n) => n.personId))
      .size,
    resources: resources.length,
    activeProjects: s.projects.filter((p) => p.status === 'active').length,
  };
});
expect(kpiText.includes(`${seedNums.done} / ${seedNums.total}`), `tasks done ${seedNums.done} / ${seedNums.total}`);
expect(kpiText.includes(`${seedNums.notes} / ${seedNums.resources}`), `daily notes ${seedNums.notes} / ${seedNums.resources}`);
expect(new RegExp(`Pending reviews\\s+${seedNums.pending}\\b`).test(kpiText), `pending reviews = ${seedNums.pending}`);
expect(new RegExp(`P1 tasks pending\\s+${seedNums.p1}\\b`).test(kpiText), `P1 pending = ${seedNums.p1}`);

const healthCards = main().getByTestId('project-health-card');
expect((await healthCards.count()) === seedNums.activeProjects, `${seedNums.activeProjects} project health cards`);
expect(
  (await healthCards
    .first()
    .getByRole('img', { name: /health: \d+%/ })
    .count()) === 1,
  'health card has a health ring',
);
expect(
  await healthCards
    .first()
    .getByText(/meetings? booked/)
    .first()
    .isVisible(),
  'health card shows meetings booked',
);

const waiting = main().getByTestId('waiting-on-you');
const reviewCards = waiting.locator('article');
expect((await reviewCards.count()) === 2, 'Kabir has 2 reviews waiting');
const priyaCard = reviewCards.filter({ hasText: 'Priya Nair' });
const nehaCard = reviewCards.filter({ hasText: 'Neha Iyer' });
expect(await priyaCard.getByText('Reminder every 30 min').isVisible(), '"Reminder every 30 min" on the card');
expect(/3 reminders sent/.test(await priyaCard.innerText()), 'Priya\'s proposal shows "3 reminders sent"');
expect(/Proposal draft/.test(await priyaCard.innerText()), 'card shows the source task');
expect(/Took|Time taken/.test(await priyaCard.innerText()), 'card shows time taken');
expect(
  /Arjun's 'Send proposal to Helios' is waiting on this/.test(await priyaCard.innerText()),
  'card shows the dependent PM task',
);
await checkPage(step);
await shot('overview-light', { fullPage: true });

// Approve Priya's proposal.
step = 'kabir:approve-priya';
await priyaCard.getByRole('button', { name: /^Approve/ }).click();
await page
  .getByTestId('approved-overlay')
  .first()
  .waitFor({ state: 'visible', timeout: 2000 })
  .then(
    () => ok('approve check animation shows'),
    () => fail(`[${step}] no approve check animation`),
  );
await toastSeen(/Arjun's 'Send proposal to Helios' is cleared to go/, 'approve proposal');
await page.waitForTimeout(1400);
expect((await waiting.locator('article').filter({ hasText: 'Priya Nair' }).count()) === 0, "Priya's card left the list");
const afterPriya = await withStore((store) => {
  const s = store.getState();
  const pt = s.pmTasks.find((p) => p.title === 'Send proposal to Helios');
  const review = s.reviewTasks.find(
    (r) =>
      r.reviewerId === 'p-kabir' &&
      s.tasks.find((t) => t.id === r.sourceTaskId)?.assigneeId === 'p-priya' &&
      s.tasks.find((t) => t.id === r.sourceTaskId)?.taskTypeId === 'tt-proposal' &&
      r.resolvedAt,
  );
  const notif = s.notifications.some(
    (n) => n.toPersonId === 'p-priya' && n.type === 'reviewApproved' && /Kabir approved/.test(n.text),
  );
  const pmNotif = s.notifications.some((n) => n.toPersonId === 'p-arjun' && n.type === 'dependencyCleared');
  return { dep: pt?.dependencyStatus, status: review?.status, notif, pmNotif };
});
expect(afterPriya.dep === 'cleared', `Arjun's dependency cleared in state (${afterPriya.dep})`);
expect(afterPriya.status === 'approved', 'review approved in state');
expect(afterPriya.notif, 'Priya gets "Kabir approved…" notification');
expect(afterPriya.pmNotif, 'Arjun gets a dependency-cleared notification');

// Send Neha's content piece back with a note (inline).
step = 'kabir:send-back-neha';
await nehaCard.getByRole('button', { name: 'Send back with note' }).click();
const noteBox = nehaCard.getByRole('textbox', { name: /Note for Neha/ });
expect(await noteBox.isVisible(), 'inline note field opens');
expect(await noteBox.evaluate((el) => el === document.activeElement), 'note field gets focus');
expect(
  await nehaCard.getByRole('button', { name: 'Send back', exact: true }).isDisabled(),
  'Send back disabled until a note is written',
);
await nehaCard.getByRole('button', { name: 'Cancel' }).click();
expect((await nehaCard.getByRole('textbox').count()) === 0, 'Cancel closes the inline note');
await nehaCard.getByRole('button', { name: 'Send back with note' }).click();
await nehaCard
  .getByRole('textbox', { name: /Note for Neha/ })
  .fill('Lovely piece! Could you add the customer quote before it goes out?');
expect(!(await nehaCard.getByRole('button', { name: 'Send back', exact: true }).isDisabled()), 'Send back enabled once a note is written');
await page.waitForTimeout(250);
await shot('overview-send-back-light');
await nehaCard.getByRole('button', { name: 'Send back', exact: true }).click();
await toastSeen(/Sent back to Neha with your note/, 'send back');
await page.waitForTimeout(700);
const afterNeha = await withStore((store) => {
  const s = store.getState();
  const pt = s.pmTasks.find((p) => p.title === 'Review & post content piece');
  const task = s.tasks.find((t) => t.id === pt?.linkedSourceTaskId);
  return { reviewStatus: task?.reviewStatus, note: task?.reviewNote, dep: pt?.dependencyStatus };
});
expect(afterNeha.reviewStatus === 'changesRequested', 'Neha\'s task is "changes requested"');
expect(/customer quote/.test(afterNeha.note ?? ''), 'note saved on the task');
expect(afterNeha.dep === 'waiting', "Meera's task keeps waiting after a send back");
expect(await main().getByText('All caught up ☀️').isVisible(), 'Waiting on you → "All caught up ☀️"');
await checkPage(step);
await shot('overview-all-caught-up-light');

// Fresh seed: approving Neha's content piece clears Meera's dependent task.
step = 'kabir:approve-neha';
await withStore((store) => {
  store.getState().resetDemo(); // the fresh seed opens as Asha
  store.getState().setCurrentUser('p-kabir');
});
await go('/overview');
expect(pathname() === '/overview', 'still on /overview after reset');
const nehaCard2 = main().getByTestId('waiting-on-you').locator('article').filter({ hasText: 'Neha Iyer' });
await nehaCard2.getByRole('button', { name: /^Approve/ }).click();
await toastSeen(/Meera's 'Review & post content piece' is cleared to go/, 'approve content piece');
await page.waitForTimeout(1300);
const meeraDep = await withStore(
  (store) => store.getState().pmTasks.find((p) => p.title === 'Review & post content piece')?.dependencyStatus,
);
expect(meeraDep === 'cleared', `Meera's dependency cleared in state (${meeraDep})`);

// Dark overview
step = 'kabir:overview-dark';
await setTheme('dark');
await checkPage(step);
await shot('overview-dark', { fullPage: true });
await setTheme('light');

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------
step = 'kabir:insights';
await nav('/insights');
expect((await page.getByRole('radio', { name: 'By Project' }).getAttribute('aria-checked')) === 'true', 'defaults to By Project');
await checkPage(step);

// By Person → Neha
step = 'insights:person';
await page.getByRole('radio', { name: 'By Person' }).click();
await page.waitForTimeout(300);
const people = await radioNames('Pick a person');
expect(people.length === 6 && isSorted(people), `person picker alphabetical: ${people.join(', ')}`);
expect(
  (await page.getByRole('radiogroup', { name: 'Pick a person' }).getByRole('radio', { checked: true }).count()) === 1,
  'one person at a time',
);
await page.getByRole('radio', { name: /Neha Iyer/ }).click();
await page.waitForTimeout(1200);
expect(
  new URL(page.url()).searchParams.get('tab') === 'person' && new URL(page.url()).searchParams.get('id') === 'p-neha',
  'URL has ?tab=person&id=p-neha',
);
expect(await main().getByText("Compared only with Neha's own history").isVisible(), 'own-history chip');
expect(
  await main()
    .getByText(/Own average \(\d+%\)/)
    .first()
    .isVisible(),
  '"Own average" reference in the legend',
);

// Week-5 dip: the 5th of 8 weeks is clearly the highest time vs standard.
const wowRows = main().getByTestId('wow-table').locator('tbody tr');
expect((await wowRows.count()) === 8, '8 weeks in the deltas table');
const pcts = await wowRows.evaluateAll((rows) =>
  rows.map((r) => Number(r.querySelectorAll('td')[0].textContent.replace('%', '')) || 0),
);
const max = Math.max(...pcts);
expect(pcts.indexOf(max) === 4 && max >= 125, `week-5 dip is the peak (${pcts.join(', ')})`);
const wowText = await main().getByTestId('wow-table').innerText();
expect(
  /pts? quicker/.test(wowText) && /pts? more time/.test(wowText),
  'deltas use kind wording ("pts quicker" / "pts more time")',
);
const dipRow = await wowRows.nth(4).innerText();
expect(/↗\s+\d+ pts more time/.test(dipRow), `week 5 row shows "↗ … more time" (${dipRow.replace(/\s+/g, ' ')})`);

// Note marker on hover.
const marker = main()
  .locator('[data-note-week]')
  .filter({ has: page.locator('circle') });
const outage = main().locator('g[role="button"][aria-label*="14 Sep"]');
expect((await outage.count()) === 1, 'note marker on the week of 14 Sep');
expect((await marker.count()) >= 3, `note markers on weeks with notes (${await marker.count()})`);
await outage.hover();
const pop = main().getByTestId('note-popover');
await pop.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
expect((await pop.count()) === 1 && /AI tool outage/.test(await pop.innerText()), 'hovering the marker reveals "AI tool outage"');
expect(/Wed 16 Sep/.test((await pop.count()) ? await pop.innerText() : ''), 'note popover shows the date');
await shot('insights-person-neha-hover-light', {
  fullPage: false,
  clip: await main()
    .locator('[data-testid="person-trend-chart"]')
    .boundingBox()
    .then((b) => ({ x: Math.max(0, b.x - 24), y: Math.max(0, b.y - 140), width: b.width + 48, height: b.height + 160 })),
});
await page.mouse.move(5, 5);
await page.waitForTimeout(250);
expect((await pop.count()) === 0, 'popover closes when the mouse leaves');

// Note marker on keyboard focus (Tab from the previous marker).
const prevMarker = main().locator('g[role="button"][aria-label*="31 Aug"]');
await prevMarker.focus();
await page.keyboard.press('Tab');
await page.waitForTimeout(200);
const focusedWeek = await page.evaluate(() => document.activeElement?.getAttribute('data-note-week'));
expect(focusedWeek === '2026-09-14' || /09-14$/.test(focusedWeek ?? ''), `Tab reaches the 14 Sep marker (${focusedWeek})`);
expect((await pop.count()) === 1 && /AI tool outage/.test(await pop.innerText()), 'keyboard focus reveals "AI tool outage"');
const described = await page.evaluate(() => {
  const id = document.activeElement?.getAttribute('aria-describedby');
  return id ? (document.getElementById(id)?.textContent ?? '') : '';
});
expect(/AI tool outage/.test(described), 'focused marker is aria-describedby the note');
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
expect((await pop.count()) === 0, 'Escape closes the note popover');
expect(
  /AI tool outage, rework on 30 messages/.test(await main().getByTestId('person-notes').innerText()),
  'notes listed under the chart',
);
expect((await chartCount()) >= 3, 'person view renders trend, rating mix and discipline charts');
expect(await main().getByText('Rating mix over time').isVisible(), 'rating mix chart');
expect(await main().getByText('Discipline trend').isVisible(), 'discipline chart');
await checkPage(step);
await shot('insights-person-neha-light', { fullPage: true });

// Ranges
step = 'insights:person-ranges';
await page.getByRole('radio', { name: '4 weeks' }).click();
await page.waitForTimeout(700);
expect((await wowRows.count()) === 4, '4 weeks → 4 rows');
expect(/last 4 weeks/.test(await main().getByTestId('range-hint').innerText()), 'hint says "last 4 weeks"');
await page.getByRole('radio', { name: 'This quarter' }).click();
await page.waitForTimeout(700);
const qRows = await wowRows.count();
const qHint = await main().getByTestId('range-hint').innerText();
expect(qRows >= 2 && qRows <= 8 && /this quarter so far/.test(qHint), `This quarter → ${qRows} weeks ("${qHint}")`);
expect(new URL(page.url()).searchParams.get('range') === 'quarter', 'range in the URL');
await checkPage(step);
await page.getByRole('radio', { name: '8 weeks' }).click();
await page.waitForTimeout(700);
expect((await wowRows.count()) === 8, 'back to 8 weeks');

// Keyboard on the person picker (arrow keys move one at a time).
step = 'insights:picker-keys';
await page.getByRole('radio', { name: /Neha Iyer/ }).focus();
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(900);
expect(new URL(page.url()).searchParams.get('id') === 'p-priya', 'ArrowRight moves to the next person (Priya)');

// By Project
step = 'insights:project';
await page.getByRole('radio', { name: 'By Project' }).click();
await page.waitForTimeout(600);
const projects = await radioNames('Pick a project');
expect(projects.length >= 3 && isSorted(projects), `project picker alphabetical: ${projects.join(' | ')}`);
for (const name of projects) {
  await page.getByRole('radiogroup', { name: 'Pick a project' }).getByRole('radio', { name }).click();
  await page.waitForTimeout(900);
  for (const range of ['4 weeks', 'This quarter', '8 weeks']) {
    await page.getByRole('radio', { name: range }).click();
    await page.waitForTimeout(450);
    const charts = await chartCount();
    if (charts < 6) fail(`[${step}] ${name} / ${range}: only ${charts} charts`);
  }
  for (const title of [
    'Messages vs weekly targets',
    'Companies researched',
    'Meetings booked',
    'Time vs standard for the project',
  ]) {
    if (!(await main().getByText(title, { exact: true }).first().isVisible())) fail(`[${step}] ${name}: missing "${title}"`);
  }
  await checkPage(`${step}:${name}`);
}
ok(`By Project renders for ${projects.length} projects × 3 ranges`);
await page
  .getByRole('radiogroup', { name: 'Pick a project' })
  .getByRole('radio', { name: /Northwind/ })
  .click();
await page.waitForTimeout(1200);
await shot('insights-project-light', { fullPage: true });

// By PM
step = 'insights:pm';
await page.getByRole('radio', { name: 'By PM' }).click();
await page.waitForTimeout(600);
const pms = await radioNames('Pick a project manager');
expect(pms.length === 2 && isSorted(pms), `PM picker alphabetical: ${pms.join(', ')}`);
for (const name of pms) {
  await page.getByRole('radiogroup', { name: 'Pick a project manager' }).getByRole('radio', { name }).click();
  await page.waitForTimeout(900);
  for (const range of ['4 weeks', 'This quarter', '8 weeks']) {
    await page.getByRole('radio', { name: range }).click();
    await page.waitForTimeout(450);
    if ((await chartCount()) < 3) fail(`[${step}] ${name} / ${range}: charts missing`);
  }
  const text = await main().innerText();
  for (const label of [
    'Projects managed',
    'On target',
    'Average review turnaround',
    'Standard-time adjustments',
    'Review turnaround',
  ]) {
    if (!text.includes(label)) fail(`[${step}] ${name}: missing "${label}"`);
  }
  if ((await main().getByTestId('pm-projects').locator('[role="img"]').count()) < 1)
    fail(`[${step}] ${name}: no project health rings`);
  await checkPage(`${step}:${name}`);
}
ok(`By PM renders for ${pms.length} PMs × 3 ranges`);
await page.getByRole('radiogroup', { name: 'Pick a project manager' }).getByRole('radio', { name: /Meera/ }).click();
await page.waitForTimeout(1200);
await shot('insights-pm-light', { fullPage: true });

// PM → project chip deep-links into the project view.
await main().getByTestId('pm-projects').getByRole('link').first().click();
await page.waitForTimeout(900);
expect(new URL(page.url()).searchParams.get('tab') === 'project', 'project chip on the PM view opens the project trends');

// Tab memory: going back to By Person keeps Priya.
await page.getByRole('radio', { name: 'By Person' }).click();
await page.waitForTimeout(600);
expect(new URL(page.url()).searchParams.get('id') === 'p-priya', 'tab switch remembers the last person');

// Deep link
step = 'insights:deeplink';
await go('/insights?tab=person&id=p-neha');
expect((await page.getByRole('radio', { name: /Neha Iyer/ }).getAttribute('aria-checked')) === 'true', 'deep link selects Neha');
await go('/insights?tab=pm&id=nope');
expect((await page.getByRole('radio', { name: 'By PM' }).getAttribute('aria-checked')) === 'true', 'deep link selects By PM');
expect(
  (await page.getByRole('radiogroup', { name: 'Pick a project manager' }).getByRole('radio', { checked: true }).count()) === 1,
  'unknown id falls back to the first PM',
);

// Dark insights
step = 'insights:dark';
await setTheme('dark');
await go('/insights?tab=person&id=p-neha');
await page.waitForTimeout(800);
await main().locator('g[role="button"][aria-label*="14 Sep"]').hover();
await page.waitForTimeout(300);
await checkPage(step);
await shot('insights-person-neha-dark', { fullPage: true });
await go('/insights?tab=project&id=pr-helios');
await page.waitForTimeout(800);
await shot('insights-project-dark', { fullPage: true });
await go('/insights?tab=pm&id=p-arjun');
await page.waitForTimeout(800);
await shot('insights-pm-dark', { fullPage: true });
await setTheme('light');

// ---------------------------------------------------------------------------
// Recognition
// ---------------------------------------------------------------------------
step = 'recognition';
await nav('/recognition');
expect(/Visible to management only/.test(await main().getByTestId('mgmt-only-banner').innerText()), 'management-only banner');
const table = main().getByTestId('recognition-table');
for (const period of ['Weekly', 'Monthly']) {
  await page.getByRole('radio', { name: period }).click();
  await page.waitForTimeout(400);
  const names = await table.locator('tbody th[scope="row"] span.block.font-semibold').allInnerTexts();
  expect(names.length === 6 && isSorted(names), `${period}: 6 people, alphabetical (${names.join(', ')})`);
  const body = await table.innerText();
  expect(!/(^|\s)#\d|\b(1st|2nd|3rd)\b/.test(body), `${period}: no rank numbers`);
  expect(/Eligible/.test(body), `${period}: tier chips`);
  expect(/own baseline/.test(body), `${period}: performance vs own baseline wording`);
  expect(
    (await table.locator('thead th').allTextContents())
      .join('|')
      .match(/Performance vs own baseline|Discipline score|Notes written|Suggested tier/g)?.length === 4,
    `${period}: all columns`,
  );
  const hint = await main().getByTestId('period-hint').innerText();
  expect(period === 'Weekly' ? /this week so far/.test(hint) : /last 4 weeks/.test(hint), `${period}: period hint "${hint}"`);
  await checkPage(`${step}:${period}`);
  await shot(`recognition-${period.toLowerCase()}-light`, { fullPage: true });
}
expect(/How the tier is suggested/.test(await main().getByTestId('tier-explainer').innerText()), 'tier explainer');
expect((await table.locator('button[aria-sort], th[aria-sort]').count()) === 0, 'no sortable columns');
const neha = await withStore((store) => {
  const s = store.getState();
  return s.people.find((p) => p.id === 'p-neha')?.name;
});
expect(!!neha, 'store reachable');
await setTheme('dark');
await checkPage('recognition:dark');
await shot('recognition-dark', { fullPage: true });
await setTheme('light');

// Tablet width
step = 'tablet';
await page.setViewportSize({ width: 768, height: 1024 });
for (const p of [
  '/overview',
  '/insights?tab=person&id=p-neha',
  '/insights?tab=project&id=pr-atlas',
  '/insights?tab=pm&id=p-meera',
  '/recognition',
]) {
  await go(p);
  await page.waitForTimeout(500);
  await checkPage(`${step}:${p}`);
}
await go('/insights?tab=person&id=p-neha');
await shot('tablet-insights-person', { fullPage: true });
await go('/overview');
await shot('tablet-overview', { fullPage: true });
await page.setViewportSize({ width: 1280, height: 900 });

// ---------------------------------------------------------------------------
// Anika: nothing waiting
// ---------------------------------------------------------------------------
await switchTo('Anika Bose', '/overview');
step = 'anika:overview';
expect(await main().getByText('All caught up ☀️').isVisible(), 'Anika: "All caught up ☀️"');
expect((await main().getByTestId('waiting-on-you').count()) === 0, 'Anika has no review cards');
await checkPage(step);
await shot('overview-anika-light', { fullPage: true });

// Reduced motion: overview + insights still render.
step = 'reduced-motion';
await page.emulateMedia({ reducedMotion: 'reduce' });
await go('/insights?tab=person&id=p-neha');
expect((await main().locator('g[role="button"][aria-label*="14 Sep"]').count()) === 1, 'markers render with reduced motion');
await page.emulateMedia({ reducedMotion: 'no-preference' });

await browser.close();

if (otherWarnings.size) console.log(`\nOther console warnings:\n${[...otherWarnings].map((w) => `  - ${w}`).join('\n')}`);
console.log(issues.length ? `\nCHECK FAILED — ${issues.length} issue(s)` : '\nCHECK PASSED');
process.exit(issues.length ? 1 : 0);
