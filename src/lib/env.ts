import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 chars'),
    AUTH_URL: z.string().url(),
  },
  client: {
    NEXT_PUBLIC_DATA_SOURCE: z.enum(['static', 'api']).default('static'),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    NEXT_PUBLIC_DATA_SOURCE: process.env.NEXT_PUBLIC_DATA_SOURCE,
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === 'true',
});
