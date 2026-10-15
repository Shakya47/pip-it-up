import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { bridgeReactEvents } from '../src/reactEventBridge';

/**
 * Render `ui` inside a wrapper, then move `ui`'s element into a second document (a stand-in PiP
 * window). Unmounting only removes the wrapper, so the moved node doesn't break cleanup.
 */
function renderMoved(ui: React.ReactElement) {
  const { container } = render(<section>{ui}</section>);
  const content = container.firstElementChild!.firstElementChild as HTMLElement;
  const pipDoc = document.implementation.createHTMLDocument('pip');
  pipDoc.body.append(content);
  return { content, pipDoc };
}

const click = (el: Element) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

describe('bridgeReactEvents', () => {
  it('a moved node does not run React handlers without the bridge', () => {
    const onClick = vi.fn();
    const { content } = renderMoved(<div><button onClick={onClick}>b</button></div>);

    click(content.querySelector('button')!);

    expect(onClick).not.toHaveBeenCalled();
  });

  it('runs React handlers of the moved content exactly once, with the real target', () => {
    const onClick = vi.fn((e: React.MouseEvent) => e.target);
    const onParentClick = vi.fn();
    const { content, pipDoc } = renderMoved(
      <div onClick={onParentClick}>
        <button onClick={onClick}>b</button>
      </div>
    );
    bridgeReactEvents(pipDoc, content);
    const button = content.querySelector('button')!;

    click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.results[0].value).toBe(button);
    expect(onParentClick).toHaveBeenCalledTimes(1);
  });

  it('copies preventDefault() and stopPropagation() back to the original event', () => {
    const { content, pipDoc } = renderMoved(
      <div>
        <a href="#x" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>a</a>
      </div>
    );
    bridgeReactEvents(pipDoc, content);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    const stop = vi.spyOn(event, 'stopPropagation');

    content.querySelector('a')!.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('stopPropagation() in a capture handler keeps the bubble handlers from running, as in the page', () => {
    const onClick = vi.fn();
    const { content, pipDoc } = renderMoved(
      <div onClickCapture={(e) => e.stopPropagation()}>
        <button onClick={onClick}>b</button>
      </div>
    );
    bridgeReactEvents(pipDoc, content);

    click(content.querySelector('button')!);

    expect(onClick).not.toHaveBeenCalled();
  });

  // Animation events: jsdom has no AnimationEvent, so React listens for `webkitAnimationEnd` there;
  // browsers use the plain names. RX14 (e2e) checks onAnimationEnd in a real PiP window.
  it('bridges transition events', () => {
    const onTransitionEnd = vi.fn();
    const { content, pipDoc } = renderMoved(
      <div onTransitionEnd={onTransitionEnd}>
        <span>s</span>
      </div>
    );
    bridgeReactEvents(pipDoc, content);

    content.querySelector('span')!.dispatchEvent(new Event('transitionend', { bubbles: true }));

    expect(onTransitionEnd).toHaveBeenCalledTimes(1);
  });

  it('ignores events outside the content and stops after dispose', () => {
    const onClick = vi.fn();
    const { content, pipDoc } = renderMoved(<div><button onClick={onClick}>b</button></div>);
    const dispose = bridgeReactEvents(pipDoc, content);
    const outside = pipDoc.createElement('p');
    pipDoc.body.append(outside);

    click(outside);
    dispose();
    click(content.querySelector('button')!);

    expect(onClick).not.toHaveBeenCalled();
  });

  it('bridges input events, so a controlled onChange sees the new value', () => {
    const onChange = vi.fn((e: React.ChangeEvent<HTMLInputElement>) => e.target.value);
    const { content, pipDoc } = renderMoved(<div><input defaultValue="" onChange={onChange} /></div>);
    bridgeReactEvents(pipDoc, content);
    const input = content.querySelector('input')!;

    // The prototype setter bypasses React's value tracker, as typing does.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'hi');
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.results[0].value).toBe('hi');
  });

  it('stamps copies with pipItUpBridged, so window capture listeners in the page can skip them', () => {
    const seen: Array<boolean | undefined> = [];
    const onCapture = (e: Event) => seen.push((e as Event & { pipItUpBridged?: boolean }).pipItUpBridged);
    window.addEventListener('click', onCapture, true);
    const onClick = vi.fn((e: React.MouseEvent) => (e.nativeEvent as Event & { pipItUpBridged?: boolean }).pipItUpBridged);
    try {
      const { content, pipDoc } = renderMoved(<div><button onClick={onClick}>b</button></div>);
      bridgeReactEvents(pipDoc, content);

      click(content.querySelector('button')!);

      // The copy is dispatched in the page, so the page's capture phase does see it: marked.
      expect(seen).toEqual([true]);
      expect(onClick.mock.results[0].value).toBe(true);
      expect(Object.keys(onClick.mock.calls[0][0].nativeEvent)).not.toContain('pipItUpBridged');
    } finally {
      window.removeEventListener('click', onCapture, true);
    }
  });

  it('reads target-relative fields and composedPath() from the original event', () => {
    const read = vi.fn((e: React.MouseEvent) => {
      const n = e.nativeEvent as MouseEvent & { layerX?: number };
      return { offsetX: n.offsetX, pageY: n.pageY, path: n.composedPath() };
    });
    const { content, pipDoc } = renderMoved(<div><button onClick={read}>b</button></div>);
    bridgeReactEvents(pipDoc, content);
    const button = content.querySelector('button')!;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 5, clientY: 6 });
    Object.defineProperty(event, 'offsetX', { value: 11 });
    Object.defineProperty(event, 'pageY', { value: 22 });

    button.dispatchEvent(event);

    const { offsetX, pageY, path } = read.mock.results[0].value;
    expect(offsetX).toBe(11);
    expect(pageY).toBe(22);
    expect(path[0]).toBe(button);
    expect(path).toContain(pipDoc);
  });
});
