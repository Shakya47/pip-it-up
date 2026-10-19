/**
 * The watchdog: watches every page of a test's browser context the way DevTools would (console,
 * uncaught errors, failed requests, error responses, slow requests), attaches a "watchdog" report
 * to the test, and fails it on the app's uncaught errors, console errors, and pip-it-up warnings.
 *
 * It watches the CONTEXT, not a page, so a Document PiP window (a `popup` page in the same context)
 * is covered from the moment it opens. Its URL is `about:blank`; errors thrown there are the app's.
 *
 * pip-it-up's own warnings (`[pip-it-up]`, `[PipWrapper]`, `[PipProvider]`, `[useVideoPip]`, ...)
 * fail a test unless the test expects them: `watchdog.allow(/\[useVideoPip\] Failed to enter/)`.
 * Allow the narrowest pattern that matches. Chrome's `content-visibility` messages are `info`
 * level and are never recorded.
 *
 * Only the app's own errors count (ported from nexus apps/e2e/lib/watchdog.ts). An error is
 * "third-party" only when every URL it names maps to a child frame on a real origin other than
 * the targets'. Everything else, including errors with no URL (`page.evaluate`), stays the app's.
 *
 * Self-check (no unit-test runner here): make a playground test run
 * `page.evaluate(() => setTimeout(() => { throw new Error('boom') }))` and it must fail with
 * "uncaught error: ... boom"; `console.warn('[pip-it-up] x')` must fail it with "pip-it-up warning".
 */
import type { BrowserContext, Frame, Page, Request, TestInfo } from '@playwright/test';

export type WatchdogOptions = {
  /** Fail the test when the app throws an uncaught error. */
  failOnPageError: boolean;
  /** Fail the test on console.error from the app. On: a library's demo should log no errors. */
  failOnConsoleError: boolean;
  /** Fail the test on a console warning or error from pip-it-up itself (see `PIP_LOG`). */
  failOnPipWarning: boolean;
  /** Fail on a 5xx from a target's dev server. */
  failOnServerError: boolean;
  /** Requests slower than this are listed in the report. They never fail a test. */
  slowRequestMs: number;
  /** Messages and URLs matching any of these are ignored everywhere. */
  ignore: RegExp[];
};

/** pip-it-up's console prefixes. Core also logs a few messages as plain `pip-it-up: ...` (fallback.ts). */
export const PIP_LOG = /\[(pip-it-up|PipWrapper|PipProvider|PipAnchor|PipTrigger|usePip|useVideoPip|useAutoPip)\]|^pip-it-up: /;

export const DEFAULT_WATCHDOG: WatchdogOptions = {
  failOnPageError: true,
  failOnConsoleError: true,
  failOnPipWarning: true,
  failOnServerError: true,
  slowRequestMs: 3000,
  ignore: [
    /net::ERR_ABORTED/, // requests cancelled by navigation or media seeking
    /NS_BINDING_ABORTED/, // Firefox's name for the same
    /Download the React DevTools/,
  ],
};

type Finding = { session: string; text: string };

export class Watchdog {
  private readonly pageErrors: Finding[] = [];
  private readonly consoleErrors: Finding[] = [];
  private readonly pipWarnings: Finding[] = [];
  private readonly consoleWarnings: Finding[] = [];
  private readonly serverErrors: Finding[] = [];
  private readonly thirdPartyErrors: Finding[] = [];
  private readonly failedRequests: Finding[] = [];
  private readonly clientErrors: Finding[] = [];
  private readonly slowRequests: (Finding & { ms: number })[] = [];
  private readonly ignored: RegExp[];
  private readonly allowed: RegExp[] = [];
  private readonly requestedBy = new Map<string, Set<Frame>>();

  constructor(
    private readonly options: WatchdogOptions,
    /** Origins of the targets under test: errors from their code, and their 5xx, are the app's. */
    private readonly appOrigins: Set<string>,
  ) {
    this.ignored = [...options.ignore];
  }

