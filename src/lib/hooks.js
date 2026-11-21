import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  subscribe,
  getConversations,
  getSettings,
  getUi,
  getRate,
  getActivity,
  computeStreak,
} from './storage';
import { computeQuota } from './rateLimit';
import { subscribeFiles, getFilesState } from './files';

export function useConversations() {
  return useSyncExternalStore(subscribe, getConversations, getConversations);
}

export function useSettings() {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}

export function useUi() {
  return useSyncExternalStore(subscribe, getUi, getUi);
}

export function useFiles() {
  return useSyncExternalStore(subscribeFiles, getFilesState, getFilesState);
}

export function useActivity() {
  return useSyncExternalStore(subscribe, getActivity, getActivity);
}

export function useStreak() {
  const days = useActivity();
  return useMemo(() => computeStreak(days), [days]);
}

export function useNow(interval = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}

// Kuota reaktif. Dicek ulang tiap 20 detik supaya jendela 24 jam bergeser sendiri.
export function useQuota() {
  const rate = useSyncExternalStore(subscribe, getRate, getRate);
  const now = useNow(20000);
  return useMemo(() => computeQuota(rate.timestamps, now), [rate, now]);
}

function subscribeOnline(cb) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

export function useOnline() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = () => setMatches(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
}
