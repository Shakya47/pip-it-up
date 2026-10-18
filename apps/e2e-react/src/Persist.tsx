/**
 * Route-persistent extension (`@ext-persist`): <PipProvider> + <PipAnchor>, on
 * `#/persist/<home|away>?gcGraceMs=<ms>&dormantMedia=<pause|keep>&unknownAnchor=1`.
 *
 * Only "Home" renders anchors. The registry holds a "Tracker" (dormancy readouts, a srcdoc iframe
 * whose loads are counted, a focusable input) and a "Player" (a playing captureStream video).
 */
import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PipAnchor, PipProvider, PipTrigger, useActiveEffect, useAdaptiveInterval, useDormancy, useRevealEffect } from '@pip-it-up/react';
import { NAMES } from '@pip-it-up/e2e-contract';
import { LogProvider, StreamVideo } from './shared';

type PersistRoute = 'home' | 'away';

function readHash() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const route: PersistRoute = path === 'persist/away' ? 'away' : 'home';
  return { route, query: new URLSearchParams(query), rawQuery: query };
}

function Tracker() {
  const { level, placement } = useDormancy();
  const [seconds, setSeconds] = useState(0);
  const [loads, setLoads] = useState(0);
  useAdaptiveInterval(() => setSeconds((n) => n + 1));
  // Dormancy hooks from the README: reveals out of the garage, and an effect alive only while active.
  const [reveals, setReveals] = useState(0);
  useRevealEffect(() => setReveals((n) => n + 1));
  const [activeEffect, setActiveEffect] = useState(false);
  useActiveEffect(() => {
    setActiveEffect(true);
    return () => setActiveEffect(false);
  }, []);
  return (
    <section aria-label="Tracker">
      <h2>Tracker</h2>
      <p>Seconds: {seconds}</p>
      <p>Level: {level}</p>
      <p>Placement: {placement}</p>
      <label>
        Tracker notes <input type="text" aria-label="Tracker notes" />
      </label>
      <iframe title="Tracker frame" srcDoc="<p>frame</p>" width={120} height={40} onLoad={() => setLoads((n) => n + 1)} />
      <p>Frame loads: {loads}</p>
      <p>Reveals: {reveals}</p>
      <p>Active effect: {activeEffect ? 'running' : 'stopped'}</p>
    </section>
  );
}

function Player() {
  return (
    <section aria-label="Player">
      <h2>Player</h2>
      <StreamVideo label="Player video" autoPlay />
    </section>
  );
}

class Boundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }
  render() {
    return this.state.message ? <p role="alert">{this.state.message}</p> : this.props.children;
  }
}

export function PersistPage() {
  const [{ route, query, rawQuery }, setHash] = useState(readHash);
  useEffect(() => {
    const onHash = () => setHash(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = (r: PersistRoute) => {
    location.hash = `#/persist/${r}${rawQuery ? `?${rawQuery}` : ''}`;
  };

  const [withTracker, setWithTracker] = useState(true);
  const registry = useMemo(
    () => (withTracker ? { tracker: <Tracker />, player: <Player /> } : { player: <Player /> }),
    [withTracker],
  );
  const gcGraceMs = query.has('gcGraceMs') ? Number(query.get('gcGraceMs')) : undefined;
  const dormantMedia = query.get('dormantMedia') === 'keep' ? 'keep' : 'pause';

  return (
    <LogProvider>
      <PipProvider registry={registry} gcGraceMs={gcGraceMs} dormantMedia={dormantMedia}>
        <header>
          <PipTrigger pipId="tracker" />
          <PipTrigger pipId="player" openLabel="Pop out player" closeLabel="Close player" />
          <button type="button" onClick={() => setWithTracker((v) => !v)}>
            {withTracker ? 'Remove tracker from registry' : 'Restore tracker to registry'}
          </button>
        </header>
        <nav aria-label="Routes">
          <button type="button" aria-current={route === 'home' ? 'page' : undefined} onClick={() => go('home')}>
            Home
          </button>
          <button type="button" aria-current={route === 'away' ? 'page' : undefined} onClick={() => go('away')}>
            Away
          </button>
        </nav>
        {route === 'home' ? (
          <div>
            <h1>Home</h1>
            {/* An anchor for an id missing from the registry throws ERR_UNKNOWN_ID in dev. */}
            {withTracker && <PipAnchor id="tracker" placeholder={<p>Tracker is away</p>} />}
            <PipAnchor id="player" placeholder={<p>Player is away</p>} />
            {query.get('unknownAnchor') === '1' && (
              <Boundary>
                <PipAnchor id="not-in-registry" />
              </Boundary>
            )}
          </div>
        ) : (
          <h1>Away</h1>
        )}
        <p>{NAMES.below}</p>
      </PipProvider>
    </LogProvider>
  );
}
