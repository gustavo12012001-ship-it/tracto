import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const isValidUrl = supabaseUrl && supabaseUrl.startsWith('https://');

if (!isValidUrl || !supabaseAnonKey) {
  console.warn('[Supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY inválidas ou ausentes no .env');
}

export const supabase = createClient(
  isValidUrl ? supabaseUrl : 'https://placeholder.supabase.co',
  supabaseAnonKey && supabaseAnonKey.length > 10 ? supabaseAnonKey : 'placeholder'
);
