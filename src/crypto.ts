/**
 * Password fields are encrypted in the browser before they ever reach localStorage.
 * Nothing leaves this machine: no server, no network call. The passphrase is held in
 * memory for the session only, so a stolen localStorage dump is ciphertext.
 */
const enc = new TextEncoder()
const dec = new TextDecoder()

const ITERATIONS = 310_000

async function deriveKey(passphrase: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

const toB64 = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) : b)))

const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

/** Returns `salt.iv.ciphertext`, all base64. */
export async function encryptSecret(plaintext: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, enc.encode(plaintext))
  return [toB64(salt), toB64(iv), toB64(ct)].join('.')
}

/** null when the passphrase is wrong or the blob is corrupt — both look identical, by design. */
export async function decryptSecret(blob: string, passphrase: string): Promise<string | null> {
  const [s, i, c] = blob.split('.')
  if (!s || !i || !c) return null
  try {
    const key = await deriveKey(passphrase, fromB64(s))
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(i) as BufferSource }, key, fromB64(c))
    return dec.decode(pt)
  } catch {
    return null
  }
}
