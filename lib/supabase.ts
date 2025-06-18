// supabase.ts
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Database } from '../types/supabase';

const supabaseUrl = 'https://rhasilvpqqtalrfubhxm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoYXNpbHZwcXF0YWxyZnViaHhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3MDMxNTUsImV4cCI6MjA2NTI3OTE1NX0.AG2rdGgFrlwuRzJOANazPdjicsvgOS1q7CZFY1VK10o';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});