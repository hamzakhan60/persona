import { createClient } from '@supabase/supabase-js'
//supabseAdmin
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Guard to prevent accidental client-side use
if (typeof window !== 'undefined') {
  throw new Error('supabaseAdmin must only be used server-side!')
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseService)