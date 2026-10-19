import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { NAMES } from '@pip-it-up/e2e-contract';

/** The "Events" log: one <li> per entry, appended in order. */
const LogContext = createContext<(entry: string) => void>(() => {});
export const useLog = () => useContext(LogContext);

export function LogProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<string[]>([]);
  // A ref-backed writer so callbacks passed to the library never change identity.
  const write = useRef((entry: string) => setEntries((prev) => [...prev, entry])).current;
  return (
    <LogContext.Provider value={write}>
      {children}
      <ul role="log" aria-label={NAMES.log}>
        {entries.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    </LogContext.Provider>
  );
}

/** A canvas.captureStream() video: no codec needed, plays in every engine. */
export function StreamVideo({
  label,
  autoPlay = false,
  videoRef,
}: {
  label: string;
  autoPlay?: boolean;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}) {
  const ownRef = useRef<HTMLVideoElement>(null);
  const ref = videoRef ?? ownRef;
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext('2d')!;
    let frame = 0;
    const timer = setInterval(() => {
      ctx.fillStyle = `hsl(${(frame++ * 7) % 360}, 80%, 50%)`;
      ctx.fillRect(0, 0, 160, 90);
    }, 50);
    const video = ref.current!;
    video.muted = true;
    video.srcObject = canvas.captureStream(30);
    if (autoPlay) void video.play().catch(() => {});
    return () => clearInterval(timer);
  }, [autoPlay]);
  return <video ref={ref} aria-label={label} width={160} height={90} playsInline />;
}
