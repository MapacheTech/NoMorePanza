'use client';

import React from 'react';
import { UserProfile, WorkoutLog } from '@/types/fitness';
import {
  FREE_REST_DAYS_PER_WEEK,
  getCurrentWeekDaysISO,
  getMexicoTodayISO,
} from '@/lib/penalty-engine';
import { CalendarDays } from 'lucide-react';

interface WeeklyCalendarTrackerProps {
  profiles: UserProfile[];
  logs: WorkoutLog[];
}

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function WeeklyCalendarTracker({
  profiles,
  logs,
}: WeeklyCalendarTrackerProps) {
  const todayISO = getMexicoTodayISO();
  const weekDays = getCurrentWeekDaysISO(todayISO);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-emerald-400" />
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-white">
              Control Semanal de Asistencia y Descansos (Lunes a Domingo)
            </h3>
            <p className="text-xs text-zinc-400">
              ✅ Entrenó con foto • 🛌 Descanso libre (máx 2/sem) • 💸 Multa de
              $50 MXN (&gt;2 faltas)
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400">
              <th className="py-2.5 pr-4 font-bold">Integrante</th>
              {weekDays.map((dayISO, idx) => {
                const isToday = dayISO === todayISO;
                return (
                  <th
                    key={dayISO}
                    className={`px-2.5 py-2.5 text-center ${
                      isToday ? 'text-emerald-400 font-black' : ''
                    }`}
                  >
                    <div>{DAY_LABELS[idx]}</div>
                    <div className="text-[10px] opacity-75">
                      {dayISO.slice(8, 10)}/{dayISO.slice(5, 7)}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-800/60">
            {profiles.map((profile) => {
              let missedCountThisWeek = 0;

              return (
                <tr key={profile.id}>
                  <td className="py-3 pr-4 font-bold text-white whitespace-nowrap">
                    {profile.full_name}
                  </td>
                  {weekDays.map((dayISO) => {
                    const log = logs.find(
                      (l) =>
                        l.user_id === profile.id && l.workout_date === dayISO
                    );
                    const isPast = dayISO < todayISO;
                    const isToday = dayISO === todayISO;

                    let cellBadge = (
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-600">
                        •
                      </span>
                    );

                    if (log?.log_type === 'workout') {
                      cellBadge = (
                        <span
                          title={`${log.activity_type} (${log.duration_minutes}m, ${log.calories_burned} kcal)`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/20 text-sm"
                        >
                          ✅
                        </span>
                      );
                    } else if (
                      log?.log_type === 'rest' ||
                      (!log && isPast)
                    ) {
                      missedCountThisWeek += 1;
                      if (missedCountThisWeek <= FREE_REST_DAYS_PER_WEEK) {
                        cellBadge = (
                          <span
                            title={`Descanso libre #${missedCountThisWeek} de 2 ($0 MXN)`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-500/40 bg-sky-500/15 text-sm"
                          >
                            🛌
                          </span>
                        );
                      } else {
                        cellBadge = (
                          <span
                            title={`Falta #${missedCountThisWeek} en la semana -> Multa de $50 MXN`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/50 bg-rose-500/25 text-xs font-black text-rose-300"
                          >
                            -$50
                          </span>
                        );
                      }
                    } else if (isToday && !log) {
                      cellBadge = (
                        <span
                          title="Pendiente de registrar hoy"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/15 text-xs font-bold text-amber-300 animate-pulse"
                        >
                          ⏳
                        </span>
                      );
                    }

                    return (
                      <td key={dayISO} className="px-2 py-2.5 text-center">
                        {cellBadge}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
