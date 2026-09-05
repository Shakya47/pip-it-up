/**
 * Interval (ms) for polling `pipWindow.closed`.
 * Required because some browsers do not reliably fire `pagehide`/`unload` when the PiP
 * window is closed via the OS window chrome.
 */
export const CLOSE_POLL_MS = 250;
