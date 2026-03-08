import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()

    // Fetch session with profile
    const { data: session } = await supabaseAdmin
      .from('prep_sessions')
      .select('*, profiles(*)')
      .eq('id', sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Fetch conversation (exclude system messages)
    const { data: messages } = await supabaseAdmin
      .from('messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .neq('role', 'system')
      .order('created_at', { ascending: true })

    const conversationText = messages
      ?.map(m => `${m.role === 'user' ? 'You' : session.profiles.full_name}: ${m.content}`)
      .join('\n\n') || ''

    // Generate summary with Claude
    const summaryPrompt = `You analyzed a practice conversation between a professional and an AI simulating ${session.profiles.full_name} (${session.profiles.headline}).

Conversation:
${conversationText}

Generate a JSON summary with this exact structure:
{
  "overallScore": 82,
  "keyInsights": [
    { "type": "positive", "title": "Strong opening", "detail": "You established credibility immediately by referencing their recent work." },
    { "type": "positive", "title": "Good listening", "detail": "You acknowledged their concern before responding." },
    { "type": "improve", "title": "Handle pricing earlier", "detail": "When pricing came up, address it proactively next time." }
  ],
  "moments": [
    { "label": "Opening pitch", "score": 88, "note": "Clear and confident." },
    { "label": "Handling objections", "score": 74, "note": "Could be more proactive." },
    { "label": "Closing", "score": 85, "note": "Good next steps defined." }
  ],
  "recommendations": [
    "Practice leading with ROI numbers upfront",
    "Prepare 2-3 responses to budget objections",
    "Try a more direct close next session"
  ]
}

Return ONLY valid JSON. No markdown. No explanation.`

    let summary = null
    try {
      const summaryResponse = await anthropic.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages:   [{ role: 'user', content: summaryPrompt }],
      })

      const raw = summaryResponse.content[0].type === 'text'
        ? summaryResponse.content[0].text
        : ''
      const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      summary = JSON.parse(clean)
    } catch {
      // Default summary if Claude fails
      summary = {
        overallScore: 75,
        keyInsights: [
          { type: 'positive', title: 'Session completed', detail: 'You completed the practice session.' }
        ],
        moments: [],
        recommendations: ['Review the conversation and identify key talking points for your real meeting.']
      }
    }

    // Save summary and mark session complete
    await supabaseAdmin
      .from('prep_sessions')
      .update({
        status:          'completed',
        session_summary: JSON.stringify(summary),
        completed_at:    new Date().toISOString(),
      })
      .eq('id', sessionId)

    return NextResponse.json({ success: true, summary })

  } catch (err: any) {
    console.error('End session error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}