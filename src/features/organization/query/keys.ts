export const organizationQueryKeys = {
  organizationReports: (userId: string) =>
    [userId, 'organization-reports'] as const,
  organizationReport: (userId: string, timeZone: string) =>
    [userId, 'organization-reports', timeZone] as const,
  organizationRevision: (userId: string) =>
    [userId, 'organization-revision'] as const,
};
