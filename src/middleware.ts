import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // ── Public paths — always allow ──────────────────────────────────────
  const isPublic =
    pathname === '/' ||
    pathname === '/about' ||
    pathname === '/price' ||
    pathname === '/contact' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/privacy' ||
    pathname === '/terms' ||
    pathname === '/setup' ||
    pathname === '/offline' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/setup')

  if (isPublic) return NextResponse.next()

  // ── No session → redirect to login ───────────────────────────────────
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const role = session.user.role

  // ── /admin/* → SUPER_ADMIN or SHOP_ADMIN only ─────────────────────────
  if (pathname.startsWith('/admin')) {
    if (role !== 'SUPER_ADMIN' && role !== 'SHOP_ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  // ── /analytics → not TECH ─────────────────────────────────────────────
  if (pathname.startsWith('/analytics') && role === 'TECH') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // ── /stock → not TECH ─────────────────────────────────────────────────
  if (pathname.startsWith('/stock') && role === 'TECH') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|icon-|apple-touch|manifest\\.json|sw\\.js|workbox).*)',
  ],
}
