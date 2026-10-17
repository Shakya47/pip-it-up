#!/usr/bin/env node
// Real Safari, through safaridriver (W3C WebDriver). Playwright's WebKit is not Safari: it has no
// working video PiP, and real Safari does. This runs the flows/safari.md rows (SF) with a tiny
// WebDriver client (plain fetch, no dependencies).
//
//   node apps/e2e/scripts/safari.mjs        # macOS only
//
// One-time setup: `sudo safaridriver --enable` (it also turns on Develop → Allow Remote Automation).
// Starts the vanilla and react targets if nothing is listening on their ports. Safari runs headed
// (WebDriver sessions can't be headless) in an automation window; don't use Safari while it runs.
// Results: a table on stdout and test-results/safari.json. Exit code 1 if any row failed.
// In CI (or with E2E_KNOWN_BUGS=1) the rows in KNOWN_BUGS below are expected to fail, like
// lib/known-bugs.ts for the Playwright suite: they don't fail the run, but passing does ("fixed?").

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const E2E_ROOT = path.resolve(import.meta.dirname, '..');
const TARGETS = JSON.parse(fs.readFileSync(path.join(E2E_ROOT, 'lib', 'targets.json'), 'utf8'));
const DRIVER_PORT = 4445;
/** Safari rows that fail today because of a library bug (see flows/safari.md). */
const KNOWN_BUGS = {}; // e.g. { SF5: 'react.md RX8: …' } — SF5 fixed 2026-09-28
const knownBugsOn = !!(process.env.CI || process.env.E2E_KNOWN_BUGS);
const W3C_ELEMENT = 'element-6066-11e4-a52e-4f735466cecf';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const up = (url) => fetch(url).then((r) => r.ok, () => false);

async function until(fn, { timeout = 5000, interval = 150 } = {}) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    last = await fn();
    if (last) return last;
    await sleep(interval);
  }
  return last;
}

// ---------- servers ----------
const children = [];
async function ensureTarget(name) {
  const url = `http://localhost:${TARGETS[name].port}/`;
  if (await up(url)) return url;
  const child = spawn('node', [path.join(E2E_ROOT, 'scripts', 'dev-server.mjs'), name], { stdio: 'ignore' });
  children.push(child);
  if (!(await until(() => up(url), { timeout: 60_000, interval: 500 }))) throw new Error(`${name} dev server didn't start`);
  return url;
}

// ---------- a minimal WebDriver client ----------
const base = `http://localhost:${DRIVER_PORT}`;
async function wd(method, route, body) {
  const res = await fetch(`${base}${route}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${route}: ${json.value?.error ?? res.status}: ${json.value?.message ?? ''}`);
  return json.value;
}
let sid = '';
const s = (route) => `/session/${sid}${route}`;
/**
 * Load a route with a REAL navigation: targets read the hash once at load, and a hash-only change
 * doesn't reload the page, so every visit gets a unique query string before the hash.
 */
let visit = 0;
const go = async (url) => {
  const [page, hash = ''] = url.split('#');
  const target = `${page}${page.includes('?') ? '&' : '?'}visit=${++visit}${hash ? `#${hash}` : ''}`;
  // A freshly started dev server compiles on the first request; give a timed-out load one retry.
  try {
    return await wd('POST', s('/url'), { url: target });
  } catch (e) {
    if (!/timeout/.test(e.message)) throw e;
    return wd('POST', s('/url'), { url: target });
  }
};
const run = (script, ...args) => wd('POST', s('/execute/sync'), { script, args });
const runAsync = (script, ...args) => wd('POST', s('/execute/async'), { script, args });
/** Find a button (or link) by its exact visible text, in the current document. */
async function byText(tag, text) {
  const el = await until(() =>
    run(`return [...document.querySelectorAll(arguments[0])].find((e) => e.textContent.trim() === arguments[1]) || null;`, tag, text),
  );
  if (!el) throw new Error(`no <${tag}> with text "${text}"`);
  return el[W3C_ELEMENT] ?? el.ELEMENT; // Safari may answer with the legacy key
}
const click = (id) => wd('POST', s(`/element/${id}/click`), {});
const handles = () => wd('GET', s('/window/handles'));
const text = (selector) => run(`const e = document.querySelector(arguments[0]); return e ? e.textContent : null;`, selector);

