import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  // Webhooks should bypass authentication
  if (req.nextUrl.pathname.startsWith('/api/webhooks')) {
    return NextResponse.next();
  }

  if (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/change-password') return NextResponse.next();
  if (req.cookies.get('metrics_session')?.value) return NextResponse.next();
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
