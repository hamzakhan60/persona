'use client'
// app/setup/page.tsx

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Profile = {
  id:              string
  full_name:       string
  headline:        string
  location:        string
  profile_picture: string | null
  linkedin_url:    string
  data_richness_score: number
}

const PURPOSES = [
  { value: 'sales',          label: 'Sales Demo',      emoji: '💼', desc: 'Pitch your product or service' },
  { value: 'job_interview',  label: 'Job Interview',   emoji: '🎯', desc: 'Practice for an upcoming interview' },
  { value: 'investor_pitch', label: 'Investor Pitch',  emoji: '📈', desc: 'Pitch to a VC or angel investor' },
  { value: 'partnership',    label: 'Partnership',     emoji: '🤝', desc: 'Explore a business partnership' },
  { value: 'networking',     label: 'Networking',      emoji: '🌐', desc: 'Build a new relationship' },
  { value: 'other',          label: 'Other Meeting',   emoji: '💬', desc: 'Any other type of conversation' },
]

const CONTEXT_PLACEHOLDERS: Record<string, string> = {
  sales:          "e.g. I'm demoing our AI analytics platform. Sarah's team uses Salesforce and is evaluating Gong. Budget ~$60k/year.",
  job_interview:  "e.g. Interviewing for Senior Engineer role. I have 8 years backend experience in Go. Nervous about system design questions at scale.",
  investor_pitch: "e.g. Raising Series A. $1.2M ARR, 25% MoM growth. Alex posted about agent reliability tooling which is exactly what we build.",
  partnership:    "e.g. Pitching a Notion integration. We connect 200+ apps. 800 of our users actively use Notion. Want a featured integration slot.",
  networking:     "e.g. Met James at SaaStr. Both interested in PLG motions. Want to share learnings and explore if there's a referral opportunity.",
  other:          "Describe what you want to accomplish in this conversation...",
}

const GOAL_PLACEHOLDERS: Record<string, string> = {
  sales:          "e.g. Get Sarah to agree to a 2-week pilot with her top 5 AEs",
  job_interview:  "e.g. Leave Marcus confident I can handle distributed systems at Stripe scale",
  investor_pitch: "e.g. Get Alexandra to agree to a second meeting and term sheet discussion",
  partnership:    "e.g. Get James to commit to a technical review meeting this week",
  networking:     "e.g. Establish a genuine connection and agree to stay in touch quarterly",
  other:          "e.g. What's the one thing you want to walk away with?",
}

function Avatar({ name, picture, size = 40 }: { name: string; picture?: string | null; size?: number }) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'
  if (picture) {
    return <img src={picture} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
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

function RichnessBar({ score }: { score: number }) {
  const color = score >= 70 ? 'var(--green)' : score >= 40 ? 'var(--yellow)' : 'var(--red)'
  const label = score >= 70 ? 'Rich profile' : score >= 40 ? 'Good profile' : 'Thin profile'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 500, whiteSpace: 'nowrap' }}>{label} ({score}%)</span>
    </div>
  )
}

