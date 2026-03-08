import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { LinkedInProfileData } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { linkedinUrl, profileData }: {
      linkedinUrl: string
      profileData: LinkedInProfileData
    } = body

    if (!linkedinUrl || !profileData) {
      return NextResponse.json(
        { error: 'linkedinUrl and profileData are required' },
        { status: 400 }
      )
    }

    // Check if profile already exists and is fresh (< 7 days old)
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id, data_richness_score')
      .eq('linkedin_url', linkedinUrl)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (existing) {
      // Update with fresh data
      await supabaseAdmin
        .from('profiles')
        .update({
          raw_data:       profileData,
          full_name:      profileData.name,
          headline:       profileData.headline,
          location:       profileData.location,
          profile_picture: profileData.profile_picture || null,
          scraped_at:     new Date().toISOString(),
          expires_at:     new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', existing.id)

      // Generate session ID for this prep attempt
      const sessionToken = uuidv4()

      return NextResponse.json({
        success:      true,
        profileId:    existing.id,
        sessionToken,
        cached:       true,
        richnessScore: existing.data_richness_score,
      })
    }

    // Insert new profile
    const { data: newProfile, error } = await supabaseAdmin
      .from('profiles')
      .insert({
        linkedin_url:    linkedinUrl,
        full_name:       profileData.name,
        headline:        profileData.headline,
        location:        profileData.location,
        profile_picture: profileData.profile_picture || null,
        raw_data:        profileData,
        scrape_source:   'extension',
        expires_at:      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id, data_richness_score')
      .single()

    if (error) throw error

    const sessionToken = uuidv4()

    return NextResponse.json({
      success:       true,
      profileId:     newProfile.id,
      sessionToken,
      cached:        false,
      richnessScore: newProfile.data_richness_score,
    })

  } catch (err: any) {
    console.error('Profile store error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to store profile' },
      { status: 500 }
    )
  }
}