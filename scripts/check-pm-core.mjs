/**
 * PM core screens check: PM Home, Reviews, Adjust standard, Projects + detail.
 *
 *   npx vite --port 5402 --strictPort &      # in another shell
 *   node scripts/check-pm-core.mjs           # BASE_URL=http://localhost:5402 by default
 *
 * Starts from a clean seed, completes Asha's L1 task (through the store), then as Meera:
 * Team today, P1 nudge, pending reviews, adjust a "Can do better" task from PM Home and
 * from Reviews, approve + send back reviews, PM task checkbox, projects list + detail
 * filters. Checks Asha's bell for the approval and Kabir's reviews/projects.
 * Fails on console errors, page errors, forbidden words or horizontal overflow.
 * Screenshots (light + dark) go to e2e/screenshots/pm-core-*.png.
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

const BASE = process.env.BASE_URL ?? 'http://localhost:5402';
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
const expect = (cond, msg) => (cond ? ok(msg) : fail(msg));
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

async function shot(name, opts = {}) {
  // Full-page captures start from the top so the sticky top bar doesn't cover the header.
  if (opts.fullPage) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path: path.join(OUT, `pm-core-${name}.png`), ...opts });
}
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

// ---------------------------------------------------------------------------
// Clean seed, then Asha completes her L1 task (store action, as the resource).
// ---------------------------------------------------------------------------
step = 'boot';
await page.goto(`${BASE}/`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await settle();

step = 'asha:complete-l1';
const ashaL1 = await withStore((store) => {
  const s = store.getState();
  const t = s.tasks.find((x) => x.assigneeId === 'p-asha' && x.date === s.demoDate && x.taskTypeId === 'tt-msg-l1');
  const result = s.completeTask(t.id, { actualMinutes: 80, quantityDone: 30, note: 'Personalised the first lines for the CFOs' });
  return { id: t.id, title: t.title, result };
});
expect(ashaL1.result.reviewerName === 'Meera', `Asha completed "${ashaL1.title}" → ${ashaL1.result.rating}, sent to ${ashaL1.result.reviewerName}`);

// ---------------------------------------------------------------------------
// Meera — PM Home
// ---------------------------------------------------------------------------
await switchTo('Meera Kulkarni', '/pm');
step = 'meera:home';
await checkPage(step);
expect((await main().locator('h1').innerText()).includes('Meera'), 'greeting mentions Meera');

const teamNames = await main().locator('[data-team-card] h3').allInnerTexts();
log('Team today:', teamNames.join(', '));
expect(teamNames.includes('Asha Rao'), 'Team today includes Asha');
expect(JSON.stringify(teamNames) === JSON.stringify([...teamNames].sort((a, b) => a.localeCompare(b))), 'Team today is alphabetical');
const ashaCard = main().locator('[data-team-card="p-asha"]');
expect(/tasks done/.test(await ashaCard.innerText()), "Asha's card shows tasks done");
expect((await ashaCard.locator('[role="progressbar"]').count()) === 1, "Asha's card has a day progress line");
expect((await ashaCard.locator('[aria-label="Asha: no note today"]').count()) === 1, 'Asha has the muted "no note" icon');
expect((await ashaCard.locator('a[href="/plan?person=p-asha"]').count()) === 1, 'Plan link → /plan?person=p-asha');

// A light day today shows its reduced target on the team cards.
step = 'meera:light-day';
const ldId = await withStore((store) =>
  store.getState().addLightDay({ date: store.getState().demoDate, projectIds: 'all', reason: 'Team offsite – targets at 50%', adjustedTargetPercent: 50 }),
);
await page.waitForTimeout(250);
const ashaLine = await ashaCard.locator('[role="progressbar"]').getAttribute('aria-valuetext');
expect(/Light day target/.test(ashaLine ?? ''), `team card shows the light-day target (${ashaLine})`);
expect(/Light day · target 4h/.test(await ashaCard.innerText()), 'team card names the light day and its 4h target');
await ashaCard.screenshot({ path: path.join(OUT, 'pm-core-home-team-card-light-day.png') });
await withStore((store, id) => store.getState().removeLightDay(id), ldId);
await page.waitForTimeout(200);
expect(!/Light day target/.test((await ashaCard.locator('[role="progressbar"]').getAttribute('aria-valuetext')) ?? ''), 'light-day target gone once removed');

// The muted "no note" icon explains itself on focus.
step = 'meera:no-note';
await ashaCard.locator('[aria-label="Asha: no note today"]').hover();
await page.waitForTimeout(350);
expect(await page.getByRole('tooltip').filter({ hasText: 'No note today' }).first().isVisible().catch(() => false), '"No note today" tooltip on hover');
await page.mouse.move(5, 5);
step = 'meera:home';

// Rohan's daily note popover.
await main().getByRole('button', { name: "Read Rohan's note" }).click();
const noteDialog = page.getByRole('dialog', { name: /Rohan's note/ });
await noteDialog.waitFor({ state: 'visible', timeout: 3000 });
expect((await noteDialog.innerText()).includes('Client call ran long'), "Rohan's note opens in a popover");
await page.waitForTimeout(200);
await shot('home-note-popover');
await page.keyboard.press('Escape');

// P1 + nudge.
const p1 = main().locator('[data-attention="p1"]');
expect((await p1.count()) >= 1, `P1 items listed (${await p1.count()})`);
const rohanP1 = p1.filter({ hasText: 'Telecalling' });
expect((await rohanP1.count()) === 1, "Rohan's P1 telecalling is listed");
await rohanP1.getByRole('button', { name: /Nudge Rohan/ }).click();
await toastSeen(/Nudge noted — this only logs a note; Rohan isn't messaged/, 'nudge');
await page.waitForTimeout(120);
expect(await page.evaluate(() => !!document.activeElement?.closest('[data-attention="p1"]')), 'focus stays on the P1 item after nudging');
expect(/Nudged at \d{1,2}:\d{2} (am|pm)/.test(await rohanP1.innerText()), 'P1 item now shows "Nudged at …"');
const nudges = await withStore((store) => store.getState().nudges.length);
expect(nudges === 1, 'nudgeTask logged one nudge');

// Pending reviews.
const reviewCol = main().locator('[data-attention="review"]');
expect((await reviewCol.count()) === 3, 'top 3 pending reviews shown');
expect(await main().getByRole('link', { name: 'Open reviews (5)' }).isVisible(), 'pending reviews count is 5 (4 seeded + Asha)');

// "Can do better" → Adjust from PM Home (Asha's CRM clean-up, reason Rework).
const cdb = main().locator('[data-attention="cdb"]');
log('Can do better today:', (await cdb.allInnerTexts()).map((t) => t.split('\n')[0]).join(' | '));
expect((await cdb.count()) >= 2, `"Can do better" tasks listed (${await cdb.count()})`);
await shot('home-light', { fullPage: true });

step = 'meera:home-adjust';
const ashaCrm = cdb.filter({ hasText: 'CRM clean-up' }).filter({ hasText: 'Asha' });
await ashaCrm.getByRole('button', { name: /Adjust standard/ }).click();
let modal = page.getByRole('dialog', { name: /Adjust standard for today/ });
await modal.waitFor({ state: 'visible', timeout: 3000 });
await page.waitForTimeout(350);
const modalText = await modal.innerText();
expect(/Original standard\s*30m/.test(modalText) && /Actual time\s*35m/.test(modalText), 'modal shows original standard and actual time');
expect((await modal.getByRole('textbox', { name: /New standard/ }).inputValue()) === '35', 'new standard prefilled with the actual time');
await modal.getByRole('button', { name: 'Save adjustment' }).click();
expect(/Pick a reason first/.test(await modal.innerText()), 'reason is required');
await modal.getByRole('radio', { name: 'Rework' }).click();
expect((await modal.locator('[data-preview-rating="Optimal"]').count()) === 1, 'live preview shows Optimal');
await modal.getByRole('button', { name: 'Save adjustment' }).click();
await toastSeen(/Adjusted for today — now Optimal ✓/, 'adjust (home)');
await modal.waitFor({ state: 'hidden', timeout: 3000 });
await page.waitForTimeout(300);
expect(/Adjusted for today/.test(await ashaCrm.innerText()), 'PM Home item shows "Adjusted for today"');
expect((await ashaCrm.locator('[data-rating="Optimal"]').count()) === 1, 'PM Home item rating flipped to Optimal');
const lib = await withStore((store) => store.getState().taskTypes.find((t) => t.id === 'tt-crm').standardMinutesPerUnit);
expect(lib === 2, 'task library standard untouched (CRM still 2 min/record)');

// My tasks.
step = 'meera:my-tasks';
expect(await main().getByText('Waiting on Kabir').first().isVisible(), '"Waiting on Kabir" chip shown');
expect(await main().getByText('Cleared', { exact: true }).first().isVisible(), '"Cleared" chip shown');
const row = main().locator('tr', { hasText: 'Send weekly client report' });
await row.locator('label').click();
await page.waitForTimeout(250);
expect((await row.getAttribute('data-done')) === 'true', 'PM task checkbox ticks the task done');
await row.locator('label').click();
await page.waitForTimeout(250);
expect((await row.getAttribute('data-done')) === 'false', 'PM task checkbox unticks it again');

// 2 pm: the P1 reminder reaches the PM (never the resource) and shows on the P1 item.
step = 'meera:2pm';
await page.locator('header button[aria-label^="Demo clock"]').click();
await page.getByRole('button', { name: 'Jump to 2pm' }).click();
await page.waitForTimeout(500);
expect((await main().locator('[data-attention="p1"] [data-escalated="true"]').count()) >= 1, 'P1 items show the 2 pm reminder sent to the PM');
expect(/Reminder sent to you at 2:00 pm/.test(await rohanP1.innerText()), "Rohan's P1 shows 'Reminder sent to you at 2:00 pm'");
await checkPage(step);

// ---------------------------------------------------------------------------
// Meera — Reviews
// ---------------------------------------------------------------------------
step = 'meera:reviews';
await page.locator('aside nav[aria-label="Main"] a[href="/reviews"]').click();
await settle();
await checkPage(step);
let cards = main().locator('[data-review-card]');
expect((await cards.count()) === 5, `5 reviews pending (${await cards.count()})`);
const firstWaiting = await cards.first().innerText();
expect(/Waiting since yesterday/.test(firstWaiting), 'oldest review first (waiting since yesterday)');
expect(/\d+ reminders? sent/.test(await main().innerText()), 'reminders sent are shown');
await shot('reviews-light', { fullPage: true });

// Adjust Rohan's L1 (Can do better) from Reviews with "Tool outage".
step = 'meera:reviews-adjust';
const rohanCard = cards.filter({ hasText: 'Rohan Mehta' }).filter({ hasText: 'First-level message – 25 messages' });
expect((await rohanCard.locator('[data-rating="Can do better"]').count()) === 1, "Rohan's L1 starts as Can do better");
await rohanCard.getByRole('button', { name: 'Adjust standard for today' }).click();
modal = page.getByRole('dialog', { name: /Adjust standard for today/ });
await modal.waitFor({ state: 'visible', timeout: 3000 });
await page.waitForTimeout(350);
expect(/Original standard\s*1h 15m/.test(await modal.innerText()), "Rohan's original standard 1h 15m");
await modal.getByRole('radio', { name: 'Tool outage' }).click();
await page.waitForTimeout(250);
await shot('adjust-modal-light');
await modal.getByRole('button', { name: 'Save adjustment' }).click();
await toastSeen(/Adjusted for today — now Optimal ✓/, 'adjust (reviews)');
await page.waitForTimeout(400);
expect((await rohanCard.locator('[data-rating="Optimal"]').count()) === 1, "Rohan's rating flipped to Optimal");
expect(/Adjusted for today/.test(await rohanCard.innerText()), '"Adjusted for today" tag on the review card');
expect((await rohanCard.getByRole('button', { name: /Adjust standard/ }).count()) === 0, 'Adjust offer gone once Optimal');

// Approve Asha's L1.
step = 'meera:approve';
const ashaCard2 = cards.filter({ hasText: 'Asha Rao' }).filter({ hasText: 'First-level message – 30 messages' });
expect(/Personalised the first lines/.test(await ashaCard2.innerText()), "Asha's note is shown on the review");
await ashaCard2.getByRole('button', { name: 'Approve' }).click();
await page.waitForTimeout(250);
expect(await ashaCard2.getByText(/Approved — Asha will see it/).isVisible(), 'big check animation plays');
await shot('reviews-approving');
await toastSeen(/Approved ✓/, 'approve');
await page.waitForTimeout(1400);
expect((await cards.filter({ hasText: 'First-level message – 30 messages' }).count()) === 0, 'approved card collapsed away');

// Send back Karan's L1 with a note.
step = 'meera:send-back';
const karanCard = cards.filter({ hasText: 'Karan Desai' }).first();
const karanTaskId = await withStore((store) => {
  const s = store.getState();
  const r = s.reviewTasks.find((x) => x.reviewerId === 'p-meera' && x.status === 'pending' && s.tasks.find((t) => t.id === x.sourceTaskId)?.assigneeId === 'p-karan');
  return r?.sourceTaskId;
});
const ratingBefore = await withStore(
  (store, id) => {
    const s = store.getState();
    const t = s.tasks.find((x) => x.id === id);
    return `${t.actualMinutes}/${t.standardMinutes}/${JSON.stringify(t.dayAdjustment ?? null)}`;
  },
  karanTaskId,
);
await karanCard.getByRole('button', { name: 'Send back with note' }).click();
await karanCard.getByRole('button', { name: 'Send back', exact: true }).click();
expect(/Add a short note/.test(await karanCard.innerText()), 'a note is required to send back');
await karanCard.getByRole('textbox', { name: 'Note for Karan' }).fill('Lovely — could you add the case-study link to the last 5?');
await shot('reviews-send-back-form');
await karanCard.getByRole('button', { name: 'Send back', exact: true }).click();
await toastSeen(/Sent back with your note — Karan's rating stays as it is/, 'send back');
await page.waitForTimeout(900);
const karanAfter = await withStore(
  (store, id) => {
    const s = store.getState();
    const t = s.tasks.find((x) => x.id === id);
    return { status: t.reviewStatus, key: `${t.actualMinutes}/${t.standardMinutes}/${JSON.stringify(t.dayAdjustment ?? null)}` };
  },
  karanTaskId,
);
expect(karanAfter.status === 'changesRequested', "Karan's task is now 'Changes requested'");
expect(karanAfter.key === ratingBefore, "Karan's rating inputs unchanged by send-back");
cards = main().locator('[data-review-card]');
expect((await cards.count()) === 3, `3 reviews left (${await cards.count()})`);

// Reviewed today.
step = 'meera:reviewed-today';
await main().getByRole('button', { name: /Reviewed today/ }).click();
await page.waitForTimeout(450);
expect((await main().locator('[data-reviewed="approved"]').count()) >= 1, 'Reviewed today lists the approval');
expect((await main().locator('[data-reviewed="changesRequested"]').count()) >= 1, 'Reviewed today lists the send-back');
await checkPage(step);
await shot('reviews-after-light', { fullPage: true });
await setTheme('dark');
await checkPage(`${step}:dark`);
await shot('reviews-dark', { fullPage: true });
await rohanCard.getByRole('button', { name: 'Send back with note' }).click();
await page.waitForTimeout(200);
await shot('reviews-send-back-dark');
await rohanCard.getByRole('button', { name: 'Cancel' }).click();
await setTheme('light');

// ---------------------------------------------------------------------------
// Meera — Projects
// ---------------------------------------------------------------------------
step = 'meera:projects';
await page.locator('aside nav[aria-label="Main"] a[href="/projects"]').click();
await settle();
await checkPage(step);
let projectCards = main().locator('[data-project-card]');
expect((await projectCards.count()) === 2, `My projects shows Meera's 2 projects (${await projectCards.count()})`);
expect(await main().getByRole('link', { name: 'New project' }).isVisible(), 'New project button visible');
expect(await main().getByText('⏱ ~3 min').isVisible(), '"⏱ ~3 min" hint visible');
await shot('projects-light', { fullPage: true });
await main().getByRole('radio', { name: 'All projects' }).click();
await page.waitForTimeout(300);
expect((await main().locator('[data-project-card]').count()) === 3, 'All projects shows 3');
await setTheme('dark');
await checkPage(`${step}:dark`);
await shot('projects-dark', { fullPage: true });
await setTheme('light');
await main().getByRole('link', { name: 'New project' }).click();
await page.waitForURL((u) => u.pathname === '/projects/new', { timeout: 5000 }).catch(() => fail(`[${step}] New project did not open /projects/new`));
await page.goBack();
await settle();

// New projects appear in the list.
const newId = await withStore((store) =>
  store.getState().createProject({
    name: 'Orion Robotics – EU Expansion',
    client: 'Orion Robotics',
    geography: 'EU',
    startDate: store.getState().demoDate,
    targets: { companies: 60, weeklyMessagesL1: 200, weeklyMessagesL2: 100, weeklyMessagesL3: 50, meetingsTarget: 8 },
    tasks: [{ taskTypeId: 'tt-msg-l1', quantity: 30 }],
    resourceIds: ['p-asha', 'p-rohan'],
    pmId: 'p-meera',
  }),
);
await page.waitForTimeout(300);
expect((await main().locator(`[data-project-card="${newId}"]`).count()) === 1, 'newly created project appears in the list');
expect(/Just started/.test(await main().locator(`[data-project-card="${newId}"]`).innerText()), 'new project reads "Just started"');
await go(`/projects/${newId}`);
await checkPage('meera:new-project-detail');
expect(await main().getByText('The trend fills in as work is logged').isVisible(), 'new project: friendly empty trend');
await shot('project-detail-new', { fullPage: true });
await go('/projects');

// Project detail.
step = 'meera:project-detail';
await main().locator('[data-project-card="pr-northwind"]').click();
await page.waitForURL((u) => u.pathname === '/projects/pr-northwind', { timeout: 5000 });
await settle();
await checkPage(step);
expect((await main().locator('h1').innerText()).includes('Northwind'), 'detail header shows the project');
expect(await main().getByRole('link', { name: 'Plan the day' }).isVisible(), '"Plan the day" button for the PM');
const bars = await main().locator('[role="progressbar"]').count();
expect(bars >= 5, `targets vs achieved bars (${bars})`);
expect((await main().locator('.recharts-surface').count()) >= 2, 'weekly trend charts render');
const table = main().locator('[data-week-table]');
await page.waitForTimeout(900); // let the trend lines finish drawing
const allRows = await table.locator('[data-row-task]').count();
expect(allRows > 0, `this week's task table has rows (${allRows})`);
await shot('project-detail-light', { fullPage: true });

await main().getByRole('radiogroup', { name: 'Filter by person' }).getByRole('radio', { name: /Rohan/ }).click();
await page.waitForTimeout(250);
const personCells = await table.locator('[data-row-task]').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-person')));
expect(personCells.length > 0 && personCells.every((t) => t === 'p-rohan'), `person filter → only Rohan (${personCells.length} rows)`);
const rohanL1Row = table.locator('[data-row-task]', { hasText: 'First-level message – 25 messages' }).first();
expect(/Adjusted for today/.test(await rohanL1Row.innerText()), 'adjusted row shows "Adjusted for today" in the table');
await main().getByRole('radiogroup', { name: 'Filter by status' }).getByRole('radio', { name: 'Up next' }).click();
await page.waitForTimeout(250);
const statuses = await table.locator('[data-row-task]').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-status')));
expect(statuses.length > 0 && statuses.every((s) => s === 'upNext'), `status filter → only Up next (${statuses.length} rows)`);
await main().getByRole('radiogroup', { name: 'Filter by status' }).getByRole('radio', { name: 'Done' }).click();
await page.waitForTimeout(250);
const doneStatuses = await table.locator('[data-row-task]').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-status')));
expect(doneStatuses.length > 0 && doneStatuses.every((s) => s === 'done'), `status filter → only Done (${doneStatuses.length} rows)`);
await main().getByRole('radiogroup', { name: 'Filter by person' }).getByRole('radio', { name: 'Everyone' }).click();
await main().getByRole('radiogroup', { name: 'Filter by status' }).getByRole('radio', { name: 'All' }).click();
await page.waitForTimeout(250);
const adjustButtons = await table.getByRole('button', { name: /^Adjust standard for/ }).count();
log(`Adjust offers in the table: ${adjustButtons}`);
expect(
  (await main().locator('[data-plan-person="p-asha"]').getAttribute('href')) === '/plan?person=p-asha',
  "project PM can jump from a teammate to planning their day",
);

// Adjust from the week table: Rohan's Tuesday L1 ("Can do better") sits past the first 20 rows.
step = 'meera:table-adjust';
await main().getByRole('button', { name: /^Show all \d+ tasks$/ }).click();
await page.waitForTimeout(300);
const tueRow = table
  .locator('[data-row-task][data-person="p-rohan"]', { hasText: 'First-level message – 30 messages' })
  .filter({ has: page.locator('[data-rating="Can do better"]') })
  .first();
expect((await tueRow.count()) === 1, "Rohan's earlier-this-week L1 shows as Can do better");
const tueId = await tueRow.getAttribute('data-row-task');
await tueRow.getByRole('button', { name: /^Adjust standard for Rohan/ }).click();
modal = page.getByRole('dialog', { name: /Adjust standard for/ });
await modal.waitFor({ state: 'visible', timeout: 3000 });
await page.waitForTimeout(300);
await modal.getByRole('radio', { name: 'Client change' }).click();
await modal.getByRole('button', { name: 'Save adjustment' }).click();
await toastSeen(/Adjusted for the day — now Optimal ✓/, 'adjust (table)');
await page.waitForTimeout(400);
const tueAfter = table.locator(`[data-row-task="${tueId}"]`);
expect((await tueAfter.locator('[data-rating="Optimal"]').count()) === 1, 'table row rating flipped to Optimal');
expect(/Adjusted for the day/.test(await tueAfter.innerText()), 'table row shows the adjusted tag');
expect(
  await page.evaluate((id) => !!document.activeElement?.closest(`[data-row-task="${id}"]`), tueId),
  'focus lands on the adjusted row after saving',
);
await main().getByRole('button', { name: 'Show fewer' }).click();
step = 'meera:project-detail';
await setTheme('dark');
await checkPage(`${step}:dark`);
await shot('project-detail-dark', { fullPage: true });
await setTheme('light');

// Someone else's project: read-only for this PM (no planning, no adjusting).
step = 'meera:other-pm-project';
await go('/projects/pr-helios');
await checkPage(step);
expect((await main().getByRole('link', { name: 'Plan the day' }).count()) === 0, "no 'Plan the day' on another PM's project");
expect((await main().locator('[data-plan-person]').count()) === 0, "no plan links on another PM's project");
await main().getByRole('button', { name: /^Show all \d+ tasks$/ }).click();
expect((await main().getByRole('button', { name: /^Adjust standard for/ }).count()) === 0, "no Adjust on another PM's project");

step = 'meera:unknown-project';
await go('/projects/does-not-exist');
expect(await main().getByText("We couldn't find that project").isVisible(), 'unknown project → friendly empty state');
expect(await main().getByRole('link', { name: 'Back to projects' }).isVisible(), 'link back to projects');

// Dark PM Home + tablet widths.
step = 'meera:persist';
await go('/pm');
await page.reload();
await settle();
expect(/Nudged at/.test(await main().locator('[data-attention="p1"]', { hasText: 'Telecalling' }).innerText()), 'nudge survives a reload');
expect((await main().locator('[data-attention="cdb"] [data-adjusted]').count()) >= 2, 'adjustments survive a reload');
expect(await main().getByRole('link', { name: 'Open reviews (3)' }).isVisible(), 'resolved reviews stay resolved after a reload');

step = 'meera:home-dark';
await go('/pm');
await setTheme('dark');
await checkPage(step);
await shot('home-dark', { fullPage: true });
await setTheme('light');

step = 'tablet';
await page.setViewportSize({ width: 768, height: 1024 });
for (const p of ['/pm', '/reviews', '/projects', '/projects/pr-northwind']) {
  await go(p);
  await checkPage(`tablet${p}`);
}
await go('/pm');
await shot('home-tablet', { fullPage: true });
await go('/projects/pr-northwind');
await page.waitForTimeout(900);
await shot('project-detail-tablet', { fullPage: true });
await go('/reviews');
await shot('reviews-tablet', { fullPage: true });
await go('/projects');
await setTheme('dark');
await shot('projects-tablet-dark', { fullPage: true });
await go('/pm');
await shot('home-tablet-dark', { fullPage: true });
await go('/projects/pr-northwind');
await page.waitForTimeout(900);
await checkPage('tablet:detail-dark');
await shot('project-detail-tablet-dark', { fullPage: true });
await setTheme('light');
await page.setViewportSize({ width: 1280, height: 900 });

// ---------------------------------------------------------------------------
// Asha's bell has the approval; Kabir's reviews + projects.
// ---------------------------------------------------------------------------
await go('/pm');
await switchTo('Asha Rao', '/my-day');
step = 'asha:bell';
await page.locator('header button[aria-label^="Notifications"]').click();
const panel = page.getByRole('dialog', { name: 'Notifications' });
await panel.waitFor({ state: 'visible', timeout: 3000 });
await page.waitForTimeout(350);
expect(await panel.getByText('Meera approved your 30 L1 messages ✓').isVisible(), "Asha's bell: 'Meera approved your 30 L1 messages ✓'");
const ashaNudged = await panel.getByText(/nudge/i).count();
expect(ashaNudged === 0, 'Asha received no nudge notification');
await shot('asha-bell');
await page.keyboard.press('Escape');

await switchTo('Rohan Mehta', '/my-day');
step = 'rohan:bell';
await page.locator('header button[aria-label^="Notifications"]').click();
await page.getByRole('dialog', { name: 'Notifications' }).waitFor({ state: 'visible', timeout: 3000 });
expect((await page.getByRole('dialog', { name: 'Notifications' }).getByText(/nudge/i).count()) === 0, 'Rohan was not messaged about the nudge');
await page.keyboard.press('Escape');

await switchTo('Arjun Pillai', '/pm');
step = 'arjun:home';
await checkPage(step);
const arjunTeam = await main().locator('[data-team-card] h3').allInnerTexts();
expect(JSON.stringify(arjunTeam) === JSON.stringify(['Karan Desai', 'Neha Iyer', 'Priya Nair']), `Arjun's team today is his own, alphabetical (${arjunTeam.join(', ')})`);
expect(await main().getByRole('button', { name: "Read Priya's note" }).isVisible(), "Priya's note icon is active");

step = 'arjun:reviews-keyboard';
await page.locator('aside nav[aria-label="Main"] a[href="/reviews"]').click();
await settle();
let arjunCards = main().locator('[data-review-card]');
const arjunCount = await arjunCards.count();
expect(arjunCount === 4, `Arjun has 4 reviews (${arjunCount})`);
await arjunCards.first().getByRole('button', { name: 'Approve' }).focus();
for (let i = arjunCount; i > 0; i -= 1) {
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const where = await page.evaluate(() => {
    const a = document.activeElement;
    return { text: a?.textContent?.trim() ?? '', inCard: !!a?.closest('[data-review-card]'), toggle: a?.hasAttribute('data-reviewed-toggle') ?? false };
  });
  if (i > 1) expect(where.inCard && where.text === 'Approve', `keyboard: focus moves to the next review's Approve (${i - 1} left)`);
  else expect(where.toggle, 'keyboard: after the last review, focus moves to "Reviewed today"');
}
expect(await main().getByText('All caught up ☀️').isVisible(), 'Reviews empty state: All caught up ☀️');
await checkPage(step);
await shot('reviews-empty-light', { fullPage: true });

// PM Home empty "Needs your attention": nothing pending for Arjun (test-only data tweak).
step = 'arjun:home-empty';
await withStore((store) => {
  const s = store.getState();
  const mine = new Set(s.projects.filter((p) => p.pmId === 'p-arjun').map((p) => p.id));
  store.setState({
    tasks: s.tasks.map((t) => {
      if (t.date !== s.demoDate || !mine.has(t.projectId)) return t;
      if (t.status === 'done') return { ...t, actualMinutes: Math.min(t.actualMinutes ?? 0, t.standardMinutes) };
      return t.priority === 'P1' ? { ...t, priority: 'P2' } : t;
    }),
  });
});
await go('/pm');
const attention = main().locator('section[aria-labelledby="pm-attention"]');
expect(await attention.getByText('All caught up ☀️').isVisible(), 'PM Home empty state: All caught up ☀️');
await checkPage(step);
await attention.scrollIntoViewIfNeeded();
await shot('home-empty-attention');

await switchTo('Kabir Sen', '/overview');
step = 'kabir:reviews';
await go('/reviews');
await checkPage(step);
const kabirCards = await main().locator('[data-review-card]').count();
expect(kabirCards === 2, `Kabir sees his 2 reviews (${kabirCards})`);
await shot('reviews-kabir-light', { fullPage: true });
step = 'kabir:projects';
await go('/projects');
expect((await main().getByRole('radiogroup', { name: 'Which projects' }).count()) === 0, 'management sees no My/All toggle');
expect((await main().locator('[data-project-card]').count()) === 4, 'management sees every project (incl. the new one)');
await checkPage(step);

// Reduced motion: approving is instant (no celebration delay), nothing breaks.
step = 'reduced-motion';
{
  const rmContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const rm = await rmContext.newPage();
  rm.on('pageerror', (err) => fail(`[${step}] pageerror: ${err.message}`));
  rm.on('console', (msg) => msg.type() === 'error' && fail(`[${step}] console.error: ${msg.text()}`));
  await rm.goto(`${BASE}/`);
  await rm.evaluate(() => localStorage.clear());
  await rm.reload();
  await rm.locator('main h1').first().waitFor({ state: 'visible', timeout: 8000 });
  await rm.locator('header button[aria-label^="Viewing as"]').click();
  await rm.getByRole('menuitemradio', { name: /Meera Kulkarni/ }).click();
  await rm.waitForURL((u) => u.pathname === '/pm', { timeout: 5000 });
  await rm.locator('aside nav[aria-label="Main"] a[href="/reviews"]').click();
  await rm.locator('[data-review-card]').first().waitFor({ state: 'visible', timeout: 5000 });
  const before = await rm.locator('[data-review-card]').count();
  await rm.locator('[data-review-card]').first().getByRole('button', { name: 'Approve' }).click();
  await rm.waitForTimeout(350);
  const after = await rm.locator('[data-review-card]').count();
  expect(after === before - 1, `reduced motion: approve clears the card straight away (${before} → ${after})`);
  await rmContext.close();
}

// Spec §11 step 2 (first two bullets), straight after Asha's day: Asha logs her L1
// in the UI flow's place (store), jumps to end of day, then Meera sees her progress,
// the P1 escalation and the pending review, approves it and adjusts Rohan's L1.
step = 'walkthrough';
{
  const wtContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const wt = await wtContext.newPage();
  wt.on('pageerror', (err) => fail(`[${step}] pageerror: ${err.message}`));
  wt.on('console', (msg) => msg.type() === 'error' && fail(`[${step}] console.error: ${msg.text()}`));
  await wt.goto(`${BASE}/`);
  await wt.evaluate(() => localStorage.clear());
  await wt.reload();
  await wt.locator('main h1').first().waitFor({ state: 'visible', timeout: 8000 });
  await wt.evaluate(async () => {
    const { useApp } = await import('/src/store/index.ts');
    const s = useApp.getState();
    const t = s.tasks.find((x) => x.assigneeId === 'p-asha' && x.date === s.demoDate && x.taskTypeId === 'tt-msg-l1');
    s.completeTask(t.id, { actualMinutes: 75, quantityDone: 30 });
  });
  await wt.locator('header button[aria-label^="Demo clock"]').click();
  await wt.getByRole('button', { name: 'Jump to end of day' }).click();
  await wt.waitForTimeout(600);
  await wt.locator('header button[aria-label^="Viewing as"]').click();
  await wt.getByRole('menuitemradio', { name: /Meera Kulkarni/ }).click();
  await wt.waitForURL((u) => u.pathname === '/pm', { timeout: 5000 });
  await wt.locator('main h1').first().waitFor({ state: 'visible', timeout: 8000 });
  await wt.waitForTimeout(700);
  const wtMain = wt.locator('main');
  const ashaText = await wtMain.locator('[data-team-card="p-asha"]').innerText();
  expect(/\b8h( \d+m)? of 8h/.test(ashaText), `walkthrough: Asha's card shows her full day (${ashaText.split('\n').find((l) => /of 8h/.test(l))})`);
  const p1Text = await wtMain.locator('[data-attention="p1"]', { hasText: 'Rohan' }).innerText();
  expect(/Reminder sent to you at \d{1,2}:\d{2} (am|pm) · in-app \+ email/.test(p1Text), "walkthrough: Rohan's P1 escalation reached Meera");
  await wtMain.getByRole('link', { name: /^Open reviews/ }).click();
  await wt.waitForURL((u) => u.pathname === '/reviews', { timeout: 5000 });
  await wt.locator('[data-review-card]').first().waitFor({ state: 'visible', timeout: 5000 });
  const ashaReview = wtMain.locator('[data-review-card]', { hasText: 'Asha Rao' }).filter({ hasText: 'First-level message – 30 messages' });
  expect((await ashaReview.count()) === 1, "walkthrough: Asha's L1 review is waiting for Meera");
  await ashaReview.getByRole('button', { name: 'Approve' }).click();
  await wt.waitForTimeout(1500);
  expect((await ashaReview.count()) === 0, "walkthrough: Asha's review approved");
  const rohan = wtMain.locator('[data-review-card]', { hasText: 'Rohan Mehta' }).filter({ hasText: 'First-level message – 25 messages' });
  await rohan.getByRole('button', { name: 'Adjust standard for today' }).click();
  const wtModal = wt.getByRole('dialog', { name: /Adjust standard for today/ });
  await wtModal.waitFor({ state: 'visible', timeout: 3000 });
  await wtModal.getByRole('radio', { name: 'Tool outage' }).click();
  await wtModal.getByRole('button', { name: 'Save adjustment' }).click();
  await wt.waitForTimeout(500);
  expect((await rohan.locator('[data-rating="Optimal"]').count()) === 1 && /Adjusted for today/.test(await rohan.innerText()), 'walkthrough: Tool outage flips Rohan to Optimal');
  const text = await wt.locator('body').innerText();
  const hit = text.match(FORBIDDEN);
  expect(!hit, `walkthrough: no forbidden words${hit ? ` (found "${hit[0]}")` : ''}`);
  await wtContext.close();
}

await browser.close();

if (otherWarnings.size) console.log(`\nOther console warnings:\n${[...otherWarnings].map((w) => `  - ${w}`).join('\n')}`);
console.log(issues.length ? `\nPM CORE CHECK FAILED — ${issues.length} issue(s)` : '\nPM CORE CHECK PASSED');
process.exit(issues.length ? 1 : 0);
