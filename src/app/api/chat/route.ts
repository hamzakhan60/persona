import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const GROQ_API_KEY = process.env.GROQ_API_KEY!
const GROQ_URL     = 'https://api.groq.com/openai/v1/chat/completions'

function buildSystemPrompt(profile: any, session: any): string {
  const p = profile.raw_data || {}

  const experience = p.experience?.slice(0, 3)
    .map((e: any) => `  - ${e.title} at ${e.company} (${e.duration})`)
    .join('\n') || '  - Not available'

  const recentPosts = p.posts?.slice(0, 2)
    .map((post: any) => `  - "${post.content?.slice(0, 120)}..." (${post.likes} likes)`)
    .join('\n') || '  - No recent posts'

  const recommendations = p.recommendations?.slice(0, 2)
    .map((r: any) => `  - ${r.author} (${r.authorTitle}): "${r.text?.slice(0, 100)}..."`)
    .join('\n') || '  - None available'

  return `You are roleplaying as ${profile.full_name} in a practice conversation.

== WHO YOU ARE ==
Name: ${profile.full_name}
Headline: ${profile.headline}
Location: ${profile.location || 'Unknown'}
About: ${p.about || 'Not available'}

== EXPERIENCE ==
${experience}

== SKILLS ==
${p.skills?.slice(0, 10).join(', ') || 'Not available'}

== RECENT LINKEDIN POSTS (their current thinking) ==
${recentPosts}

== WHAT COLLEAGUES SAY ==
${recommendations}

== MEETING CONTEXT ==
Purpose: ${session.meeting_purpose || 'General meeting'}
Context: ${session.meeting_context || 'No additional context provided'}

== INSTRUCTIONS ==
- Stay fully in character as ${profile.full_name}
- Respond naturally based on their background and communication style
- Be realistic — not overly enthusiastic or difficult
- Keep responses conversational (2-4 sentences max unless asked something detailed)
- Draw on their actual experience, posts, and recommendations when relevant
- Never break character or mention you are an AI`
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, message } = await req.json()

    if (!sessionId || !message?.trim()) {
      return new Response(
        JSON.stringify({ error: 'sessionId and message are required' }),
        { status: 400 }
      )
    }

    // ── Auth check ──────────────────────────────────────────────
    const cookieStore  = await cookies()
    const supabaseUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cs) => cs.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
        },
      }
    )

    const { data: { user } } = await supabaseUser.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    // ── Fetch session + profile ─────────────────────────────────
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('prep_sessions')
      .select('*, profiles(*)')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404 })
    }

    if (session.status === 'completed' || session.status === 'abandoned') {
      return new Response(JSON.stringify({ error: 'Session is no longer active' }), { status: 400 })
    }

    const profile = session.profiles

    // ── Fetch conversation history ──────────────────────────────
    const { data: history } = await supabaseAdmin
      .from('messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: true })
      .limit(12)

    // ✅ Groq uses OpenAI format — standard role names, system message supported
    const conversationMessages = (history || []).map((m: any) => ({
      role:    m.role as 'user' | 'assistant',
      content: m.content,
    }))

    const systemPrompt   = buildSystemPrompt(profile, session)
    const isFirstMessage = !history || history.length === 0

    // ── Save user message ───────────────────────────────────────
    await supabaseAdmin.from('messages').insert({
      session_id: sessionId,
      role:       'user',
      content:    message.trim(),
      model_used: 'llama-3.3-70b-versatile',
    })

    // ── Call Groq API ───────────────────────────────────────────
    const groqRes = await fetch(GROQ_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model:       'llama-3.3-70b-versatile',
        max_tokens:  400,
        temperature: 0.85,
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationMessages,
          { role: 'user', content: message.trim() },
        ],
      }),
    })

    if (!groqRes.ok) {
      const errText = await groqRes.text()
      console.error('Groq API error:', errText)
      return new Response(
        JSON.stringify({ error: 'AI service error', detail: errText }),
        { status: 502 }
      )
    }

    const data         = await groqRes.json()
    const responseText = data.choices?.[0]?.message?.content

    if (!responseText) {
      console.error('No text in Groq response:', JSON.stringify(data))
      return new Response(
        JSON.stringify({ error: 'No response from AI' }),
        { status: 502 }
      )
    }

    const inputTokens  = data.usage?.prompt_tokens     || 0
    const outputTokens = data.usage?.completion_tokens || 0

    // ── Save assistant response ─────────────────────────────────
    await supabaseAdmin.from('messages').insert({
      session_id:    sessionId,
      role:          'assistant',
      content:       responseText,
      input_tokens:  inputTokens,
      output_tokens: outputTokens,
      model_used:    'llama-3.3-70b-versatile',
      is_intro:      isFirstMessage,
    })

    await supabaseAdmin
      .from('prep_sessions')
      .update({
        last_active_at: new Date().toISOString(),
        ...(isFirstMessage ? { intro_sent: true } : {}),
      })
      .eq('id', sessionId)

    return new Response(
      JSON.stringify({ text: responseText, inputTokens, outputTokens, done: true }),
      {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
      }
    )

  } catch (err: any) {
    console.error('Chat API error:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Chat failed' }),
      { status: 500 }
    )
  }
}
// import { NextRequest } from 'next/server'
// import { supabaseAdmin } from '@/lib/supabaseAdmin'
// import { createServerClient } from '@supabase/ssr'
// import { cookies } from 'next/headers'
// import Anthropic from '@anthropic-ai/sdk'

