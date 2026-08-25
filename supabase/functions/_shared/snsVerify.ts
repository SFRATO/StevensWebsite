/**
 * Amazon SNS message signature verification (Deno / WebCrypto).
 *
 * Why this exists: the SES webhook is necessarily unauthenticated — SNS cannot
 * present a JWT — so the *only* thing separating a real AWS delivery event from
 * a forged one is this signature. Without it, anyone who learns a
 * `ses_message_id` can POST a fake `Bounce` and the handler will mark that lead
 * bounced and cancel their entire drip.
 *
 * Verifies SignatureVersion 1 (SHA1withRSA) and 2 (SHA256withRSA) against the
 * signing certificate SNS publishes, per:
 * https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html
 */

/** Fields included in the canonical string, in this exact order, per message type. */
const SIGNABLE_KEYS: Record<string, string[]> = {
  Notification: [
    "Message",
    "MessageId",
    "Subject", // included only when present
    "Timestamp",
    "TopicArn",
    "Type",
  ],
  SubscriptionConfirmation: [
    "Message",
    "MessageId",
    "SubscribeURL",
    "Timestamp",
    "Token",
    "TopicArn",
    "Type",
  ],
  UnsubscribeConfirmation: [
    "Message",
    "MessageId",
    "SubscribeURL",
    "Timestamp",
    "Token",
    "TopicArn",
    "Type",
  ],
};

/**
 * Only fetch signing certs from AWS-controlled hosts. Without this check the
 * `SigningCertURL` in an attacker-supplied body would make us fetch — and then
 * trust — a certificate of their choosing.
 */
export function isAwsSigningUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return /^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(host) ||
    /^sns\.[a-z0-9-]+\.amazonaws\.com\.cn$/.test(host);
}

/** Build the canonical `key\nvalue\n` string SNS signed. */
function canonicalString(msg: Record<string, unknown>): string {
  const keys = SIGNABLE_KEYS[String(msg.Type)];
  if (!keys) throw new Error(`Unsignable SNS message type: ${msg.Type}`);
  let out = "";
  for (const key of keys) {
    const value = msg[key];
    // Subject is optional; omit the pair entirely when absent.
    if (value === undefined || value === null) continue;
    out += `${key}\n${value}\n`;
  }
  return out;
}

function pemToDer(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN CERTIFICATE-----/, "")
    .replace(/-----END CERTIFICATE-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const der = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i);
  return der;
}

/**
 * Extract the SubjectPublicKeyInfo from an X.509 certificate.
 *
 * WebCrypto's importKey has no "x509 certificate" format — it wants the bare
 * SPKI. Rather than pull in a full ASN.1 library for one field, walk the DER to
 * the AlgorithmIdentifier whose OID is rsaEncryption (1.2.840.113549.1.1.1) and
 * take the SEQUENCE that encloses it.
 */
function extractSpki(der: Uint8Array): Uint8Array {
  // DER for: SEQUENCE { OID 1.2.840.113549.1.1.1, NULL }
  const marker = [
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d,
    0x01, 0x01, 0x01, 0x05, 0x00,
  ];
  for (let i = 0; i + marker.length <= der.length; i++) {
    let hit = true;
    for (let j = 0; j < marker.length; j++) {
      if (der[i + j] !== marker[j]) { hit = false; break; }
    }
    if (!hit) continue;

    // The enclosing SPKI SEQUENCE starts just before this AlgorithmIdentifier.
    // Parse its length header to slice exactly.
    const start = i - 4 >= 0 && der[i - 4] === 0x30 ? i - 4
      : i - 3 >= 0 && der[i - 3] === 0x30 ? i - 3
      : i - 2 >= 0 && der[i - 2] === 0x30 ? i - 2
      : -1;
    if (start < 0) continue;

    const lenByte = der[start + 1];
    let headerLen: number;
    let bodyLen: number;
    if (lenByte < 0x80) {
      headerLen = 2;
      bodyLen = lenByte;
    } else {
      const n = lenByte & 0x7f;
      headerLen = 2 + n;
      bodyLen = 0;
      for (let k = 0; k < n; k++) bodyLen = (bodyLen << 8) | der[start + 2 + k];
    }
    return der.slice(start, start + headerLen + bodyLen);
  }
  throw new Error("Could not locate RSA SubjectPublicKeyInfo in certificate");
}

// Certs rotate rarely; cache by URL for the life of the isolate.
const certCache = new Map<string, CryptoKey>();

async function loadPublicKey(certUrl: string, algo: string): Promise<CryptoKey> {
  const cacheKey = `${certUrl}|${algo}`;
  const cached = certCache.get(cacheKey);
  if (cached) return cached;

  const res = await fetch(certUrl);
  if (!res.ok) throw new Error(`Signing cert fetch failed: ${res.status}`);
  const spki = extractSpki(pemToDer(await res.text()));

  const key = await crypto.subtle.importKey(
    "spki",
    spki,
    { name: "RSASSA-PKCS1-v1_5", hash: algo },
    false,
    ["verify"],
  );
  certCache.set(cacheKey, key);
  return key;
}

/**
 * Returns true only if the message carries a valid AWS signature.
 * Any malformed input, non-AWS cert host, or crypto failure returns false —
 * this must never throw its way into a "success" path.
 */
export async function verifySnsSignature(
  msg: Record<string, unknown>,
): Promise<boolean> {
  try {
    const certUrl = String(msg.SigningCertURL ?? msg.SigningCertUrl ?? "");
    if (!isAwsSigningUrl(certUrl)) {
      console.error("SNS: refusing non-AWS SigningCertURL:", certUrl);
      return false;
    }

    const version = String(msg.SignatureVersion ?? "1");
    const algo = version === "2" ? "SHA-256" : "SHA-1";

    const signature = String(msg.Signature ?? "");
    if (!signature) return false;

    const sigBin = atob(signature);
    const sigBytes = new Uint8Array(sigBin.length);
    for (let i = 0; i < sigBin.length; i++) sigBytes[i] = sigBin.charCodeAt(i);

    const key = await loadPublicKey(certUrl, algo);
    return await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      sigBytes,
      new TextEncoder().encode(canonicalString(msg)),
    );
  } catch (err) {
    console.error("SNS signature verification error:", err);
    return false;
  }
}
