import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value)
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = req.nextUrl

  // ── Public routes — accessible without auth ──────────────────
  const publicRoutes = ['/login']

  if (publicRoutes.includes(pathname)) {
    // Already logged in → go to dashboard
    if (user) return NextResponse.redirect(new URL('/dashboard', req.url))
    return res
  }

  // ── Root redirect ─────────────────────────────────────────────
  // '/' has no page — redirect to the right place
  if (pathname === '/') {
    if (user) return NextResponse.redirect(new URL('/dashboard', req.url))
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // ── Protected routes — must be logged in ─────────────────────
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}