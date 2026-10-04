import pg from 'pg';
import { createInterface } from 'node:readline/promises';
import { emitKeypressEvents } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { migrateAuth, normalizeLogin, hashPassword } from '../server/auth.js';

export async function createInitialAdmin(pool, { login, name, password }) {
  const normalized = normalizeLogin(login);
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) throw new Error('Имя: от 1 до 100 символов');
  const hash = await hashPassword(password);
  await migrateAuth(pool);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(741902002)');
    const existing = await client.query("SELECT id FROM admin_users WHERE role = 'admin' AND is_active = TRUE LIMIT 1");
    if (existing.rowCount) throw new Error('Действующий главный администратор уже существует. Управляйте аккаунтами через админку');
    const result = await client.query(`INSERT INTO admin_users (login, name, role, password_hash)
      VALUES ($1, $2, 'admin', $3) RETURNING id, login, name, role`, [normalized, name.trim(), hash]);
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') throw new Error('Этот логин уже занят');
    throw error;
  } finally { client.release(); }
}

function readSecret(prompt) {
  process.stdout.write(prompt);
  emitKeypressEvents(process.stdin);
  const wasRaw = process.stdin.isRaw;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolveSecret, reject) => {
    let secret = '';
    const cleanup = () => {
      process.stdin.off('keypress', onKey);
      process.stdin.setRawMode(Boolean(wasRaw));
      process.stdin.pause();
      process.stdout.write('\n');
    };
    function onKey(text, key) {
      if (key?.ctrl && ['c', 'd'].includes(key.name)) {
        cleanup(); reject(new Error('Создание отменено')); return;
      }
      if (key?.name === 'return' || key?.name === 'enter') {
        cleanup(); resolveSecret(secret); return;
      }
      if (key?.name === 'backspace') {
        secret = [...secret].slice(0, -1).join('');
      } else if (text && !key?.ctrl && !key?.meta && !/[\x00-\x1f\x7f]/.test(text)) {
        if ((secret + text).length <= 128) secret += text;
      }
      // Do not echo password characters or put secrets in shell history.
    }
    process.stdin.on('keypress', onKey);
  });
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log('DATABASE_URL должен явно указывать нужную БД. Запуск: node scripts/create-admin.js\nЛогин, имя и пароль вводятся интерактивно; пароль не отображается. Повторное создание действующего главного администратора запрещено.');
    return;
  }
  if (process.argv.length !== 2) throw new Error('Аргументы не поддерживаются. Пароль вводится только интерактивно');
  if (!process.env.DATABASE_URL) throw new Error('Задайте DATABASE_URL нужной локальной БД явно');
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Запустите в интерактивном терминале');
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  let login, name;
  try {
    login = await readline.question('Логин главного администратора: ');
    name = await readline.question('Имя: ');
  } finally { readline.close(); }
  const password = await readSecret('Пароль (12–128 символов, ввод скрыт): ');
  const confirmation = await readSecret('Повторите пароль: ');
  if (password !== confirmation) throw new Error('Пароли не совпадают');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const user = await createInitialAdmin(pool, { login, name, password });
    console.log(`Главный администратор создан: ${user.login} (${user.name})`);
  } finally { await pool.end(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
