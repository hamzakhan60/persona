'use client'
//app/chat/[sessionId]/page.tsx
import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Message = {
  id:         string
  role:       'user' | 'assistant'
  content:    string
  is_intro:   boolean
  created_at: string
}

type SessionData = {
  id:              string
  status:          string
  message_count:   number
  meeting_purpose: string
  profiles: {
    full_name:       string
    headline:        string
    location:        string
    profile_picture: string | null
  }
}

const PURPOSE_TIPS: Record<string, string[]> = {
  sales: [
    "What tools is your team currently using for this?",
    "What's your biggest challenge right now?",
    "What would make this a no-brainer for you?",
    "How do you typically evaluate new vendors?",
    "What does success look like in 90 days?",
  ],
  job_interview: [
    "Can you tell me about the team I'd be joining?",
    "What does success look like in the first 90 days?",
    "What's the biggest technical challenge the team faces?",
    "How do you approach performance reviews?",
    "What do you enjoy most about working here?",
  ],
  investor_pitch: [
    "What metrics matter most to you at this stage?",
    "What's your typical involvement post-investment?",
    "What concerns you most about this space?",
    "Have you seen similar companies in your portfolio?",
    "What would make this a clear yes for you?",
  ],
  partnership: [
    "What does an ideal partner look like to you?",
    "What integrations have worked well in the past?",
    "What's your process for evaluating new partnerships?",
    "What would mutual success look like?",
    "What's your timeline for decisions like this?",
  ],
  networking: [
    "What are you focused on these days?",
    "What's the most interesting problem you're working on?",
    "How did you get into this space?",
    "What would be most useful to you right now?",
    "Who else should I be talking to in this space?",
  ],
}

const DEFAULT_TIPS = [
  "What's your biggest challenge right now?",
  "How do you prefer to work with partners?",
  "What does success look like for you?",
  "What are you most focused on this quarter?",
  "What would make this conversation worthwhile?",
]

function Avatar({ name, picture, size = 36 }: { name: string; picture?: string | null; size?: number }) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'
  if (picture) {
    return (
      <img src={picture} alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #1E3A5F, #3B82F6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 600, color: 'white',
    }}>
      {initials}
    </div>
  )
}

function TypingIndicator({ name, picture }: { name: string; picture?: string | null }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', padding: '4px 0' }}>
      <Avatar name={name} picture={picture} size={32} />
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '16px 16px 16px 4px',
        padding: '12px 16px',
        display: 'flex', gap: 5, alignItems: 'center',
      }}>
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  )
}

export default function ChatPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const router = useRouter()

  const [session,   setSession]   = useState<SessionData | null>(null)
  const [messages,  setMessages]  = useState<Message[]>([])
  const [input,     setInput]     = useState('')
  const [streaming, setStreaming] = useState(false)
  const [typing,    setTyping]    = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [showTips,  setShowTips]  = useState(true)
  const [ending,    setEnding]    = useState(false)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const streamText = useRef('')

  // ── Load session + messages ──────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: sessionData, error: sessionErr } = await supabase
        .from('prep_sessions')
        .select('*, profiles(full_name, headline, location, profile_picture)')
        .eq('id', sessionId)
        .single()

      if (sessionErr || !sessionData) {
        router.push('/')
        return
      }

      // Redirect if session already ended
      if (sessionData.status === 'completed' || sessionData.status === 'abandoned') {
        router.push(`/summary/${sessionId}`)
        return
      }

      setSession(sessionData)

      const { data: msgs } = await supabase
        .from('messages')
        .select('id, role, content, is_intro, created_at')
        .eq('session_id', sessionId)
        .neq('role', 'system')
        .order('created_at', { ascending: true })

      setMessages(msgs || [])
      setLoading(false)
    }
    load()
  }, [sessionId, router])

  // ── Auto scroll ──────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  // ── Send message ─────────────────────────────────────────────
//   async function sendMessage(text?: string) {
//     const messageText = (text || input).trim()
//     if (!messageText || streaming || typing) return

//     setInput('')
//     setShowTips(false)
//     setError('')
//     setTyping(true)

//     // Optimistic user message
//     const tempId = `temp-${Date.now()}`
//     const tempUserMsg: Message = {
//       id:         tempId,
//       role:       'user',
//       content:    messageText,
//       is_intro:   false,
//       created_at: new Date().toISOString(),
//     }
//     setMessages(prev => [...prev, tempUserMsg])

//     try {
//       const res = await fetch('/api/chat', {
//         method:  'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body:    JSON.stringify({ sessionId, message: messageText }),
//       })

//       if (!res.ok) {
//         const errData = await res.json().catch(() => ({}))
//         throw new Error(errData.error || `Request failed: ${res.status}`)
//       }

//       if (!res.body) throw new Error('No response body from server')

//       setTyping(false)
//       setStreaming(true)
//       streamText.current = ''

//       // Add streaming placeholder
//       const streamId = `stream-${Date.now()}`
//       setMessages(prev => [...prev, {
//         id:         streamId,
//         role:       'assistant',
//         content:    '',
//         is_intro:   false,
//         created_at: new Date().toISOString(),
//       }])

