import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hzfaonqjvcdnotorcvip.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6ZmFvbnFqdmNkbm90b3JjdmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2OTMzMTksImV4cCI6MjA4NDI2OTMxOX0.cZNr_Xs28vqtCK_J1N8TrmHz9e2pdUZ03zF-LbaVQsc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
