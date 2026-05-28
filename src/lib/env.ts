import { z } from 'zod';

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STRIPE_ENCRYPTION_KEY: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let _cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (_cached) return _cached;
  const result = serverSchema.safeParse(process.env);
  if (!result.success) {
    const missing = Object.keys(result.error.flatten().fieldErrors).join(', ');
    throw new Error(`Variáveis de ambiente inválidas ou ausentes: ${missing}`);
  }
  _cached = result.data;
  return _cached;
}