  /** Ignore something this test expects everywhere (errors, requests), e.g. a stubbed tile 404. */
  ignore(pattern: RegExp) {
    this.ignored.push(pattern);
  }

  /** Allow a console warning or error this test expects. Still listed in the report, never fatal. */
  allow(pattern: RegExp) {
    this.allowed.push(pattern);
  }

  watch(context: BrowserContext, session = 'main') {
    context.on('request', (request) => this.rememberFrame(request));
    context.on('weberror', (webError) => {
      const error = webError.error();
      const urls = [webError.location().url, ...stackUrls(error.stack)];
      this.recordError(this.pageErrors, session, `${error.name}: ${error.message}`, urls, webError.page());
    });
    context.on('console', (message) => {
      const type = message.type();
      if (type !== 'error' && type !== 'warning') return;
      const url = message.location().url;
      const where = url ? ` (${this.short(url)})` : '';
      const text = `${type === 'warning' ? 'warning: ' : ''}${message.text()}${where}`;
      if (this.isIgnored(text)) return;
      if (PIP_LOG.test(message.text()) && !this.isAllowed(text)) {
        this.pipWarnings.push({ session, text });
        return;
      }
      if (type === 'warning' || this.isAllowed(text)) {
        this.consoleWarnings.push({ session, text });
        return;
      }
      this.recordError(this.consoleErrors, session, text, [url], message.page());
    });
    context.on('requestfailed', (request) => {
      this.record(this.failedRequests, session, `${this.describe(request)}: ${request.failure()?.errorText}`);
    });
    context.on('response', (response) => {
      const status = response.status();
      if (status < 400) return;
      const line = `${status} ${this.describe(response.request())}`;
      const ours = this.appOrigins.has(originOf(response.url()));
      this.record(status >= 500 && ours ? this.serverErrors : this.clientErrors, session, line);
    });
    context.on('requestfinished', (request) => {
      const { responseEnd } = request.timing();
      if (responseEnd < this.options.slowRequestMs) return;
      const text = `${Math.round(responseEnd)} ms: ${this.describe(request)}`;
      if (!this.isIgnored(text)) this.slowRequests.push({ session, text, ms: responseEnd });
    });
  }

  /** Attach the report and throw if anything the options treat as fatal happened. */
  async finish(testInfo: TestInfo) {
    const sections: [string, Finding[]][] = [
      ['Uncaught errors', this.pageErrors],
      ['Console errors', this.consoleErrors],
      ['pip-it-up warnings', this.pipWarnings],
      ['Server errors (5xx)', this.serverErrors],
      ['Console warnings (and allowed messages)', this.consoleWarnings],
      ["Third-party frames (errors inside other sites' iframes; info, never fail a test)", this.thirdPartyErrors],
      ['Failed requests', this.failedRequests],
      ['Client errors (4xx)', this.clientErrors],
      [`Slow requests (over ${this.options.slowRequestMs} ms)`, [...this.slowRequests].sort((a, b) => b.ms - a.ms)],
    ];
    const report = sections
      .filter(([, findings]) => findings.length > 0)
      .map(([title, findings]) => `## ${title}\n${this.list(findings)}`)
      .join('\n\n');
    if (report) await testInfo.attach('watchdog', { body: report, contentType: 'text/markdown' });

    const fatal: [string, Finding[]][] = [];
    if (this.options.failOnPageError) fatal.push(['uncaught error', this.pageErrors]);
    if (this.options.failOnConsoleError) fatal.push(['console error', this.consoleErrors]);
    if (this.options.failOnPipWarning) fatal.push(['pip-it-up warning', this.pipWarnings]);
    if (this.options.failOnServerError) fatal.push(['server error', this.serverErrors]);
    const problems = fatal.filter(([, findings]) => findings.length > 0);
    if (problems.length > 0) {
      const detail = problems.map(([kind, findings]) => `${kind}:\n${this.list(findings, 5)}`).join('\n');
      throw new Error(
        `[watchdog] The app misbehaved during this test (full list in the "watchdog" attachment).\n${detail}\n` +
          'If this is expected, call watchdog.allow(/narrow pattern/) in the test.',
      );
    }
  }

