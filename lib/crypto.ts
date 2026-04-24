import { sql } from "@/lib/db";

// Thin wrappers around pgcrypto. We never handle raw cipher bytes in JS
// and we never derive our own keys — the key lives only in env and only
// ever crosses the wire as a parameter to pgp_sym_encrypt / _decrypt.
//
// Callers must never log the plaintext return value from `decryptPat`.

function key(): string {
  const k = process.env.PAT_ENCRYPTION_KEY;
  if (!k) throw new Error("PAT_ENCRYPTION_KEY is not set");
  return k;
}

/** Returns the encrypted `bytea` ready to be stored in `installations.encrypted_pat`. */
export async function encryptPat(pat: string): Promise<Uint8Array> {
  const rows = (await sql`select pgp_sym_encrypt(${pat}, ${key()}) as v`) as Array<{
    v: Uint8Array;
  }>;
  return rows[0].v;
}

/** Decrypts a stored `bytea` back to the raw PAT. Treat the result like radioactive material. */
export async function decryptPat(encrypted: Uint8Array): Promise<string> {
  const rows = (await sql`select pgp_sym_decrypt(${encrypted}, ${key()}) as v`) as Array<{
    v: string;
  }>;
  return rows[0].v;
}
