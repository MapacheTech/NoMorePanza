'use client';

import React, { useState } from 'react';
import { WorkoutLog } from '@/types/fitness';
import { getWatchLabel } from '@/lib/penalty-engine';
import {
  Activity,
  BedDouble,
  Camera,
  Flame,
  Maximize2,
  Smartphone,
  Timer,
  Watch,
  X,
} from 'lucide-react';

interface ProofFeedProps {
  logs: WorkoutLog[];
}

export function ProofFeed({ logs }: ProofFeedProps) {
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    title: string;
  } | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
            <Camera className="h-5 w-5 text-emerald-400" />
            Muro de Evidencias Fotográficas + Smartwatch
          </h3>
          <p className="text-xs text-zinc-400">
            Muestra la foto entrenando y la captura del reloj inteligente (haz
            clic en cualquier imagen para ampliarla).
          </p>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 p-10 text-center space-y-2">
          <Camera className="mx-auto h-8 w-8 text-emerald-400/70" />
          <p className="text-sm font-bold text-white">
            Aún no hay entrenamientos registrados por el grupo
          </p>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Haz clic en el botón verde &ldquo;Registrar Ejercicio + Subir Foto
            de Prueba&rdquo; para estrenar el muro con tu smartwatch y tu foto
            del día.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {logs.map((log) => {
            const isRest = log.log_type === 'rest';
            const hasBothPhotos = Boolean(
              log.proof_photo_url && log.watch_photo_url
            );

            return (
              <article
                key={log.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 shadow-lg"
              >
                {isRest ? (
                  <div className="flex h-52 flex-col items-center justify-center bg-gradient-to-br from-amber-500/15 to-zinc-950 p-6 text-center">
                    <BedDouble className="h-10 w-10 text-amber-400 mb-2" />
                    <span className="text-sm font-bold text-amber-300">
                      Día de Descanso Registrado
                    </span>
                    <span className="text-xs text-zinc-400 mt-1">
                      Usa 1 de los 2 días de descanso libres por semana
                    </span>
                  </div>
                ) : (
                  <div className="relative h-56 w-full bg-zinc-950 overflow-hidden">
                    {hasBothPhotos ? (
                      /* Vista Doble: Foto Entrenando + Captura del Reloj */
                      <div className="grid h-full w-full grid-cols-2 gap-0.5 bg-zinc-800">
                        <button
                          type="button"
                          onClick={() =>
                            setLightboxImage({
                              url: log.proof_photo_url!,
                              title: `Foto de Prueba • ${
                                log.user_name || 'Integrante'
                              } (${log.workout_date})`,
                            })
                          }
                          className="group relative h-full w-full overflow-hidden bg-zinc-950 cursor-pointer"
                        >
                          <img
                            src={log.proof_photo_url!}
                            alt={`Foto de prueba de ${log.user_name}`}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-black/80 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                            <Camera className="h-3 w-3" /> Foto Gym
                          </span>
                          <span className="absolute top-2 right-2 rounded-md bg-black/70 p-1 text-white opacity-0 transition group-hover:opacity-100">
                            <Maximize2 className="h-3.5 w-3.5" />
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setLightboxImage({
                              url: log.watch_photo_url!,
                              title: `Captura Smartwatch (${getWatchLabel(
                                log.watch_brand
                              )}) • ${log.user_name || 'Integrante'}`,
                            })
                          }
                          className="group relative h-full w-full overflow-hidden bg-zinc-950 cursor-pointer"
                        >
                          <img
                            src={log.watch_photo_url!}
                            alt={`Captura de reloj de ${log.user_name}`}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-black/80 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                            <Smartphone className="h-3 w-3" /> Reloj
                          </span>
                          <span className="absolute top-2 right-2 rounded-md bg-black/70 p-1 text-white opacity-0 transition group-hover:opacity-100">
                            <Maximize2 className="h-3.5 w-3.5" />
                          </span>
                        </button>
                      </div>
                    ) : log.proof_photo_url ? (
                      /* Vista Individual: Solo Foto Entrenando */
                      <button
                        type="button"
                        onClick={() =>
                          setLightboxImage({
                            url: log.proof_photo_url!,
                            title: `Evidencia de ${
                              log.user_name || 'Integrante'
                            } (${log.workout_date})`,
                          })
                        }
                        className="group relative h-full w-full overflow-hidden cursor-pointer"
                      >
                        <img
                          src={log.proof_photo_url}
                          alt={`Evidencia de ${log.user_name || 'Atleta'}`}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                        <span className="absolute top-3 right-3 rounded-lg bg-black/75 p-1.5 text-white opacity-80 group-hover:opacity-100">
                          <Maximize2 className="h-4 w-4" />
                        </span>
                      </button>
                    ) : null}

                    <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/75 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-emerald-400 border border-emerald-500/30">
                      <Watch className="h-3.5 w-3.5" />
                      {getWatchLabel(log.watch_brand)}
                    </div>

                    <div className="pointer-events-none absolute bottom-2 right-2 rounded-lg bg-black/80 backdrop-blur-md px-2 py-0.5 text-[10px] font-semibold text-zinc-200">
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
                        {hasBothPhotos
                          ? '2 Fotos Verificadas'
                          : log.sync_source === 'strava_oauth'
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
                          <Activity className="h-3 w-3 text-sky-400" /> Pasos
                        </div>
                        <p className="text-xs font-extrabold text-white">
                          {(log.steps || 0).toLocaleString('es-MX')}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal Lightbox para ver foto en pantalla completa */}
      {lightboxImage ? (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 shadow-2xl"
          >
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="text-xs sm:text-sm font-bold text-white">
                {lightboxImage.title}
              </span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="rounded-lg bg-zinc-800 p-1.5 text-zinc-300 hover:bg-zinc-700 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.title}
              className="max-h-[80vh] w-full rounded-xl object-contain bg-black"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