// ---------- rows ----------
const rows = [];
async function row(id, scenario, fn) {
  // In CI a failing row gets one retry, like the Playwright suite's `retries`; a pass on retry is
  // reported as flaky (SF3/SF4 flaked once in six local runs, 2026-09-27).
  const attempts = knownBugsOn && !KNOWN_BUGS[id] ? 2 : 1;
  let firstError = '';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const note = await fn();
      rows.push(firstError ? { id, result: 'flaky', note: `passed on retry; first attempt: ${firstError}` } : { id, result: 'pass', note: note ?? '' });
      break;
    } catch (e) {
      firstError ||= e.message.split('\n')[0];
      if (attempt === attempts) rows.push({ id, result: 'fail', note: firstError });
    }
  }
  const mark = { pass: '✓', flaky: '~', fail: '✘' }[rows.at(-1).result];
  console.log(`${mark} ${id} ${scenario}${rows.at(-1).note ? ` — ${rows.at(-1).note}` : ''}`);
}
/** Key order doesn't matter (Safari serialises objects in its own order). */
const canonical = (v) => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x));
const expectEq = (actual, expected, what) => {
  if (canonical(actual) !== canonical(expected)) throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

// ---------- main ----------
if (process.platform !== 'darwin') {
  console.error('Real Safari needs macOS.');
  process.exit(1);
}
const stopAll = () => children.forEach((c) => c.kill('SIGTERM'));
process.on('exit', stopAll);

/**
 * Start safaridriver and wait for it to answer. Right after a previous run the old driver (and
 * Safari's automation session) can take a few seconds to go, and the new one then exits or never
 * answers: kill it, wait, and try again.
 */
async function startDriver(attempts = 3) {
  let why = '';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await until(() => fetch(`${base}/status`).then(() => false, () => true), { timeout: 10_000 });
    const driver = spawn('safaridriver', ['-p', String(DRIVER_PORT)], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    let exited = null;
    driver.stderr.on('data', (d) => (err += d));
    driver.on('exit', (code) => (exited = code));
    children.push(driver);
    const up = await until(
      async () => (exited !== null ? 'exited' : (await fetch(`${base}/status`).then((r) => r.ok, () => false)) ? 'up' : null),
      { timeout: 10_000 },
    );
    if (up === 'up') return;
    driver.kill('SIGTERM');
    why = `${exited === null ? 'no answer after 10 s' : `exited with code ${exited}`}${err.trim() ? `: ${err.trim()}` : ''}`;
    await sleep(3_000);
  }
  throw new Error(`safaridriver didn't start (${attempts} attempts; last: ${why}).`);
}

try {
  await startDriver();
  try {
    sid = (await wd('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'safari' } } })).sessionId;
  } catch (e) {
    throw new Error(`${e.message}\nOne-time setup: run \`sudo safaridriver --enable\`, then try again.`);
  }
  const vanilla = await ensureTarget('vanilla');
  const react = await ensureTarget('react');
  const version = (await wd('GET', `/session/${sid}`).catch(() => null))?.capabilities?.browserVersion ?? (await run('return navigator.userAgent;'));

  await row('SF1', 'capabilities: no Document PiP, no moveBefore, video PiP API present', async () => {
    await go(`${vanilla}#/basic`);
    const live = await run(`return {
      docPip: 'documentPictureInPicture' in window,
      moveBefore: typeof Element.prototype.moveBefore === 'function',
      videoPipApi: typeof HTMLVideoElement.prototype.requestPictureInPicture === 'function' && document.pictureInPictureEnabled === true,
      userActivation: 'userActivation' in navigator,
    };`);
    expectEq(live, { docPip: false, moveBefore: false, videoPipApi: true, userActivation: true }, 'feature detection');
    return JSON.stringify(live);
  });

  await row('SF2', 'no Document PiP, fallback none: "Open PiP" opens nothing', async () => {
    await go(`${vanilla}#/basic`);
    if (!(await until(() => run(`return !!document.querySelector('[role="log"]');`)))) throw new Error('the page did not render');
    // WebDriver can't read Safari's console: record warnings in the page, as SF4 does.
    await run(`window.__warns = []; const w = console.warn; console.warn = (...a) => { window.__warns.push(a.map(String).join(' ')); w(...a); };`);
    const before = (await handles()).length;
    await click(await byText('button', 'Open PiP'));
    // Positive signal first: open() reached the 'none' fallback (its warning), or reported the
    // failure through onError / a rejected open() in the log. Without it the checks below would
    // pass on a click that did nothing at all.
    const gaveUp = await until(() =>
      run(`return window.__warns.some((w) => w.includes('Document Picture-in-Picture is not supported'))
        || [...document.querySelectorAll('[role="log"] li')].some((l) => /^(error|reject):/.test(l.textContent));`),
    );
    if (!gaveUp) throw new Error(`open() never reached the 'none' fallback; warnings: ${JSON.stringify(await run('return window.__warns;'))}`);
    // No positive signal for "no window": hold the negative for 2 s (a fallback tab opens within a
    // few hundred ms in SF3), checking status and window count throughout.
    const stop = Date.now() + 2_000;
    do {
      expectEq(await text('[role="status"]'), 'PiP: closed', 'status');
      expectEq((await handles()).length, before, 'window count');
      await sleep(250);
    } while (Date.now() < stop);
  });

  await row('SF3', 'fallback=new-tab opens fallbackUrl in a new tab', async () => {
    await go(`${vanilla}#/basic?fallback=new-tab&fallbackUrl=/standalone`);
    const before = await handles();
    const opener = await wd('GET', s('/window'));
    let tab;
    try {
      await click(await byText('button', 'Open PiP'));
      const after = await until(async () => ((await handles()).length > before.length ? handles() : null));
      if (!after) throw new Error('no new tab');
      tab = after.find((h) => !before.includes(h));
      expectEq(await text('[role="status"]'), 'PiP: open', 'status');
      await wd('POST', s('/window'), { handle: tab });
      const url = await wd('GET', s('/url'));
      if (!url.endsWith('/standalone')) throw new Error(`tab opened at ${url}`);
      return url;
    } finally {
      // Whatever failed above: close the new tab and drive the opener again, so the next rows
      // (and this row's retry) don't run in the wrong window.
      if (tab) {
        await wd('POST', s('/window'), { handle: tab }).then(() => wd('DELETE', s('/window'))).catch(() => {});
      }
      await wd('POST', s('/window'), { handle: opener }).catch(() => {});
    }
  });

  await row('SF4', 'a single <video> enters REAL video PiP through the automatic video fallback', async () => {
    await go(`${vanilla}#/video`);
    // The hash route renders after load: wait for the <video> and the log before instrumenting them.
    if (!(await until(() => run(`return !!document.querySelector('video') && !!document.querySelector('[role="log"]');`)))) {
      throw new Error('the video page did not render');
    }
    // WebDriver can't read Safari's console: keep the page's warnings for the failure message.
    await run(`window.__warns = []; const w = console.warn; console.warn = (...a) => { window.__warns.push(a.map(String).join(' ')); w(...a); };
      // Timeline of the video's PiP events, relative to page load, for the failure message.
      window.__trace = []; const t0 = performance.now(); const v0 = document.querySelector('video');
      const mark = (e) => window.__trace.push(Math.round(performance.now() - t0) + 'ms ' + e + ' mode=' + v0.webkitPresentationMode + ' log=' + [...document.querySelectorAll('[role="log"] li')].map((l) => l.textContent).join('/'));
      for (const e of ['enterpictureinpicture', 'leavepictureinpicture', 'webkitpresentationmodechanged']) v0.addEventListener(e, () => mark(e));
      new MutationObserver(() => mark('log changed')).observe(document.querySelector('[role="log"]'), { childList: true });
      document.addEventListener('click', (e) => mark('click ' + e.target.textContent), true);`);
    await runAsync(`const done = arguments[arguments.length - 1];
      const v = document.querySelector('video'); v.play().then(() => done(true), () => done(false));`);
    await click(await byText('button', 'Open PiP'));
    const state = await until(() =>
      run(`const v = document.querySelector('video');
        const inPip = document.pictureInPictureElement === v || v.webkitPresentationMode === 'picture-in-picture';
        return inPip ? { status: document.querySelector('[role="status"]').textContent, log: [...document.querySelectorAll('[role="log"] li')].map((l) => l.textContent) } : null;`),
    );
    if (!state) {
      const detail = await run(`const v = document.querySelector('video'); return {
        warns: window.__warns, status: document.querySelector('[role="status"]').textContent,
        log: [...document.querySelectorAll('[role="log"] li')].map((l) => l.textContent),
        paused: v.paused, readyState: v.readyState, presentationMode: v.webkitPresentationMode };`);
      throw new Error(`the video did not enter PiP: ${JSON.stringify(detail)}`);
    }
    // The instance reports open once enterVideoPip() resolves; allow it a moment after PiP shows.
    const status = await until(() => run(`const t = document.querySelector('[role="status"]').textContent; return t === 'PiP: open' ? t : null;`));
    if (!status) {
      const warns = await run('return window.__warns;');
      throw new Error(`the video is in PiP but the instance never reported open (status "PiP: closed" after 5 s); log ${JSON.stringify(state.log)}; page warnings: ${JSON.stringify(warns)}`);
    }
    // Every open reports once: Safari fires enterpictureinpicture after the request resolved.
    const log = await run(`return [...document.querySelectorAll('[role="log"] li')].map((l) => l.textContent);`);
    if (JSON.stringify(log) !== JSON.stringify(['open'])) throw new Error(`log should be ["open"], got ${JSON.stringify(log)}`);
    // Safari drops WebDriver clicks while it is still animating the PiP entry: let it settle, and
    // check the click registered (the toggle's label flips back) before judging the exit.
    await sleep(1_500);
    await click(await byText('button', 'Close PiP'));
    if (!(await until(() => run(`return [...document.querySelectorAll('button')].some((b) => b.textContent === 'Open PiP');`)))) {
      await click(await byText('button', 'Close PiP')); // one more try if Safari swallowed it
    }
    // Safari animates PiP exit; allow 10 s.
    const out = await until(() => run(`const v = document.querySelector('video'); return document.pictureInPictureElement === null && v.webkitPresentationMode !== 'picture-in-picture';`), { timeout: 10_000 });
    if (!out) {
      const after = await run(`const v = document.querySelector('video'); return {
        status: document.querySelector('[role="status"]').textContent,
        log: [...document.querySelectorAll('[role="log"] li')].map((l) => l.textContent),
        pictureInPictureElement: document.pictureInPictureElement === v,
        presentationMode: v.webkitPresentationMode, warns: window.__warns, trace: window.__trace };`);
      throw new Error(`"Close PiP" did not exit video PiP: ${JSON.stringify(after)}`);
    }
    return state.log.join(',');
  });

  await row('SF5', 'React <PipTrigger renderUnsupported> shows its unsupported UI (react.md RX8)', async () => {
    await go(`${react}#/react-trigger`);
    // Wait for the unsupported UI (it renders after mount), then check the button is absent.
    const shown = !!(await until(() => run(`return document.body.innerText.includes('PiP unavailable');`)));
    const button = await run(`return [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Open unsupported demo');`);
    expectEq({ shown, button }, { shown: true, button: false }, 'renderUnsupported');
  });

  // `video-api` (video.md VP8–VP10): core's enterVideoPip / exitVideoPip (vanilla) and useVideoPip
  // (react) on a standalone video, in real video PiP.
  const standalone = `document.querySelector('video[aria-label="Standalone video"]')`;
  const videoInPip = () => run(`const v = ${standalone}; return document.pictureInPictureElement === v || v.webkitPresentationMode === 'picture-in-picture';`);
  const videoStatus = (on) => until(() => run(`return document.body.innerText.includes(arguments[0]);`, `Video PiP: ${on ? 'on' : 'off'}`));
  const videoOut = () => until(async () => !(await videoInPip()), { timeout: 10_000 }); // Safari animates the exit
  async function enterVideoApi(target) {
    await go(`${target}#/video-api`);
    const playing = await until(() => run(`const v = ${standalone}; return !!v && !v.paused && v.readyState >= 2;`));
    if (!playing) throw new Error(`${target}: the standalone video never played`);
    await click(await byText('button', 'Enter video PiP'));
    if (!(await until(videoInPip))) throw new Error(`${target}: "Enter video PiP" did not enter video PiP`);
    if (!(await videoStatus(true))) throw new Error(`${target}: in PiP, but the status never read "Video PiP: on"`);
    await sleep(1_500); // Safari drops input while it animates the PiP entry (see SF4)
  }

  await row('SF6', '"Enter video PiP" / "Exit video PiP" on a standalone video, vanilla and react (video.md VP8, VP9)', async () => {
    for (const target of [vanilla, react]) {
      await enterVideoApi(target);
      await click(await byText('button', 'Exit video PiP'));
      if (!(await videoOut())) throw new Error(`${target}: "Exit video PiP" did not leave video PiP`);
      if (!(await videoStatus(false))) throw new Error(`${target}: out of PiP, but the status never read "Video PiP: off"`);
    }
  });

  await row('SF7', "leaving video PiP from Safari's side updates the status, vanilla and react (video.md VP10)", async () => {
    for (const target of [vanilla, react]) {
      await enterVideoApi(target);
      await runAsync(`const done = arguments[arguments.length - 1]; document.exitPictureInPicture().then(() => done(true), () => done(false));`);
      if (!(await videoOut())) throw new Error(`${target}: exitPictureInPicture() did not leave video PiP`);
      if (!(await videoStatus(false))) throw new Error(`${target}: the status never followed the browser-side exit`);
    }
  });

  if (knownBugsOn) {
    for (const r of rows) {
      if (!KNOWN_BUGS[r.id]) continue;
      if (r.result === 'fail') Object.assign(r, { result: 'known-bug', note: `${KNOWN_BUGS[r.id]} (expected) — ${r.note}` });
      else Object.assign(r, { result: 'fail', note: `listed as a known bug (${KNOWN_BUGS[r.id]}) but PASSED: fixed? remove it from KNOWN_BUGS` });
    }
  }
  const failed = rows.filter((r) => r.result === 'fail').length;
  const out = { browser: 'safari', version, date: new Date().toISOString(), rows };
  fs.mkdirSync(path.join(E2E_ROOT, 'test-results'), { recursive: true });
  fs.writeFileSync(path.join(E2E_ROOT, 'test-results', 'safari.json'), JSON.stringify(out, null, 2));
  const known = rows.filter((r) => r.result === 'known-bug').length;
  const flaky = rows.filter((r) => r.result === 'flaky').length;
  console.log(`\nSafari ${version}: ${rows.length - failed - known - flaky} passed, ${failed} failed, ${flaky} flaky${known ? `, ${known} known bug(s)` : ''} · test-results/safari.json`);
  for (const r of rows.filter((x) => x.result !== 'pass')) console.log(`  ${r.result}: ${r.id} ${r.note}`);
  await wd('DELETE', `/session/${sid}`).catch(() => {});
  stopAll();
  process.exit(failed ? 1 : 0);
} catch (e) {
  console.error(e.message);
  if (sid) await wd('DELETE', `/session/${sid}`).catch(() => {});
  stopAll();
  process.exit(1);
}
