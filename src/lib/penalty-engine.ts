import {
  LeaderboardEntry,
  PenaltyRecord,
  UserProfile,
  WatchBrand,
  WorkoutLog,
} from '@/types/fitness';

export const PENALTY_AMOUNT_MXN = 50;
export const FREE_REST_DAYS_PER_WEEK = 2;
export const REQUIRED_WORKOUT_DAYS_PER_WEEK = 5;

export function getMexicoTodayISO(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Obtiene los 7 días (Lunes a Domingo) de la semana actual en formato YYYY-MM-DD
 */
export function getCurrentWeekDaysISO(referenceDateISO?: string): string[] {
  const baseStr = referenceDateISO || getMexicoTodayISO();
  const [year, month, day] = baseStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay(); // 0 = Domingo, 1 = Lunes, ...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diffToMonday);

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const current = new Date(monday);
    current.setUTCDate(monday.getUTCDate() + i);
    days.push(current.toISOString().slice(0, 10));
  }
  return days;
}

export function getBadgeForStats(
  weekWorkouts: number,
  penaltyDays: number,
  totalWorkouts: number
): string {
  if (penaltyDays === 0 && totalWorkouts >= 10) return 'Máquina Imparable 🔥';
  if (penaltyDays === 0 && weekWorkouts >= 4) return 'Cero Multas 🛡️';
  if (penaltyDays >= 3) return 'Patrocinador del Cochinito 🐷💸';
  if (penaltyDays >= 1) return 'Deudor en Rehabilitación ⚠️';
  return 'Atleta en Ascenso ⚡';
}

export function getWatchLabel(brand: WatchBrand): string {
  switch (brand) {
    case 'apple':
      return 'Apple Watch (HealthKit)';
    case 'samsung':
      return 'Samsung Galaxy Watch (Health)';
    case 'huawei':
      return 'Huawei Watch (Huawei Health)';
    case 'garmin':
      return 'Garmin Connect';
    default:
      return 'Smartwatch / Sensor BLE';
  }
}

/**
 * Calcula la tabla gamificada y las multas aplicando la regla:
 * - 2 días de descanso libres por semana sin multa.
 * - A partir del 3er día sin entrenar en una misma semana -> $50 MXN por cada día fallado.
 */
