import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import PgAdapter from "@auth/pg-adapter";
import { Pool } from "pg";

// Reuse one pool across hot-reloaded modules in dev and warm Lambda invocations
// in prod. Without this, every module reload opens a new pool and Neon's
// connection cap gets angry.
const globalForPool = globalThis as unknown as { __authPgPool?: Pool };
const pool =
  globalForPool.__authPgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
if (process.env.NODE_ENV !== "production") globalForPool.__authPgPool = pool;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PgAdapter(pool),
  session: { strategy: "database" },
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.AUTH_EMAIL_FROM,
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login?sent=1",
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}
