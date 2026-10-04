import { Router } from 'express';
import { scrypt, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';

const deriveKey = promisify(scrypt);
const scryptOptions = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const cookieName = 'packera_session';
const sessionSeconds = 12 * 60 * 60;
let activeHashes = 0;

function httpError(status, message, code) {
  return Object.assign(new Error(message), { status, code });
}

export function normalizeLogin(value) {
  if (typeof value !== 'string') throw httpError(400, 'Логин должен быть строкой');
  const login = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(login)) {
    throw httpError(400, 'Логин: 3–64 латинских буквы, цифры, точка, дефис или подчёркивание');
  }
  return login;
}

function validPasswordInput(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 128 && Buffer.byteLength(value) <= 512;
}

export function validateNewPassword(value) {
  if (!validPasswordInput(value) || value.length < 12) {
    throw httpError(400, 'Пароль должен содержать от 12 до 128 символов');
  }
}

async function withHashSlot(work) {
  if (activeHashes >= 2) throw httpError(429, 'Слишком много попыток входа. Повторите позже');
  activeHashes++;
  try { return await work(); } finally { activeHashes--; }
}

export async function hashPassword(password) {
  validateNewPassword(password);
  return withHashSlot(async () => {
    const salt = randomBytes(16).toString('hex');
    const key = await deriveKey(password, salt, 64, scryptOptions);
    return `scrypt$131072$8$1$${salt}$${key.toString('hex')}`;
  });
}

async function verifyPassword(password, encoded) {
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts.slice(0, 4).join('$') !== 'scrypt$131072$8$1' ||
      !/^[a-f0-9]{32}$/.test(parts[4]) || !/^[a-f0-9]{128}$/.test(parts[5])) {
    throw httpError(500, 'Ошибка проверки учётной записи');
  }
  return withHashSlot(async () => {
    const key = await deriveKey(password, parts[4], 64, scryptOptions);
    return timingSafeEqual(key, Buffer.from(parts[5], 'hex'));
  });
}

const digest = value => createHash('sha256').update(value).digest('hex');
const csrfFor = token => digest(`csrf:${token}`);
const publicUser = user => ({
  id: user.id, login: user.login, name: user.name, role: user.role,
  mustChangePassword: user.must_change_password,
});

