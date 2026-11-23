export const presetQueryKeys = {
  presets: (userId: string) => [userId, 'quick-launch-presets'] as const,
  presetList: (userId: string) =>
    [userId, 'quick-launch-presets', 'list'] as const,
  preset: (userId: string, id: string) =>
    [userId, 'quick-launch-presets', 'detail', id] as const,
};
