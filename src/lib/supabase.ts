import { createBrowserClient } from '@supabase/ssr'
// lib/supabase.ts

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ✅ createBrowserClient reads from cookies, not localStorage
// This is required when using @supabase/ssr for auth (server actions)
export const supabase = createBrowserClient(supabaseUrl, supabaseAnon)

// Types
export type Profile = {
  id: string
  linkedin_url: string
  full_name: string
  headline: string
  location: string
  profile_picture: string | null
  raw_data: LinkedInProfileData
  data_richness_score: number
  scraped_at: string
  expires_at: string
}

export type PrepSession = {
  id: string
  user_id: string
  profile_id: string
  status: 'active' | 'completed' | 'abandoned'
  meeting_context: string | null
  meeting_purpose: string | null
  message_count: number
  total_tokens_used: number
  intro_sent: boolean
  session_summary: string | null
  started_at: string
  last_active_at: string
}

export type Message = {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  input_tokens: number
  output_tokens: number
  model_used: string
  is_intro: boolean
  created_at: string
}

export type LinkedInProfileData = {
  name: string
  headline: string
  location: string
  about: string
  profile_picture?: string
  experience: Array<{
    title: string
    company: string
    duration: string
    description: string
  }>
  education: Array<{
    school: string
    degree: string
    years: string
  }>
  skills: string[]
  recommendations: Array<{
    author: string
    authorTitle: string
    text: string
  }>
  posts: Array<{
    content: string
    likes: number
    date: string
  }>
  certifications: string[]
  languages: string[]
}