  private record(bucket: Finding[], session: string, text: string) {
    if (!this.isIgnored(text)) bucket.push({ session, text });
  }

  private recordError(bucket: Finding[], session: string, text: string, urls: string[], page: Page | null) {
    if (this.isIgnored(text)) return;
    const frameUrl = this.thirdPartyFrame(urls, page);
    if (frameUrl) this.thirdPartyErrors.push({ session, text: `${text} [frame ${frameUrl}]` });
    else bucket.push({ session, text });
  }

  private rememberFrame(request: Request) {
    let frame: Frame;
    try {
      frame = request.frame();
    } catch {
      return; // a service-worker request, or a navigation that started before its frame existed
    }
    const url = withoutHash(request.url());
    let frames = this.requestedBy.get(url);
    if (!frames) this.requestedBy.set(url, (frames = new Set()));
    frames.add(frame);
  }

  private thirdPartyFrame(urls: string[], page: Page | null): string | null {
    const known = [...new Set(urls.filter(Boolean).map(withoutHash))];
    if (known.length === 0) return null;
    let frameUrl: string | null = null;
    for (const url of known) {
      if (this.appOrigins.has(originOf(url))) return null;
      const frames = this.framesFor(url, page);
      if (frames.length === 0 || !frames.every((frame) => this.isThirdPartyFrame(frame))) return null;
      frameUrl ??= frames[0].url();
    }
    return frameUrl;
  }

  private framesFor(url: string, page: Page | null): Frame[] {
    const requested = this.requestedBy.get(url);
    if (requested?.size) return [...requested];
    const children = page ? page.frames().filter((frame) => frame.parentFrame() !== null) : [];
    const documents = children.filter((frame) => withoutHash(frame.url()) === url);
    if (documents.length > 0) return documents;
    const origin = originOf(url);
    return origin === 'null' ? [] : children.filter((frame) => originOf(frame.url()) === origin);
  }

  private isThirdPartyFrame(frame: Frame) {
    const origin = originOf(frame.url());
    return frame.parentFrame() !== null && origin !== 'null' && !this.appOrigins.has(origin);
  }

  private isIgnored(text: string) {
    return this.ignored.some((pattern) => pattern.test(text));
  }

  private isAllowed(text: string) {
    return this.allowed.some((pattern) => pattern.test(text));
  }

  private describe(request: Request) {
    return `${request.method()} ${this.short(request.url())}`;
  }

  private short(url: string) {
    const origin = originOf(url);
    return this.appOrigins.has(origin) ? url.slice(origin.length) || '/' : url;
  }

  /** Identical findings collapse into one line with a count (Chrome reports some errors twice). */
  private list(findings: Finding[], max = 25) {
    const counts = new Map<string, number>();
    for (const f of findings) {
      const line = `[${f.session}] ${f.text}`;
      counts.set(line, (counts.get(line) ?? 0) + 1);
    }
    const unique = [...counts];
    const lines = unique.slice(0, max).map(([line, n]) => `- ${n > 1 ? `${n}× ` : ''}${line}`);
    if (unique.length > max) lines.push(`- ...and ${unique.length - max} more`);
    return lines.join('\n');
  }
}

/** The URLs in a V8 stack trace's "    at ..." frames, without their `:line:column`. */
export function stackUrls(stack: string | undefined): string[] {
  const frames = (stack ?? '').split('\n').filter((line) => /^\s+at\s/.test(line) || /@/.test(line));
  return frames.flatMap((line) =>
    [...line.matchAll(/\b(?:https?|blob|about|file):[^\s()]+/g)].map((match) => match[0].replace(/(?::\d+){1,2}$/, '')),
  );
}

/** `new URL(url).origin`, or "null" (the opaque origin) for anything unparseable. */
export function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return 'null';
  }
}

function withoutHash(url: string) {
  const hash = url.indexOf('#');
  return hash === -1 ? url : url.slice(0, hash);
}
