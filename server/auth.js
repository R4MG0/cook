const {
  createHash,
  randomBytes,
  scrypt: scryptCallback,
  timingSafeEqual,
} = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(scryptCallback);
const cookieName = 'cook_session';
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;
const passwordKeyLength = 64;
const passwordOptions = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, passwordKeyLength, passwordOptions);
  return `${salt.toString('base64url')}.${key.toString('base64url')}`;
}

async function verifyPassword(password, passwordHash) {
  const [saltValue, keyValue, ...extra] = passwordHash.split('.');
  if (!saltValue || !keyValue || extra.length > 0) {
    throw new Error('Stored password hash is invalid.');
  }

  const salt = Buffer.from(saltValue, 'base64url');
  const expectedKey = Buffer.from(keyValue, 'base64url');
  if (salt.length !== 16 || expectedKey.length !== passwordKeyLength) {
    throw new Error('Stored password hash is invalid.');
  }

  const actualKey = await scrypt(password, salt, passwordKeyLength, passwordOptions);
  return timingSafeEqual(actualKey, expectedKey);
}

function getSessionToken(request) {
  const cookies = request.headers.cookie?.split(';') ?? [];
  for (const cookie of cookies) {
    const separator = cookie.indexOf('=');
    if (separator < 0 || cookie.slice(0, separator).trim() !== cookieName) {
      continue;
    }
    return cookie.slice(separator + 1).trim();
  }
  return null;
}

function getSessionUser(request, database) {
  const token = getSessionToken(request);
  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);
  const session = database
    .prepare(`
      SELECT users.id, users.display_name AS name, users.email, sessions.expires_at
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ?
    `)
    .get(tokenHash);
  if (!session) {
    return null;
  }
  if (session.expires_at <= Date.now()) {
    database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return null;
  }

  return { id: session.id, name: session.name, email: session.email };
}

function createSession(database, userId) {
  const token = randomBytes(32).toString('base64url');
  database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
  database
    .prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(hashToken(token), userId, Date.now() + sessionDurationMs);
  return token;
}

function destroySession(request, database) {
  const token = getSessionToken(request);
  if (token) {
    database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  }
}

function setSessionCookie(response, token, secureCookies) {
  const secure = secureCookies ? '; Secure' : '';
  response.setHeader(
    'Set-Cookie',
    `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionDurationMs / 1000}${secure}`,
  );
}

function clearSessionCookie(response, secureCookies) {
  const secure = secureCookies ? '; Secure' : '';
  response.setHeader(
    'Set-Cookie',
    `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
  );
}

module.exports = {
  clearSessionCookie,
  createSession,
  destroySession,
  getSessionUser,
  hashPassword,
  setSessionCookie,
  verifyPassword,
};
