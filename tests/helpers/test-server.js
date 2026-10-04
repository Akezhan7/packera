import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { randomBytes, randomUUID, scrypt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { readFile } from 'node:fs/promises';

const execFileAsync = promisify(execFile);
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

async function freePort() {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
  return port;
}

// Creates its own disposable DB; never accepts a DATABASE_URL from the caller.
export async function startTestServer({ production = false, alternate = false, restoreDump = false, trustProxy = false } = {}) {
  const container = `packera-integrity-test-${randomUUID()}`;
  const password = randomBytes(24).toString('hex');
  let containerCreated = false;
  let pool;
  let backend;
  let backendExit;
  let output = '';
  const backgroundErrors = [];

  async function close() {
    const errors = [];
    if (backend && backend.exitCode === null && backend.signalCode === null) {
      backend.kill();
      try { await backendExit; } catch (error) { errors.push(error); }
    }
    if (pool) {
      try { await pool.end(); } catch (error) { errors.push(error); }
    }
    if (containerCreated) {
      try {
        // Only this randomly named, newly created container; no host mounts.
        await execFileAsync('docker', ['rm', '--force', '--volumes', container], { timeout: 15000 });
        containerCreated = false;
      } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, 'Test environment cleanup failed');
  }

  try {
    await execFileAsync('docker', [
      'run', '--detach', '--name', container,
      '--label', 'packera.purpose=integrity-test',
      '--publish', '127.0.0.1::5432',
      '--env', 'POSTGRES_DB=packera_integrity_test',
      '--env', 'POSTGRES_USER=postgres',
      '--env', `POSTGRES_PASSWORD=${password}`,
      'postgres:15-alpine',
    ], { timeout: 30000 });
    containerCreated = true;
    const { stdout } = await execFileAsync('docker', ['port', container, '5432/tcp']);
    const match = stdout.trim().match(/^127\.0\.0\.1:(\d+)$/);
    if (!match) throw new Error(`Unexpected test DB port: ${stdout.trim()}`);
    const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${match[1]}/packera_integrity_test`;
    pool = new pg.Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 1000 });
    pool.on('error', error => backgroundErrors.push(error));
    const dbDeadline = Date.now() + 30000;
    let ready = false;
    let lastError;
    while (Date.now() < dbDeadline) {
      try {
        await pool.query('SELECT 1');
        ready = true;
        break;
      } catch (error) {
        lastError = error;
        await delay(100);
      }
    }
    if (!ready) throw new Error('Test PostgreSQL did not become ready', { cause: lastError });

    let restoredRows;
    if (restoreDump) {
      const restore = spawn('docker', ['exec','-i',container,'psql','-U','postgres','-d','packera_integrity_test','--set','ON_ERROR_STOP=1'], { windowsHide:true, stdio:['pipe','pipe','pipe'] });
      let restoreErrors = '';
      restore.stdout.resume();
      restore.stderr.on('data', data => { restoreErrors += data.toString(); });
      const restoreExit = once(restore,'exit');
      restore.stdin.end(await readFile(new URL('../../packera-database-handover-20261001.sql',import.meta.url)));
      const [code] = await restoreExit;
      if (code !== 0) throw new Error(`Test dump restore failed: ${restoreErrors}`);
      restoredRows = {};
      for (const table of ['products','categories','tasks','banners','site_settings']) {
        restoredRows[table] = (await pool.query(`SELECT * FROM ${table} ORDER BY ${table === 'categories' ? 'name' : table === 'site_settings' ? 'key' : 'id'}`)).rows;
      }
    }
    const port = await freePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const backendArgs = alternate ? ['--input-type=module', '-e', "const { default: app } = await import('./api/index.js'); app.listen(process.env.PORT);"] : ['server.js'];
    backend = spawn(process.execPath, backendArgs, {
      cwd: projectRoot,
      windowsHide: true,
      env: { ...process.env, NODE_ENV: production ? 'production' : 'test', PORT: String(port), DATABASE_URL: databaseUrl, TRUST_PROXY:trustProxy?'1':'' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    backendExit = once(backend, 'exit');
    // Attach a rejection handler now, even if startup fails before close().
    backendExit.catch(error => backgroundErrors.push(error));
    backend.stdout.on('data', data => { output += data.toString(); });
    backend.stderr.on('data', data => { output += data.toString(); });

    async function request(path, { method = 'GET', body, headers = {} } = {}) {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
      const text = await response.text();
      return { status: response.status, body: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : text, cookie: response.headers.get('set-cookie') };
    }

    const appDeadline = Date.now() + 20000;
    ready = false;
    while (Date.now() < appDeadline) {
      if (backgroundErrors.length || backend.exitCode !== null || backend.signalCode !== null) {
        throw new Error(`Test backend exited during startup: ${output}`, { cause: backgroundErrors[0] });
      }
      if (alternate || output.includes('Database initialized successfully!')) {
        try {
          const response = await request('/api/data');
          if (response.status === 200) {
            ready = true;
            break;
          }
        } catch (error) { lastError = error; }
      }
      await delay(100);
    }
    if (!ready) throw new Error(`Test backend did not become ready: ${output}`, { cause: lastError });

    return {
      request,
      close,
      baseUrl,
      pool,
      restoredRows,
      query: (sql, values) => pool.query(sql, values),
      async restart() {
        backend.kill(); await backendExit;
        output = '';
        backend = spawn(process.execPath, backendArgs, {
          cwd:projectRoot, windowsHide:true,
          env:{...process.env,NODE_ENV:production ? 'production' : 'test',PORT:String(port),DATABASE_URL:databaseUrl,TRUST_PROXY:trustProxy?'1':''},
          stdio:['ignore','pipe','pipe'],
        });
        backendExit = once(backend,'exit');
        backendExit.catch(error => backgroundErrors.push(error));
        backend.stdout.on('data',data => {output += data.toString();});
        backend.stderr.on('data',data => {output += data.toString();});
        const deadline = Date.now() + 20000;
        while(Date.now() < deadline) {
          if(backend.exitCode !== null) throw new Error(`Restart failed: ${output}`);
          if(output.includes('Database initialized successfully!')) {
            try { if((await request('/api/data')).status === 200) return; } catch {}
          }
          await delay(100);
        }
        throw new Error(`Restart timeout: ${output}`);
      },
      async createUser(login, role = 'admin', mustChange = false) {
        const password = 'Test-only-password-42!';
        const salt = randomBytes(16).toString('hex');
        const key = await promisify(scrypt)(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
        const hash = `scrypt$131072$8$1$${salt}$${key.toString('hex')}`;
        const result = await pool.query(`INSERT INTO admin_users (login, name, role, password_hash, must_change_password)
          VALUES ($1, $1, $2, $3, $4) RETURNING id`, [login, role, hash, mustChange]);
        return { id: result.rows[0].id, login, password };
      },
      async readProduct(id) {
        const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
        return result.rows[0];
      },
      async clear() {
        // Pool is constructed exclusively from the container URL above.
        await pool.query('TRUNCATE products, categories, tasks, banners, site_settings');
      },
    };
  } catch (error) {
    try { await close(); } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Test setup and cleanup failed');
    }
    throw error;
  }
}
