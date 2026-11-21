import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Efek mengetik halus: 15 ms per karakter.
 * Untuk balasan panjang, jumlah karakter per tick dinaikkan supaya total
 * durasi tidak lebih dari ±maxMs (kode ribuan baris tidak perlu menunggu menit).
 */
export function useTypewriter(fullText, enabled, { speed = 15, maxMs = 6000 } = {}) {
  const [count, setCount] = useState(enabled ? 0 : fullText.length);
  const progress = useRef(enabled ? 0 : fullText.length);

  useEffect(() => {
    if (!enabled) {
      progress.current = fullText.length;
      setCount(fullText.length);
      return undefined;
    }
    const perTick = Math.max(1, Math.ceil(fullText.length / (maxMs / speed)));
    const id = setInterval(() => {
      progress.current = Math.min(fullText.length, progress.current + perTick);
      setCount(progress.current);
      if (progress.current >= fullText.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [fullText, enabled, speed, maxMs]);

  const skip = useCallback(() => {
    progress.current = fullText.length;
    setCount(fullText.length);
  }, [fullText]);

  const done = !enabled || count >= fullText.length;
  return { text: done ? fullText : fullText.slice(0, count), done, skip };
}