export async function migrateAuth(pool) {
  const sql = await readFile(new URL('./migrations/001-auth.sql', import.meta.url), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(741902001)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const exists = await client.query('SELECT version FROM schema_migrations WHERE version = $1', ['001-auth']);
    if (!exists.rowCount) {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', ['001-auth']);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function createAuth(pool, allowedOrigins) {
  await migrateAuth(pool);
  const dummyHash = await hashPassword(randomBytes(24).toString('hex'));
  const cookieOptions = {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/',
  };
  const failures = new Map();
  const failureWindow = 15 * 60 * 1000;

  function trustedOrigin(req) {
    const origin = req.get('origin');
    if (!origin) return true; // Non-browser requests still need the session and CSRF token.
    if (allowedOrigins.includes(origin)) return true;
    try {
      const url = new URL(origin);
      return ['http:', 'https:'].includes(url.protocol) && url.origin === origin && url.host === req.get('host');
    } catch { return false; }
  }

  function checkOrigin(req, res, next) {
    if (!trustedOrigin(req)) return res.status(403).json({ error: 'Недопустимый источник запроса', code: 'CSRF_INVALID' });
    next();
  }

  function failureKeys(req, login) { return [`ip:${req.ip}`, `login:${login}`]; }
  function pruneFailures() {
    for (const [key, value] of failures) {
      if (value.until <= Date.now()) failures.delete(key);
    }
  }
  function isLimited(keys) {
    pruneFailures();
    return keys.some(key => (failures.get(key)?.count || 0) >= 10);
  }
  function recordFailure(keys) {
    for (const key of keys) {
      if (!failures.has(key) && failures.size >= 10000) failures.delete(failures.keys().next().value);
      const previous = failures.get(key);
      failures.set(key, { count: (previous?.count || 0) + 1, until: previous?.until || Date.now() + failureWindow });
    }
  }

  async function requireSession(req, res, next) {
    const cookie = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`));
    const token = cookie?.slice(cookieName.length + 1);
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      return res.status(401).json({ error: 'Войдите в админку', code: 'AUTH_REQUIRED' });
    }
    const tokenHash = digest(token);
    const result = await pool.query(`
      SELECT u.* FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.is_active = TRUE
    `, [tokenHash]);
    if (!result.rowCount) {
      res.clearCookie(cookieName, cookieOptions);
      return res.status(401).json({ error: 'Сессия истекла. Войдите снова; ваши правки сохранены в форме', code: 'SESSION_EXPIRED' });
    }
    req.auth = { user: result.rows[0], tokenHash, csrfToken: csrfFor(token) };
    next();
  }

  function requireCsrf(req, res, next) {
    const supplied = req.get('x-csrf-token');
    const expected = req.auth.csrfToken;
    if (!trustedOrigin(req) || typeof supplied !== 'string' || !/^[a-f0-9]{64}$/.test(supplied) ||
        !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
      return res.status(403).json({ error: 'Ошибка проверки запроса. Обновите сессию', code: 'CSRF_INVALID' });
    }
    next();
  }

  function requireRole(role) {
    return (req, res, next) => {
      if (req.auth.user.role !== role) return res.status(403).json({ error: 'Недостаточно прав', code: 'FORBIDDEN' });
      next();
    };
  }

  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.post('/login', checkOrigin, async (req, res) => {
    const login = normalizeLogin(req.body?.login);
    const password = req.body?.password;
    if (!validPasswordInput(password)) throw httpError(400, 'Некорректный пароль');
    const keys = failureKeys(req, login);
    if (isLimited(keys)) {
      res.set('Retry-After', '900');
      throw httpError(429, 'Слишком много попыток входа. Повторите через 15 минут');
    }
    const found = await pool.query('SELECT * FROM admin_users WHERE login = $1', [login]);
    const user = found.rows[0];
    const valid = await verifyPassword(password, user?.password_hash || dummyHash);
    if (!valid || !user?.is_active) {
      recordFailure(keys);
      return res.status(401).json({ error: 'Неверный логин или пароль', code: 'INVALID_CREDENTIALS' });
    }
    keys.forEach(key => failures.delete(key));
    const token = randomBytes(32).toString('base64url');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Recheck under a row lock: account changes cannot race session creation.
      const current = await client.query('SELECT * FROM admin_users WHERE id = $1 FOR UPDATE', [user.id]);
      if (!current.rows[0]?.is_active || current.rows[0].password_hash !== user.password_hash || current.rows[0].updated_at.getTime() !== user.updated_at.getTime()) {
        throw httpError(401, 'Учётная запись изменилась. Войдите снова');
      }
      await client.query('DELETE FROM admin_sessions WHERE expires_at <= now()');
      await client.query(`INSERT INTO admin_sessions (token_hash, user_id, expires_at)
        VALUES ($1, $2, now() + interval '12 hours')`, [digest(token), user.id]);
      await client.query('COMMIT');
      res.cookie(cookieName, token, { ...cookieOptions, maxAge: sessionSeconds * 1000 });
      res.json({ user: publicUser(current.rows[0]), csrfToken: csrfFor(token) });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  });
  router.get('/me', requireSession, (req, res) => {
    res.json({ user: publicUser(req.auth.user), csrfToken: req.auth.csrfToken });
  });
  router.post('/logout', requireSession, requireCsrf, async (req, res) => {
    await pool.query('DELETE FROM admin_sessions WHERE token_hash = $1', [req.auth.tokenHash]);
    res.clearCookie(cookieName, cookieOptions);
    res.json({ success: true });
  });
  router.post('/password', requireSession, requireCsrf, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!validPasswordInput(currentPassword)) throw httpError(400, 'Введите текущий пароль');
    validateNewPassword(newPassword);
    if (newPassword === currentPassword) throw httpError(400, 'Новый пароль должен отличаться от текущего');
    if (!await verifyPassword(currentPassword, req.auth.user.password_hash)) {
      return res.status(401).json({ error: 'Неверный текущий пароль', code: 'INVALID_CREDENTIALS' });
    }
    const hash = await hashPassword(newPassword);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(`UPDATE admin_users
        SET password_hash = $1, must_change_password = FALSE,
        updated_at = GREATEST(date_trunc('milliseconds',clock_timestamp()),date_trunc('milliseconds',updated_at)+interval '1 millisecond')
        WHERE id = $2 AND password_hash = $3 AND is_active = TRUE RETURNING id`,
      [hash, req.auth.user.id, req.auth.user.password_hash]);
      if (!result.rowCount) throw httpError(409, 'Учётная запись изменилась. Войдите снова');
      await client.query('DELETE FROM admin_sessions WHERE user_id = $1', [req.auth.user.id]);
      await client.query("INSERT INTO audit_log(actor_id,entity,entity_id,action,changes,version) VALUES($1::uuid,'users',$1::text,'update',$2,nextval('content_version_seq'))",
        [req.auth.user.id, JSON.stringify({passwordChanged:{before:false,after:true},mustChangePassword:{before:req.auth.user.must_change_password,after:false}})]);
      await client.query('COMMIT');
      res.clearCookie(cookieName, cookieOptions);
      res.json({ success: true });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  });

  async function protectApi(req, res, next) {
    if (req.method === 'GET' && req.path === '/data') return next();
    await requireSession(req, res, () => {
      if (req.auth.user.must_change_password) {
        return res.status(403).json({ error: 'Сначала смените временный пароль', code: 'PASSWORD_CHANGE_REQUIRED' });
      }
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
      requireCsrf(req, res, next);
    });
  }

  return { router, protectApi, requireRole, requireSession, requireCsrf, clearSessionCookie: res => res.clearCookie(cookieName, cookieOptions) };
}
