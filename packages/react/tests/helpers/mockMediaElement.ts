export interface MockMediaState {
  /** Advances only when `tick()` is called while not paused. */
  currentTime: number;
  paused: boolean;
  /** Every `play()` call, resolved or rejected. */
  readonly playCalls: number;
  readonly pauseCalls: number;
  /**
   * Incremented whenever the element's `isConnected` was observed to be `false` at a `tick()`.
   * The zero-remount suites assert this stays 0 across every transition, because a detach is
   * what triggers HTML's media removal steps and pauses playback.
   */
  readonly detachedTicks: number;
}

export interface MockMediaHandle {
  readonly element: HTMLVideoElement;
  readonly state: MockMediaState;
  /** Advance virtual playback by `seconds`, and sample `isConnected`. */
  tick(seconds: number): void;
  /** Make the next `play()` reject, simulating autoplay policy. */
  rejectNextPlay(): void;
}

/**
 * Creates a `<video>` whose playback state is fully controllable.
 * `autoplay` semantics are NOT simulated; call `element.play()` explicitly.
 */
export function createMockVideo(
  initial?: Partial<Pick<MockMediaState, 'currentTime' | 'paused'>>
): MockMediaHandle {
  const element = document.createElement('video');

  let currentTime = initial?.currentTime ?? 0;
  let paused = initial?.paused ?? true;
  let playCalls = 0;
  let pauseCalls = 0;
  let detachedTicks = 0;
  let shouldRejectNextPlay = false;

  const state: MockMediaState = {
    get currentTime(): number {
      return currentTime;
    },
    set currentTime(val: number) {
      currentTime = val;
    },
    get paused(): boolean {
      return paused;
    },
    set paused(val: boolean) {
      paused = val;
    },
    get playCalls(): number {
      return playCalls;
    },
    get pauseCalls(): number {
      return pauseCalls;
    },
    get detachedTicks(): number {
      return detachedTicks;
    },
  };

  Object.defineProperty(element, 'currentTime', {
    get: () => currentTime,
    set: (val: number) => {
      currentTime = val;
    },
    configurable: true,
  });

  Object.defineProperty(element, 'paused', {
    get: () => paused,
    set: (val: boolean) => {
      paused = val;
    },
    configurable: true,
  });

  element.play = async function (): Promise<void> {
    playCalls += 1;
    if (shouldRejectNextPlay) {
      shouldRejectNextPlay = false;
      return Promise.reject(
        Object.assign(new Error('play() blocked'), { name: 'NotAllowedError' })
      );
    }
    paused = false;
    return Promise.resolve();
  };

  element.pause = function (): void {
    pauseCalls += 1;
    paused = true;
  };

  return {
    element,
    state,
    tick(seconds: number): void {
      if (!element.isConnected) {
        detachedTicks += 1;
      }
      if (!paused) {
        currentTime += seconds;
      }
    },
    rejectNextPlay(): void {
      shouldRejectNextPlay = true;
    },
  };
}
