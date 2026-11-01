'use client';

import React, { useState } from 'react';
import {
  LogType,
  SmartwatchSyncPayload,
  WatchBrand,
  WorkoutLog,
} from '@/types/fitness';
import { SmartwatchSyncCard } from './SmartwatchSyncCard';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { getMexicoTodayISO } from '@/lib/penalty-engine';
import {
  AlertTriangle,
  BedDouble,
  Camera,
  CheckCircle2,
  Dumbbell,
  UploadCloud,
  X,
} from 'lucide-react';

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  defaultWatchBrand: WatchBrand;
  remainingRestDaysThisWeek: number;
  onWorkoutSaved: (newLog: WorkoutLog, triggeredPenaltyMxn: number) => void;
}

export function CheckInModal({
  isOpen,
  onClose,
  userId,
  userName,
  defaultWatchBrand,
  remainingRestDaysThisWeek,
  onWorkoutSaved,
}: CheckInModalProps) {
  const [logType, setLogType] = useState<LogType>('workout');
  const [watchBrand, setWatchBrand] = useState<WatchBrand>(defaultWatchBrand);
  const [metrics, setMetrics] = useState<SmartwatchSyncPayload>({
    watch_brand: defaultWatchBrand,
    sync_source: 'strava_oauth',
    activity_type: 'Entrenamiento de Fuerza + Cardio',
    duration_minutes: 50,
    calories_burned: 460,
    avg_heart_rate: 145,
    max_heart_rate: 176,
    steps: 5800,
  });

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [watchFile, setWatchFile] = useState<File | null>(null);
  const [watchPreview, setWatchPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleProofPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setProofPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  function handleWatchPhotoSelect(file: File) {
    setWatchFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setWatchPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function uploadToSupabaseStorage(
    file: File,
    prefix: string
  ): Promise<string | null> {
    if (!isSupabaseConfigured()) return null;
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${userId}/${getMexicoTodayISO()}_${prefix}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('workout-proofs')
        .upload(path, file, { upsert: true });

      if (uploadErr) return null;

      const { data } = supabase.storage
        .from('workout-proofs')
        .getPublicUrl(path);
      return data.publicUrl;
    } catch {
      return null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (logType === 'workout') {
      if (!proofFile && !proofPreview) {
        setError(
          '📸 ¡Alto ahí! La foto de prueba entrenando es OBLIGATORIA para validar que cumpliste hoy y evitar la multa de $50 MXN.'
        );
        return;
      }
      if (metrics.duration_minutes < 15) {
        setError(
          '⏱️ El entrenamiento del smartwatch debe registrar al menos 15 minutos de actividad.'
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const todayISO = getMexicoTodayISO();
      let finalProofUrl = proofPreview;
      let finalWatchUrl = watchPreview;

      if (proofFile && isSupabaseConfigured()) {
        const uploadedUrl = await uploadToSupabaseStorage(proofFile, 'proof');
        if (uploadedUrl) finalProofUrl = uploadedUrl;
      }

      if (watchFile && isSupabaseConfigured()) {
        const uploadedWatchUrl = await uploadToSupabaseStorage(
          watchFile,
          'watch'
        );
        if (uploadedWatchUrl) finalWatchUrl = uploadedWatchUrl;
      }

      const newLog: WorkoutLog = {
        id: `log_${Date.now()}`,
        user_id: userId,
        user_name: userName,
        workout_date: todayISO,
        log_type: logType,
        watch_brand: watchBrand,
        sync_source: metrics.sync_source,
        activity_type:
          logType === 'rest'
            ? 'Día de Descanso'
            : metrics.activity_type || 'Entrenamiento',
        duration_minutes: logType === 'rest' ? 0 : metrics.duration_minutes,
        calories_burned: logType === 'rest' ? 0 : metrics.calories_burned,
        avg_heart_rate: logType === 'rest' ? null : metrics.avg_heart_rate,
        max_heart_rate: logType === 'rest' ? null : metrics.max_heart_rate,
        steps: logType === 'rest' ? 0 : metrics.steps,
        proof_photo_url: logType === 'rest' ? null : finalProofUrl,
        watch_photo_url: logType === 'rest' ? null : finalWatchUrl,
        notes:
          notes.trim() ||
          (logType === 'rest'
            ? 'Día de descanso registrado.'
            : 'Cumplido con reloj y foto de evidencia.'),
        created_at: new Date().toISOString(),
      };

      const penaltyTriggered =
        logType === 'rest' && remainingRestDaysThisWeek <= 0 ? 50 : 0;

      if (isSupabaseConfigured()) {
        const supabase = createClient();
        await supabase.from('workout_logs').upsert(
          {
            user_id: userId,
            workout_date: todayISO,
            log_type: newLog.log_type,
            watch_brand: newLog.watch_brand,
            sync_source: newLog.sync_source,
            activity_type: newLog.activity_type,
            duration_minutes: newLog.duration_minutes,
            calories_burned: newLog.calories_burned,
            avg_heart_rate: newLog.avg_heart_rate,
            max_heart_rate: newLog.max_heart_rate,
            steps: newLog.steps,
            proof_photo_url: newLog.proof_photo_url,
            watch_photo_url: newLog.watch_photo_url,
            notes: newLog.notes,
          },
          { onConflict: 'user_id,workout_date' }
        );
      }

      onWorkoutSaved(newLog, penaltyTriggered);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al guardar tu registro.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="relative my-auto w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-5 sm:p-6 text-zinc-100 shadow-2xl max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
            <Dumbbell className="h-3.5 w-3.5" /> Check-in Diario • {userName}
          </span>
          <h2 className="mt-2 text-xl font-extrabold text-white">
            Registrar Día de Ejercicio o Descanso
          </h2>
          <p className="text-xs text-zinc-400">
            Recuerda: tienes 2 días de descanso gratis por semana. A partir del
            3er día sin entrenar se te cobran{' '}
            <strong className="text-rose-400">$50 MXN</strong> al cochinito.
          </p>
        </div>

        {/* Selector Entrenamiento vs Día de Descanso */}
        <div className="mb-5 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setLogType('workout')}
            className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-bold transition cursor-pointer ${
              logType === 'workout'
                ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            <Dumbbell className="h-4 w-4" />
            ¡Sí Entrené Hoy!
          </button>

          <button
            type="button"
            onClick={() => setLogType('rest')}
            className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-bold transition cursor-pointer ${
              logType === 'rest'
                ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            <BedDouble className="h-4 w-4" />
            Día de Descanso ({remainingRestDaysThisWeek}/2 libres)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {logType === 'workout' ? (
            <>
              {/* Paso 1: Smartwatch */}
              <SmartwatchSyncCard
                selectedBrand={watchBrand}
                onBrandChange={setWatchBrand}
                metrics={metrics}
                onMetricsChange={setMetrics}
                watchPhotoPreview={watchPreview}
                onWatchPhotoSelect={handleWatchPhotoSelect}
              />

              {/* Paso 2: Subida de Foto de Prueba OBLIGATORIA */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="h-5 w-5 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">
                      2. Foto de Prueba Obligatoria (Evidencia Real)
                    </h3>
                  </div>
                  <span className="rounded-full bg-rose-500/20 border border-rose-500/40 px-2.5 py-0.5 text-[11px] font-bold text-rose-300">
                    Obligatoria
                  </span>
                </div>

                <p className="text-xs text-zinc-400">
                  Tómate una foto en el gym, corriendo, con las mancuernas o con
                  tu reloj en la muñeca para que la familia verifique que no
                  hiciste trampa.
                </p>

                <label className="group relative flex min-h-44 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-950 p-4 text-center transition hover:border-emerald-500">
                  {proofPreview ? (
                    <div className="relative w-full">
                      <img
                        src={proofPreview}
                        alt="Vista previa de prueba de ejercicio"
                        className="mx-auto max-h-56 rounded-lg object-cover"
                      />
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-zinc-950">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Foto lista (clic
                        para cambiar)
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 group-hover:scale-110 transition">
                        <UploadCloud className="h-6 w-6" />
                      </div>
                      <span className="text-sm font-semibold text-zinc-200">
                        Subir o tomar foto de prueba ahora
                      </span>
                      <span className="text-xs text-zinc-500">
                        JPG, PNG, WEBP o cámara directa del celular (Máx. 10 MB)
                      </span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleProofPhotoChange}
                    className="hidden"
                  />
                </label>

                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    Comentario / Reto para el grupo (Opcional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ej. Día de pierna terminado, a ver quién paga los $50 hoy..."
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </>
          ) : (
            /* Modo Día de Descanso */
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 shrink-0 text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">
                    {remainingRestDaysThisWeek > 0
                      ? `Tienes ${remainingRestDaysThisWeek} día(s) de descanso libre disponibles esta semana`
                      : '¡Cuidado! Ya agotaste tus 2 días de descanso libres esta semana'}
                  </h3>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {remainingRestDaysThisWeek > 0
                      ? 'Registrar hoy como día de descanso NO te generará multa de $50 MXN.'
                      : 'Si no entrenas hoy, se te sumará automáticamente una multa de $50 MXN al cochinito familiar/de amigos.'}
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-300">
                  Motivo del descanso (Opcional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Recuperación muscular / viaje familiar..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {error ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 p-3 text-xs font-medium text-rose-200">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-extrabold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              {submitting
                ? 'Guardando evidencia...'
                : logType === 'workout'
                ? 'Subir Evidencia y Salvar $50 MXN'
                : remainingRestDaysThisWeek > 0
                ? 'Usar 1 Día de Descanso Gratis'
                : 'Aceptar Falta (+$50 MXN de Multa)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
