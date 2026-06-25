import type { NextConfig } from "next";
// @ts-expect-error next-pwa doesn't have full type definitions
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  cacheOnFrontEndNav: true,
  reloadOnOnline: true,
});

const nextConfig: NextConfig = {
  turbopack: {},
};

export default withPWA(nextConfig);
