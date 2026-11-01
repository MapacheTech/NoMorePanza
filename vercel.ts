import { type VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  buildCommand: 'npm run build',
  framework: 'nextjs',
  crons: [
    {
      // Ejecuta el corte diario a las 06:05 UTC (00:05 AM hora CDMX) para calcular multas de $50 MXN
      path: '/api/cron/penalties',
      schedule: '5 6 * * *',
    },
  ],
};
