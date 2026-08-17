import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://fdlbfxzfkwuuldpkshls.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_5ss3WpSfCHMZnx42Q-WhQA_oUThMf3g";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
});

export type StudyDayRow = {
  user_id: string;
  day_number: number;
  completed: boolean;
  note: string;
  focus_minutes: number;
  updated_at: string;
};
