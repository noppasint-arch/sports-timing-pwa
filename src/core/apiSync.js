/**
 * apiSync — pushes finished results into Athlete Performance Lab's
 * Supabase project, keyed by the school's student ID. This app has no
 * login of its own, so it writes with the public anon key (insert-only
 * RLS policy on the APL side — this app can never read/edit/delete).
 *
 * "Remembers" the last student ID typed so back-to-back trials for the
 * same runner don't require retyping it every time.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const aplSupabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const LAST_STUDENT_ID_KEY = 'stp_last_student_id';

export function getLastStudentId() {
  return localStorage.getItem(LAST_STUDENT_ID_KEY) || '';
}

export function setLastStudentId(id) {
  localStorage.setItem(LAST_STUDENT_ID_KEY, id);
}

/**
 * Pushes one finished trial result to APL.
 * testType must match APL's timing_test_results.test_type check constraint:
 * 'sprint-30m' | 'illinois-agility' | 'y-shape-agility'
 */
export async function pushResultToAPL({ studentId, testType, result, deviceName }) {
  if (!aplSupabase) throw new Error('APL sync not configured (missing VITE_SUPABASE_URL/KEY)');
  if (!studentId) throw new Error('Student ID is required');

  const metrics = result.metrics || {};
  const primaryTime = metrics.totalTimeS ?? metrics.repTime ?? null;

  const { error } = await aplSupabase.from('timing_test_results').insert({
    student_id: studentId.trim(),
    test_type: testType,
    primary_time_sec: typeof primaryTime === 'number' ? primaryTime : null,
    speed_ms: metrics.speedMs ?? null,
    speed_kmh: metrics.speedKmh ?? null,
    split1_time_sec: metrics.split1Time ?? null,
    split2_time_sec: metrics.split2Time ?? null,
    sync_quality: result.syncQuality ?? null,
    device_name: deviceName ?? null,
    tested_at: new Date(result.savedAt || Date.now()).toISOString(),
  });

  if (error) throw error;
  setLastStudentId(studentId.trim());
}
