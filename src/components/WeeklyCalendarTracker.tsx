'use client';

import React from 'react';
import { UserProfile, WorkoutLog } from '@/types/fitness';
import {
  CHALLENGE_START_DATE_ISO,
  FREE_REST_DAYS_PER_WEEK,
  getCurrentWeekDaysISO,
  getMexicoTodayISO,
  getWatchLabel,
  toMexicoDateISO,
} from '@/lib/penalty-engine';
import { CalendarDays, Watch } from 'lucide-react';

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
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3.5 sm:p-5 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-start sm:items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-white leading-tight">
              Control Semanal (Inicio Oficial: Lunes 2 de Nov)
            </h3>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5">
              ✅ Entrenó • 🛌 Descanso libre (máx 3/sem) • 💸 Multa $50 (&gt;3
              faltas)
            </p>
          </div>
        </div>
      </div>

      {profiles.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-center text-xs text-zinc-400">
          Inicia sesión con tu cuenta de Google o Correo para aparecer en el
          tablero semanal del grupo.
        </div>
      ) : (
        <div className="space-y-2.5">
          {profiles.map((profile) => {
            let missedCountThisWeek = 0;
            const rawJoinedISO =
              toMexicoDateISO(profile.created_at) || todayISO;
            const effectiveStartISO =
              rawJoinedISO < CHALLENGE_START_DATE_ISO
                ? CHALLENGE_START_DATE_ISO
                : rawJoinedISO;

            return (
              <div
                key={profile.id}
                className="rounded-xl border border-zinc-800/90 bg-zinc-950/75 p-3 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-extrabold text-white truncate">
                    {profile.full_name}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400 shrink-0">
                    <Watch className="h-3 w-3 text-emerald-400" />
                    {getWatchLabel(profile.watch_brand)}
                  </span>
                </div>

                {/* Cuadrícula de 7 días adaptada 100% a pantallas móviles sin scroll horizontal */}
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {weekDays.map((dayISO, idx) => {
                    const log = logs.find(
                      (l) =>
                        l.user_id === profile.id && l.workout_date === dayISO
                    );
                    const isBeforeStart = dayISO < effectiveStartISO;
                    const isPast = dayISO < todayISO && !isBeforeStart;
                    const isToday = dayISO === todayISO;

                    let statusIcon = isBeforeStart ? '—' : '•';
                    let boxStyle =
                      'border-zinc-800/80 bg-zinc-900/60 text-zinc-500';

                    if (log?.log_type === 'workout') {
                      statusIcon = '✅';
                      boxStyle =
                        'border-emerald-500/50 bg-emerald-500/20 text-emerald-300';
                    } else if (
                      log?.log_type === 'rest' ||
                      (!log && isPast)
                    ) {
                      missedCountThisWeek += 1;
                      if (missedCountThisWeek <= FREE_REST_DAYS_PER_WEEK) {
                        statusIcon = '🛌';
                        boxStyle =
                          'border-sky-500/40 bg-sky-500/15 text-sky-300';
                      } else {
                        statusIcon = '-$50';
                        boxStyle =
                          'border-rose-500/60 bg-rose-500/25 text-rose-300 font-black';
                      }
                    } else if (isToday && !log) {
                      statusIcon = '⏳';
                      boxStyle =
                        'border-amber-500/50 bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30';
                    }

                    return (
                      <div
                        key={dayISO}
                        className={`flex flex-col items-center justify-center rounded-xl border py-1.5 px-0.5 text-center transition ${boxStyle}`}
                      >
                        <span
                          className={`text-[10px] font-bold leading-none ${
                            isToday ? 'text-emerald-400' : 'text-zinc-400'
                          }`}
                        >
                          {DAY_LABELS[idx]}
                        </span>
                        <span className="text-[9px] text-zinc-500 mt-0.5 leading-none">
                          {dayISO.slice(8, 10)}/{dayISO.slice(5, 7)}
                        </span>
                        <span className="mt-1 text-xs sm:text-sm leading-none">
                          {statusIcon}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