export default function SetupPage() {
  const router = useRouter()

  // Step: 'profile' | 'purpose' | 'context' | 'creating'
  const [step,    setStep]    = useState<'profile' | 'purpose' | 'context' | 'creating'>('profile')
  const [error,   setError]   = useState('')

  // Step 1 — profile selection
  const [profiles,     setProfiles]     = useState<Profile[]>([])
  const [profilesLoading, setProfilesLoading] = useState(true)
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
  const [urlInput,     setUrlInput]     = useState('')
  const [urlSearching, setUrlSearching] = useState(false)

  // Step 2 — purpose
  const [purpose, setPurpose] = useState('')

  // Step 3 — context
  const [context,            setContext]            = useState('')
  const [goal,               setGoal]               = useState('')
  const [communicationStyle, setCommunicationStyle] = useState('professional')

  // Load existing profiles for quick selection
  useEffect(() => {
    async function loadProfiles() {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, headline, location, profile_picture, linkedin_url, data_richness_score')
        .order('scraped_at', { ascending: false })
        .limit(10)
      setProfiles(data || [])
      setProfilesLoading(false)
    }
    loadProfiles()
  }, [])

  // Look up profile by LinkedIn URL
  async function handleUrlLookup() {
    if (!urlInput.trim()) return
    setUrlSearching(true)
    setError('')
    try {
      const url = urlInput.trim().split('?')[0].replace(/\/$/, '') // normalize
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, headline, location, profile_picture, linkedin_url, data_richness_score')
        .eq('linkedin_url', url)
        .single()

      if (data) {
        setSelectedProfile(data)
        setStep('purpose')
      } else {
        setError('Profile not found in database. Use the Chrome extension on their LinkedIn page first, or select an existing profile below.')
      }
    } catch {
      setError('Profile not found. Try selecting from the list below.')
    } finally {
      setUrlSearching(false)
    }
  }

  // Create the session
  async function handleCreate() {
    if (!selectedProfile || !purpose) return
    setStep('creating')
    setError('')

    try {
      const res = await fetch('/api/session', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId:          selectedProfile.id,
          meetingPurpose:     purpose,
          meetingContext:     context,
          meetingGoal:        goal,
          communicationStyle: communicationStyle,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create session')

      router.push(`/chat/${data.sessionId}`)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setStep('context')
    }
  }

  // ── STEP: CREATING ───────────────────────────────────────────
  if (step === 'creating') {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 20 }}>✦</div>
          <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 8 }}>
            Preparing your session
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
            Analyzing {selectedProfile?.full_name}'s profile and generating your intro...
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
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
        position: 'sticky', top: 0,
        background: 'var(--bg-primary)', zIndex: 100,
      }}>
        <button
          onClick={() => step === 'profile' ? router.push('/') : setStep(step === 'context' ? 'purpose' : 'profile')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 14,
            fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          ← {step === 'profile' ? 'Dashboard' : 'Back'}
        </button>

        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>
          New Session
        </span>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {(['profile', 'purpose', 'context'] as const).map((s, i) => (
            <div key={s} style={{
              width:  step === s ? 20 : 6,
              height: 6,
              borderRadius: 3,
              background: step === s ? 'var(--accent)' :
                (['profile', 'purpose', 'context'].indexOf(step) > i) ? 'var(--accent-subtle)' : 'var(--border)',
              transition: 'all 0.2s ease',
            }} />
          ))}
        </div>
      </nav>

      <main style={{ maxWidth: 600, margin: '0 auto', padding: '48px 24px' }}>

        {/* ── STEP 1: SELECT PROFILE ── */}
        {step === 'profile' && (
          <div className="slide-up">
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 8 }}>
              Who are you meeting?
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
              Select a profile you've already scraped, or paste their LinkedIn URL.
            </p>

            {/* URL input */}
            <div style={{ marginBottom: 32 }}>
              <label className="label">LinkedIn URL</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input-field"
                  placeholder="https://linkedin.com/in/username"
                  value={urlInput}
                  onChange={e => { setUrlInput(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleUrlLookup()}
                  style={{ flex: 1 }}
                />
                <button
                  className="btn-primary"
                  onClick={handleUrlLookup}
                  disabled={!urlInput.trim() || urlSearching}
                  style={{ flexShrink: 0, padding: '12px 20px' }}
                >
                  {urlSearching ? '...' : 'Find'}
                </button>
              </div>
              {error && (
                <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 8, background: '#2D1515', border: '1px solid #5C2020', color: '#FCA5A5', fontSize: 13 }}>
                  {error}
                </div>
              )}
            </div>

            {/* Existing profiles */}
            {profilesLoading ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading profiles...</div>
            ) : profiles.length > 0 ? (
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>
                  Or choose from recent profiles:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {profiles.map(p => (
                    <div
                      key={p.id}
                      className="card-hover"
                      onClick={() => { setSelectedProfile(p); setStep('purpose') }}
                      style={{
                        padding: '14px 16px', display: 'flex',
                        alignItems: 'center', gap: 14,
                        border: selectedProfile?.id === p.id ? '1px solid var(--accent)' : undefined,
                      }}
                    >
                      <Avatar name={p.full_name} picture={p.profile_picture} size={44} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{p.full_name}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 6,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.headline}
                        </div>
                        <RichnessBar score={p.data_richness_score} />
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🔌</div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>No profiles yet</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                  Install the Chrome extension and open a LinkedIn profile to scrape it, or paste a URL above.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: SELECT PURPOSE ── */}
        {step === 'purpose' && selectedProfile && (
          <div className="slide-up">

            {/* Selected profile recap */}
            <div className="card" style={{ padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'center', marginBottom: 32 }}>
              <Avatar name={selectedProfile.full_name} picture={selectedProfile.profile_picture} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{selectedProfile.full_name}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedProfile.headline}
                </div>
              </div>
              <button
                onClick={() => setStep('profile')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}
              >
                Change
              </button>
            </div>

            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 8 }}>
              What's the meeting for?
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>
              This shapes how the AI plays the role and what questions to practice.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {PURPOSES.map(p => (
                <div
                  key={p.value}
                  className="card-hover"
                  onClick={() => { setPurpose(p.value); setStep('context') }}
                  style={{
                    padding: '16px 18px',
                    border: purpose === p.value ? '1px solid var(--accent)' : undefined,
                    background: purpose === p.value ? 'var(--accent-subtle)' : undefined,
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{p.emoji}</div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{p.label}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{p.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 3: CONTEXT ── */}
        {step === 'context' && selectedProfile && purpose && (
          <div className="slide-up">

            {/* Recap pill */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
              <div className="badge" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12 }}>
                <Avatar name={selectedProfile.full_name} picture={selectedProfile.profile_picture} size={18} />
                <span style={{ marginLeft: 6 }}>{selectedProfile.full_name}</span>
              </div>
              <div className="badge" style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border)', color: 'var(--accent)', fontSize: 12 }}>
                {PURPOSES.find(p => p.value === purpose)?.emoji} {PURPOSES.find(p => p.value === purpose)?.label}
              </div>
            </div>

            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 8 }}>
              Give the AI context
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>
              The more detail you give, the more realistic and useful the practice will be.
            </p>

            {/* Meeting context */}
            <div style={{ marginBottom: 20 }}>
              <label className="label">Meeting context <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(required)</span></label>
              <textarea
                className="input-field"
                rows={4}
                placeholder={CONTEXT_PLACEHOLDERS[purpose] || CONTEXT_PLACEHOLDERS.other}
                value={context}
                onChange={e => setContext(e.target.value)}
                style={{ resize: 'vertical', minHeight: 100 }}
              />
            </div>

            {/* Goal */}
            <div style={{ marginBottom: 20 }}>
              <label className="label">Your goal for this meeting <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              <input
                className="input-field"
                placeholder={GOAL_PLACEHOLDERS[purpose] || GOAL_PLACEHOLDERS.other}
                value={goal}
                onChange={e => setGoal(e.target.value)}
              />
            </div>

            {/* Communication style */}
            <div style={{ marginBottom: 32 }}>
              <label className="label">Their communication style <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { value: 'professional', label: 'Professional' },
                  { value: 'direct',       label: 'Direct & blunt' },
                  { value: 'analytical',   label: 'Analytical' },
                  { value: 'warm',         label: 'Warm & friendly' },
                ].map(style => (
                  <button
                    key={style.value}
                    onClick={() => setCommunicationStyle(style.value)}
                    style={{
                      padding: '8px 14px', borderRadius: 20,
                      border: `1px solid ${communicationStyle === style.value ? 'var(--accent)' : 'var(--border)'}`,
                      background: communicationStyle === style.value ? 'var(--accent-subtle)' : 'transparent',
                      color: communicationStyle === style.value ? 'var(--accent)' : 'var(--text-secondary)',
                      cursor: 'pointer', fontSize: 13,
                      fontFamily: 'DM Sans, sans-serif',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: '#2D1515', border: '1px solid #5C2020', color: '#FCA5A5', fontSize: 13 }}>
                {error}
              </div>
            )}

            <button
              className="btn-primary"
              onClick={handleCreate}
              disabled={!context.trim()}
              style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 16 }}
            >
              Start prep session →
            </button>

            <p style={{ textAlign: 'center', marginTop: 12, color: 'var(--text-muted)', fontSize: 12 }}>
              Session will open with an AI intro from {selectedProfile.full_name}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}