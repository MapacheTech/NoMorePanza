'use client';

import React from 'react';
import { WorkoutLog } from '@/types/fitness';
import { getWatchLabel } from '@/lib/penalty-engine';
import {
  Activity,
  BedDouble,
  Camera,
  Flame,
  HeartPulse,
  Timer,
  Watch,
} from 'lucide-react';

interface ProofFeedProps {
  logs: WorkoutLog[];
}

export function ProofFeed({ logs }: ProofFeedProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
            <Camera className="h-5 w-5 text-emerald-400" />
            Muro de Evidencias Fotográficas + Smartwatch
          </h3>
          <p className="text-xs text-zinc-400">
            Cada registro muestra la foto obligatoria subida y las métricas
            extraídas del reloj inteligente.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {logs.map((log) => {
          const isRest = log.log_type === 'rest';
          return (
            <article
              key={log.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 shadow-lg"
            >
              {isRest ? (
                <div className="flex h-48 flex-col items-center justify-center bg-gradient-to-br from-amber-500/15 to-zinc-950 p-6 text-center">
                  <BedDouble className="h-10 w-10 text-amber-400 mb-2" />
                  <span className="text-sm font-bold text-amber-300">
                    Día de Descanso Registrado
                  </span>
                  <span className="text-xs text-zinc-400 mt-1">
                    Usa 1 de los 2 días de descanso libres por semana
                  </span>
                </div>
              ) : (
                <div className="relative h-52 w-full bg-zinc-950 overflow-hidden">
                  {log.proof_photo_url ? (
                    <img
                      src={log.proof_photo_url}
                      alt={`Evidencia de ${log.user_name || 'Atleta'}`}
                      className="h-full w-full object-cover transition duration-300 hover:scale-105"
                    />
                  ) : null}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/75 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-emerald-400 border border-emerald-500/30">
                    <Watch className="h-3.5 w-3.5" />
                    {getWatchLabel(log.watch_brand)}
                  </div>
                  <div className="absolute bottom-3 right-3 rounded-lg bg-black/80 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-zinc-200">
                    {log.workout_date}
                  </div>
                </div>
              )}

              <div className="flex flex-1 flex-col justify-between p-4 space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold text-white">
                      {log.user_name || 'Integrante'}
                    </span>
                    <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-300">
                      {log.sync_source === 'strava_oauth'
                        ? 'Sincronizado OAuth'
                        : log.sync_source === 'web_bluetooth'
                        ? 'Bluetooth BLE'
                        : 'Evidencia Reloj'}
                    </span>
                  </div>

                  <p className="mt-1 text-xs font-semibold text-emerald-400">
                    {log.activity_type}
                  </p>

                  {log.notes ? (
                    <p className="mt-1.5 text-xs text-zinc-300 line-clamp-2">
                      “{log.notes}”
                    </p>
                  ) : null}
                </div>

                {!isRest ? (
                  <div className="grid grid-cols-3 gap-2 border-t border-zinc-800/80 pt-3 text-center">
                    <div className="rounded-lg bg-zinc-950/80 p-1.5">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-zinc-400">
                        <Timer className="h-3 w-3 text-emerald-400" /> Minutos
                      </div>
                      <p className="text-xs font-extrabold text-white">
                        {log.duration_minutes}m
                      </p>
                    </div>

                    <div className="rounded-lg bg-zinc-950/80 p-1.5">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-zinc-400">
                        <Flame className="h-3 w-3 text-orange-400" /> Calorías
                      </div>
                      <p className="text-xs font-extrabold text-white">
                        {log.calories_burned}
                      </p>
                    </div>

                    <div className="rounded-lg bg-zinc-950/80 p-1.5">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-zinc-400">
                        {log.avg_heart_rate ? (
                          <>
                            <HeartPulse className="h-3 w-3 text-rose-400" /> BPM
                          </>
                        ) : (
                          <>
                            <Activity className="h-3 w-3 text-sky-400" /> Pasos
                          </>
                        )}
                      </div>
                      <p className="text-xs font-extrabold text-white">
                        {log.avg_heart_rate
                          ? `${log.avg_heart_rate} bpm`
                          : log.steps}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
