import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Next 16 Proxy always runs on Node, so importing `pg` from lib/auth is safe.

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isProtected =
    nextUrl.pathname.startsWith("/connect") || nextUrl.pathname.startsWith("/dashboard");
  if (isProtected && !session) {
    const url = new URL("/login", nextUrl);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  // Skip static assets, the favicon, and auth endpoints themselves.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