export function buildGamifiedLeaderboard(
  profiles: UserProfile[],
  logs: WorkoutLog[],
  explicitPenalties: PenaltyRecord[],
  todayISO: string = getMexicoTodayISO()
): {
  leaderboard: LeaderboardEntry[];
  computedPenalties: PenaltyRecord[];
  totalPotMXN: number;
} {
  const currentWeekDays = getCurrentWeekDaysISO(todayISO);
  const weekStart = currentWeekDays[0];
  const elapsedWeekDays = currentWeekDays.filter((d) => d <= todayISO);

  // Agrupar logs por usuario
  const logsByUser = new Map<string, WorkoutLog[]>();
  for (const log of logs) {
    const list = logsByUser.get(log.user_id) || [];
    list.push(log);
    logsByUser.set(log.user_id, list);
  }

  const allComputedPenalties: PenaltyRecord[] = [...explicitPenalties];
  const existingPenaltyKey = new Set(
    explicitPenalties.map((p) => `${p.user_id}_${p.penalty_date}`)
  );

  const entries: LeaderboardEntry[] = profiles.map((profile) => {
    const userLogs = logsByUser.get(profile.id) || [];
    const workoutMap = new Map<string, WorkoutLog>();
    for (const l of userLogs) {
      workoutMap.set(l.workout_date, l);
    }

    // Evaluar días transcurridos de la semana actual (hasta ayer, o hoy si ya declaró descanso)
    let missedInCurrentWeek = 0;
    for (const dayISO of elapsedWeekDays) {
      const logForDay = workoutMap.get(dayISO);
      const isPastDay = dayISO < todayISO;
      const isDeclaredRestToday = dayISO === todayISO && logForDay?.log_type === 'rest';

      if (!logForDay && isPastDay) {
        missedInCurrentWeek++;
        if (missedInCurrentWeek > FREE_REST_DAYS_PER_WEEK) {
          const key = `${profile.id}_${dayISO}`;
          if (!existingPenaltyKey.has(key)) {
            existingPenaltyKey.add(key);
            allComputedPenalties.push({
              id: `auto_${profile.id}_${dayISO}`,
              user_id: profile.id,
              user_name: profile.full_name,
              penalty_date: dayISO,
              week_start: weekStart,
              amount_mxn: PENALTY_AMOUNT_MXN,
              reason: `Falta #${missedInCurrentWeek} en la semana (superó los ${FREE_REST_DAYS_PER_WEEK} descansos libres)`,
              is_paid: false,
            });
          }
        }
      } else if (logForDay?.log_type === 'rest' && (isPastDay || isDeclaredRestToday)) {
        missedInCurrentWeek++;
        if (missedInCurrentWeek > FREE_REST_DAYS_PER_WEEK) {
          const key = `${profile.id}_${dayISO}`;
          if (!existingPenaltyKey.has(key)) {
            existingPenaltyKey.add(key);
            allComputedPenalties.push({
              id: `auto_${profile.id}_${dayISO}`,
              user_id: profile.id,
              user_name: profile.full_name,
              penalty_date: dayISO,
              week_start: weekStart,
              amount_mxn: PENALTY_AMOUNT_MXN,
              reason: `Día #${missedInCurrentWeek} de descanso en la semana (máximo ${FREE_REST_DAYS_PER_WEEK} sin multa)`,
              is_paid: false,
            });
          }
        }
      }
    }

    const validWorkouts = userLogs.filter((l) => l.log_type === 'workout');
    const weekWorkouts = validWorkouts.filter((l) =>
      currentWeekDays.includes(l.workout_date)
    ).length;

    const totalCalories = validWorkouts.reduce(
      (sum, l) => sum + (Number(l.calories_burned) || 0),
      0
    );
    const totalMinutes = validWorkouts.reduce(
      (sum, l) => sum + (Number(l.duration_minutes) || 0),
      0
    );

    const userPenalties = allComputedPenalties.filter((p) => p.user_id === profile.id);
    const penaltyDays = userPenalties.length;
    const totalFineMxn = userPenalties.reduce((sum, p) => sum + p.amount_mxn, 0);
    const unpaidFineMxn = userPenalties
      .filter((p) => !p.is_paid)
      .reduce((sum, p) => sum + p.amount_mxn, 0);

    // Calcular racha actual de días entrenados
    let streak = 0;
    const sortedWorkoutDates = validWorkouts
      .map((w) => w.workout_date)
      .sort((a, b) => (a > b ? -1 : 1));
    streak = sortedWorkoutDates.length > 0 ? Math.min(sortedWorkoutDates.length, weekWorkouts + 2) : 0;

    const remainingRestDays = Math.max(0, FREE_REST_DAYS_PER_WEEK - missedInCurrentWeek);

    const xpScore =
      validWorkouts.length * 100 +
      Math.floor(totalCalories / 10) -
      penaltyDays * 75;

    return {
      user_id: profile.id,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      watch_brand: profile.watch_brand,
      total_workouts: validWorkouts.length,
      week_workouts: weekWorkouts,
      week_rest_days_used: missedInCurrentWeek,
      remaining_rest_days_this_week: remainingRestDays,
      total_calories: totalCalories,
      total_minutes: totalMinutes,
      penalty_days: penaltyDays,
      total_fine_mxn: totalFineMxn,
      unpaid_fine_mxn: unpaidFineMxn,
      xp_score: xpScore,
      current_streak: streak,
      badge: getBadgeForStats(weekWorkouts, penaltyDays, validWorkouts.length),
    };
  });

  // Ordenar por XP y días entrenados
  const leaderboard = entries.toSorted((a, b) => {
    if (b.xp_score !== a.xp_score) return b.xp_score - a.xp_score;
    return b.total_workouts - a.total_workouts;
  });

  const totalPotMXN = allComputedPenalties.reduce((sum, p) => sum + p.amount_mxn, 0);

  return {
    leaderboard,
    computedPenalties: allComputedPenalties.toSorted((a, b) =>
      a.penalty_date < b.penalty_date ? 1 : -1
    ),
    totalPotMXN,
  };
}
