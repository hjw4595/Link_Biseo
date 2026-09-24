import { dateInZone } from '@/lib/time-zone';
export const usageTimezone = 'Asia/Seoul';
export function seoulDate(value: string | number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: usageTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}
export function previousDate(day: string, days = 1): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) - days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}
export function usageDateLabel(
  value: string | null,
  today: string | null,
  timeZone = usageTimezone,
): string {
  if (!value) return '사용 기록 없음';
  const day = dateInZone(value, timeZone);
  if (today && day === today) return '오늘';
  if (today && day === previousDate(today)) return '어제';
  return day.replaceAll('-', '.');
}