//       const reader  = res.body.getReader()
//       const decoder = new TextDecoder()
//       let   buffer  = ''

//       while (true) {
//         const { done, value } = await reader.read()
//         if (done) break

//         // ✅ Buffer partial SSE lines properly
//         buffer += decoder.decode(value, { stream: true })
//         const lines = buffer.split('\n')
//         buffer = lines.pop() || ''  // keep incomplete line

//         for (const line of lines) {
//           if (!line.startsWith('data: ')) continue
//           const jsonStr = line.slice(6).trim()
//           if (!jsonStr) continue

//           try {
//             const data = JSON.parse(jsonStr)

//             if (data.error) {
//               throw new Error(data.error)
//             }

//             if (data.text) {
//               streamText.current += data.text
//               const currentText = streamText.current
//               setMessages(prev => {
//                 const updated = [...prev]
//                 const lastIdx = updated.length - 1
//                 if (updated[lastIdx]?.role === 'assistant') {
//                   updated[lastIdx] = { ...updated[lastIdx], content: currentText }
//                 }
//                 return updated
//               })
//             }

//             // ✅ On done, refresh from DB to get real IDs
//             if (data.done) {
//               const { data: freshMsgs } = await supabase
//                 .from('messages')
//                 .select('id, role, content, is_intro, created_at')
//                 .eq('session_id', sessionId)
//                 .neq('role', 'system')
//                 .order('created_at', { ascending: true })
//               if (freshMsgs) setMessages(freshMsgs)
//             }

//           } catch (parseErr: any) {
//             if (parseErr.message !== 'Unexpected end of JSON input') {
//               console.error('Stream parse error:', parseErr)
//               setError('Something went wrong. Please try again.')
//             }
//           }
//         }
//       }

//     } catch (err: any) {
//       console.error('Send error:', err)
//       setError(err.message || 'Failed to send message. Please try again.')
//       // Remove optimistic user message on failure
//       setMessages(prev => prev.filter(m => m.id !== tempId))
//     } finally {
//       setTyping(false)
//       setStreaming(false)
//       inputRef.current?.focus()
//     }
//   }

