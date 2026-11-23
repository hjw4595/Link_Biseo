export const categoryQueryKeys = {
  categories: (userId: string) => [userId, 'categories'] as const,
  categorySummary: (userId: string) =>
    [userId, 'categories', 'summary'] as const,
};
