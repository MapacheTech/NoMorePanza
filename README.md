# 🏋️‍♂️ NoMorePanza — Reto Fitness Familiar & Amigos ($50 MXN por Falta)

Aplicación web full-stack construida con **Next.js (App Router + TypeScript + Tailwind CSS)**, **Supabase (Postgres, Auth con Google/Correo y Storage)** y lista para desplegarse en **Vercel**.

## ✨ Características Principales

1. **Integración Híbrida con Smartwatches (Opción C — Apple Watch, Samsung Galaxy Watch y Huawei Watch):**
   - **Puente OAuth con Strava (`/api/strava/connect` y `/api/strava/sync`):** Apple Health, Samsung Health y Huawei Health sincronizan nativamente gratis con Strava; la app extrae calorías, duración, frecuencia cardíaca y deporte automáticamente.
   - **Conexión Directa Web Bluetooth (BLE `0x180D`):** Lee el pulso cardíaco en tiempo real desde navegadores compatibles.
   - **Evidencia de Reloj + Captura:** Permite subir la captura de los anillos/resumen del reloj junto con las métricas.
2. **Foto de Prueba Obligatoria (`workout-proofs` bucket en Supabase Storage):**
   - No se puede marcar un día como entrenado sin subir una foto real de prueba (validado tanto en la interfaz como mediante un `CHECK CONSTRAINT` en PostgreSQL).
3. **Regla de 2 Descansos por Semana y Castigo Monetario de $50 MXN:**
   - Cada integrante tiene derecho a **2 días de descanso libres por semana** (Lunes a Domingo, zona horaria `America/Mexico_City`) sin multa.
   - A partir del **3er día sin entrenar en la semana**, se genera automáticamente un cargo de **$50 MXN** al cochinito grupal.
4. **Tabla Gamificada Dual:**
   - **Ranking de Cumplimiento:** Ordenado por puntos XP, días entrenados, calorías y racha.
   - **Tabla de Multas y Deudores ($50 MXN/día):** Muestra quién ha fallado más días, cuánto debe al bote acumulado y permite marcar multas como pagadas.

---

## 🚀 Pasos para Configurar en Supabase y Subir a Vercel

### 1. Configurar la Base de Datos y Storage en Supabase
1. Crea un proyecto en [Supabase](https://supabase.com).
2. Ve al **SQL Editor** y pega el contenido completo de [`supabase/migrations/20261101000000_init_nomorepanza.sql`](./supabase/migrations/20261101000000_init_nomorepanza.sql) y ejecútalo. Esto creará:
   - Tablas `profiles`, `workout_logs`, `penalties` con políticas **Row Level Security (RLS)** seguras.
   - Vista `leaderboard_stats` (`security_invoker = true`).
   - Función `reconcile_weekly_penalties()` para el corte automático de los $50 MXN.
   - Bucket público `workout-proofs` en **Supabase Storage** con permisos `SELECT`, `INSERT` y `UPDATE`.
3. En **Authentication → Providers**, activa **Email** y **Google** (agregando la URL de redirección `https://tu-dominio.vercel.app/auth/callback`).

### 2. Variables de Entorno
Copia `.env.example` a `.env.local` (o configúralas en el panel de **Vercel → Settings → Environment Variables**):

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-o-publishable-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
NEXT_PUBLIC_APP_URL=https://tu-dominio.vercel.app
NEXT_PUBLIC_STRAVA_CLIENT_ID=tu_strava_client_id
STRAVA_CLIENT_SECRET=tu_strava_client_secret
CRON_SECRET=un_secreto_seguro_para_vercel_cron
```

### 3. Desplegar en Vercel
1. Sube este repositorio a GitHub o ejecuta `vercel deploy` desde la terminal.
2. El archivo [`vercel.ts`](./vercel.ts) ya incluye la configuración del **Cron Job** diario (`/api/cron/penalties`) que ejecuta el corte de multas de $50 MXN cada medianoche (hora de México).
