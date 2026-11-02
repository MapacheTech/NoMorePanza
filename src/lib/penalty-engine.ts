import {
  LeaderboardEntry,
  PenaltyRecord,
  UserProfile,
  WatchBrand,
  WorkoutLog,
} from '@/types/fitness';

export const PENALTY_AMOUNT_MXN = 50;
export const FREE_REST_DAYS_PER_WEEK = 3;
export const REQUIRED_WORKOUT_DAYS_PER_WEEK = 4;
export const CHALLENGE_START_DATE_ISO = '2026-11-02';

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

export function toMexicoDateISO(dateStr?: string): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
  } catch {
    return null;
  }
}

/**
 * Obtiene los 7 días (Lunes a Domingo) de la semana activa del reto.
 * Si hoy es antes del inicio del reto (2026-11-02), muestra la Semana 1 (desde el Lunes 2 de Noviembre).
 */
export function getCurrentWeekDaysISO(referenceDateISO?: string): string[] {
  const rawDate = referenceDateISO || getMexicoTodayISO();
  const baseStr =
    rawDate < CHALLENGE_START_DATE_ISO ? CHALLENGE_START_DATE_ISO : rawDate;

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
  if (penaltyDays === 0 && totalWorkouts >= 8) return 'Máquina Imparable 🔥';
  if (penaltyDays === 0 && weekWorkouts >= REQUIRED_WORKOUT_DAYS_PER_WEEK)
    return 'Meta Semanal Cumplida 🏆';
  if (penaltyDays >= 3) return 'Patrocinador del Cochinito 🐷💸';
  if (penaltyDays >= 1) return 'Deudor en Rehabilitación ⚠️';
  return 'Atleta Activo ⚡';
}

export function getWatchLabel(brand: WatchBrand): string {
  switch (brand) {
    case 'apple':
      return 'Apple Watch';
    case 'samsung':
      return 'Samsung Watch';
    case 'huawei':
      return 'Huawei Watch';
    case 'garmin':
      return 'Garmin Watch';
    default:
      return 'Smartwatch';
  }
}

/**
 * Calcula la tabla gamificada y las multas aplicando la regla oficial:
 * - El reto inicia el 2 de noviembre de 2026 (2026-11-02).
 * - 3 días de descanso libres por semana sin multa (meta de 4 entrenamientos/semana).
 * - A partir del 4to día sin entrenar en una misma semana -> $50 MXN por cada día fallado.
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
  const elapsedWeekDays = currentWeekDays.filter(
    (d) => d >= CHALLENGE_START_DATE_ISO && d <= todayISO
  );

  const logsByUser = new Map<string, WorkoutLog[]>();
  for (const log of logs) {
    const list = logsByUser.get(log.user_id) || [];
    list.push(log);
    logsByUser.set(log.user_id, list);
  }

  const allComputedPenalties: PenaltyRecord[] = explicitPenalties.filter(
    (p) => p.penalty_date >= CHALLENGE_START_DATE_ISO
  );
  const existingPenaltyKey = new Set(
    allComputedPenalties.map((p) => `${p.user_id}_${p.penalty_date}`)
  );

  const entries: LeaderboardEntry[] = profiles.map((profile) => {
    const userLogs = logsByUser.get(profile.id) || [];
    const workoutMap = new Map<string, WorkoutLog>();
    for (const l of userLogs) {
      workoutMap.set(l.workout_date, l);
    }

    const rawJoinedISO = toMexicoDateISO(profile.created_at) || todayISO;
    const effectiveStartISO =
      rawJoinedISO < CHALLENGE_START_DATE_ISO
        ? CHALLENGE_START_DATE_ISO
        : rawJoinedISO;

    let missedInCurrentWeek = 0;
    for (const dayISO of elapsedWeekDays) {
      if (dayISO < effectiveStartISO) {
        continue;
      }

      const logForDay = workoutMap.get(dayISO);
      const isPastDay = dayISO < todayISO;
      const isDeclaredRestToday =
        dayISO === todayISO && logForDay?.log_type === 'rest';

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
      } else if (
        logForDay?.log_type === 'rest' &&
        (isPastDay || isDeclaredRestToday)
      ) {
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

    const userPenalties = allComputedPenalties.filter(
      (p) => p.user_id === profile.id
    );
    const penaltyDays = userPenalties.length;
    const totalFineMxn = userPenalties.reduce((sum, p) => sum + p.amount_mxn, 0);
    const unpaidFineMxn = userPenalties
      .filter((p) => !p.is_paid)
      .reduce((sum, p) => sum + p.amount_mxn, 0);

    const remainingRestDays = Math.max(
      0,
      FREE_REST_DAYS_PER_WEEK - missedInCurrentWeek
    );

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
      current_streak: validWorkouts.length,
      badge: getBadgeForStats(weekWorkouts, penaltyDays, validWorkouts.length),
    };
  });

  const leaderboard = entries.toSorted((a, b) => {
    if (b.xp_score !== a.xp_score) return b.xp_score - a.xp_score;
    return b.total_workouts - a.total_workouts;
  });

  const totalPotMXN = allComputedPenalties.reduce(
    (sum, p) => sum + p.amount_mxn,
    0
  );

  return {
    leaderboard,
    computedPenalties: allComputedPenalties.toSorted((a, b) =>
      a.penalty_date < b.penalty_date ? 1 : -1
    ),
    totalPotMXN,
  };
}
