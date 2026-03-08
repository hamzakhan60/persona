'use client'
// app/dashboard/page.tsx

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type SessionOverview = {
  session_id:          string
  user_id:             string
  person_name:         string
  person_headline:     string
  person_picture:      string | null
  linkedin_url:        string
  meeting_purpose:     string
  message_count:       number
  started_at:          string
  last_active_at:      string
  status:              string
  feedback_rating:     number | null
  data_richness_score: number
}

const PURPOSE_LABELS: Record<string, string> = {
  sales:          'Sales Demo',
  job_interview:  'Job Interview',
  partnership:    'Partnership',
  investor_pitch: 'Investor Pitch',
  networking:     'Networking',
  other:          'Meeting',
}

const PURPOSE_COLORS: Record<string, { bg: string; color: string }> = {
  sales:          { bg: '#1E3A5F', color: '#60A5FA' },
  job_interview:  { bg: '#1A3A2A', color: '#34D399' },
  partnership:    { bg: '#2D1F3A', color: '#A78BFA' },
  investor_pitch: { bg: '#3A2A1A', color: '#FBB040' },
  networking:     { bg: '#1A2A3A', color: '#67E8F9' },
  other:          { bg: '#1E2A3E', color: '#94A3B8' },
}

function timeAgo(dateStr: string) {
  const diff  = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  <  1)  return 'Just now'
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  if (days  === 1) return 'Yesterday'
  if (days  < 30)  return `${days} days ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function Avatar({ name, picture, size = 40 }: { name: string; picture?: string | null; size?: number }) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'
  if (picture) {
    return (
      <img src={picture} alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
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

function PurposeBadge({ purpose }: { purpose: string }) {
  const s = PURPOSE_COLORS[purpose] || PURPOSE_COLORS.other
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 500,
      background: s.bg, color: s.color,
    }}>
      {PURPOSE_LABELS[purpose] || 'Meeting'}
    </span>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const { user, loading: authLoading, signOut } = useAuth()

  const [sessions, setSessions] = useState<SessionOverview[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<'all' | 'active' | 'completed'>('all')

  // ✅ Wait for auth to resolve, then fetch only this user's sessions
  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); 
      console.log(user)
      return }

    supabase
      .from('session_overview')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) console.error('session_overview error:', error.message)
        setSessions(data || [])
        setLoading(false)
      })
  }, [user, authLoading, router])

  const activeSessions    = sessions.filter(s => s.status === 'active')
  const completedSessions = sessions.filter(s => s.status === 'completed')
  const totalMessages     = sessions.reduce((sum, s) => sum + (s.message_count || 0), 0)

  const displayed = filter === 'active'    ? activeSessions
                  : filter === 'completed' ? completedSessions
                  : sessions

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span>Loading</span>
          <span style={{ display: 'flex', gap: 4 }}>
            <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
          </span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>

      {/* Nav */}
      <nav style={{
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 32px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 100,
      }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          PrepTalk
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user && (
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              {user.user_metadata?.full_name || user.email}
            </span>
          )}
          <button className="btn-primary" style={{ fontSize: 13, padding: '8px 16px' }}
            onClick={() => router.push('/setup')}>
            + New Session
          </button>
          <button className="btn-secondary" style={{ fontSize: 13, padding: '8px 14px' }}
            onClick={async () => { await signOut(); router.push('/login') }}>
            Sign out
          </button>
        </div>
      </nav>

      <main style={{ maxWidth: 780, margin: '0 auto', padding: '48px 24px' }}>

        {/* Hero */}
        <div className="slide-up" style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: 8 }}>
            {user?.user_metadata?.full_name
              ? `Welcome back, ${user.user_metadata.full_name.split(' ')[0]}`
              : 'Prepare with confidence'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16 }}>
            Practice conversations with AI before your important meetings
          </p>
        </div>

        {/* Stats */}
        {sessions.length > 0 && !loading && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 36 }}>
            {[
              { label: 'Total sessions', value: sessions.length },
              { label: 'Active',         value: activeSessions.length },
              { label: 'Completed',      value: completedSessions.length },
              { label: 'Messages sent',  value: totalMessages },
            ].map(stat => (
              <div key={stat.label} className="card" style={{ padding: '14px 18px', flex: 1 }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>{stat.label}</div>
                <div style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em' }}>{stat.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {sessions.length === 0 && !loading && (
          <div className="card fade-in" style={{
            padding: 24, marginBottom: 32,
            background: 'var(--accent-subtle)', border: '1px solid #1E3A5F',
          }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: 'var(--accent)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 20,
              }}>🔌</div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Install the Chrome Extension to get started</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 12 }}>
                  Open any LinkedIn profile and click the PrepTalk button to scrape their full profile and start a prep session.
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-primary" style={{ fontSize: 13, padding: '8px 16px' }}>
                    Install Extension
                  </button>
                  <button className="btn-secondary" style={{ fontSize: 13, padding: '8px 16px' }}
                    onClick={() => router.push('/setup')}>
                    Start manually →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active sessions pinned */}
        {activeSessions.length > 0 && filter === 'all' && (
          <section style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Active sessions</h2>
              <span style={{ background: 'var(--accent)', color: 'white', borderRadius: 10, fontSize: 11, fontWeight: 600, padding: '1px 7px' }}>
                {activeSessions.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeSessions.map(s => (
                <div key={s.session_id} className="card-hover"
                  onClick={() => router.push(`/chat/${s.session_id}`)}
                  style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, borderLeft: '3px solid var(--accent)' }}
                >
                  <Avatar name={s.person_name} picture={s.person_picture} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{s.person_name}</span>
                      <PurposeBadge purpose={s.meeting_purpose} />
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.person_headline}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 3 }}>
                      {s.message_count} messages · {timeAgo(s.last_active_at || s.started_at)}
                    </div>
                  </div>
                  <button className="btn-primary" style={{ fontSize: 13, padding: '7px 14px', flexShrink: 0 }}
                    onClick={e => { e.stopPropagation(); router.push(`/chat/${s.session_id}`) }}>
                    Continue →
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* New session CTA */}
        {sessions.length > 0 && activeSessions.length === 0 && filter === 'all' && (
          <div className="card-hover" onClick={() => router.push('/setup')}
            style={{ padding: 24, marginBottom: 32, display: 'flex', alignItems: 'center', gap: 16, border: '1px dashed var(--border)' }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>+</div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Start a new prep session</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Paste a LinkedIn URL or use the Chrome extension on any profile</div>
            </div>
          </div>
        )}

        {/* Sessions list with filter tabs */}
        {sessions.length > 0 && (
          <section>
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', padding: 4, borderRadius: 8, marginBottom: 16, width: 'fit-content' }}>
              {([
                { key: 'all',       label: `All (${sessions.length})` },
                { key: 'active',    label: `Active (${activeSessions.length})` },
                { key: 'completed', label: `Completed (${completedSessions.length})` },
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => setFilter(tab.key)} style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 500, fontFamily: 'DM Sans, sans-serif',
                  background: filter === tab.key ? 'var(--bg-card)' : 'transparent',
                  color:      filter === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}>{tab.label}</button>
              ))}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>Loading sessions...</div>
            ) : displayed.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                No {filter !== 'all' ? filter : ''} sessions yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {displayed.map((s, i) => (
                  <div key={s.session_id} className="card-hover fade-in"
                    onClick={() => router.push(s.status === 'active' ? `/chat/${s.session_id}` : `/summary/${s.session_id}`)}
                    style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, animationDelay: `${Math.min(i * 0.04, 0.3)}s` }}
                  >
                    <Avatar name={s.person_name} picture={s.person_picture} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, fontSize: 15 }}>{s.person_name}</span>
                        <PurposeBadge purpose={s.meeting_purpose} />
                        {s.status === 'active' && (
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                        )}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                        {s.person_headline}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {s.message_count} messages · {timeAgo(s.started_at)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      {s.feedback_rating && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: 'var(--green)', fontWeight: 600, fontSize: 15 }}>↑ {s.feedback_rating * 20}%</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Confidence</div>
                        </div>
                      )}
                      {s.status === 'active' ? (
                        <button className="btn-primary" style={{ fontSize: 13, padding: '7px 14px' }}
                          onClick={e => { e.stopPropagation(); router.push(`/chat/${s.session_id}`) }}>
                          Continue →
                        </button>
                      ) : (
                        <button className="btn-secondary" style={{ fontSize: 13, padding: '7px 14px' }}
                          onClick={e => { e.stopPropagation(); router.push(`/summary/${s.session_id}`) }}>
                          Review
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}