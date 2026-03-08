'use client'
//app/chat/page.tsx
import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Message = {
  id:        string
  role:      'user' | 'assistant'
  content:   string
  is_intro:  boolean
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

const QUICK_TIPS = [
  'What do you care most about in a vendor?',
  "What's your biggest challenge right now?",
  'How do you prefer to evaluate new solutions?',
  'What would make this a no-brainer for you?',
  'What does success look like for you in 90 days?',
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
  const router        = useRouter()

  const [session,   setSession]   = useState<SessionData | null>(null)
  const [messages,  setMessages]  = useState<Message[]>([])
  const [input,     setInput]     = useState('')
  const [streaming, setStreaming] = useState(false)
  const [typing,    setTyping]    = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [showTips,  setShowTips]  = useState(true)
  const [ending,    setEnding]    = useState(false)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const streamText = useRef('')

  // Fetch session + messages
  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase
        .from('prep_sessions')
        .select('*, profiles(full_name, headline, location, profile_picture)')
        .eq('id', sessionId)
        .single()

      if (!sessionData) { router.push('/'); return }
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
  }, [sessionId])

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  async function sendMessage(text?: string) {
    const messageText = (text || input).trim()
    if (!messageText || streaming) return

    setInput('')
    setShowTips(false)
    setTyping(true)

    // Optimistically add user message
    const tempUserMsg: Message = {
      id:         `temp-${Date.now()}`,
      role:       'user',
      content:    messageText,
      is_intro:   false,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempUserMsg])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: messageText }),
      })

      if (!res.ok) throw new Error('Chat request failed')
      if (!res.body)  throw new Error('No response body')

      setTyping(false)
      setStreaming(true)
      streamText.current = ''

      // Add placeholder AI message
      const tempAiMsg: Message = {
        id:         `stream-${Date.now()}`,
        role:       'assistant',
        content:    '',
        is_intro:   false,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, tempAiMsg])

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.text) {
              streamText.current += data.text
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: streamText.current,
                }
                return updated
              })
            }
            if (data.done) {
              // Reload messages from DB for accurate IDs
              const { data: freshMsgs } = await supabase
                .from('messages')
                .select('id, role, content, is_intro, created_at')
                .eq('session_id', sessionId)
                .neq('role', 'system')
                .order('created_at', { ascending: true })
              if (freshMsgs) setMessages(freshMsgs)
            }
          } catch { /* skip malformed chunks */ }
        }
      }

    } catch (err) {
      console.error('Send error:', err)
    } finally {
      setTyping(false)
      setStreaming(false)
      inputRef.current?.focus()
    }
  }

  async function handleEndSession() {
    setEnding(true)
    try {
      await fetch('/api/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      router.push(`/summary/${sessionId}`)
    } catch {
      setEnding(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ color: 'var(--text-muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span>Loading session</span>
          <span style={{ display: 'flex', gap: 4 }}>
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </span>
        </div>
      </div>
    )
  }

  const person = session?.profiles

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-primary)',
    }}>

      {/* Top bar */}
      <div style={{
        height: 60, flexShrink: 0,
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        background: 'var(--bg-primary)',
      }}>
        {/* Left */}
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', display: 'flex',
            alignItems: 'center', gap: 6, fontSize: 14,
          }}
        >
          ← Exit
        </button>

        {/* Center */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{person?.full_name}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{person?.headline}</div>
        </div>

        {/* Right */}
        <button
          className="btn-secondary"
          style={{ fontSize: 13, padding: '7px 14px' }}
          onClick={handleEndSession}
          disabled={ending}
        >
          {ending ? 'Ending...' : 'End session'}
        </button>
      </div>

      {/* Messages area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 0',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px' }}>

          {/* Quick tip — shown until first user message */}
          {showTips && messages.length <= 1 && (
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
                  animationDelay: `${i * 0.03}s`,
                }}
              >
                {msg.role === 'assistant' && (
                  <Avatar name={person?.full_name || ''} picture={person?.profile_picture} size={32} />
                )}

                <div style={{
                  maxWidth: '72%',
                  background: msg.role === 'user'
                    ? 'var(--accent)'
                    : 'var(--bg-card)',
                  border: msg.role === 'user'
                    ? 'none'
                    : '1px solid var(--border)',
                  borderRadius: msg.role === 'user'
                    ? '16px 16px 4px 16px'
                    : msg.is_intro
                    ? '16px 16px 16px 4px'
                    : '16px 16px 16px 4px',
                  padding: '12px 16px',
                  color: 'var(--text-primary)',
                  fontSize: 15,
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                  boxShadow: msg.is_intro ? '0 0 0 1px var(--accent-subtle)' : 'none',
                }}>
                  {msg.content}
                  {msg.is_intro && (
                    <div style={{
                      marginTop: 8, paddingTop: 8,
                      borderTop: '1px solid var(--border)',
                      fontSize: 11, color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      ✦ PrepTalk AI
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {typing && person && (
              <TypingIndicator name={person.full_name} picture={person.profile_picture} />
            )}
          </div>

          {/* Quick starters — show after intro, before first user message */}
          {showTips && messages.some(m => m.is_intro) && messages.filter(m => m.role === 'user').length === 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 10 }}>
                Try asking:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {QUICK_TIPS.map(tip => (
                  <button
                    key={tip}
                    onClick={() => sendMessage(tip)}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 20,
                      color: 'var(--text-secondary)',
                      padding: '7px 14px',
                      fontSize: 13,
                      cursor: 'pointer',
                      fontFamily: 'DM Sans, sans-serif',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      (e.target as HTMLElement).style.borderColor = 'var(--accent)'
                      ;(e.target as HTMLElement).style.color = 'var(--text-primary)'
                    }}
                    onMouseLeave={e => {
                      (e.target as HTMLElement).style.borderColor = 'var(--border)'
                      ;(e.target as HTMLElement).style.color = 'var(--text-secondary)'
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

      {/* Input area */}
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
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '4px 4px 4px 16px',
            transition: 'border-color 0.15s',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Type your message...`}
              rows={1}
              style={{
                flex: 1, background: 'transparent', border: 'none',
                outline: 'none', color: 'var(--text-primary)',
                fontFamily: 'DM Sans, sans-serif', fontSize: 15,
                resize: 'none', padding: '10px 0',
                lineHeight: 1.5, maxHeight: 120, overflowY: 'auto',
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
              disabled={!input.trim() || streaming}
              style={{
                padding: '10px 16px', borderRadius: 8,
                flexShrink: 0, alignSelf: 'flex-end',
                marginBottom: 4,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              <span style={{ marginLeft: 4 }}>Send</span>
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
            {messages.filter(m => m.role !== 'system').length} messages exchanged
          </div>
        </div>
      </div>
    </div>
  )
}