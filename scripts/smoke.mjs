/**
 * Foundation smoke test: drives the real app in headless Chromium.
 *
 *   npx vite --port 5173 --strictPort &      # in another shell
 *   node scripts/smoke.mjs                   # BASE_URL=http://localhost:5173 by default
 *
 * For Asha (resource), Meera (PM) and Kabir (management) it switches person via the
 * "Viewing as" menu, checks the shell (sidebar nav for the role + top bar), clicks
 * every sidebar item, toggles dark mode, opens the notification panel and uses the
 * demo clock's "Jump to 2pm". It fails on console errors, page errors, forbidden
 * words in rendered copy, or horizontal page overflow.
 * Screenshots go to e2e/screenshots/foundation-*.png.
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

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'e2e', 'screenshots');
mkdirSync(OUT, { recursive: true });

const FORBIDDEN = /\b(late|failed|missed|behind|poor|flagged|overdue|rank|ranked|ranking|leaderboard|worst|top performer)\b/i;

const PEOPLE = [
  {
    id: 'p-asha',
    slug: 'asha',
    name: 'Asha Rao',
    home: '/my-day',
    nav: ['My Day', 'My Progress', 'Spotlight', 'Settings'],
  },
  {
    id: 'p-meera',
    slug: 'meera',
    name: 'Meera Kulkarni',
    home: '/pm',
    nav: ['Home', 'Projects', 'Plan the day', 'Reviews', 'Task library', 'Light days', 'Spotlight', 'Settings'],
  },
  {
    id: 'p-kabir',
    slug: 'kabir',
    name: 'Kabir Sen',
    home: '/overview',
    nav: ['Overview', 'Insights', 'Weekly feedback', 'Pick Spotlights', 'Recognition', 'Projects', 'Reviews', 'Spotlight', 'Settings'],
  },
];

const issues = [];
const otherWarnings = new Set();
const log = (...a) => console.log('·', ...a);
const fail = (msg) => {
  issues.push(msg);
  console.log('✗', msg);
};
let step = 'boot';

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

page.on('console', (msg) => {
  const type = msg.type();
  const text = msg.text();
  if (type === 'error') fail(`[${step}] console.error: ${text}`);
  else if (type === 'warning') {
    // React / router warnings are bugs; anything else is listed at the end for a human to judge.
    if (/Warning:|Maximum update depth|getSnapshot|act\(|Future Flag/.test(text)) fail(`[${step}] console.warn: ${text}`);
    else otherWarnings.add(text.slice(0, 200));
  }
});
page.on('pageerror', (err) => fail(`[${step}] pageerror: ${err.message}`));

const shot = (name) => page.screenshot({ path: path.join(OUT, `foundation-${name}.png`) });
const pathname = () => new URL(page.url()).pathname;

/** Waits for the routed page to settle: an h1 is visible and the 300ms skeleton is gone. */
async function settle() {
  await page.locator('main h1').first().waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(550);
}

/** Checks rendered copy and layout on the current screen. */
async function checkPage(label) {
  const text = await page.locator('body').innerText();
  const hit = text.match(FORBIDDEN);
  if (hit) fail(`[${label}] forbidden word in UI copy: "${hit[0]}"`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) fail(`[${label}] horizontal overflow of ${overflow}px`);
}

async function switchTo(person) {
  step = `switch:${person.slug}`;
  await page.locator('header button[aria-label^="Viewing as"]').click();
  await page.getByRole('menuitemradio', { name: new RegExp(person.name) }).click();
  await page.waitForURL((u) => u.pathname === person.home, { timeout: 5000 }).catch(() => {
    fail(`[${step}] expected ${person.home}, got ${pathname()}`);
  });
  await settle();
  const trigger = await page.locator('header button[aria-label^="Viewing as"]').getAttribute('aria-label');
  if (!trigger?.includes(person.name)) fail(`[${step}] viewing-as trigger says "${trigger}"`);
}

async function sidebarItems() {
  return page.$$eval('aside nav[aria-label="Main"] a', (links) =>
    links.map((a) => ({ href: a.getAttribute('href'), label: a.querySelector('span.truncate')?.textContent?.trim() ?? '' })),
  );
}

async function theme() {
  return page.evaluate(() => document.documentElement.dataset.theme ?? 'light');
}