// Replace your entire sendMessage function with this
  async function sendMessage(text?: string) {
    const messageText = (text || input).trim()
    if (!messageText || streaming || typing) return

    setInput('')
    setShowTips(false)
    setError('')
    setTyping(true)

    // Optimistic user message
    const tempId = `temp-${Date.now()}`
    const tempUserMsg: Message = {
      id:         tempId,
      role:       'user',
      content:    messageText,
      is_intro:   false,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempUserMsg])

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sessionId, message: messageText }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || `Request failed: ${res.status}`)
      }

      setTyping(false)

      // Replace optimistic message + add assistant response
      const { data: freshMsgs } = await supabase
        .from('messages')
        .select('id, role, content, is_intro, created_at')
        .eq('session_id', sessionId)
        .neq('role', 'system')
        .order('created_at', { ascending: true })

      if (freshMsgs) setMessages(freshMsgs)

    } catch (err: any) {
      console.error('Send error:', err)
      setError(err.message || 'Failed to send message. Please try again.')
      setMessages(prev => prev.filter(m => m.id !== tempId))
    } finally {
      setTyping(false)
      setStreaming(false)
      inputRef.current?.focus()
    }
  }
  // ── End session ──────────────────────────────────────────────
  async function handleEndSession() {
    if (ending) return
    setEnding(true)
    try {
      const res = await fetch('/api/session/end', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sessionId }),
      })
      if (!res.ok) throw new Error('Failed to end session')
      router.push(`/summary/${sessionId}`)
    } catch (err) {
      console.error('End session error:', err)
      setEnding(false)
      setError('Failed to end session. Try again.')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Loading state ────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ color: 'var(--text-muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span>Loading session</span>
          <span style={{ display: 'flex', gap: 4 }}>
            <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
          </span>
        </div>
      </div>
    )
  }

  const person   = session?.profiles
  const tips     = PURPOSE_TIPS[session?.meeting_purpose || ''] || DEFAULT_TIPS
  const userMsgs = messages.filter(m => m.role === 'user').length
  const hasIntro = messages.some(m => m.is_intro)

  return (
    <div style={{
      height: '100vh', display: 'flex',
      flexDirection: 'column', background: 'var(--bg-primary)',
    }}>

      {/* ── Top bar ── */}
      <div style={{
        height: 60, flexShrink: 0,
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        background: 'var(--bg-primary)',
      }}>
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', display: 'flex',
            alignItems: 'center', gap: 6, fontSize: 14,
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          ← Exit
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{person?.full_name}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {person?.headline}
          </div>
        </div>

        <button
          className="btn-secondary"
          style={{ fontSize: 13, padding: '7px 14px' }}
          onClick={handleEndSession}
          disabled={ending}
        >
          {ending ? 'Ending...' : 'End session'}
        </button>
      </div>

      {/* ── Messages area ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px' }}>

          {/* Tip banner — before first user message */}
          {showTips && userMsgs === 0 && (
            <div className="card fade-in" style={{
              padding: '14px 18px', marginBottom: 24,
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <span style={{ color: 'var(--accent)', fontSize: 18, flexShrink: 0 }}>💡</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Quick tip</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                  Start with a brief introduction. Practice your pitch, then handle objections.
                  This is a safe space to try different approaches.
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((msg, i) => (
              <div
                key={msg.id}
                className="fade-in"
                style={{
                  display: 'flex',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  gap: 10,
                  alignItems: 'flex-end',
                  animationDelay: `${Math.min(i * 0.03, 0.3)}s`,
                }}
              >
                {msg.role === 'assistant' && (
                  <Avatar name={person?.full_name || ''} picture={person?.profile_picture} size={32} />
                )}

                <div style={{
                  maxWidth: '72%',
                  background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-card)',
                  border:     msg.role === 'user' ? 'none' : '1px solid var(--border)',
                  borderRadius: msg.role === 'user'
                    ? '16px 16px 4px 16px'
                    : '16px 16px 16px 4px',
                  padding:    '12px 16px',
                  color:      'var(--text-primary)',
                  fontSize:   15,
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                  wordBreak:  'break-word',
                  // ✅ Streaming cursor effect
                  borderColor: msg.content === '' ? 'var(--accent)' : undefined,
                }}>
                  {/* ✅ Show cursor while streaming empty message */}
                  {msg.content || (
                    <span style={{ opacity: 0.4, fontSize: 18, lineHeight: 1 }}>▊</span>
                  )}

                  {msg.is_intro && (
                    <div style={{
                      marginTop: 8, paddingTop: 8,
                      borderTop: '1px solid var(--border)',
                      fontSize: 11, color: 'var(--text-muted)',
                    }}>
                      ✦ PrepTalk AI
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing dots */}
            {typing && person && (
              <TypingIndicator name={person.full_name} picture={person.profile_picture} />
            )}
          </div>

          {/* Quick starter chips — after intro, before first user message */}
          {showTips && hasIntro && userMsgs === 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 10 }}>
                Try asking:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {tips.map(tip => (
                  <button
                    key={tip}
                    onClick={() => sendMessage(tip)}
                    disabled={streaming}
                    style={{
                      background:    'var(--bg-card)',
                      border:        '1px solid var(--border)',
                      borderRadius:  20,
                      color:         'var(--text-secondary)',
                      padding:       '7px 14px',
                      fontSize:      13,
                      cursor:        'pointer',
                      fontFamily:    'DM Sans, sans-serif',
                      transition:    'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      const el = e.target as HTMLElement
                      el.style.borderColor = 'var(--accent)'
                      el.style.color = 'var(--text-primary)'
                    }}
                    onMouseLeave={e => {
                      const el = e.target as HTMLElement
                      el.style.borderColor = 'var(--border)'
                      el.style.color = 'var(--text-secondary)'
                    }}
                  >
                    {tip}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div style={{
          background: '#2D1515', borderTop: '1px solid #5C2020',
          padding: '10px 24px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ color: '#FCA5A5', fontSize: 13 }}>{error}</span>
          <button
            onClick={() => setError('')}
            style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer', fontSize: 18 }}
          >
            ×
          </button>
        </div>
      )}

      {/* ── Input area ── */}
      <div style={{
        flexShrink: 0,
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-primary)',
        padding: '16px 24px 20px',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{
            display: 'flex', gap: 12, alignItems: 'flex-end',
            background: 'var(--bg-input)',
            border: `1px solid ${streaming ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 12,
            padding: '4px 4px 4px 16px',
            transition: 'border-color 0.15s',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={streaming ? `${person?.full_name} is typing...` : 'Type your message...'}
              disabled={streaming}
              rows={1}
              style={{
                flex: 1, background: 'transparent', border: 'none',
                outline: 'none', color: 'var(--text-primary)',
                fontFamily: 'DM Sans, sans-serif', fontSize: 15,
                resize: 'none', padding: '10px 0',
                lineHeight: 1.5, maxHeight: 120, overflowY: 'auto',
                opacity: streaming ? 0.5 : 1,
              }}
              onInput={e => {
                const el = e.target as HTMLTextAreaElement
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 120) + 'px'
              }}
            />
            <button
              className="btn-primary"
              onClick={() => sendMessage()}
              disabled={!input.trim() || streaming || typing}
              style={{
                padding: '10px 16px', borderRadius: 8,
                flexShrink: 0, alignSelf: 'flex-end', marginBottom: 4,
              }}
            >
              {streaming ? (
                <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                  <span className="typing-dot" style={{ background: 'white' }} />
                  <span className="typing-dot" style={{ background: 'white' }} />
                  <span className="typing-dot" style={{ background: 'white' }} />
                </span>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  <span style={{ marginLeft: 4 }}>Send</span>
                </>
              )}
            </button>
          </div>

          <div style={{
            textAlign: 'center', marginTop: 8,
            color: 'var(--text-muted)', fontSize: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {messages.length} messages · Enter to send · Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  )
}