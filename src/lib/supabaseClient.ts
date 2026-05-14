import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "") as string;
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "") as string;

const TOKEN_STORAGE_KEY = 'mrm_token';
const USER_STORAGE_KEY = 'mrm_user';

let authStorageSyncStarted = false;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase env vars are missing. Define NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

function readStoredUser() {
  try {
    const rawUser = localStorage.getItem(USER_STORAGE_KEY);
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

function persistSessionToken(accessToken: string | null) {
  if (!accessToken) {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    return;
  }

  localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);

  const storedUser = readStoredUser();
  if (storedUser && storedUser.token !== accessToken) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({
      ...storedUser,
      token: accessToken,
    }));
  }
}

export async function initializeSupabaseAuthStorageSync() {
  if (authStorageSyncStarted) {
    return;
  }

  authStorageSyncStarted = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    persistSessionToken(session?.access_token ?? null);
  });

  const { data } = await supabase.auth.getSession();
  persistSessionToken(data.session?.access_token ?? null);
}
