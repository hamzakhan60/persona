'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type SummaryData = {
  overallScore:    number
  keyInsights:     Array<{ type: 'positive' | 'improve'; title: string; detail: string }>
  moments:         Array<{ label: string; score: number; note: string }>
  recommendations: string[]
}

type SessionData = {
  id:              string
  meeting_purpose: string
  message_count:   number
  session_summary: string | null
  started_at:      string
  profiles: {
    full_name:       string
    headline:        string
    profile_picture: string | null
  }
}

const PURPOSE_LABELS: Record<string, string> = {
  sales:          'Sales call',
  job_interview:  'Job interview',
  partnership:    'Partnership discussion',
  investor_pitch: 'Investor pitch',
  networking:     'Networking',
  other:          'Meeting',
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div style={{
      height: 6, borderRadius: 3,
      background: 'var(--border)',
      overflow: 'hidden', marginTop: 8,
    }}>
      <div style={{
        height: '100%', borderRadius: 3,
        width: `${score}%`,
        background: color,
        transition: 'width 0.8s ease',
      }} />
    </div>
  )
}

function Avatar({ name, picture, size = 40 }: { name: string; picture?: string | null; size?: number }) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'
  if (picture) {
    return (
      <img src={picture} alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #1E3A5F, #3B82F6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 600, color: 'white',
    }}>
      {initials}
    </div>
  )
}

export default function SummaryPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const router        = useRouter()

  const [session,  setSession]  = useState<SessionData | null>(null)
  const [summary,  setSummary]  = useState<SummaryData | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [rating,   setRating]   = useState(0)
  const [showRate, setShowRate] = useState(false)
  const [rated,    setRated]    = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('prep_sessions')
        .select('*, profiles(full_name, headline, profile_picture)')
        .eq('id', sessionId)
        .single()

      if (!data) { router.push('/'); return }
      setSession(data)

      if (data.session_summary) {
        try {
          setSummary(JSON.parse(data.session_summary))
        } catch { /* use null */ }
      }

      // If no summary yet, generate it
      if (!data.session_summary || data.status !== 'completed') {
        const res = await fetch('/api/session/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
        const result = await res.json()
        if (result.summary) setSummary(result.summary)
      }

      setLoading(false)
    }
    load()
  }, [sessionId])

  async function submitRating() {
    if (!rating) return
    await supabase.from('feedback').upsert({
      session_id: sessionId,
      user_id:    '00000000-0000-0000-0000-000000000000',
      rating,
    })
    setRated(true)
  }

  function getScoreColor(score: number) {
    if (score >= 80) return 'var(--green)'
    if (score >= 60) return 'var(--yellow)'
    return 'var(--red)'
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg-primary)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
      }}>
        <div style={{ fontSize: 32 }}>✦</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Generating your session summary...</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    )
  }

  const person = session?.profiles

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: 100 }}>

      {/* Top bar */}
      <div style={{
        padding: '0 24px',
        height: 56,
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>PrepTalk</span>
      </div>

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '40px 24px' }}>

        {/* Header */}
        <div className="slide-up" style={{ marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 20,
            background: 'var(--green-subtle)',
            border: '1px solid var(--green)',
            marginBottom: 16,
          }}>
            <span style={{ color: 'var(--green)', fontSize: 13 }}>✓ Session complete</span>
          </div>

          <h1 style={{
            fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em',
            marginBottom: 8,
          }}>
            Practice session summary
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)', fontSize: 14 }}>
            <Avatar name={person?.full_name || ''} picture={person?.profile_picture} size={24} />
            <span>
              Conversation with {person?.full_name} · {PURPOSE_LABELS[session?.meeting_purpose || ''] || 'Meeting'}
            </span>
          </div>
        </div>

        {/* Overall score */}
        {summary && (
          <>
            <div className="card fade-in" style={{ padding: 24, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>Overall performance</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                    Based on communication effectiveness, objection handling, and goal achievement
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, color: 'var(--text-primary)' }}>
                    {summary.overallScore}
                    <span style={{ fontSize: 18, color: 'var(--text-muted)', fontWeight: 400 }}>/100</span>
                  </div>
                  <div style={{ color: 'var(--green)', fontSize: 12, marginTop: 2 }}>
                    ↑ Great session
                  </div>
                </div>
              </div>
              <ScoreBar score={summary.overallScore} color="var(--accent)" />
            </div>

            {/* Key insights */}
            <section style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Key insights</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {summary.keyInsights.map((insight, i) => (
                  <div key={i} className="card fade-in" style={{
                    padding: '14px 16px',
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    animationDelay: `${i * 0.08}s`,
                  }}>
                    <span style={{
                      fontSize: 16, flexShrink: 0, marginTop: 1,
                      color: insight.type === 'positive' ? 'var(--green)' : 'var(--yellow)',
                    }}>
                      {insight.type === 'positive' ? '✓' : '⚠'}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{insight.title}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{insight.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Performance by moment */}
            {summary.moments.length > 0 && (
              <section style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Performance by moment</h2>
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {summary.moments.map((moment, i) => (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontWeight: 500, fontSize: 14 }}>{moment.label}</span>
                          <span style={{ fontWeight: 600, fontSize: 14, color: getScoreColor(moment.score) }}>
                            {moment.score}%
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 6 }}>
                          {moment.note}
                        </div>
                        <ScoreBar score={moment.score} color={getScoreColor(moment.score)} />
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Recommendations */}
            {summary.recommendations.length > 0 && (
              <section style={{ marginBottom: 32 }}>
                <div className="card" style={{ padding: 20, background: 'var(--bg-secondary)' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
                    <span style={{ color: 'var(--accent)', fontSize: 16 }}>◎</span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Recommended for your next session</span>
                  </div>
                  <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {summary.recommendations.map((rec, i) => (
                      <li key={i} style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{rec}</li>
                    ))}
                  </ul>
                </div>
              </section>
            )}
          </>
        )}

        {/* Rating section */}
        {!rated ? (
          <div className="card" style={{ padding: 20, marginBottom: 24 }}>
            {!showRate ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Was this session helpful?</span>
                <button
                  className="btn-secondary"
                  style={{ fontSize: 13, padding: '7px 14px' }}
                  onClick={() => setShowRate(true)}
                >
                  Rate session ★
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 12 }}>How was this session?</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 28, color: star <= rating ? '#F59E0B' : 'var(--border)',
                        transition: 'color 0.1s, transform 0.1s',
                        transform: star <= rating ? 'scale(1.1)' : 'scale(1)',
                      }}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <button
                  className="btn-primary"
                  style={{ fontSize: 13, padding: '8px 20px' }}
                  onClick={submitRating}
                  disabled={!rating}
                >
                  Submit
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{
            padding: '14px 16px', borderRadius: 8, marginBottom: 24,
            background: 'var(--green-subtle)', border: '1px solid var(--green)',
            color: 'var(--green)', fontSize: 14, fontWeight: 500,
          }}>
            ✓ Thanks for your feedback — it helps us improve!
          </div>
        )}

        {/* Bottom actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            className="btn-secondary"
            onClick={() => router.push(`/chat/${sessionId}`)}
            style={{ flex: '0 0 auto' }}
          >
            ← Back to chat
          </button>
          <button
            className="btn-primary"
            onClick={() => router.push('/setup')}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            Start another session
          </button>
        </div>
      </main>
    </div>
  )
}   