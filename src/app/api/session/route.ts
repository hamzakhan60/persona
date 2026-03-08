//api/session/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { buildIntroMessage, buildSystemPrompt } from '@/lib/prompts'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@supabase/ssr'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

async function getUserFromRequest(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: () => {},
      },
    }
  )
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user ?? null
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      profileId,
      meetingPurpose,
      meetingContext,
      communicationStyle,
      meetingGoal,
    } = body

    if (!profileId) {
      return NextResponse.json(
        { error: 'profileId is required' },
        { status: 400 }
      )
    }

    // Fetch the profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Create the prep session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('prep_sessions')
      .insert({
        user_id:         user.id,
        profile_id:       profileId,
        meeting_purpose:  meetingPurpose || 'other',
        meeting_context:  `Goal: ${meetingGoal || ''}\nContext: ${meetingContext || ''}\nStyle: ${communicationStyle || ''}`,
        status:           'active',
        intro_sent:       false,
      })
      .select('id')
      .single()

    if (sessionError) throw sessionError

    // Generate the intro message from Claude
    const profileData = profile.raw_data
    const systemPrompt = buildSystemPrompt(
      profileData,
      meetingContext || '',
      meetingPurpose || '',
      communicationStyle || ''
    )

    const introText = buildIntroMessage(
      profileData,
      meetingPurpose || 'other',
      meetingContext || ''
    )

    // Store system prompt as system message
    await supabaseAdmin.from('messages').insert({
      session_id:  session.id,
      role:        'system',
      content:     systemPrompt,
      model_used:  'claude-haiku-4-5-20251001',
      is_intro:    false,
    })

    // Generate a richer intro via Claude
    let finalIntro = introText
    try {
      const introResponse = await anthropic.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system:     systemPrompt,
        messages:   [{
          role:    'user',
          content: '__INTRO__', // special trigger
        }],
      })

      // Use Claude's intro if it makes sense, otherwise use our template
      const claudeIntro = introResponse.content[0].type === 'text'
        ? introResponse.content[0].text
        : introText

      // Only use Claude's version if it's reasonably short
      if (claudeIntro.length < 400) {
        finalIntro = claudeIntro
      }
    } catch {
      // Fall back to template intro if Claude fails
    }

    // Store intro message
    await supabaseAdmin.from('messages').insert({
      session_id:  session.id,
      role:        'assistant',
      content:     finalIntro,
      model_used:  'claude-haiku-4-5-20251001',
      is_intro:    true,
    })

    // Mark intro as sent
    await supabaseAdmin
      .from('prep_sessions')
      .update({ intro_sent: true })
      .eq('id', session.id)

    return NextResponse.json({
      success:   true,
      sessionId: session.id,
      intro:     finalIntro,
    })

  } catch (err: any) {
    console.error('Session creation error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to create session' },
      { status: 500 }
    )
  }
}