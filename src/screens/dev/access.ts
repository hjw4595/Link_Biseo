// Server route entry points must check this before mounting preview providers.
export function devPreviewsEnabled(
  environment: {
    NODE_ENV?: string;
    ENABLE_DEV_PREVIEWS?: string;
  } = process.env,
): boolean {
  return (
    environment.NODE_ENV === 'development' &&
    environment.ENABLE_DEV_PREVIEWS === 'true'
  );
}
