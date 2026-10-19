#!/usr/bin/env node
// Rewrite the Status cell of every flow row from the last run (test-results/results.json).
//
//   node scripts/flow-status.mjs            # all flow files
//   node scripts/flow-status.mjs lifecycle  # one
//
// Per row (matched by the id that starts each test title), MERGED with what the row already says,
// so a partial run (`--project=vanilla-firefox`, `-g LC5`) only updates the projects it ran:
// - each project that ran gets its new outcome: `pass <date> · <projects>`,
//   `fail <projects> <date>: <reason>` or `flaky <projects> <date>: passed on retry`; projects the
//   row already listed and this run didn't touch keep their old outcome and date;
// - a failing project keeps its own earlier fail reason; one with none gets `see Notes` (write the
//   reason by hand); a `;` inside a reason is safe (parts split only on `; pass|fail|flaky|skipped`);
// - on a single-target row, bare browser names (`chrome`) are read as `<target>-<browser>`, so the
//   row is rewritten in project names only;
// - a project skipped in this run never replaces an earlier pass/fail for it; a row whose tests
//   were all skipped and that lists no earlier outcome keeps a `skipped:` text, else gets the reason;
// - a row whose old Status isn't in this format (`todo`, `new`, `todo — retest: ...`) starts over.
// Rows with no test in this run are left alone. Review the diff: this never invents a reason.
//
//   E2E_RESULTS=<file> E2E_FLOWS=<dir> node scripts/flow-status.mjs   # other inputs (self-tests)

import fs from 'node:fs';
import path from 'node:path';

const E2E_ROOT = path.resolve(import.meta.dirname, '..');
const FLOWS = process.env.E2E_FLOWS ? path.resolve(process.env.E2E_FLOWS) : path.join(E2E_ROOT, 'flows');
const RESULTS = process.env.E2E_RESULTS ? path.resolve(process.env.E2E_RESULTS) : path.join(E2E_ROOT, 'test-results', 'results.json');
const run = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
const date = (run.stats?.startTime ?? new Date().toISOString()).slice(0, 10);

// Worst outcome wins when a project ran several tests for one id.
const RANK = { skip: 0, pass: 1, flaky: 2, fail: 3 };

/** id -> Map(project -> { outcome, why }) for this run. */
const byId = new Map();
(function walk(suites) {
  for (const s of suites ?? []) {
    for (const spec of s.specs ?? []) {
      const id = spec.title.match(/^([A-Z]+\d+)\b/)?.[1];
      if (!id) continue;
      for (const t of spec.tests ?? []) {
        const why = t.annotations?.find((a) => a.type === 'skip')?.description;
        // A listed known bug (lib/known-bugs.ts, CI) runs as `test.fail()`: "expected" means it
        // still FAILS, "unexpected" means it now passes (the bug is fixed).
        const knownBug = t.annotations?.some((a) => a.type === 'fail');
        let outcome;
        if (knownBug && t.status === 'expected') outcome = 'fail';
        else if (knownBug && t.status === 'unexpected') outcome = 'pass';
        else if (t.status === 'expected') outcome = 'pass';
        else if (t.status === 'flaky') outcome = 'flaky';
        else if (t.status === 'skipped') outcome = 'skip';
        else outcome = 'fail';
        const entry = byId.get(id) ?? new Map();
        const prev = entry.get(t.projectName);
        if (!prev || RANK[outcome] > RANK[prev.outcome]) entry.set(t.projectName, { outcome, why });
        byId.set(id, entry);
      }
    }
    walk(s.suites);
  }
})(run.suites);

const TARGETS = Object.keys(JSON.parse(fs.readFileSync(path.join(E2E_ROOT, 'lib', 'targets.json'), 'utf8')));
const BROWSERS = new Set(['chrome', 'firefox', 'webkit', 'msedge', 'chromium']);

const DATE = '\\d{4}-\\d{2}-\\d{2}';
const PART = {
  pass: new RegExp(`^pass (${DATE}) · (.+)$`),
  fail: new RegExp(`^fail (.+?) (${DATE}): (.+)$`),
  flaky: new RegExp(`^flaky (.+?) (${DATE})(?:: (.+))?$`),
};

/**
 * An existing Status as project -> { outcome, date, reason }, or null if it isn't in that format.
 * `target` (single-target rows): bare browser names become `<target>-<browser>`.
 */