async function openNotifications(name) {
  await page.locator('header button[aria-label^="Notifications"]').click();
  const panel = page.getByRole('dialog', { name: 'Notifications' });
  await panel.waitFor({ state: 'visible', timeout: 3000 });
  await page.waitForTimeout(400);
  await checkPage(`${step}:notifications`);
  await shot(name);
  const rows = await panel.locator('li').count();
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'hidden', timeout: 3000 });
  return rows;
}

async function jumpTo2pm(screenshotName) {
  await page.locator('header button[aria-label^="Demo clock"]').click();
  await page.getByRole('button', { name: 'Jump to 2pm' }).waitFor({ state: 'visible', timeout: 3000 });
  if (screenshotName) {
    await page.waitForTimeout(250);
    await shot(screenshotName);
  }
  await page.getByRole('button', { name: 'Jump to 2pm' }).click();
  await page.waitForTimeout(300);
  const label = await page.locator('header button[aria-label^="Demo clock"]').getAttribute('aria-label');
  if (!/2:0\d pm/.test(label ?? '')) fail(`[${step}] demo clock reads "${label}" after Jump to 2pm`);
}

// ---------------------------------------------------------------------------

step = 'boot';
await page.goto(`${BASE}/`);
await settle();
if (pathname() !== '/my-day') fail(`[boot] default viewer should land on /my-day, got ${pathname()}`);
await checkPage('boot');

for (const person of PEOPLE) {
  log(`— ${person.name}`);
  await switchTo(person);

  // Shell: top bar + sidebar for the role.
  step = `${person.slug}:shell`;
  for (const sel of ['header button[aria-label^="Demo clock"]', 'header button[aria-label^="Notifications"]', 'header button[aria-label="Anonymous lounge"]']) {
    if (!(await page.locator(sel).isVisible())) fail(`[${step}] missing top-bar control ${sel}`);
  }
  const items = await sidebarItems();
  const labels = items.map((i) => i.label);
  if (JSON.stringify(labels) !== JSON.stringify(person.nav))
    fail(`[${step}] sidebar ${JSON.stringify(labels)} != ${JSON.stringify(person.nav)}`);
  if (!(await page.getByText('Team Chat (replaces WhatsApp)').isVisible())) fail(`[${step}] coming-soon items missing`);
  if ((await theme()) !== 'light') fail(`[${step}] ${person.name} should start in light mode`);
  await shot(`${person.slug}-home-light`);

  // Every sidebar item.
  for (const item of items) {
    step = `${person.slug}:${item.href}`;
    await page.locator(`aside nav[aria-label="Main"] a[href="${item.href}"]`).click();
    await page.waitForURL((u) => u.pathname === item.href, { timeout: 5000 }).catch(() => {
      fail(`[${step}] expected ${item.href}, got ${pathname()}`);
    });
    await settle();
    await checkPage(step);
    const active = await page.locator(`aside nav[aria-label="Main"] a[href="${item.href}"]`).getAttribute('aria-current');
    if (active !== 'page') fail(`[${step}] nav item not marked current`);
    await shot(`${person.slug}-page${item.href.replace(/\//g, '-')}`);
  }

  // Back home, dark mode.
  step = `${person.slug}:dark`;
  await page.locator(`aside nav[aria-label="Main"] a[href="${person.home}"]`).click();
  await settle();
  await page.locator('header button[aria-label="Switch to dark mode"]').click();
  await page.waitForTimeout(400);
  if ((await theme()) !== 'dark') fail(`[${step}] theme did not switch to dark`);
  await checkPage(step);
  await shot(`${person.slug}-home-dark`);

  // Notifications, then the demo clock.
  step = `${person.slug}:notifications`;
  const before = await openNotifications(`${person.slug}-notifications-dark`);
  step = `${person.slug}:jump2pm`;
  await jumpTo2pm(person.slug === 'asha' ? 'demo-clock-menu-dark' : undefined);
  const after = await openNotifications(`${person.slug}-notifications-2pm`);
  log(`notifications: ${before} → ${after} after Jump to 2pm`);

  if (person.slug === 'kabir') {
    // Kabir goes back to light; Asha and Meera stay dark (saved per person).
    step = 'kabir:light';
    await page.locator('header button[aria-label="Switch to light mode"]').click();
    await page.waitForTimeout(300);
    if ((await theme()) !== 'light') fail(`[${step}] theme did not switch back to light`);
    await openNotifications('kabir-notifications-light');

    // The Viewing-as menu, in light mode.
    await page.locator('header button[aria-label^="Viewing as"]').click();
    await page.getByRole('menuitemradio').first().waitFor({ state: 'visible', timeout: 3000 });
    await page.waitForTimeout(250);
    await shot('viewing-as-menu-light');
    await page.keyboard.press('Escape');

    // "Mark all as read" clears the bell.
    step = 'kabir:mark-all-read';
    await page.locator('header button[aria-label^="Notifications"]').click();
    await page.getByRole('button', { name: 'Mark all as read' }).click();
    await page.keyboard.press('Escape');
    const bell = await page.locator('header button[aria-label^="Notifications"]').getAttribute('aria-label');
    if (bell !== 'Notifications') fail(`[${step}] bell still shows unread: "${bell}"`);
  }
}

