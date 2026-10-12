/**
 * Round 13 · sweep and integration check (R6 wording, R7 mascot, every persona on every route).
 *
 *   npx vite build --base ./ && npx vite preview --port 5720 --strictPort &
 *   node scripts/check-r13-sweep.mjs        # BASE_URL=http://localhost:5720/ by default
 *
 * Starts from clean demo data. For Udhaya, Bheeshma, Komala and Kingshuk it opens Dashboard, Tasks update, Projects,
 * Assign (when the nav shows it), People (when the nav shows it) and Profile, and fails on page errors, console errors,
 * em or en dashes in visible text or in title / aria-label / placeholder / alt attributes, and session wording.
 * Then it checks the mascot: on by default, clicks alternate a sarcastic quip and motivation, the Theme menu has a
 * "Show mascot" toggle that hides and shows him. Also checks a phone width for sideways scrolling.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5720/';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'e2e', 'screenshots');
mkdirSync(OUT, { recursive: true });

const issues = [];
let step = 'boot';
const ok = (m) => console.log('  ok  ', m);
const fail = (m) => { issues.push(`[${step}] ${m}`); console.log('  FAIL', `[${step}]`, m); };
const expect = (c, m) => (c ? ok(m) : fail(m));
const section = (s) => { step = s; console.log(`\n# ${s}`); };

const DASH = /[–—]/;
const SESSION = /\b(log ?in|log ?out|logged ?in|logged ?out|sign ?in|sign ?out|signed ?in|signed ?out)\b/i;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const page = await context.newPage();
page.on('pageerror', (e) => fail(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') fail(`console.error: ${m.text()}`); });

const shot = (name, full = false) => page.screenshot({ path: path.join(OUT, `r13-sweep-${name}.png`), fullPage: full });
const go = async (hash) => { await page.goto(`${BASE}#${hash}`); await page.waitForTimeout(400); };
const as = async (id) => {
  await page.selectOption('select[aria-label="Viewing as"]', id);
  await page.waitForTimeout(200);
};

/** Visible text and user-facing attributes must have no em/en dashes and no session wording. */
const checkWording = async (where) => {
  const text = await page.evaluate(() => document.body.innerText);
  const dash = text.split('\n').filter((l) => /[–—]/.test(l));
  expect(dash.length === 0, `${where}: no em or en dashes in visible text${dash.length ? ` (found: ${dash.slice(0, 3).join(' | ')})` : ''}`);
  const sess = text.split('\n').filter((l) => SESSION.test(l));
  expect(sess.length === 0, `${where}: no session wording${sess.length ? ` (found: ${sess.slice(0, 3).join(' | ')})` : ''}`);
  const attrs = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('[title],[aria-label],[placeholder],[alt]').forEach((el) => {
      ['title', 'aria-label', 'placeholder', 'alt'].forEach((a) => { const v = el.getAttribute(a); if (v && /[–—]/.test(v)) out.push(`${a}="${v}"`); });
    });
    return out;
  });
  expect(attrs.length === 0, `${where}: no dashes in title / aria-label / placeholder / alt${attrs.length ? ` (found: ${attrs.slice(0, 3).join(' | ')})` : ''}`);
};

section('boot');
await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(500);
expect(await page.locator('select[aria-label="Viewing as"]').count() === 1, 'app boots with the Viewing as picker');
const title = await page.title();
const desc = await page.locator('meta[name="description"]').getAttribute('content');
expect(!DASH.test(title) && !DASH.test(desc ?? ''), `index.html title and description have no dashes ("${title}")`);

const PERSONAS = ['udhaya', 'bheeshma', 'komala', 'kingshuk'];
const ROUTES = [['/', 'dashboard'], ['/daily', 'daily'], ['/projects', 'projects'], ['/assign', 'assign'], ['/people', 'people'], ['/profile', 'profile']];
for (const who of PERSONAS) {
  section(`persona ${who}`);
  await go('/');
  await as(who);
  const navHrefs = await page.locator('nav a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  for (const [hash, name] of ROUTES) {
    if ((name === 'assign' || name === 'people') && !navHrefs.includes(`#${hash}`)) { ok(`${name} not in nav for ${who}, skipped`); continue; }
    await go(hash);
    const at = await page.evaluate(() => location.hash);
    expect(at === `#${hash}`, `${who} ${name}: route stays on #${hash} (at ${at})`);
    const h = await page.evaluate(() => document.body.innerText.length);
    expect(h > 200, `${who} ${name}: page renders content`);
    expect(await page.getByText('Something went wrong').count() === 0, `${who} ${name}: no error boundary`);
    await checkWording(`${who} ${name}`);
    await shot(`${who}-${name}`, true);
  }
  if (who === 'bheeshma') {
    expect(navHrefs.includes('#/assign'), 'Bheeshma (owns a project) sees Assign');
    expect(!navHrefs.includes('#/people'), 'Bheeshma does not see People');
  }
  if (who === 'udhaya') expect(!navHrefs.includes('#/people'), 'Udhaya does not see People');
  if (who === 'komala' || who === 'kingshuk') expect(navHrefs.includes('#/assign') && navHrefs.includes('#/people'), `${who} sees Assign and People`);
}

