import { getAdminPasskey } from "@/lib/admin/config";
import { constantTimeEqual, sha256Bytes } from "@/lib/admin/session";

/** Longer than any real pass key; rejects absurd input before it is hashed. */
const MAX_INPUT_LENGTH = 256;

/**
 * Checks a submitted pass key against ADMIN_PASSKEY.
 *
 * Both sides are SHA-256 hashed and the digests compared in constant time, so the comparison
 * neither leaks how many leading characters were right nor depends on the key's length. False
 * for a disabled console, a non-string, or an over-long value; never throws.
 */
export async function verifyPasskey(input: unknown): Promise<boolean> {
  try {
    const expected = getAdminPasskey();
    if (expected === null) return false;
    if (typeof input !== "string" || input.length > MAX_INPUT_LENGTH) return false;

    // Trimmed because the stored key is: a pasted key often carries a trailing newline or space.
    const [expectedDigest, providedDigest] = await Promise.all([sha256Bytes(expected), sha256Bytes(input.trim())]);
    return constantTimeEqual(expectedDigest, providedDigest);
  } catch {
    return false;
  }
}
