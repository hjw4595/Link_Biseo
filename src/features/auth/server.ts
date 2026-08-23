import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export const verifiedUser = cache(async () => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    return { user: error ? null : data.user, error: error ? 'session' : null };
  } catch {
    return { user: null, error: 'configuration' };
  }
});
