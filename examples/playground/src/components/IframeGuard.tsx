export function IframeGuard() {
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  if (!isInIframe) return null;

  return (
    <div className="p-4 border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 rounded-md shadow-sm">
      <p className="font-semibold mb-1">⚠️ Iframe Context Detected</p>
      <p className="text-sm">
        Modern browser security restricts the <strong>Document Picture-in-Picture API</strong> inside iframes.
        To test these demos successfully, please click the native <strong>"Open in New Window" / "Open in New Tab"</strong> button in the top-right corner of your sandbox preview panel!
      </p>
    </div>
  );
}
