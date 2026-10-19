#!/usr/bin/env node
// Turn the last test run into a bug report another agent can fix from.
// Ported from nexus apps/e2e/scripts/bug-report.mjs.
//
//   pnpm e2e:bug-report playground            # after a run of that area
//   pnpm e2e:bug-report playground --replace  # final report: also deletes this area's older reports
//
// Reads test-results/results.json (the JSON reporter) and writes:
//   reports/<area>-<YYYY-MM-DD-HHMM>.md                 the report, failures grouped by project
//   reports/<area>-<YYYY-MM-DD-HHMM>/<project>/<ID>/    evidence per failure: trace.zip,
//     screenshots, video, page snapshot, watchdog, dev-server log, and text dumps of the trace
//     (errors, failed requests, console, actions)
// test-results/ and playwright-report/ are wiped on every run; reports/ is not (it's gitignored).
//
// The report leaves "Classification", "Suspected cause", "Suggested fix", "Invariants",
// "Parallel paths" and "Docs to update" for the agent to fill in from the evidence, the code,
// specs/MAINTENANCE_GUIDE.md (the architecture contract) and CONTRIBUTING.md's security checklist.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const E2E_ROOT = path.resolve(import.meta.dirname, '..');
const REPO_ROOT = path.resolve(E2E_ROOT, '../..');
const RESULTS = process.env.E2E_RESULTS || path.join(E2E_ROOT, 'test-results', 'results.json');
const FLOWS = path.join(E2E_ROOT, 'flows');

const args = process.argv.slice(2);
const replace = args.includes('--replace');
const area = (args.find((a) => !a.startsWith('--')) || 'run').replace(/[^a-z0-9-]/gi, '-');
if (!fs.existsSync(RESULTS)) {
  console.error(`No ${path.relative(REPO_ROOT, RESULTS)}. Run the tests first.`);
  process.exit(1);
}