// Per-person theme + persistence across a reload (hydration).
step = 'persist';
await switchTo(PEOPLE[0]);
if ((await theme()) !== 'dark') fail(`[${step}] Asha's dark mode was not remembered`);
await page.reload();
await settle();
if (pathname() !== '/my-day') fail(`[${step}] after reload expected /my-day, got ${pathname()}`);
const viewer = await page.locator('header button[aria-label^="Viewing as"]').getAttribute('aria-label');
if (!viewer?.includes('Asha Rao')) fail(`[${step}] viewer after reload: ${viewer}`);
if ((await theme()) !== 'dark') fail(`[${step}] dark mode lost after reload`);
const clock = await page.locator('header button[aria-label^="Demo clock"]').getAttribute('aria-label');
if (!/2:0\d pm/.test(clock ?? '')) fail(`[${step}] demo clock after reload: ${clock}`);

// Role guard: Asha can't open management pages; unknown paths go home.
step = 'guard';
for (const p of ['/overview', '/pm', '/does-not-exist']) {
  await page.goto(`${BASE}${p}`);
  await settle();
  if (pathname() !== '/my-day') fail(`[${step}] ${p} should redirect Asha to /my-day, got ${pathname()}`);
}

// End of day (exercises the auto-log path for a resource).
step = 'asha:end-of-day';
await page.locator('header button[aria-label^="Demo clock"]').click();
await page.getByRole('button', { name: 'Jump to end of day' }).click();
await page.waitForTimeout(500);
const eod = await page.locator('header button[aria-label^="Demo clock"]').getAttribute('aria-label');
if (!/6:0\d pm/.test(eod ?? '')) fail(`[${step}] demo clock reads "${eod}" after Jump to end of day`);
await shot('asha-end-of-day-dark');

// Mobile: drawer navigation at phone width.
step = 'mobile';
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/my-day`);
await settle();
await checkPage('mobile');
await shot('mobile-my-day');
await page.getByRole('button', { name: 'Open menu' }).click();
const drawer = page.getByRole('dialog', { name: 'Navigation' });
await drawer.waitFor({ state: 'visible', timeout: 3000 });
await page.waitForTimeout(400);
await shot('mobile-drawer');
await drawer.getByRole('link', { name: /My Progress/ }).click();
await page.waitForURL((u) => u.pathname === '/my-progress', { timeout: 5000 }).catch(() => fail(`[${step}] drawer link did not navigate`));
await drawer.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => fail(`[${step}] drawer did not close after navigating`));

// Resilience: unreadable or outdated saved data falls back to a fresh seed.
step = 'resilience';
await page.setViewportSize({ width: 1440, height: 900 });
for (const bad of ['{not json', JSON.stringify({ state: { tasks: 'nope' }, version: 0 }), JSON.stringify({ state: null, version: 999 })]) {
  await page.evaluate((v) => localStorage.setItem('ls-tracker-v1', v), bad);
  await page.goto(`${BASE}/`);
  await settle();
  if (pathname() !== '/my-day') fail(`[${step}] with saved data ${bad.slice(0, 30)} landed on ${pathname()}`);
  const items = await sidebarItems();
  if (items.length !== PEOPLE[0].nav.length) fail(`[${step}] sidebar did not render with saved data ${bad.slice(0, 30)}`);
}

await browser.close();

if (otherWarnings.size) console.log(`\nOther console warnings:\n${[...otherWarnings].map((w) => `  - ${w}`).join('\n')}`);
console.log(issues.length ? `\nSMOKE FAILED — ${issues.length} issue(s)` : '\nSMOKE PASSED');
process.exit(issues.length ? 1 : 0);
