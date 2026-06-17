export const accessCookieName = "storymaker5000_access";
export const accessCookieMaxAge = 60 * 60 * 24 * 30;
export const accessSecretMinLength = 32;

const accessSalt = "storymaker5000-access-v1";
const maxFailedAttempts = 8;
const failedAttemptWindowMs = 15 * 60 * 1000;
const lockoutMs = 15 * 60 * 1000;

type FailedAttempt = {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number;
};

const failedAttempts = new Map<string, FailedAttempt>();

export function isAccessEnabled() {
  return Boolean(process.env.ACCESS_PASSWORD?.trim());
}

export function shouldRequireAccess(request: { headers: Headers }) {
  return isAccessEnabled() && !isLocalAccessRequest(request.headers);
}

export function isLocalAccessRequest(headers: Headers) {
  const forwardedHost = firstHeaderValue(headers.get("x-forwarded-host"));
  const host = firstHeaderValue(forwardedHost || headers.get("host"));

  if (!host) return false;

  return isLocalHostName(hostToName(host));
}

export function getAccessSecretProblem(secret = process.env.ACCESS_PASSWORD) {
  const cleanSecret = secret?.trim() || "";

  if (!cleanSecret) {
    return "Online access secret is not configured.";
  }

  if (cleanSecret.length < accessSecretMinLength) {
    return `Online access secret must be at least ${accessSecretMinLength} characters.`;
  }

  return "";
}

export async function createAccessToken() {
  const password = process.env.ACCESS_PASSWORD?.trim();

  if (!password) return "";

  return sha256(`${accessSalt}:${password}`);
}

export async function isValidAccessToken(token: string | undefined) {
  if (!isAccessEnabled() || !token) return false;

  return timingSafeEqual(token, await createAccessToken());
}

export function getAccessAttemptStatus(identifier: string) {
  const now = Date.now();
  const attempt = failedAttempts.get(identifier);

  if (!attempt) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (attempt.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((attempt.lockedUntil - now) / 1000)
    };
  }

  if (now - attempt.firstAttemptAt > failedAttemptWindowMs) {
    failedAttempts.delete(identifier);
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordFailedAccessAttempt(identifier: string) {
  const now = Date.now();
  const current = failedAttempts.get(identifier);
  const attempt =
    current && now - current.firstAttemptAt <= failedAttemptWindowMs
      ? current
      : { count: 0, firstAttemptAt: now, lockedUntil: 0 };

  attempt.count += 1;

  if (attempt.count >= maxFailedAttempts) {
    attempt.lockedUntil = now + lockoutMs;
  }

  failedAttempts.set(identifier, attempt);

  return {
    locked: attempt.lockedUntil > now,
    retryAfterSeconds: Math.ceil(Math.max(0, attempt.lockedUntil - now) / 1000)
  };
}

export function clearFailedAccessAttempts(identifier: string) {
  failedAttempts.delete(identifier);
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;

  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return difference === 0;
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || "";
}

function hostToName(host: string) {
  const cleanHost = host.trim().toLowerCase();

  if (cleanHost.startsWith("[")) {
    return cleanHost.slice(1, cleanHost.indexOf("]"));
  }

  return cleanHost.split(":")[0] || cleanHost;
}

function isLocalHostName(hostname: string) {
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "0.0.0.0" ||
    hostname === "::1"
  ) {
    return true;
  }

  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }

  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }

  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }

  const private172 = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);

  if (private172) {
    const secondOctet = Number(private172[1]);
    return secondOctet >= 16 && secondOctet <= 31;
  }

  return hostname.startsWith("fc") || hostname.startsWith("fd");
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
