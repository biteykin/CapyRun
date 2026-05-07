const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "randomuser.me" }],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ⚠️ Позволяет Next.js собирать проект, даже если есть ошибки типов.
    ignoreBuildErrors: true,
  },
};

module.exports = withSentryConfig(nextConfig, { silent: true });
