/** Typed application configuration, read once at boot. */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  frontendUrl: string;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  cookie: {
    domain: string;
    secure: boolean;
  };
  ai: {
    provider: 'mock' | 'anthropic';
    apiKey: string | null;
    model: string;
  };
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

export default (): AppConfig => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  // Secrets may only fall back to a development placeholder outside production.
  const devFallback = nodeEnv === 'production' ? undefined : 'kosvia-dev-secret';

  const provider = (process.env.AI_PROVIDER ?? 'mock').toLowerCase();
  if (provider !== 'mock' && provider !== 'anthropic') {
    throw new Error(`Unsupported AI_PROVIDER "${provider}". Use "mock" or "anthropic".`);
  }

  return {
    nodeEnv,
    port: Number(process.env.API_PORT ?? 3001),
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    jwt: {
      accessSecret: required('JWT_SECRET', devFallback),
      refreshSecret: required('JWT_REFRESH_SECRET', devFallback && `${devFallback}-refresh`),
      accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
      refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
    },
    cookie: {
      domain: process.env.COOKIE_DOMAIN ?? 'localhost',
      secure: process.env.COOKIE_SECURE === 'true',
    },
    ai: {
      provider,
      apiKey: process.env.AI_API_KEY || null,
      model: process.env.AI_MODEL ?? 'claude-sonnet-4-5',
    },
  };
};
