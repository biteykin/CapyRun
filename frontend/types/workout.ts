export interface WorkoutRow {
    id: string;
    user_id: string;
    start_time: string;
    local_date: string | null;
    uploaded_at: string;
    sport: string | null;
    sub_sport: string | null;
    duration_sec: number | null;
    distance_m: number | null;
    avg_hr: number | null;
    calories_kcal: number | null;
    name: string | null;
    visibility: string | null;
    weekday_iso: number | null;
  }
  
  export interface SessionData {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
    expires_in?: number;
    token_type?: string;
    user?: any;
  }
  
  export interface CapyrunAuth {
    currentSession?: SessionData;
    session?: SessionData;
    state?: {
      session?: SessionData;
    };
    access_token?: string;
    refresh_token?: string;
  }