const run = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
const name = `${area}-${stamp}`;
const reportDir = path.join(E2E_ROOT, 'reports');
const evidenceDir = path.join(reportDir, name);
fs.mkdirSync(evidenceDir, { recursive: true });

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
const clean = (text = '') => String(text).replace(ANSI, '');
const rel = (p) => path.relative(REPO_ROOT, p);
const cut = (text, maxLines) => {
  const lines = clean(text).trimEnd().split('\n');
  return lines.length > maxLines
    ? [...lines.slice(0, maxLines), `... ${lines.length - maxLines} more lines (full text in the evidence folder)`].join('\n')
    : lines.join('\n');
};
const fence = (text, lang = '') => '```' + lang + '\n' + text.replace(/```/g, '``​`') + '\n```';

// ---------- flow rows, so each failure shows what was expected ----------
// Row format: | ID | Scenario | Expect | Targets | Needs | Status |
const flowRows = new Map();
const flowNotes = new Map();
if (fs.existsSync(FLOWS)) {
  for (const file of fs.readdirSync(FLOWS).filter((f) => f.endsWith('.md') && !f.startsWith('_') && f !== 'README.md')) {
    const text = fs.readFileSync(path.join(FLOWS, file), 'utf8');
    const [rowsPart, notesPart = ''] = text.split(/^## Notes$/m);
    for (const line of rowsPart.split('\n')) {
      const cells = line.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim());
      if (cells.length === 6 && /^[A-Z]+\d+$/.test(cells[0])) {
        flowRows.set(cells[0], { file, scenario: cells[1], expect: cells[2], targets: cells[3], needs: cells[4], status: cells[5] });
      }
    }
    flowNotes.set(file, notesPart.split('\n').filter((l) => l.trim().startsWith('-') || /^\s+\d+\./.test(l)));
  }
}
const notesFor = (id, file) => (flowNotes.get(file) ?? []).filter((l) => new RegExp(`\\b${id}\\b`).test(l)).slice(0, 6);

// ---------- walk the results ----------
const tests = [];
(function walk(suites, fileHint) {
  for (const suite of suites ?? []) {
    const file = suite.file ?? fileHint;
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const results = t.results ?? [];
        tests.push({
          title: spec.title,
          id: spec.title.match(/^([A-Z]+\d+)\b/)?.[1] ?? null,
          file: spec.file ?? file,
          line: spec.line,
          project: t.projectName,
          outcome: t.status, // expected | unexpected | flaky | skipped
          last: results[results.length - 1] ?? {},
          results,
          annotations: t.annotations ?? [],
        });
      }
    }
    walk(suite.suites, file);
  }
})(run.suites);

const byOutcome = (o) => tests.filter((t) => t.outcome === o);
const failures = byOutcome('unexpected');
const flaky = byOutcome('flaky');
const skipped = byOutcome('skipped');
const passed = byOutcome('expected');
const projects = [...new Set(tests.map((t) => t.project))].sort();

const attachmentBody = (a) =>
  a.body ? Buffer.from(a.body, 'base64').toString('utf8') : a.path && fs.existsSync(a.path) ? fs.readFileSync(a.path, 'utf8') : '';

// ---------- trace dumps via `playwright trace` ----------
function traceDump(zip, outDir) {
  const pw = (...a) => spawnSync('pnpm', ['exec', 'playwright', 'trace', ...a], { cwd: E2E_ROOT, encoding: 'utf8', timeout: 60_000 });
  if (pw('open', zip).status !== 0) return null;
  const dumps = {};
  for (const [key, a] of [
    ['errors', ['errors']],
    ['failed-requests', ['requests', '--failed']],
    ['console', ['console']],
    ['actions', ['actions']],
  ]) {
    const out = pw(...a);
    dumps[key] = clean((out.stdout || '') + (out.stderr || '')).trim();
    fs.writeFileSync(path.join(outDir, `trace-${key}.txt`), dumps[key] + '\n');
  }
  pw('close');
  return dumps;
}

// Keep only error and warning entries from `playwright trace console`, deduplicated.
function consoleErrorsAndWarnings(text) {
  const entries = [];
  for (const line of text.split('\n')) {
    if (/^\s*\d+:\d+\.\d+\s/.test(line)) entries.push([line]);
    else if (entries.length) entries[entries.length - 1].push(line);
  }
  const counts = new Map();
  for (const entry of entries) {
    if (!/\]\s+(error|warning|warn)\s/.test(entry[0])) continue;
    const body = entry.map((l) => l.replace(/^\s*\d+:\d+\.\d+\s+/, '')).join('\n').trim();
    counts.set(body, (counts.get(body) ?? 0) + 1);
  }
  return [...counts].map(([body, n]) => (n > 1 ? `${n}× ${body}` : body)).join('\n');
}

// ---------- one section per failure ----------
function failureSection(t, index) {
  const folder = path.join(evidenceDir, t.project, t.id ?? `test-${index + 1}`);
  fs.mkdirSync(folder, { recursive: true });
  const r = t.last;
  const files = [];
  let watchdog = '';
  let serverLog = '';
  let pageSnapshot = '';
  let trace = null;

  for (const a of r.attachments ?? []) {
    if (a.path && fs.existsSync(a.path)) {
      const target = path.join(folder, path.basename(a.path));
      fs.copyFileSync(a.path, target);
      files.push(target);
      if (a.name === 'trace') trace = target;
      if (a.name === 'error-context') pageSnapshot = fs.readFileSync(target, 'utf8');
    } else if (a.body) {
      const body = attachmentBody(a);
      const target = path.join(folder, `${a.name}.${a.contentType === 'text/markdown' ? 'md' : 'txt'}`);
      fs.writeFileSync(target, body);
      files.push(target);
      if (a.name === 'watchdog') watchdog = body;
      if (a.name === 'server-log') serverLog = body;
    }
  }
  const dumps = trace ? traceDump(trace, folder) : null;

  const errors = (r.errors?.length ? r.errors : r.error ? [r.error] : []).map((e) =>
    [e.message, e.snippet ? `\n${e.snippet}` : '', e.stack && !String(e.message ?? '').includes(e.stack) ? `\n${e.stack}` : ''].join(''),
  );
  const flow = t.id ? flowRows.get(t.id) : null;
  const out = [];
  out.push(`### ${t.title}`, '');
  if (flow) {
    out.push(`- **Scenario** (flows/${flow.file}): ${flow.scenario}`);
    out.push(`- **Expected**: ${flow.expect}`);
    out.push(`- **Targets / needs**: ${flow.targets} · ${flow.needs}`);
  }
  out.push(`- **Project**: \`${t.project}\``);
  out.push(`- **Result**: ${r.status} after ${((r.duration ?? 0) / 1000).toFixed(1)} s${t.results.length > 1 ? ` (attempt ${t.results.length})` : ''}`);
  out.push(`- **Test**: \`apps/e2e/tests/${t.file}:${t.line}\``);
  out.push(`- **Reproduce**: \`pnpm --filter @pip-it-up/e2e e2e --project ${t.project} -g "${t.id ?? t.title}"\` (add \`--headed\` to watch, \`--debug\` to step through)`);
  out.push(`- **Evidence**: \`${rel(folder)}/\`${trace ? ` · open the trace with \`pnpm --filter @pip-it-up/e2e exec playwright show-trace ${rel(trace)}\`` : ''}`);
  out.push(`  - ${files.map((f) => path.basename(f)).join(', ') || 'no attachments'}`, '');
  out.push('**Error**', fence(cut(errors.join('\n\n') || '(no error message)', 40)));
  if (dumps?.errors) out.push('**Trace: errors**', fence(cut(dumps.errors, 30)));
  if (dumps?.['failed-requests']) out.push('**Trace: failed requests (status ≥ 400)**', fence(cut(dumps['failed-requests'], 30)));
  const consoleProblems = dumps?.console ? consoleErrorsAndWarnings(dumps.console) : '';
  if (consoleProblems) out.push('**Trace: console errors and warnings** (full console in trace-console.txt)', fence(cut(consoleProblems, 30)));
  if (watchdog) out.push('**Watchdog** (uncaught errors, console errors and warnings, pip-it-up warnings, failed and slow requests)', cut(watchdog, 40));
  if (serverLog) out.push('**Dev server log during the test**', fence(cut(serverLog, 60)));
  if (pageSnapshot) out.push('<details><summary>Page snapshot at failure</summary>', '', fence(cut(pageSnapshot, 80)), '', '</details>');
  if (dumps?.actions) out.push('<details><summary>Test steps (trace actions)</summary>', '', fence(cut(dumps.actions, 60)), '', '</details>');
  const notes = flow ? notesFor(t.id, flow.file) : [];
  if (notes.length) out.push('**Flow file notes about this row**', notes.map((l) => l.trim()).join('\n'));
  out.push('');
  out.push('- **Classification**: _app bug / test bug / flaky / environment / browser difference (agent fills in)_');
  out.push('- **Suspected cause**: _file:line and why (agent fills in)_');
  out.push("- **Suggested fix**: _what to change (agent fills in; don't change library code while testing)_");
  out.push('- **Invariants**: _the specs/MAINTENANCE_GUIDE.md sections (§1–13) and CONTRIBUTING.md security-checklist rows the fix touches, and how it complies (agent fills in)_');
  out.push('- **Parallel paths**: _other code paths that reach the same state (core vs React, vanilla vs binding, other browsers) and whether they need the same fix (agent fills in)_');
  out.push('- **Docs to update**: _README / docs/recipes / MANUAL_SMOKE sentences this fix would make false, or "none" (agent fills in)_');
  out.push('');
  return out.join('\n');
}

// ---------- optimisation data from every test ----------
function parseWatchdog(body) {
  const sections = {};
  let current = null;
  for (const line of body.split('\n')) {
    const heading = line.match(/^## (.+)$/);
    if (heading) current = heading[1].replace(/\s*\(.*\)$/, '');
    else if (current && line.startsWith('- ')) (sections[current] ??= []).push(line.slice(2));
  }
  return sections;
}
const slowRequests = new Map();
const warnings = new Map();
for (const t of tests) {
  for (const a of t.last.attachments ?? []) {
    if (a.name !== 'watchdog') continue;
    const sections = parseWatchdog(attachmentBody(a));
    for (const line of sections['Slow requests'] ?? []) {
      const ms = Number(line.match(/(\d+) ms/)?.[1] ?? 0);
      const key = line.replace(/^(\d+× )?\[[^\]]+\]\s*/, '').replace(/^\d+ ms: /, '');
      const prev = slowRequests.get(key);
      if (!prev || prev.ms < ms) slowRequests.set(key, { ms, line, test: t.id ?? t.title, count: (prev?.count ?? 0) + 1 });
      else prev.count += 1;
    }
    if (t.outcome !== 'expected') continue;
    for (const kind of ['Console warnings', 'Failed requests', 'Client errors']) {
      for (const line of sections[kind] ?? []) {
        const key = `${kind}: ${line.replace(/^(\d+× )?\[[^\]]+\]\s*/, '')}`;
        const entry = warnings.get(key) ?? { kind, line, tests: new Set() };
        entry.tests.add(`${t.id ?? t.title} (${t.project})`);
        warnings.set(key, entry);
      }
    }
  }
}

// ---------- write the report ----------
const stats = run.stats ?? {};
const md = [];
md.push(`# Bug report: ${area}`, '');
md.push(
  `Run: ${stats.startTime ?? '?'} · ${((stats.duration ?? 0) / 1000).toFixed(0)} s · ${passed.length} passed, ${failures.length} failed, ${flaky.length} flaky, ${skipped.length} skipped`,
);
md.push(`Evidence: \`${rel(evidenceDir)}/\` · HTML report of this run: \`pnpm --filter @pip-it-up/e2e e2e:report\` (until the next run replaces it)`, '');
md.push('> **Before fixing anything in this report, read `specs/MAINTENANCE_GUIDE.md` (§1–13, the architecture contract)');
md.push('> and the security checklist in `CONTRIBUTING.md`.** Every suggested fix must respect them: no `await` between the');
md.push('> gesture and `requestWindow()` (§1), deferred Strict Mode teardown (§2), one immortal shuttle moved natively (§9),');
md.push('> compare-and-clear handles (§10), the attached inert garage (§11), anti-CLS reservation (§12), synchronous');
md.push("> repatriation with no `flushSync` (§13), `isTrusted` filters on forwarded events. A fix that conflicts with a rule is");
md.push('> wrong: fix it the way the guide says, or stop and ask. Browser differences (lib/capabilities.ts) are not bugs by');
md.push('> themselves: check the declared capabilities before calling a webkit-only failure an app bug.', '');

