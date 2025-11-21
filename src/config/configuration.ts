export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/elsehub?schema=public',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  jwt: {
    access: {
      secret: process.env.JWT_ACCESS_SECRET ?? 'change-me-access',
      expiresIn: process.env.JWT_ACCESS_EXPIRES ?? '900s',
    },
    refresh: {
      secret: process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh',
      expiresIn: process.env.JWT_REFRESH_EXPIRES ?? '7d',
    },
  },
  throttler: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL ?? '60', 10),
    limit: parseInt(process.env.RATE_LIMIT_MAX ?? '30', 10),
  },
  bullmq: {
    prefix: process.env.BULLMQ_PREFIX ?? 'elsehu',
  },
  storage: {
    basePath: process.env.STORAGE_PATH ?? './storage',
  },
  cors: {
    allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },
});
