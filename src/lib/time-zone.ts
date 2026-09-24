export function normalizeTimeZone(value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    !/^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+)$/.test(value)
  )
    return null;
  try {
    return new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions()
      .timeZone;
  } catch {
    return null;
  }
}
export function deviceTimeZone() {
  try {
    return (
      normalizeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone) ??
      'Asia/Seoul'
    );
  } catch {
    return 'Asia/Seoul';
  }
}
export function dateInZone(value: string | number, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}
export function nextDayDelay(now: number, timeZone: string) {
  const today = dateInZone(now, timeZone);
  let low = now,
    high = now + 27 * 3600000;
  while (high - low > 100) {
    const mid = Math.floor((low + high) / 2);
    if (dateInZone(mid, timeZone) === today) low = mid;
    else high = mid;
  }
  return high - now + 20;
}
