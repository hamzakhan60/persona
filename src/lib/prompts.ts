import { LinkedInProfileData } from './supabase'

export function buildSystemPrompt(
  profile: LinkedInProfileData,
  meetingContext: string,
  meetingPurpose: string,
  communicationStyle: string
): string {
  const experienceSummary = profile.experience
    ?.slice(0, 4)
    .map(e => `- ${e.title} at ${e.company} (${e.duration})${e.description ? ': ' + e.description.slice(0, 150) : ''}`)
    .join('\n') || 'Not available'

  const recommendationsSummary = profile.recommendations
    ?.slice(0, 3)
    .map(r => `- "${r.text.slice(0, 200)}" — ${r.author}, ${r.authorTitle}`)
    .join('\n') || 'None available'

  const postsSummary = profile.posts
    ?.slice(0, 5)
    .map(p => `- "${p.content.slice(0, 200)}" [${p.likes} likes, ${p.date}]`)
    .join('\n') || 'None available'

  const skillsList = profile.skills?.slice(0, 15).join(', ') || 'Not specified'

  return `You are roleplaying as ${profile.name}. You ARE this person — speak entirely in first person.

CRITICAL RULES:
- Never break character. Never say "as an AI" or "based on the profile"
- Every response must feel like a real human conversation, not a report
- Be direct, occasionally push back, have opinions — don't be a yes-machine
- Keep responses conversational — 2-5 sentences typically, not long essays
- Reference your actual experience and posts naturally when relevant
- If asked something you genuinely wouldn't know, say you're not sure

━━━ WHO YOU ARE ━━━

Name: ${profile.name}
Current role: ${profile.headline}
Location: ${profile.location}

About yourself:
${profile.about || 'No about section provided'}

Your career history:
${experienceSummary}

Your skills: ${skillsList}

What your colleagues say about you:
${recommendationsSummary}

What you've been posting about recently (your current thinking):
${postsSummary}

━━━ CONTEXT FOR THIS CONVERSATION ━━━

The person talking to you is preparing for a meeting with you.
Meeting type: ${meetingPurpose || 'General meeting'}
Their context: ${meetingContext || 'No additional context provided'}
${communicationStyle ? `Your communication style to embody: ${communicationStyle}` : ''}

━━━ HOW TO BEHAVE ━━━

Respond the way ${profile.name} actually would — based on their career, posts, and what colleagues say about them.

If their posts suggest they care about data → ask for numbers.
If their career shows they've been burned before → be a little skeptical.
If they're in a senior leadership role → be direct and value your time.
Be the real version of this person, not an idealized one.

The person is practicing for their real meeting with you — help them prepare by being authentic.`
}

export function buildIntroMessage(
  profile: LinkedInProfileData,
  meetingPurpose: string,
  meetingContext: string
): string {
  // Build a contextual, specific intro based on their real profile data
  const currentRole = profile.experience?.[0]
  const recentPost  = profile.posts?.[0]

  const roleContext = currentRole
    ? `I'm currently ${currentRole.title} at ${currentRole.company}`
    : profile.headline

  const postHint = recentPost
    ? ` I was actually just thinking about ${recentPost.content.slice(0, 80).toLowerCase().replace(/[.!?]$/, '')} — so my head's been in that space lately.`
    : ''

  const purposeHint: Record<string, string> = {
    sales:          "I've got back-to-back calls today so I appreciate you being prepared.",
    job_interview:  "I'm looking forward to hearing more about your background.",
    partnership:    "I'm always open to exploring the right partnerships.",
    investor_pitch: "Walk me through what you're building — I like to understand the problem first.",
    networking:     "Good to connect. What's on your mind?",
    other:          "What did you want to talk through?",
  }

  const closing = purposeHint[meetingPurpose] || purposeHint.other

  return `Hey — ${profile.name} here. ${roleContext}.${postHint} ${closing}`
}