md.push('## Summary by project', '', '| Project | Passed | Failed | Flaky | Skipped |', '| --- | --- | --- | --- | --- |');
for (const p of projects) {
  const n = (o) => tests.filter((t) => t.project === p && t.outcome === o).length;
  md.push(`| ${p} | ${n('expected')} | ${n('unexpected')} | ${n('flaky')} | ${n('skipped')} |`);
}
md.push('');

md.push('## Failures', '');
if (!failures.length) md.push('None.', '');
let index = 0;
for (const p of projects) {
  const inProject = failures.filter((t) => t.project === p);
  if (!inProject.length) continue;
  md.push(`## ${p}`, '');
  for (const t of inProject) md.push(failureSection(t, index++));
}
if (flaky.length) {
  md.push('## Flaky (failed, then passed on retry)', '');
  for (const t of flaky) md.push(`- [${t.project}] ${t.title} · \`${t.file}:${t.line}\` · \`--project ${t.project} -g "${t.id ?? t.title}" --repeat-each 5\``);
  md.push('');
}
md.push('## Timings and warnings', '');
md.push('Dev-server timings: reported, never asserted.', '');
const slowTests = tests.filter((t) => t.last.duration).sort((a, b) => b.last.duration - a.last.duration).slice(0, 10);
md.push('**Slowest tests**', slowTests.map((t) => `- ${(t.last.duration / 1000).toFixed(1)} s · [${t.project}] ${t.title}`).join('\n') || '- none', '');
md.push(
  '**Slow requests** (slowest first)',
  [...slowRequests.values()].sort((a, b) => b.ms - a.ms).slice(0, 25).map((s) => `- ${s.line} · in ${s.test}${s.count > 1 ? ` · seen ${s.count}×` : ''}`).join('\n') || '- none',
  '',
);
md.push(
  '**Console warnings, failed requests and 4xx in tests that passed**',
  [...warnings.values()].slice(0, 40).map((w) => `- ${w.kind}: ${w.line} · in ${[...w.tests].slice(0, 5).join(', ')}`).join('\n') || '- none',
  '',
);
if (skipped.length) {
  md.push('## Skipped', '');
  for (const t of skipped) {
    const why = t.annotations.find((a) => a.type === 'skip' || a.type === 'fixme')?.description;
    md.push(`- [${t.project}] ${t.title}${why ? ` · ${why}` : ''}`);
  }
  md.push('');
}

const mdPath = path.join(reportDir, `${name}.md`);
fs.writeFileSync(mdPath, md.join('\n'));

// --replace: this is the final report for the area, so earlier ones are superseded.
if (replace) {
  const older = new RegExp(`^${area}-\\d{4}-\\d{2}-\\d{2}-\\d{4}(\\.md)?$`);
  for (const entry of fs.readdirSync(reportDir)) {
    if (entry === name || entry === `${name}.md` || !older.test(entry)) continue;
    fs.rmSync(path.join(reportDir, entry), { recursive: true, force: true });
    console.log(`Removed older report: ${rel(path.join(reportDir, entry))}`);
  }
}
console.log(`Bug report: ${rel(mdPath)}`);
console.log(`Evidence:   ${rel(evidenceDir)}/`);
console.log(`${failures.length} failed, ${flaky.length} flaky, ${passed.length} passed, ${skipped.length} skipped`);
