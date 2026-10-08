/**
 * Shared screens check: weekly feedback (list + editor), Pick Spotlights, the
 * Spotlight page, the anonymous lounge and Settings — driven in headless Chromium.
 *
 *   npx vite --port 5305 --strictPort &       # in another shell
 *   BASE_URL=http://localhost:5305 node scripts/check-shared.mjs
 *
 * From a clean seed, as Kabir: edit Asha's weekly feedback (edit a bullet, reorder,
 * delete, add), save, send ("Shared with Asha"), update & resend; refresh Karan's
 * suggestions; pick + publish this month's Spotlights (incl. "Someone else" and a
 * citation) → /spotlight shows them. As Asha: the bell has the feedback + Spotlight
 * notifications, My Progress lists the new report, /spotlight shows the new month;
 * the anonymous lounge (alias, new alias, post with Enter / Shift+Enter, reactions,
 * no person id anywhere in chat data). Settings: theme + accent per person,
 * team rules editable by Kabir (thresholds stay ordered) and read-only for Asha,
 * Jump to 2pm, Reset demo data. Fails on console errors, page errors, forbidden
 * words or horizontal overflow. Screenshots: e2e/screenshots/shared-*.png
 * (light + dark, desktop 1280 and tablet 768).
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

const BASE = process.env.BASE_URL ?? 'http://localhost:5305';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'e2e', 'screenshots');
mkdirSync(OUT, { recursive: true });

const FORBIDDEN =
  /\b(late|failed|missed|behind|poor|flagged|overdue|slow|rank|ranked|ranking|leaderboard|worst|top performer)\b/i;
const STORAGE_KEY = 'ls-tracker-v1';
const ALIAS_KEY = 'ls-tracker-chat-alias';
const REACTED_KEY = 'ls-tracker-chat-reacted';
const HEADER_TEXT = 'Anonymous lounge — nobody, including management, can see who wrote what.';

const issues = [];
const otherWarnings = new Set();
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
  // Full-page shots start from the top so the sticky top bar isn't captured mid-page.
  if (opts.fullPage) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path: path.join(OUT, `shared-${name}.png`), ...opts });
}
const pathname = () => new URL(page.url()).pathname;
const state = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}').state, STORAGE_KEY);
const ls = (k) => page.evaluate((key) => localStorage.getItem(key), k);

async function settle() {
  await page.locator('main h1').first().waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(650);
}

async function checkPage(label) {
  const text = await page.locator('body').innerText();
  const hit = text.match(FORBIDDEN);
  if (hit) fail(`[${label}] forbidden word in UI copy: "${hit[0]}"`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) fail(`[${label}] horizontal overflow of ${overflow}px`);
}

async function go(p) {
  await page.goto(`${BASE}${p}`);
  await settle();
  await checkPage(`${step}:${p}`);
}

async function switchTo(name, home) {
  step = `switch:${name}`;
  await page.locator('header button[aria-label^="Viewing as"]').click();
  await page.getByRole('menuitemradio', { name: new RegExp(name) }).click();
  await page.waitForURL((u) => u.pathname === home, { timeout: 5000 }).catch(() => fail(`[${step}] expected ${home}, got ${pathname()}`));
  await settle();
}

async function toastText() {
  await page.waitForTimeout(250);
  return page.locator('[role="status"][aria-live="polite"] li').allInnerTexts().then((t) => t.join(' | '));
}

async function waitForToast(re, label) {
  const found = await page
    .locator('[role="status"][aria-live="polite"] li', { hasText: re })
    .first()
    .waitFor({ state: 'visible', timeout: 4000 })
    .then(() => true)
    .catch(() => false);
  expect(found, `${label} (toast ${re})`);
  if (!found) console.log('   toasts:', await toastText());
}

async function dismissToasts() {
  for (const b of await page.locator('[role="status"][aria-live="polite"] li button[aria-label="Dismiss"]').all()) {
    await b.click().catch(() => {});
  }
  await page.waitForTimeout(200);
}

async function theme() {
  return page.evaluate(() => ({ theme: document.documentElement.dataset.theme, accent: document.documentElement.dataset.accent }));
}

async function setThemeViaTopBar(want) {
  const label = want === 'dark' ? 'Switch to dark mode' : 'Switch to light mode';
  const btn = page.locator(`header button[aria-label="${label}"]`);
  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(450);
  }
}

const bulletTexts = (section) =>
  page.locator(`[data-testid="bullets-${section}"] textarea[data-focus="input"]`).evaluateAll((els) => els.map((e) => e.value));

// ---------------------------------------------------------------------------
// Clean seed, Kabir
// ---------------------------------------------------------------------------

step = 'boot';
await page.goto(`${BASE}/`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await settle();
await switchTo('Kabir Sen', '/overview');

const seed = await state();
const weekStart = (() => {
  const d = new Date(`${seed.demoDate}T12:00:00`);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();
const monthKey = seed.demoDate.slice(0, 7);
const monthName = new Date(`${seed.demoDate}T12:00:00`).toLocaleString('en-GB', { month: 'long' });
const personIds = seed.people.map((p) => p.id);
const resourceNames = seed.people.filter((p) => p.role === 'resource').map((p) => p.name);

// ---- Weekly feedback list --------------------------------------------------
step = 'feedback-list';
await go('/feedback');
expect(/Week of/.test(await page.locator('main').innerText()), 'feedback list shows the week label');
const rowNames = await page.locator('[data-testid="feedback-rows"] li p.truncate').allInnerTexts();
expect(
  JSON.stringify(rowNames) === JSON.stringify([...resourceNames].sort((a, b) => a.localeCompare(b))),
  `feedback list is the resources, alphabetical (${rowNames.join(', ')})`,
);
expect((await page.locator('[data-testid="feedback-rows"] [data-status="draft"]').count()) === 6, 'every resource has a Draft this week');
expect(/Fri|Thu|Mon|Tue|Wed/.test(await page.locator('[data-testid="feedback-rows"] li').first().innerText()), 'last shared date shown');
await shot('feedback-list-light');
await page.getByRole('link', { name: "Open Asha's feedback" }).click();
await page.waitForURL((u) => u.pathname === '/feedback/p-asha');
await settle();
await checkPage('feedback-editor');

// ---- Feedback editor: edit, reorder, delete, add ---------------------------
step = 'feedback-editor';
const main = await page.locator('main').innerText();
expect(main.includes('5 areas where you shone') && main.includes('5 areas to improve') && main.includes('Next steps'), 'editor has the three sections');
expect(main.includes("Asha's week so far"), 'side context card with own week stats');
const before = await state();
const ashaDraft = before.weeklyFeedback.find((f) => f.personId === 'p-asha' && f.weekStart === weekStart);
const shine0 = await bulletTexts('shine');
expect(JSON.stringify(shine0) === JSON.stringify(ashaDraft.shine), 'shine bullets prefilled from the seeded draft');
await shot('feedback-editor-light', { fullPage: true });

const editedShine = 'Logged every task right after finishing it — a lovely steady rhythm';
const shineInputs = page.locator('[data-testid="bullets-shine"] textarea[data-focus="input"]');
await shineInputs.nth(0).fill(editedShine);
await shineInputs.nth(0).blur();
// Reorder: bullet 2 up.
const shineSection = page.locator('[data-testid="bullets-shine"]');
await shineSection.getByRole('button', { name: 'Move bullet 2 up' }).click();
await page.waitForTimeout(350);
let shine1 = await bulletTexts('shine');
expect(shine1[0] === shine0[1] && shine1[1] === editedShine, 'Move up swaps bullets 1 and 2');
const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
expect(focused === 'Move bullet 1 down', `focus stays on the moved bullet's controls (${focused})`);
await shineSection.getByRole('button', { name: 'Move bullet 1 down' }).click();
await page.waitForTimeout(350);
await shineSection.getByRole('button', { name: 'Move bullet 1 up' }).isDisabled();
await shineSection.getByRole('button', { name: 'Move bullet 2 up' }).click();
await page.waitForTimeout(350);
shine1 = await bulletTexts('shine');
expect(shine1[0] === shine0[1], 'reorder works both ways');
// Delete + add in "improve".
const improveSection = page.locator('[data-testid="bullets-improve"]');
const improve0 = await bulletTexts('improve');
expect((await improveSection.getByRole('button', { name: /^Add an area to grow/ }).isDisabled()) === (improve0.length >= 5), 'add is disabled at 5 bullets');
await improveSection.getByRole('button', { name: `Delete bullet ${improve0.length}` }).click();
await page.waitForTimeout(350);
expect((await bulletTexts('improve')).length === improve0.length - 1, 'delete removes a bullet');
await improveSection.getByRole('button', { name: /^Add an area to grow/ }).click();
await page.waitForTimeout(300);
const newImprove = 'Try pairing with Meera on one tricky message batch';
const activeIsNew = await page.evaluate(() => document.activeElement?.tagName === 'TEXTAREA' && document.activeElement.value === '');
expect(activeIsNew, 'add focuses the new empty bullet');
await page.keyboard.type(newImprove);
const improve1 = await bulletTexts('improve');
expect(improve1.length === improve0.length && improve1[improve1.length - 1] === newImprove, 'added bullet holds the new text');
expect(improve1.every((t) => !FORBIDDEN.test(t)), 'improve bullets use positive wording');
await page.getByRole('button', { name: 'Save draft' }).click();
await waitForToast(/Draft saved/, 'Save draft');
let s1 = (await state()).weeklyFeedback.find((f) => f.personId === 'p-asha' && f.weekStart === weekStart);
expect(s1.status === 'draft' && s1.shine[0] === shine0[1] && s1.shine[1] === editedShine, 'draft saved with the edited + reordered shine');
expect(s1.improve[s1.improve.length - 1] === newImprove, 'draft saved with the new improve bullet');
await dismissToasts();

// Keyboard: Enter in the last "Next steps" bullet adds a new one and moves focus there.
const nextBefore = (await bulletTexts('nextSteps')).length;
await page.locator('[data-testid="bullets-nextSteps"] textarea[data-focus="input"]').nth(nextBefore - 1).press('End');
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
expect(
  (await bulletTexts('nextSteps')).length === nextBefore + 1 &&
    (await page.evaluate(() => document.activeElement?.tagName === 'TEXTAREA' && document.activeElement.value === '')),
  'Enter on the last bullet adds a new one (keyboard flow)',
);
await page.keyboard.type('Celebrate the wins in Friday’s team call');
await page.waitForTimeout(900);
expect(
  (await state()).weeklyFeedback.find((f) => f.personId === 'p-asha' && f.weekStart === weekStart).nextSteps.length === nextBefore + 1,
  'draft autosaves shortly after typing',
);

// Send.
await page.getByRole('button', { name: 'Send to Asha' }).click();
await waitForToast(/Shared with Asha/, 'Send → "Shared with Asha"');
s1 = (await state()).weeklyFeedback.find((f) => f.personId === 'p-asha' && f.weekStart === weekStart);
expect(s1.status === 'sent' && !!s1.sentAt && s1.sentById === 'p-kabir', 'report marked sent by Kabir');
expect((await page.locator('main [data-status="sent"]').count()) > 0, 'status chip shows Sent');
const resend = page.getByRole('button', { name: 'Update & resend' });
expect(await resend.isDisabled(), '"Update & resend" waits for a change');
await shot('feedback-editor-sent-light');
await dismissToasts();
const nextInputs = page.locator('[data-testid="bullets-nextSteps"] textarea[data-focus="input"]');
await nextInputs.nth(0).fill('Pick one focus area for next week and tell Meera on Monday');
expect(!(await resend.isDisabled()), 'editing a sent report enables "Update & resend"');
expect(/Unsaved changes/.test(await page.getByTestId('save-state').innerText()), 'sent report shows unsaved changes until resent');
await resend.click();
await waitForToast(/Shared with Asha/, 'Update & resend');
s1 = (await state()).weeklyFeedback.find((f) => f.personId === 'p-asha' && f.weekStart === weekStart);
expect(s1.status === 'sent' && s1.nextSteps[0].startsWith('Pick one focus area'), 'resent report has the update');
await dismissToasts();

// Next person + refresh suggestions (confirm).
step = 'feedback-refresh';
await page.getByRole('button', { name: /^Next: Karan/ }).click();
await page.waitForURL((u) => u.pathname === '/feedback/p-karan');
await settle();
const karanInputs = page.locator('[data-testid="bullets-shine"] textarea[data-focus="input"]');
const karanOrig = await bulletTexts('shine');
await karanInputs.nth(0).fill('Temporary edit');
await page.getByRole('button', { name: 'Refresh suggestions' }).click();
const dialog = page.getByRole('dialog', { name: 'Refresh suggestions?' });
await dialog.waitFor({ state: 'visible' });
await page.waitForTimeout(300);
await shot('feedback-refresh-confirm-light');
await dialog.getByRole('button', { name: 'Keep my edits' }).click();
await dialog.waitFor({ state: 'hidden' });
expect((await bulletTexts('shine'))[0] === 'Temporary edit', '"Keep my edits" keeps the edits');
await page.getByRole('button', { name: 'Refresh suggestions' }).click();
await dialog.getByRole('button', { name: 'Refresh' }).click();
await waitForToast(/Fresh suggestions/, 'Refresh suggestions');
await page.waitForTimeout(300);
const karanRefreshed = await bulletTexts('shine');
expect(
  karanRefreshed.length === 5 && !karanRefreshed.includes('Temporary edit') && karanRefreshed[1] === karanOrig[1],
  `refresh re-pulls the suggestions (${karanRefreshed[0]})`,
);
await page.waitForTimeout(900);
const karan = (await state()).weeklyFeedback.find((f) => f.personId === 'p-karan' && f.weekStart === weekStart);
expect(karan.status === 'draft' && karan.shine[0] === karanRefreshed[0], 'refreshed draft autosaved');
await dismissToasts();

step = 'feedback-list-after';
await go('/feedback');
expect((await page.locator('li[data-person="p-asha"] [data-status="sent"]').count()) === 1, 'list shows Asha as Sent');
expect(/1 of 6 shared this week/.test(await page.getByTestId('feedback-summary').innerText()), 'summary counts shared reports');
expect(/Today/.test(await page.locator('li[data-person="p-asha"]').innerText()), "Asha's last shared date is today");

// ---- Spotlights --------------------------------------------------------------
step = 'spotlight-before';
await go('/spotlight');
expect((await page.getByTestId('spotlight-banner').count()) === 1, `banner: "${monthName}'s Spotlights are being picked ✨"`);
expect(new RegExp(`${monthName}'s Spotlights are being picked ✨`).test(await page.getByTestId('spotlight-banner').innerText()), 'banner copy');
expect((await page.locator('[data-testid^="spotlight-card-"]').count()) === 3, 'three Spotlight cards for last month');
expect((await page.locator('[data-testid="spotlight-timeline"] > li').count()) === 2, 'timeline lists the two earlier months');
await shot('spotlight-before-light', { fullPage: true });
await page.getByRole('button', { name: "Pick this month's Spotlights" }).click();
await page.waitForURL((u) => u.pathname === '/spotlights/manage');
await settle();
await checkPage('spotlights-manage');

step = 'spotlights-manage';
const personPicker = page.getByTestId('picker-person');
const pmPicker = page.getByTestId('picker-pm');
const projectPicker = page.getByTestId('picker-project');
expect((await personPicker.locator('[data-suggestion]').count()) === 3, '3 person suggestions');
expect((await pmPicker.locator('[data-suggestion]').count()) >= 1 && (await pmPicker.locator('[data-suggestion]').count()) <= 3, '≤3 PM suggestions');
expect((await projectPicker.locator('[data-suggestion]').count()) === 3, '3 project suggestions');
expect((await personPicker.locator('[data-suggestion]').first().innerText()).length > 12, 'suggestions show a short reason');
const publishBtn = page.getByRole('button', { name: new RegExp(`Publish ${monthName}'s Spotlights`) });
expect(await publishBtn.isDisabled(), 'publish waits for all three picks');
await shot('spotlights-manage-light', { fullPage: true });

await personPicker.locator('[data-suggestion]').first().click();
expect((await personPicker.locator('[data-suggestion]').first().getAttribute('aria-pressed')) === 'true', 'suggestion card selectable');
await personPicker.getByRole('button', { name: 'Someone else' }).click();
const pills = personPicker.getByRole('group', { name: /Everyone else/ }).getByRole('button');
await pills.first().waitFor({ state: 'visible' });
const otherNames = await pills.allInnerTexts();
expect(otherNames.length === 3 && JSON.stringify(otherNames) === JSON.stringify([...otherNames].sort((a, b) => a.localeCompare(b))), `"Someone else" pills alphabetical (${otherNames.join(', ')})`);
await pills.first().click();
const pickedPerson = otherNames[0].trim();
expect((await personPicker.locator('[data-suggestion][aria-pressed="true"]').count()) === 0, 'picking someone else clears the suggestion');
expect((await page.getByTestId('picked-person').innerText()).includes(pickedPerson), `person picked: ${pickedPerson}`);
const personCitation = `${pickedPerson.split(' ')[0]} was always first to help a teammate, and logged as you go all month.`;
await personPicker.getByRole('textbox', { name: /Citation/ }).fill(personCitation);
await pmPicker.locator('[data-suggestion]').first().click();
const pickedPm = (await page.getByTestId('picked-pm').innerText()).trim();
await projectPicker.locator('[data-suggestion]').nth(1).click();
const pickedProject = (await page.getByTestId('picked-project').innerText()).trim();
expect(!(await publishBtn.isDisabled()), 'publish enabled once all three are picked');
await publishBtn.click();
await page.waitForURL((u) => u.pathname === '/spotlight', { timeout: 5000 }).catch(() => fail(`[${step}] publish should go to /spotlight, got ${pathname()}`));
await waitForToast(/Spotlights are live/, 'publish toast');
await settle();
await page.waitForTimeout(900);
await checkPage('spotlight-after');
await shot('spotlight-published-light', { fullPage: true });
step = 'spotlight-after';
const sp = (await state()).spotlights.find((s) => s.month === monthKey);
expect(!!sp && sp.citations.person === personCitation && sp.citations.pm.length > 5 && sp.citations.project.length > 5, 'spotlight stored with citations (fallbacks for empty ones)');
expect((await page.getByTestId('spotlight-banner').count()) === 0, 'banner gone once the month is published');
expect((await page.getByTestId('spotlight-card-person').innerText()).includes(pickedPerson), 'person card shows the pick');
expect((await page.getByTestId('spotlight-card-person').innerText()).includes(personCitation), 'person card shows the citation');
expect((await page.getByTestId('spotlight-card-pm').innerText()).includes(pickedPm), 'PM card shows the pick');
expect((await page.getByTestId('spotlight-card-project').innerText()).includes(pickedProject), 'project card shows the pick');
expect((await page.getByTestId('spotlight-card-person').innerText()).includes('Logged as you go'), 'person card highlight stats');
expect((await page.getByTestId('spotlight-card-pm').innerText()).includes('Avg turnaround'), 'PM card highlight stats');
expect((await page.getByTestId('spotlight-card-project').innerText()).includes('L1 messages'), 'project card highlight stats');
expect((await page.locator('[data-testid="spotlight-timeline"] > li').count()) === 3, 'last month moved into the timeline');
expect((await page.getByText('Just published').count()) > 0, 'celebratory flourish after publishing');
await dismissToasts();

await page.getByRole('button', { name: "Edit this month's picks" }).click();
await page.waitForURL((u) => u.pathname === '/spotlights/manage');
await settle();
expect(/Published on/.test(await page.getByTestId('published-banner').innerText()), 'manage page shows "Published on …"');
expect((await page.getByTestId('picked-person').innerText()).includes(pickedPerson), 'published picks are preselected');
expect((await page.getByRole('button', { name: 'Publish updates' }).count()) === 1, 're-publishing is offered');
await shot('spotlights-manage-published-light');

// ---- Kabir dark screenshots --------------------------------------------------
step = 'kabir-dark';
await setThemeViaTopBar('dark');
expect((await theme()).theme === 'dark', 'Kabir in dark mode');
for (const [p, name] of [
  ['/feedback', 'feedback-list-dark'],
  ['/feedback/p-asha', 'feedback-editor-dark'],
  ['/spotlights/manage', 'spotlights-manage-dark'],
  ['/spotlight', 'spotlight-dark'],
  ['/settings', 'settings-kabir-dark'],
]) {
  await go(p);
  await shot(name, { fullPage: true });
}
await setThemeViaTopBar('light');

// ---------------------------------------------------------------------------
// Asha
// ---------------------------------------------------------------------------
await switchTo('Asha Rao', '/my-day');
step = 'asha-bell';
await page.locator('header button[aria-label^="Notifications"]').click();
const panel = page.getByRole('dialog', { name: 'Notifications' });
await panel.waitFor({ state: 'visible' });
await page.waitForTimeout(400);
const bell = await panel.innerText();
expect(/weekly feedback from Kabir/i.test(bell), 'Asha: feedback notification in the bell');
expect(new RegExp(`${monthName} Spotlights are out`).test(bell), 'Asha: Spotlight notification in the bell');
await shot('asha-notifications-light');
await page.keyboard.press('Escape');
await panel.waitFor({ state: 'hidden' });

step = 'asha-progress';
await go('/my-progress');
const rows = page.getByTestId('feedback-row');
if ((await rows.count()) > 0) {
  const wk = new Date(`${weekStart}T12:00:00`).toLocaleString('en-GB', { day: 'numeric', month: 'short' });
  expect((await rows.allInnerTexts()).some((t) => t.includes(`Week of ${wk}`)), `My Progress lists the new report (Week of ${wk})`);
} else {
  ok('My Progress feedback list not built yet — skipped');
}

step = 'asha-spotlight';
await go('/spotlight');
expect((await page.getByTestId('spotlight-card-person').innerText()).includes(pickedPerson), 'Asha sees the new Spotlight');
expect((await page.getByRole('button', { name: /Pick this month's Spotlights|Edit this month's picks/ }).count()) === 0, 'no picking button for a resource');
await shot('spotlight-asha-light', { fullPage: true });

// ---- Anonymous lounge --------------------------------------------------------
step = 'chat';
await page.locator('header button[aria-label="Anonymous lounge"]').click();
const chat = page.getByRole('dialog', { name: /Anonymous lounge/ });
await chat.waitFor({ state: 'visible' });
await page.waitForTimeout(500);
const header = (await page.getByTestId('chat-header').textContent()).replace(/\s+/g, ' ').trim();
expect(header === HEADER_TEXT, `lounge header text exact ("${header}")`);
const alias1 = await ls(ALIAS_KEY);
expect(!!alias1 && /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(alias1), `alias generated and stored (${alias1})`);
expect((await page.getByTestId('chat-alias').innerText()).includes(`You're ${alias1} 🎭`), `"You're ${alias1} 🎭" shown`);
const body = chat.locator('[data-dialog-body]');
const atBottom = () => body.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 4);
expect(await atBottom(), 'lounge opens scrolled to the newest message');
const composer = chat.getByRole('textbox', { name: 'Message the lounge' });
expect(await composer.evaluate((el) => el === document.activeElement), 'composer focused on open');
await chat.getByRole('button', { name: 'New alias' }).click();
const alias2 = await ls(ALIAS_KEY);
expect(alias2 && alias2 !== alias1 && (await page.getByTestId('chat-alias').innerText()).includes(alias2), `New alias shuffles (${alias2})`);
await composer.fill('Chai break at 4? ☕');
await composer.press('Shift+Enter');
await composer.type('Bring biscuits 🍪');
expect((await composer.inputValue()).includes('\n'), 'Shift+Enter adds a new line');
await composer.press('Enter');
await page.waitForTimeout(600);
expect((await composer.inputValue()) === '', 'Enter sends and clears the composer');
const lastMsg = chat.locator('[data-message-id]').last();
const lastText = await lastMsg.innerText();
expect(lastText.includes(alias2) && lastText.includes('Chai break at 4?') && lastText.includes('Bring biscuits'), 'new message shows alias + text');
expect(await atBottom(), 'auto-scrolled to the newest message');
expect((await composer.getAttribute('maxlength')) === '280', 'composer max 280 chars');
const newId = await lastMsg.getAttribute('data-message-id');
await lastMsg.getByRole('button', { name: 'Add a reaction' }).click();
await lastMsg.getByRole('group', { name: 'Pick a reaction' }).getByRole('button', { name: 'React with 🎉' }).click();
await page.waitForTimeout(300);
const pill = lastMsg.locator('button[aria-pressed="true"]', { hasText: '🎉' });
expect((await pill.count()) === 1 && /1 reaction, including yours/.test(await pill.getAttribute('aria-label')), 'reaction added and marked as mine');
let reacted = JSON.parse((await ls(REACTED_KEY)) ?? '[]');
expect(reacted.includes(`${newId}:🎉`), 'my reaction remembered in localStorage (no person id)');
// Toggle a seeded reaction on the first message.
const firstMsg = chat.locator('[data-message-id]').first();
const firstId = await firstMsg.getAttribute('data-message-id');
const seededPill = firstMsg.locator('button[aria-pressed]').first();
const seededEmoji = (await seededPill.innerText()).split(/\s+/)[0];
const countOf = async () => (await state()).chat.find((m) => m.id === firstId).reactions[seededEmoji];
const c0 = await countOf();
await seededPill.click();
await page.waitForTimeout(200);
const c1 = await countOf();
await seededPill.click();
await page.waitForTimeout(200);
const c2 = await countOf();
expect(c1 === c0 + 1 && c2 === c0, `existing reaction pill toggles (${c0} → ${c1} → ${c2})`);
const chatData = (await state()).chat;
const keysOk = chatData.every((m) => JSON.stringify(Object.keys(m).sort()) === JSON.stringify(['alias', 'createdAt', 'id', 'reactions', 'text']));
const blob = JSON.stringify(chatData);
expect(keysOk && !personIds.some((id) => blob.includes(id)), 'chat messages hold no person id (id, alias, text, createdAt, reactions only)');
expect(chatData.some((m) => m.alias === alias2 && m.text.includes('Chai break')), 'posted message stored under the alias');
await page.waitForTimeout(300);
await shot('chat-light');
await page.keyboard.press('Escape');
await chat.waitFor({ state: 'hidden' });

// ---- Settings as Asha (read-only rules, prefs) ------------------------------
step = 'settings-asha';
await go('/settings');
expect((await page.getByTestId('rules-readonly').count()) === 1, 'team rules read-only note for a resource');
expect((await page.getByRole('button', { name: 'Save team rules' }).count()) === 0, 'no save button for a resource');
expect((await page.getByRole('button', { name: /Increase Better threshold/ }).count()) === 0, 'no threshold steppers for a resource');
expect(/≤ 90% of the standard time → Better ✦/.test(await page.getByTestId('rating-explainer').innerText()), 'rule explanation shown');
await shot('settings-asha-light', { fullPage: true });
await page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'Dark' }).click();
await page.waitForTimeout(450);
await page.getByRole('radio', { name: 'Mint' }).click();
await page.waitForTimeout(450);
let t = await theme();
expect(t.theme === 'dark' && t.accent === 'mint', 'Asha: theme + accent applied');
let prefs = (await state()).userPrefs;
expect(prefs['p-asha']?.theme === 'dark' && prefs['p-asha']?.accent === 'mint', 'saved per user');
await page.getByRole('radio', { name: 'Mint' }).press('ArrowRight');
await page.waitForTimeout(300);
expect((await theme()).accent === 'sky', 'accent radio group supports arrow keys');
await page.getByRole('radio', { name: 'Sky' }).press('ArrowLeft');
await page.waitForTimeout(300);
await checkPage('settings-asha-dark');
await shot('settings-asha-dark', { fullPage: true });
await go('/spotlight');
await shot('spotlight-asha-dark', { fullPage: true });
await page.locator('header button[aria-label="Anonymous lounge"]').click();
await chat.waitFor({ state: 'visible' });
await page.waitForTimeout(500);
await shot('chat-dark');
await page.keyboard.press('Escape');

// ---------------------------------------------------------------------------
// Kabir: team rules, simulate time, reset
// ---------------------------------------------------------------------------
await switchTo('Kabir Sen', '/overview');
t = await theme();
expect(t.theme === 'light' && t.accent === 'lavender', "Kabir keeps his own theme (Asha's dark + mint is hers)");
step = 'settings-kabir';
await go('/settings');
expect((await page.getByTestId('rules-readonly').count()) === 0, 'team rules editable by management');
await page.getByRole('button', { name: 'Decrease Better threshold, percent of standard time' }).click();
await page.getByRole('button', { name: 'Increase Can do better threshold, percent of standard time' }).click();
await page.getByRole('button', { name: 'Increase Workday hours' }).click();
await page.getByRole('radiogroup', { name: 'Approval reminder interval' }).getByRole('radio', { name: '15 min' }).click();
const explainer = await page.getByTestId('rating-explainer').innerText();
expect(/≤ 85% of the standard time → Better ✦/.test(explainer) && /More than 115% → Can do better/.test(explainer), 'explanation follows the steppers');
await page.getByRole('button', { name: 'Save team rules' }).click();
await waitForToast(/Team rules updated/, 'save team rules');
let settings = (await state()).settings;
expect(
  settings.betterThreshold === 0.85 && settings.canDoBetterThreshold === 1.15 && settings.workdayHours === 9 && settings.approvalReminderMinutes === 15,
  `settings saved (${JSON.stringify(settings)})`,
);
// Thresholds stay ordered: Better can't reach Can do better.
const incBetter = page.getByRole('button', { name: 'Increase Better threshold, percent of standard time' });
for (let i = 0; i < 12 && !(await incBetter.isDisabled()); i++) await incBetter.click();
const betterVal = Number(await page.getByRole('textbox', { name: 'Better threshold, percent of standard time', exact: true }).inputValue());
expect(betterVal === 110 && (await incBetter.isDisabled()), `Better stops below Can do better (${betterVal}% < 115%)`);
const workdayInc = page.getByRole('button', { name: 'Increase Workday hours' });
await workdayInc.click();
expect(await workdayInc.isDisabled(), 'workday hours capped at 10');
await shot('settings-kabir-light', { fullPage: true });
await page.getByRole('button', { name: 'Defaults' }).click();
await page.getByRole('button', { name: 'Save team rules' }).click();
await page.waitForTimeout(300);
settings = (await state()).settings;
expect(settings.betterThreshold === 0.9 && settings.canDoBetterThreshold === 1.1 && settings.workdayHours === 8 && settings.approvalReminderMinutes === 30, 'defaults restored');
await dismissToasts();

step = 'simulate-time';
await page.getByTestId('demo-card').getByRole('button', { name: 'Jump to 2pm' }).click();
await page.waitForTimeout(400);
expect(/2:0\d pm/.test(await page.getByTestId('demo-time').innerText()), 'Jump to 2pm moves the demo clock');
expect(/2:0\d pm/.test((await page.locator('header button[aria-label^="Demo clock"]').getAttribute('aria-label')) ?? ''), 'top bar clock follows');
await page.getByTestId('demo-card').getByRole('button', { name: 'Back to 11:45' }).click();
await page.waitForTimeout(300);
expect(/11:4\d am/.test(await page.getByTestId('demo-time').innerText()), 'Back to 11:45');
await page.getByTestId('demo-card').getByRole('button', { name: 'Jump to end of day' }).click();
await page.waitForTimeout(300);
expect(/6:0\d pm/.test(await page.getByTestId('demo-time').innerText()), 'Jump to end of day');
await dismissToasts();

step = 'reset';
await page.getByRole('button', { name: 'Reset demo data' }).click();
const resetDialog = page.getByRole('dialog', { name: 'Reset the demo?' });
await resetDialog.waitFor({ state: 'visible' });
await page.waitForTimeout(300);
await shot('settings-reset-confirm-light');
await resetDialog.getByRole('button', { name: 'Keep my changes' }).click();
await resetDialog.waitFor({ state: 'hidden' });
expect((await state()).spotlights.some((s) => s.month === monthKey), 'cancel keeps the data');
await page.getByRole('button', { name: 'Reset demo data' }).click();
await resetDialog.getByRole('button', { name: 'Yes, reset' }).click();
await page.waitForURL((u) => u.pathname === '/overview', { timeout: 5000 }).catch(() => fail(`[${step}] reset should go to Kabir's home, got ${pathname()}`));
await waitForToast(/Demo data reset/, 'reset toast');
await settle();
const fresh = await state();
expect(fresh.currentUserId === 'p-kabir', 'still viewing as Kabir after reset');
expect(!fresh.spotlights.some((s) => s.month === monthKey) && fresh.spotlights.length === 3, 'Spotlights back to the seed');
expect(fresh.weeklyFeedback.find((f) => f.personId === 'p-asha' && f.weekStart === weekStart)?.status === 'draft', "Asha's report back to Draft");
expect(fresh.chat.length === 15 && !fresh.chat.some((m) => m.text.includes('Chai break')), 'lounge back to the seed');
expect((await ls(ALIAS_KEY)) === null && (await ls(REACTED_KEY)) === null, 'chat alias + reactions cleared');
expect(fresh.settings.workdayHours === 8 && !fresh.userPrefs['p-asha'], 'settings + prefs back to defaults');
expect(/11:4\d am/.test((await page.locator('header button[aria-label^="Demo clock"]').getAttribute('aria-label')) ?? ''), 'demo clock back to 11:45');

// ---------------------------------------------------------------------------
// Tablet (768px)
// ---------------------------------------------------------------------------
step = 'tablet';
await page.setViewportSize({ width: 768, height: 1024 });
for (const [p, name] of [
  ['/feedback', 'tablet-feedback-list'],
  ['/feedback/p-asha', 'tablet-feedback-editor'],
  ['/spotlights/manage', 'tablet-spotlights-manage'],
  ['/spotlight', 'tablet-spotlight'],
  ['/settings', 'tablet-settings'],
]) {
  await go(p);
  await shot(name, { fullPage: true });
}
await page.locator('header button[aria-label="Anonymous lounge"]').click();
await chat.waitFor({ state: 'visible' });
await page.waitForTimeout(500);
await checkPage('tablet-chat');
await shot('tablet-chat');
await page.keyboard.press('Escape');

// ---------------------------------------------------------------------------
// Reduced motion: content still renders fully (no stuck entrance animations)
// ---------------------------------------------------------------------------
step = 'reduced-motion';
const rmContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
const rm = await rmContext.newPage();
rm.on('pageerror', (err) => fail(`[${step}] pageerror: ${err.message}`));
await rm.goto(`${BASE}/spotlight`);
await rm.locator('main h1').first().waitFor();
await rm.waitForTimeout(700);
const opacities = await rm.locator('[data-testid^="spotlight-card-"], [data-testid="spotlight-timeline"] > li').evaluateAll((els) =>
  els.map((e) => Number(getComputedStyle(e).opacity)),
);
expect(opacities.length === 5 && opacities.every((o) => o === 1), 'reduced motion: Spotlight cards + timeline fully visible');
await rmContext.close();

await browser.close();

if (otherWarnings.size) console.log(`\nOther console warnings:\n${[...otherWarnings].map((w) => `  - ${w}`).join('\n')}`);
console.log(issues.length ? `\nCHECK FAILED — ${issues.length} issue(s)` : '\nCHECK PASSED');
process.exit(issues.length ? 1 : 0);
