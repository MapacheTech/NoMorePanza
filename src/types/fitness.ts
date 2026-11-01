export type WatchBrand = 'apple' | 'samsung' | 'huawei' | 'garmin' | 'other';

export type SyncSource = 'strava_oauth' | 'web_bluetooth' | 'watch_screenshot';

export type LogType = 'workout' | 'rest';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  watch_brand: WatchBrand;
  strava_connected?: boolean;
}

export interface WorkoutLog {
  id: string;
  user_id: string;
  user_name?: string;
  user_avatar?: string | null;
  workout_date: string; // YYYY-MM-DD
  log_type: LogType;
  watch_brand: WatchBrand;
  sync_source: SyncSource;
  activity_type: string;
  duration_minutes: number;
  calories_burned: number;
  avg_heart_rate?: number | null;
  max_heart_rate?: number | null;
  steps: number;
  proof_photo_url?: string | null;
  watch_photo_url?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface PenaltyRecord {
  id: string;
  user_id: string;
  user_name?: string;
  penalty_date: string;
  week_start: string;
  amount_mxn: number;
  reason: string;
  is_paid: boolean;
  paid_at?: string | null;
}

export interface LeaderboardEntry {
  user_id: string;
  full_name: string;
  avatar_url?: string | null;
  watch_brand: WatchBrand;
  total_workouts: number;
  week_workouts: number;
  week_rest_days_used: number;
  remaining_rest_days_this_week: number;
  total_calories: number;
  total_minutes: number;
  penalty_days: number;
  total_fine_mxn: number;
  unpaid_fine_mxn: number;
  xp_score: number;
  current_streak: number;
  badge: string;
}

export interface SmartwatchSyncPayload {
  watch_brand: WatchBrand;
  sync_source: SyncSource;
  activity_type: string;
  duration_minutes: number;
  calories_burned: number;
  avg_heart_rate: number;
  max_heart_rate?: number;
  steps: number;
  external_activity_id?: string;
}
