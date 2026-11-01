import { PenaltyRecord, UserProfile, WorkoutLog } from '@/types/fitness';
import { getCurrentWeekDaysISO, getMexicoTodayISO } from './penalty-engine';

export function getInitialDemoData() {
  const today = getMexicoTodayISO();
  const weekDays = getCurrentWeekDaysISO(today);

  const profiles: UserProfile[] = [
    {
      id: 'user-1',
      email: 'carlos.familia@gmail.com',
      full_name: 'Carlos (Tú)',
      watch_brand: 'apple',
      strava_connected: true,
    },
    {
      id: 'user-2',
      email: 'sofia.fit@gmail.com',
      full_name: 'Sofía (Hermana)',
      watch_brand: 'samsung',
      strava_connected: true,
    },
    {
      id: 'user-3',
      email: 'diego.primo@gmail.com',
      full_name: 'Diego (Primo)',
      watch_brand: 'huawei',
      strava_connected: false,
    },
    {
      id: 'user-4',
      email: 'tio.memo@gmail.com',
      full_name: 'Tío Memo',
      watch_brand: 'samsung',
      strava_connected: false,
    },
  ];

  const logs: WorkoutLog[] = [
    {
      id: 'log-1',
      user_id: 'user-1',
      user_name: 'Carlos (Tú)',
      workout_date: weekDays[0],
      log_type: 'workout',
      watch_brand: 'apple',
      sync_source: 'strava_oauth',
      activity_type: 'Pesas + HIIT Funcional',
      duration_minutes: 58,
      calories_burned: 540,
      avg_heart_rate: 146,
      max_heart_rate: 178,
      steps: 6420,
      proof_photo_url:
        'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=80',
      notes: 'Pierna pesada + 15 min de escaladora. Apple Watch cerrado al 100%.',
      created_at: `${weekDays[0]}T19:30:00Z`,
    },
    {
      id: 'log-2',
      user_id: 'user-2',
      user_name: 'Sofía (Hermana)',
      workout_date: weekDays[0],
      log_type: 'workout',
      watch_brand: 'samsung',
      sync_source: 'strava_oauth',
      activity_type: 'Indoor Cycling + Core',
      duration_minutes: 50,
      calories_burned: 485,
      avg_heart_rate: 152,
      max_heart_rate: 181,
      steps: 5120,
      proof_photo_url:
        'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=80',
      notes: 'Clase de spinning completada con el Galaxy Watch 7.',
      created_at: `${weekDays[0]}T20:10:00Z`,
    },
    {
      id: 'log-3',
      user_id: 'user-3',
      user_name: 'Diego (Primo)',
      workout_date: weekDays[0],
      log_type: 'workout',
      watch_brand: 'huawei',
      sync_source: 'watch_screenshot',
      activity_type: 'Running 5K Nocturno',
      duration_minutes: 34,
      calories_burned: 390,
      avg_heart_rate: 158,
      max_heart_rate: 184,
      steps: 7850,
      proof_photo_url:
        'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=900&q=80',
      notes: 'Huawei Watch GT4 marcando ritmo de 5:45/km.',
      created_at: `${weekDays[0]}T21:15:00Z`,
    },
    {
      id: 'log-4',
      user_id: 'user-2',
      user_name: 'Sofía (Hermana)',
      workout_date: weekDays[1],
      log_type: 'workout',
      watch_brand: 'samsung',
      sync_source: 'web_bluetooth',
      activity_type: 'CrossFit WOD Murph Prep',
      duration_minutes: 62,
      calories_burned: 610,
      avg_heart_rate: 155,
      max_heart_rate: 185,
      steps: 7300,
      proof_photo_url:
        'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=900&q=80',
      notes: 'Sudando la gota gorda hoy.',
      created_at: `${weekDays[1]}T18:45:00Z`,
    },
  ];

  const penalties: PenaltyRecord[] = [
    {
      id: 'pen-1',
      user_id: 'user-4',
      user_name: 'Tío Memo',
      penalty_date: weekDays[0],
      week_start: weekDays[0],
      amount_mxn: 50,
      reason: 'Falta #3 acumulada sin subir foto ni datos del reloj (Multa de $50 MXN)',
      is_paid: false,
    },
    {
      id: 'pen-2',
      user_id: 'user-4',
      user_name: 'Tío Memo',
      penalty_date: weekDays[1],
      week_start: weekDays[0],
      amount_mxn: 50,
      reason: 'Falta #4 acumulada sin subir foto de prueba (Multa de $50 MXN)',
      is_paid: false,
    },
    {
      id: 'pen-3',
      user_id: 'user-3',
      user_name: 'Diego (Primo)',
      penalty_date: weekDays[1],
      week_start: weekDays[0],
      amount_mxn: 50,
      reason: 'Excedió los 2 días de descanso libres de la semana ($50 MXN)',
      is_paid: true,
      paid_at: `${weekDays[1]}T22:00:00Z`,
    },
  ];

  return { profiles, logs, penalties };
}
