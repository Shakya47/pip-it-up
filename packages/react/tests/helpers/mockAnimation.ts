import { vi } from 'vitest';

export interface MockAnimationRecord {
  readonly target: Element;
  readonly keyframes: Keyframe[];
  readonly options: KeyframeAnimationOptions;
  readonly cancel: ReturnType<typeof vi.fn>;
  /** Resolves the animation's `finished` promise. */
  finish(): void;
}

export interface AnimationController {
  readonly animations: ReadonlyArray<MockAnimationRecord>;
  /** Remove `Element.prototype.animate` entirely, to test the degrade-to-instant path. */
  removeAnimateSupport(): void;
  restore(): void;
}

let activeAnimationController: AnimationController | null = null;

export function installMockAnimation(): AnimationController {
  if (activeAnimationController !== null) {
    throw new Error('Animation mock is already installed. Call restore() before installing again.');
  }

  const hadAnimate = Object.prototype.hasOwnProperty.call(Element.prototype, 'animate');
  const previousAnimate = Element.prototype.animate;
  const animations: MockAnimationRecord[] = [];
  let restored = false;

  const animateFn = vi.fn(function (
    this: Element,
    keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
    options?: number | KeyframeAnimationOptions
  ) {
    let resolveFinished!: (value?: unknown) => void;
    let rejectFinished!: (reason?: unknown) => void;
    const finished = new Promise<unknown>((resolve, reject) => {
      resolveFinished = resolve;
      rejectFinished = reject;
    });

    const cancel = vi.fn(() => {
      rejectFinished(new DOMException('The animation was aborted', 'AbortError'));
    }) as unknown as ReturnType<typeof vi.fn>;

    const finish = () => {
      resolveFinished();
    };

    const animObj = {
      finished,
      cancel,
      finish,
      play: vi.fn(),
      pause: vi.fn(),
    };

    const normalizedOptions = (typeof options === 'number' ? { duration: options } : (options ?? {})) as KeyframeAnimationOptions;

    const record: MockAnimationRecord = {
      target: this,
      keyframes: (keyframes ?? []) as Keyframe[],
      options: normalizedOptions,
      cancel,
      finish,
    };

    animations.push(record);
    return animObj as unknown as Animation;
  });

  Element.prototype.animate = animateFn as unknown as typeof Element.prototype.animate;

  const controller: AnimationController = {
    get animations(): ReadonlyArray<MockAnimationRecord> {
      return animations;
    },

    removeAnimateSupport(): void {
      delete (Element.prototype as { animate?: unknown }).animate;
    },

    restore(): void {
      if (restored) return;
      restored = true;
      if (hadAnimate) {
        Element.prototype.animate = previousAnimate;
      } else {
        delete (Element.prototype as { animate?: unknown }).animate;
      }
      animations.length = 0;
      activeAnimationController = null;
    },
  };

  activeAnimationController = controller;
  return controller;
}
