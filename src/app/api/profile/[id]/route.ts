import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {

  const { id } = await params;
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ profile })

  } catch (err: any) {
    console.error('Profile fetch error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}