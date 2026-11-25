import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {PRIMARY_ADMIN_EMAIL, type AuthUserProfile} from '../src/types/prime.ts';

interface StoredUserRecord {
  id: string;
  name: string;
  email: string;
  salt: string;
  passwordHash: string;
  createdAtMs: number;
}

const USERS_PATH = path.resolve(process.cwd(), '.prime-users.json');
const SECRET_PATH = path.resolve(process.cwd(), '.prime-auth-secret');

function getSigningSecret(): string {
  const fromEnv = process.env.PRIME_AUTH_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (fs.existsSync(SECRET_PATH)) {
    const existing = fs.readFileSync(SECRET_PATH, 'utf8').trim();
    if (existing.length >= 32) return existing;
  }
  const generated = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_PATH, generated, 'utf8');
  return generated;
}

function readUsers(): StoredUserRecord[] {
  if (!fs.existsSync(USERS_PATH)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUserRecord[]): void {
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function createSessionToken(user: StoredUserRecord): string {
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      email: user.email,
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    }),
    'utf8',
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', getSigningSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function computeIsAdmin(email: string, adminEmails: string[] = []): boolean {
  const normalized = email.trim().toLowerCase();
  const allowed = new Set([
    PRIMARY_ADMIN_EMAIL.toLowerCase(),
    ...adminEmails.map((e) => e.trim().toLowerCase()),
  ]);
  return allowed.has(normalized);
}

export function registerLocalUser(
  rawName: string,
  rawEmail: string,
  rawPassword: string,
  adminEmails: string[] = [],
): {user: AuthUserProfile; token: string} {
  const name = rawName.trim();
  const email = rawEmail.trim().toLowerCase();
  const password = rawPassword;

  if (!name || name.length < 2) {
    throw new Error('Please enter your display name (at least 2 characters).');
  }
  if (!email.includes('@') || !email.includes('.')) {
    throw new Error('Please enter a valid email address.');
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const users = readUsers();
  if (users.some((u) => u.email === email)) {
    throw new Error('An account with this email already exists. Please sign in instead.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const record: StoredUserRecord = {
    id: `usr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    name,
    email,
    salt,
    passwordHash: hashPassword(password, salt),
    createdAtMs: Date.now(),
  };

  users.push(record);
  writeUsers(users);

  return {
    user: {
      id: record.id,
      name: record.name,
      email: record.email,
      isAdmin: computeIsAdmin(record.email, adminEmails),
      provider: 'local',
    },
    token: createSessionToken(record),
  };
}

export function loginLocalUser(
  rawEmail: string,
  rawPassword: string,
  adminEmails: string[] = [],
): {user: AuthUserProfile; token: string} {
  const email = rawEmail.trim().toLowerCase();
  const users = readUsers();
  const record = users.find((u) => u.email === email);
  if (!record) {
    throw new Error('Invalid email or password.');
  }

  const candidateHex = hashPassword(rawPassword, record.salt);
  const expectedBuf = Buffer.from(record.passwordHash, 'hex');
  const actualBuf = Buffer.from(candidateHex, 'hex');
  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    throw new Error('Invalid email or password.');
  }

  return {
    user: {
      id: record.id,
      name: record.name,
      email: record.email,
      isAdmin: computeIsAdmin(record.email, adminEmails),
      provider: 'local',
    },
    token: createSessionToken(record),
  };
}

export function verifyLocalSessionToken(
  authHeader: string | undefined,
  adminEmails: string[] = [],
): AuthUserProfile | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;

  const payloadB64 = token.slice(0, dotIdx);
  const providedSig = token.slice(dotIdx + 1);
  const expectedSig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(payloadB64)
    .digest('base64url');

  const sigBufA = Buffer.from(providedSig);
  const sigBufB = Buffer.from(expectedSig);
  if (sigBufA.length !== sigBufB.length || !crypto.timingSafeEqual(sigBufA, sigBufB)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      id?: string;
      email?: string;
      exp?: number;
    };
    if (!payload.id || !payload.email || !payload.exp || Date.now() > payload.exp) {
      return null;
    }
    const users = readUsers();
    const record = users.find((u) => u.id === payload.id && u.email === payload.email);
    if (!record) return null;
    return {
      id: record.id,
      name: record.name,
      email: record.email,
      isAdmin: computeIsAdmin(record.email, adminEmails),
      provider: 'local',
    };
  } catch {
    return null;
  }
}