// const anthropic = new Anthropic({
//   apiKey: process.env.ANTHROPIC_API_KEY!,
// })

// // Build the system prompt dynamically from profile data
// function buildSystemPrompt(profile: any, session: any): string {
//   const p = profile.raw_data || {}

//   const experience = p.experience?.slice(0, 3)
//     .map((e: any) => `  - ${e.title} at ${e.company} (${e.duration})`)
//     .join('\n') || '  - Not available'

//   const recentPosts = p.posts?.slice(0, 2)
//     .map((post: any) => `  - "${post.content?.slice(0, 120)}..." (${post.likes} likes)`)
//     .join('\n') || '  - No recent posts'

//   const recommendations = p.recommendations?.slice(0, 2)
//     .map((r: any) => `  - ${r.author} (${r.authorTitle}): "${r.text?.slice(0, 100)}..."`)
//     .join('\n') || '  - None available'

//   return `You are roleplaying as ${profile.full_name} in a practice conversation.

// == WHO YOU ARE ==
// Name: ${profile.full_name}
// Headline: ${profile.headline}
// Location: ${profile.location || 'Unknown'}
// About: ${p.about || 'Not available'}

// == EXPERIENCE ==
// ${experience}

// == SKILLS ==
// ${p.skills?.slice(0, 10).join(', ') || 'Not available'}

// == RECENT LINKEDIN POSTS (their current thinking) ==
// ${recentPosts}

// == WHAT COLLEAGUES SAY ==
// ${recommendations}

// == MEETING CONTEXT ==
// Purpose: ${session.meeting_purpose || 'General meeting'}
// Context: ${session.meeting_context || 'No additional context provided'}

// == INSTRUCTIONS ==
// - Stay fully in character as ${profile.full_name}
// - Respond naturally based on their background and communication style
// - Be realistic — not overly enthusiastic or difficult
// - Keep responses conversational (2-4 sentences max unless asked something detailed)
// - Draw on their actual experience, posts, and recommendations when relevant
// - Never break character or mention you are an AI`
// }

// export async function POST(req: NextRequest) {
//   try {
//     const { sessionId, message } = await req.json()

//     if (!sessionId || !message?.trim()) {
//       return new Response(
//         JSON.stringify({ error: 'sessionId and message are required' }),
//         { status: 400 }
//       )
//     }

//     // ── Auth check ──────────────────────────────────────────────
//     const cookieStore = await cookies()
//     const supabaseUser = createServerClient(
//       process.env.NEXT_PUBLIC_SUPABASE_URL!,
//       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
//       {
//         cookies: {
//           getAll: () => cookieStore.getAll(),
//           setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
//         },
//       }
//     )
//     const { data: { user } } = await supabaseUser.auth.getUser()
//     if (!user) {
//       return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
//     }

