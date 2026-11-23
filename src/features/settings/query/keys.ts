export const usageSummaryQueryKeys = {
  usageSummaries: (userId: string) => [userId, 'usage-summary'] as const,
  usageSummary: (userId: string, timeZone: string, deviceDay: string | null) =>
    [userId, 'usage-summary', timeZone, deviceDay] as const,
};
