// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check for HTTP-only cookie set by the server
  const accessToken = request.cookies.get('accessToken')?.value;
  const path = request.nextUrl.pathname;

  // Protected routes
  if (path.startsWith('/dashboard')) {
    if (!accessToken) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Auth routes (login, register)
  if ((path === '/login' || path === '/register') && accessToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Clone the request headers and add the auth token if it exists
  // This is needed for the client-side fetch API calls to backend services
  const requestHeaders = new Headers(request.headers);
  
  // Add CSRF protection header for non-GET requests
  if (request.method !== 'GET') {
    const csrfHeader = request.headers.get('X-CSRF-Token');
    const csrfCookie = request.cookies.get('csrf-token')?.value;
    
    // If CSRF token is missing or doesn't match, block the request
    // Note: In a real implementation, you would have a matching mechanism
    // to create and validate these tokens
    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      if (path.startsWith('/api')) {
        return NextResponse.json(
          { error: 'CSRF token validation failed' },
          { status: 403 }
        );
      }
    }
  }

  // Return modified request
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}