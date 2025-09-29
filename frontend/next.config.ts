const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ⚠️ Позволяет Next.js собирать проект, даже если есть ошибки типов.
    ignoreBuildErrors: true,
  },
};

module.exports = withSentryConfig(nextConfig, { silent: true });
