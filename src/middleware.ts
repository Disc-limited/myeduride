import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  // Skip middleware for API routes — they handle their own auth
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Redirect Capacitor mobile app users from the root landing page to the login page
  if (request.nextUrl.pathname === '/') {
    const userAgent = request.headers.get('user-agent') || '';
    const isCapacitor =
      userAgent.includes('MyEduRideApp') ||
      userAgent.includes('Capacitor') ||
      request.headers.get('x-capacitor-platform') !== null;

    if (isCapacitor) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|models|sw.js).*)',
  ],
};
