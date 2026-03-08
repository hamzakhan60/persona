import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  const { linkedin_url, profile_data, meeting_purpose, meeting_context, user_id } = await req.json()

  // 1. Upsert profile (cache it)
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      linkedin_url,
      full_name:       profile_data.name,
      headline:        profile_data.headline,
      location:        profile_data.location,
      profile_picture: profile_data.profile_picture,
      raw_data:        profile_data,
      expires_at:      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'linkedin_url' })
    .select()
    .single()

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  // 2. Create session
  const { data: session, error: sessionError } = await supabaseAdmin
    .from('prep_sessions')
    .insert({
      user_id,
      profile_id:      profile.id,
      meeting_purpose: meeting_purpose || 'other',
      meeting_context,
      status:          'active',
    })
    .select()
    .single()

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 })

  // 3. Log extension usage
  await supabaseAdmin.from('extension_logs').insert({
    user_id,
    linkedin_url,
    scrape_success: true,
    fields_captured: {
      has_about:             !!profile_data.about,
      experience_count:      profile_data.experience?.length || 0,
      recommendation_count:  profile_data.recommendations?.length || 0,
      post_count:            profile_data.posts?.length || 0,
      skills_count:          profile_data.skills?.length || 0,
      has_education:         !!profile_data.education?.length,
    },
    proceeded_to_platform: true,
  })

  return NextResponse.json({ session_id: session.id })
}