section('project admin sees Assign');
{
  // Any persona who is an admin (not owner) of an active project must get the Assign tab.
  const admins = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('ls-tracker-v2') ?? '{}');
    const ps = raw.state?.projects ?? [];
    return ps.filter((p) => p.status === 'active').flatMap((p) => (p.admins ?? []).filter((a) => a !== p.pmId));
  });
  const candidate = admins.find((a) => ['prajwal', 'alok', 'abisho', 'bheeshma', 'udhaya', 'bharath', 'sachi'].includes(a));
  if (!candidate) ok('no non-owner project admin in the demo data, skipped');
  else {
    await go('/');
    await as(candidate);
    const hrefs = await page.locator('nav a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(hrefs.includes('#/assign'), `${candidate} (project admin) sees Assign`);
    await go('/assign');
    expect(await page.evaluate(() => location.hash) === '#/assign', `${candidate} can open Assign`);
    await checkWording(`${candidate} assign`);
  }
}

section('mascot');
await go('/');
await as('udhaya');
await go('/');
const mascot = page.getByTestId('mascot');
expect(await mascot.isVisible(), 'mascot is on by default');
const kinds = [];
const texts = [];
for (let i = 0; i < 6; i++) {
  await mascot.click({ force: true });
  await page.waitForTimeout(150);
  const bubble = page.getByTestId('mascot-line');
  kinds.push(await bubble.getAttribute('data-kind'));
  texts.push((await bubble.innerText()).replace(/\s+/g, ' '));
}
console.log('    lines:', texts.map((t, i) => `\n      ${kinds[i]}: ${t}`).join(''));
expect(kinds.join(',') === 'sarcastic,motivation,sarcastic,motivation,sarcastic,motivation', `clicks alternate sarcastic and motivation (${kinds.join(',')})`);
expect(new Set(texts).size === texts.length, 'six clicks give six different lines');
expect(texts.every((t) => !DASH.test(t)), 'mascot lines have no dashes');
expect(/open task|Zero open tasks/.test(texts[0]) || /targets/.test(texts.join(' ')), 'mascot quips are context aware (open tasks or targets)');
await shot('mascot-bubble');
await page.getByRole('button', { name: 'Theme' }).click();
await page.waitForTimeout(300);
const toggle = page.getByTestId('mascot-toggle');
expect(await page.getByText('Show mascot', { exact: true }).isVisible(), 'Theme menu has a "Show mascot" toggle');
expect(await toggle.isChecked(), 'Show mascot is ticked by default');
await checkWording('theme menu');
await shot('theme-menu');
await toggle.uncheck();
await page.waitForTimeout(200);
expect(await page.getByTestId('mascot').count() === 0, 'unticking hides the mascot');
await toggle.check();
await page.waitForTimeout(200);
expect(await page.getByTestId('mascot').count() === 1, 'ticking shows him again');
await page.keyboard.press('Escape');

section('mascot pops up on his own');
{
  const ctx2 = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx2.clock.install();
  const p2 = await ctx2.newPage();
  p2.on('pageerror', (e) => fail(`pageerror: ${e.message}`));
  await p2.goto(BASE);
  await p2.waitForTimeout(500);
  expect(await p2.getByTestId('mascot-line').count() === 0, 'no bubble right after opening the app');
  await p2.clock.fastForward(121_000);
  await p2.waitForTimeout(200);
  const kind = await p2.getByTestId('mascot-line').getAttribute('data-kind').catch(() => null);
  expect(kind === 'sarcastic' || kind === 'motivation', `periodic pop-up appears after 2 minutes (${kind})`);
  await p2.clock.fastForward(9_000);
  await p2.waitForTimeout(200);
  expect(await p2.getByTestId('mascot-line').count() === 0, 'the bubble hides itself again');
  await ctx2.close();
}

section('fun theme and dark');
await page.getByRole('button', { name: 'Theme' }).click();
await page.waitForTimeout(200);
await page.getByRole('button', { name: /Cartoon/ }).click();
await page.keyboard.press('Escape');
await go('/daily');
expect(await page.evaluate(() => document.documentElement.dataset.fun) === 'cartoon', 'Cartoon theme applies');
await checkWording('cartoon daily');
await shot('cartoon-daily');
await page.getByRole('button', { name: 'Theme' }).click();
await page.waitForTimeout(200);
await page.getByRole('button', { name: /Professional Dark/ }).click();
await page.keyboard.press('Escape');
await go('/');
expect(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'Professional Dark applies');
await shot('dark-dashboard');
await page.getByRole('button', { name: 'Theme' }).click();
await page.waitForTimeout(200);
await page.getByRole('button', { name: /^Professional The standard/ }).click();
await page.keyboard.press('Escape');

section('phone width');
await page.setViewportSize({ width: 420, height: 860 });
for (const [who, hash] of [['udhaya', '/'], ['udhaya', '/daily'], ['komala', '/daily'], ['bheeshma', '/projects']]) {
  await go('/');
  await as(who);
  await go(hash);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const header = await page.evaluate(() => { const h = document.querySelector('header'); return h ? h.scrollWidth - h.clientWidth : 0; });
  expect(header <= 0, `${who} ${hash}: header fits at 420px (overflow ${header}px)`);
  expect(over <= 0, `${who} ${hash}: no sideways scrolling at 420px (overflow ${over}px)`);
  await shot(`phone-${who}-${hash.replace(/\W/g, '') || 'dashboard'}`);
}

await browser.close();
console.log(issues.length ? `\n${issues.length} issue(s):\n${issues.join('\n')}` : '\nAll sweep checks passed.');
process.exit(issues.length ? 1 : 0);
