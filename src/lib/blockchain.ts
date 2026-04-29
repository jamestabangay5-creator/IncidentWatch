// SHA-256 hashing chain for tamper-evident report logs.
// Each block hashes (previous_hash + data_hash) so any later edit to history breaks the chain.

export async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildBlock(payload: Record<string, unknown>, previousHash: string) {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  const dataHash = await sha256(canonical);
  const hashValue = await sha256(previousHash + dataHash);
  return { dataHash, hashValue, canonical };
}

export const GENESIS_HASH = "0".repeat(64);