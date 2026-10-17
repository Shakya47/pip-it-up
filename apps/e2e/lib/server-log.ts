import fs from 'node:fs';
import path from 'node:path';
import type { TestInfo } from '@playwright/test';
import { E2E_ROOT, type TargetName } from './targets';

/** Written by scripts/dev-server.mjs: one "<ISO time> [out|err] <line>" per line, one file per target. */
export const serverLogPath = (target: TargetName) => path.join(E2E_ROOT, 'logs', `${target}.log`);

const MAX_READ_BYTES = 8 * 1024 * 1024;
const MAX_LINES = 400;

/** Dev server lines logged between `from` and `to` (ms since epoch), with a little slack. */
export function serverLogBetween(target: TargetName, from: number, to: number): string[] | null {
  const file = serverLogPath(target);
  if (!fs.existsSync(file)) return null;
  const { size } = fs.statSync(file);
  const fd = fs.openSync(file, 'r');
  const start = Math.max(0, size - MAX_READ_BYTES);
  const buffer = Buffer.alloc(size - start);
  fs.readSync(fd, buffer, 0, buffer.length, start);
  fs.closeSync(fd);

  const lines: string[] = [];
  for (const line of buffer.toString('utf8').split('\n')) {
    const time = Date.parse(line.slice(0, 24));
    if (Number.isNaN(time)) continue;
    if (time >= from - 1_000 && time <= to + 2_000) lines.push(line);
  }
  return lines.length > MAX_LINES
    ? [`...${lines.length - MAX_LINES} earlier lines cut`, ...lines.slice(-MAX_LINES)]
    : lines;
}

/** Attach the target's dev-server output from this test's run to a failed test. */
export async function attachServerLog(testInfo: TestInfo, target: TargetName, startedAt: number) {
  if (testInfo.status === testInfo.expectedStatus) return;
  const lines = serverLogBetween(target, startedAt, Date.now());
  const body =
    lines === null
      ? `No server log: the ${target} dev server wasn't started with \`pnpm e2e:server\` (or by Playwright), so its output isn't captured.`
      : lines.length === 0
        ? 'The dev server printed nothing during this test.'
        : // Other tests run in parallel, so some lines may belong to them.
          `${target} dev server output during this test (parallel tests may add lines):\n\n${lines.join('\n')}`;
  await testInfo.attach('server-log', { body, contentType: 'text/plain' });
}
