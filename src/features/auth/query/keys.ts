export const authQueryKeys = {
  auth: (userId: string) => [userId, 'auth'] as const,
};
