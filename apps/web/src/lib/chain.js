/**
 * The clue chain's cryptography.
 *
 * Ten steps ship as ten sealed blobs. Step 1 opens with the team's own code;
 * every step after that opens with the codeword from the step before it, which
 * exists only out on campus — printed on a poster, or the answer to the puzzle
 * at that station. So the bundle a team downloads is the whole hunt and also
 * tells them nothing: view-source gets you ciphertext, and reading ahead means
 * physically doing the steps in order.
 *
 * There is no separate answer check. AES-GCM authenticates, so a wrong codeword
 * derives a wrong key and the decrypt throws — being able to open step N+1 is
 * the proof that you solved step N. That is also why `open()` returns null
 * rather than raising: for the caller, "did not decrypt" and "wrong answer" are
 * the same event.
 *
 * Runs unchanged in the browser and in Node, so the build tool that seals the
 * chain and the app that opens it can never disagree about the format.
 *
 * Note that crypto.subtle needs a secure context. https and localhost are fine;
 * serving the game off a bare http LAN address is not.
 */

/**
 * Deliberately slow. The codewords are short human-typable words, so the only
 * thing standing between a dumped bundle and a dictionary attack is how long
 * each guess takes. ~150k iterations is a beat or two of latency once per step
 * on a phone, and a wall for anyone trying millions of guesses.
 */
const ITERATIONS = 150_000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Codewords are typed by people, on phones, in a hurry, possibly read off a
 * poster in bad light. Case, spaces and punctuation must not decide whether the
 * hunt continues, so they are stripped before the key is derived — which means
 * this function is part of the format: change it and every sealed chain that
 * was built with the old one stops opening.
 */
export function normalizeCodeword(word) {
  return (word ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function deriveKey(codeword, salt) {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(normalizeCodeword(codeword)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Per-blob salt and IV: two steps sharing a codeword must not look alike. */
export async function seal(payload, codeword) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(codeword, salt);

  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(payload)),
  );

  return { v: 1, salt: toBase64(salt), iv: toBase64(iv), ct: toBase64(new Uint8Array(sealed)) };
}

/** The step's payload, or null when the codeword was wrong. */
export async function open(blob, codeword) {
  try {
    const key = await deriveKey(codeword, fromBase64(blob.salt));
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(blob.iv) },
      key,
      fromBase64(blob.ct),
    );
    return JSON.parse(decoder.decode(plain));
  } catch {
    return null;
  }
}

// Chunked rather than spread: String.fromCharCode(...bytes) overflows the call
// stack on large inputs, and one day a payload will carry an inline image.
function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
