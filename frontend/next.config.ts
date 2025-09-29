const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // другие настройки...
};

module.exports = withSentryConfig(nextConfig, { silent: true });
