// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';


export function middleware(request: NextRequest) {
  const authToken = request.cookies.get('refresh_token')?.value;
  const path = request.nextUrl.pathname;

  // Protected routes
  if (path.startsWith('/dashboard')) {
    if (!authToken) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Auth routes (login, register)
  if ((path === '/login' || path === '/register') && authToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Clone the request headers and add the auth token if it exists
  const requestHeaders = new Headers(request.headers);
  if (authToken) {
    requestHeaders.set('Authorization', `Bearer ${authToken}`);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}