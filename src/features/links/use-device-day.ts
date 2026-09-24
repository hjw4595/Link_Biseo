'use client';
import { useSyncExternalStore } from 'react';
import { deviceTimeZone, dateInZone, nextDayDelay } from '@/lib/time-zone';
function snapshot() {
  const timeZone = deviceTimeZone();
  const date = dateInZone(Date.now(), timeZone);
  return `${timeZone}|${date}`;
}
function subscribe(notify: () => void) {
  let timer: ReturnType<typeof setTimeout>;
  const resume = () => {
    notify();
    clearTimeout(timer);
    timer = setTimeout(resume, nextDayDelay(Date.now(), deviceTimeZone()));
  };
  resume();
  window.addEventListener('focus', resume);
  document.addEventListener('visibilitychange', resume);
  return () => {
    clearTimeout(timer);
    window.removeEventListener('focus', resume);
    document.removeEventListener('visibilitychange', resume);
  };
}
export function useDeviceDay() {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
