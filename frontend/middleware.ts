// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check for HTTP-only cookie set by the server (matches backend cookie name)
  const authToken = request.cookies.get('auth_token')?.value || 
                   request.cookies.get('accessToken')?.value ||
                   request.cookies.get('.AspNetCore.Cookies')?.value;
  
  const path = request.nextUrl.pathname;

  // Protected routes - require authentication
  if (path.startsWith('/dashboard') || path.startsWith('/role-selection')) {
    if (!authToken) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Don't redirect authenticated users from auth pages
  // Let the login page handle role-based redirects based on user data
  // This prevents the redirect loop issue

  // Clone the request headers
  const requestHeaders = new Headers(request.headers);
  
  // For API routes, ensure CSRF token is present for non-GET requests
  if (path.startsWith('/api') && request.method !== 'GET') {
    const csrfHeader = request.headers.get('X-CSRF-Token');
    const csrfCookie = request.cookies.get('csrf-token')?.value;
    
    // Both CSRF token and cookie must be present
    // The actual validation should be done by the backend
    if (!csrfHeader || !csrfCookie) {
      return NextResponse.json(
        { error: 'CSRF token required' },
        { status: 403 }
      );
    }
  }

  // Return modified request
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ]
}