function parseStatus(text, target) {
  const projects = new Map();
  const name = (p) => (target && BROWSERS.has(p) ? `${target}-${p}` : p);
  const set = (list, s) => {
    for (const p of list.split(/\s+/)) projects.set(name(p), s);
  };
  for (const part of text.split(/;\s+(?=(?:pass|fail|flaky|skipped)\b)/).map((p) => p.trim()).filter(Boolean)) {
    let m;
    if ((m = part.match(PART.pass))) set(m[2], { outcome: 'pass', date: m[1] });
    else if ((m = part.match(PART.fail))) set(m[1], { outcome: 'fail', date: m[2], reason: m[3].trim() });
    else if ((m = part.match(PART.flaky))) set(m[1], { outcome: 'flaky', date: m[2] });
    else return null;
  }
  return projects;
}

/** Group project outcomes back into Status parts: fail first, then flaky, then pass; newest date first. */
function formatStatus(projects) {
  const groups = new Map();
  for (const [project, s] of projects) {
    const key = `${s.outcome}|${s.date}|${s.outcome === 'fail' ? s.reason : ''}`;
    if (!groups.has(key)) groups.set(key, { ...s, projects: [] });
    groups.get(key).projects.push(project);
  }
  const order = { fail: 0, flaky: 1, pass: 2 };
  return [...groups.values()]
    .sort((a, b) => order[a.outcome] - order[b.outcome] || b.date.localeCompare(a.date))
    .map((g) => {
      const list = g.projects.sort().join(' ');
      if (g.outcome === 'pass') return `pass ${g.date} · ${list}`;
      if (g.outcome === 'flaky') return `flaky ${list} ${g.date}: passed on retry`;
      return `fail ${list} ${g.date}: ${g.reason}`;
    })
    .join('; ');
}

const only = process.argv[2];
let changed = 0;
for (const file of fs.readdirSync(FLOWS).filter((f) => f.endsWith('.md') && !f.startsWith('_') && f !== 'README.md')) {
  if (only && file !== `${only}.md`) continue;
  const full = path.join(FLOWS, file);
  const lines = fs.readFileSync(full, 'utf8').split('\n');
  const out = lines.map((line) => {
    const cells = line.split(/(?<!\\)\|/);
    if (cells.length !== 8) return line; // '' | ID | Scenario | Expect | Targets | Needs | Status | ''
    const id = cells[1].trim();
    const ran = byId.get(id);
    if (!/^[A-Z]+\d+$/.test(id) || !ran) return line;
    const old = cells[6].trim();
    // One target: the Targets cell if it names one (targets.json), else the one prefix of the projects
    // that ran (`ext-persist` rows run as react-*). Bare browser names are read as that target's.
    const targetsCell = cells[4].trim();
    const prefixes = new Set([...ran.keys()].filter((p) => p.includes('-')).map((p) => p.split('-').slice(0, -1).join('-')));
    const target = TARGETS.includes(targetsCell)
      ? targetsCell
      : /^[\w-]+$/.test(targetsCell) && prefixes.size === 1
        ? [...prefixes][0]
        : undefined;
    const merged = parseStatus(old, target) ?? new Map();

    for (const [project, r] of ran) {
      if (r.outcome === 'skip') continue; // never replaces an earlier outcome
      // A bare browser left on a multi-target row ("chrome") is superseded by the project that ran.
      const browser = project.split('-').at(-1);
      if (browser !== project) merged.delete(browser);
      const prevReason = merged.get(project)?.reason;
      merged.set(project, { outcome: r.outcome, date, reason: r.outcome === 'fail' ? (prevReason ?? 'see Notes') : undefined });
    }

    let status = formatStatus(merged);
    if (!status) {
      const firstSkip = [...ran.values()].find((r) => r.outcome === 'skip');
      status = old.startsWith('skipped:') ? old : `skipped: ${firstSkip?.why ?? 'not run'}`;
    }
    if (status === old) return line;
    changed++;
    cells[6] = ` ${status} `;
    return cells.join('|');
  });
  fs.writeFileSync(full, out.join('\n'));
}
console.log(`${changed} row statuses updated from ${path.relative(process.cwd(), RESULTS)}`);
