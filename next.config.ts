import type { NextConfig } from 'next';
const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  devIndicators: false,
  logging: { incomingRequests: { ignore: [/\/auth\/callback/] } },
};
export default config;