//     // ── Fetch session + profile ──────────────────────────────────
//     const { data: session, error: sessionError } = await supabaseAdmin
//       .from('prep_sessions')
//       .select('*, profiles(*)')
//       .eq('id', sessionId)
//       .eq('user_id', user.id)   // ensures user owns this session
//       .single()

//     if (sessionError || !session) {
//       return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404 })
//     }

//     if (session.status === 'completed' || session.status === 'abandoned') {
//       return new Response(JSON.stringify({ error: 'Session is no longer active' }), { status: 400 })
//     }

//     const profile = session.profiles

//     // ── Fetch conversation history (last 12 messages) ───────────
//     const { data: history } = await supabaseAdmin
//       .from('messages')
//       .select('role, content')
//       .eq('session_id', sessionId)
//       .in('role', ['user', 'assistant'])
//       .order('created_at', { ascending: true })
//       .limit(12)

//     const conversationMessages: { role: 'user' | 'assistant'; content: string }[] = [
//       ...(history || []).map(m => ({
//         role:    m.role as 'user' | 'assistant',
//         content: m.content,
//       })),
//       { role: 'user', content: message.trim() },
//     ]

//     // ── Build system prompt fresh from profile data ──────────────
//     const systemPrompt = buildSystemPrompt(profile, session)

//     // ── Stream response ──────────────────────────────────────────
//     const encoder = new TextEncoder()
//     let fullResponse = ''
//     let inputTokens  = 0
//     let outputTokens = 0

//     const stream = new ReadableStream({
//       async start(controller) {
//         try {
//           // Save user message first
//           await supabaseAdmin.from('messages').insert({
//             session_id: sessionId,
//             role:       'user',
//             content:    message.trim(),
//             model_used: 'claude-haiku-4-5-20251001',
//           })

//           const claudeStream = anthropic.messages.stream({
//             model:      'claude-haiku-4-5-20251001',
//             max_tokens: 400,
//             system:     systemPrompt,
//             messages:   conversationMessages,
//           })

//           for await (const chunk of claudeStream) {
//             if (
//               chunk.type === 'content_block_delta' &&
//               chunk.delta.type === 'text_delta'
//             ) {
//               fullResponse += chunk.delta.text
//               controller.enqueue(
//                 encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`)
//               )
//             }
//             if (chunk.type === 'message_start' && chunk.message.usage) {
//               inputTokens = chunk.message.usage.input_tokens
//             }
//             if (chunk.type === 'message_delta' && chunk.usage) {
//               outputTokens = chunk.usage.output_tokens
//             }
//           }

//           // Save assistant response + mark intro sent if first message
//           const isFirstMessage = !history || history.length === 0

//           await supabaseAdmin.from('messages').insert({
//             session_id:    sessionId,
//             role:          'assistant',
//             content:       fullResponse,
//             input_tokens:  inputTokens,
//             output_tokens: outputTokens,
//             model_used:    'claude-haiku-4-5-20251001',
//             is_intro:      isFirstMessage,
//           })

//           // Mark intro_sent on session after first exchange
//           if (isFirstMessage) {
//             await supabaseAdmin
//               .from('prep_sessions')
//               .update({ intro_sent: true })
//               .eq('id', sessionId)
//           }

//           controller.enqueue(
//             encoder.encode(`data: ${JSON.stringify({ done: true, inputTokens, outputTokens })}\n\n`)
//           )
//           controller.close()

//         } catch (err: any) {
//           // If streaming fails, try to clean up the user message we already saved
//           console.error('Stream error:', err)
//           controller.enqueue(
//             encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`)
//           )
//           controller.close()
//         }
//       },
//     })

//     return new Response(stream, {
//       headers: {
//         'Content-Type':  'text/event-stream',
//         'Cache-Control': 'no-cache',
//         'Connection':    'keep-alive',
//       },
//     })

//   } catch (err: any) {
//     console.error('Chat API error:', err)
//     return new Response(
//       JSON.stringify({ error: err.message || 'Chat failed' }),
//       { status: 500 }
//     )
//   }
// }