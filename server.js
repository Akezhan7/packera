import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join, sep, resolve } from 'path';
import fs from 'fs';
import { createAuth } from './server/auth.js';
import { createUsersRouter } from './server/users.js';
import { createImageThumbnailsRouter } from './server/imageThumbnails.js';
import { seoHeaders, createPublicPagesRouter } from './server/seo.js';
import { readCatalog } from './server/catalog.js';
import { migrateIntegrity, createContentRouter } from './server/content.js';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
// Enable only when the origin is private and every external request crosses one trusted proxy.
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
app.use(seoHeaders);

// CORS: allow specific origins in production, all in development
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3002'];
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
}));
app.use(express.json({ limit: '50mb' }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/packera'
});

// Initialize and Seed Tables with Retry Logic
async function initDb(retries = 10, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS categories (
        name TEXT PRIMARY KEY,
        icon TEXT,
        "sortOrder" INTEGER DEFAULT 0
      )`);

      // Ensure icon column exists for older installations
      try {
        await pool.query(`ALTER TABLE categories ADD COLUMN icon TEXT`);
      } catch(e) {
        // Column might already exist, ignore error
      }
      // Ensure sortOrder column exists for older installations
      try {
        await pool.query(`ALTER TABLE categories ADD COLUMN "sortOrder" INTEGER DEFAULT 0`);
      } catch(e) {
        // Column might already exist, ignore error
      }

      await pool.query(`CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        title TEXT,
        "desc" TEXT,
        price DOUBLE PRECISION,
        unit TEXT,
        category TEXT,
        visual TEXT,
        color TEXT,
        image TEXT,
        images TEXT,
        tasks TEXT,
        sizes TEXT,
        specs TEXT,
        "kaspiLink" TEXT DEFAULT '',
        "halykLink" TEXT DEFAULT '',
        "forteLink" TEXT DEFAULT ''
      )`);
      await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER DEFAULT 0`);
      await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS "categorySortOrder" INTEGER`);
      await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS "isVisible" BOOLEAN DEFAULT TRUE`);

      const tasksExisted = (await pool.query("SELECT to_regclass('public.tasks') AS name")).rows[0].name !== null;
      await pool.query(`CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT,
        "desc" TEXT,
        "titleKk" TEXT DEFAULT '',
        "descKk" TEXT DEFAULT '',
        icon TEXT,
        image TEXT,
        "sortOrder" INTEGER DEFAULT 0
      )`);

      try {
        await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER DEFAULT 0`);
      } catch (err) {
        // Ignore if column exists
      }

      const { rows } = await pool.query("SELECT COUNT(*) as count FROM tasks");
      if (!tasksExisted && parseInt(rows[0].count, 10) === 0) {
        const defaultTasks = [
          { id: "move", title: "Переезд", desc: "Всё для безопасной упаковки вещей", titleKk: "Көшу", descKk: "Заттарды қауіпсіз қаптауға арналған барлық нәрсе", icon: "truck", image: "/task_icon_0.png" },
          { id: "repair", title: "Подготовка к ремонту", desc: "Защитные материалы и расходники", titleKk: "Жөндеуге дайындық", descKk: "Қорғаныс материалдары мен шығын материалдары", icon: "paint-roller", image: "/task_icon_1.png" },
          { id: "marketplaces", title: "Упаковка товаров для маркетплейсов", desc: "Пакеты, плёнка, скотч и зипы", titleKk: "Маркетплейстерге арналған тауарларды қаптау", descKk: "Пакеттер, үлдір, скотч және зиптер", icon: "scan-barcode", image: "/task_icon_2.png" },
          { id: "storage", title: "Сохранность вещей/мебели", desc: "Для хранения вещей и сезонных товаров", titleKk: "Заттардың/жиһаздың сақталуы", descKk: "Заттарды және маусымдық тауарларды сақтауға арналған", icon: "sofa", image: "/task_icon_3.png" },
          { id: "cleaning", title: "Уборка после ремонта", desc: "Мешки, перчатки и химия", titleKk: "Жөндеуден кейінгі тазалау", descKk: "Қаптар, қолғаптар және химия", icon: "brush-cleaning", image: "/task_icon_4.png" },
          { id: "warehouse", title: "Для склада", desc: "Паллетная стрейч-плёнка, скотч и аксессуары", titleKk: "Қойма үшін", descKk: "Паллеттік стрейч-үлдір, скотч және аксессуарлар", icon: "shelving-unit", image: "/task_icon_5.png" }
        ];
        for (const t of defaultTasks) {
          await pool.query(
            `INSERT INTO tasks (id, title, "desc", "titleKk", "descKk", icon, image) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [t.id, t.title, t.desc, t.titleKk, t.descKk, t.icon, t.image]
          );
        }
      }

      await pool.query(`CREATE TABLE IF NOT EXISTS banners (
        id TEXT PRIMARY KEY,
        image TEXT,
        "isActive" BOOLEAN DEFAULT TRUE,
        "sortOrder" INTEGER DEFAULT 0
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`);
      // Seed default installmentEnabled = true
      await pool.query(`
        INSERT INTO site_settings (key, value) VALUES ('installmentEnabled', 'true')
        ON CONFLICT (key) DO NOTHING
      `);

      console.log("Database initialized successfully!");
      return;
    } catch (err) {
      console.error(`Database connection attempt ${i + 1} failed:`, err.message);
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delay));
      } else {
        console.error("All DB connection retries exhausted.");
      }
    }
  }
}

await initDb();
const auth = await createAuth(pool, allowedOrigins);
app.use('/api/auth', auth.router);
app.use('/api', auth.protectApi);
await migrateIntegrity(pool);
app.use('/api', createContentRouter(pool, auth));
app.use('/api', createUsersRouter(pool, auth));

// Get all data
app.get('/api/data', async (req, res) => {
  res.set('Cache-Control','no-store');
  try {
    res.json(await readCatalog(pool));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Full snapshots and reset cannot bypass addressed/versioned writes.
app.post('/api/save', (_req, res) => res.status(410).json({ error: 'Сохранение снимка отключено. Используйте адресные операции', code: 'SNAPSHOT_DISABLED' }));
app.post('/api/reset', auth.requireRole('admin'), (_req, res) => res.status(410).json({ error: 'Сброс отключён. Используйте явные операции с версиями', code: 'RESET_DISABLED' }));

// Image Upload Endpoint (expects base64 JSON payload)
app.post('/api/upload', (req, res) => {
  const { image, filename } = req.body;
  if (!image || !filename) {
    return res.status(400).json({ error: 'Missing image or filename data' });
  }

  // Security: Validate file header (only allow PNG/JPEG/SVG images)
  const allowedHeaders = [
    'data:image/jpeg;base64,',
    'data:image/png;base64,',
    'data:image/jpg;base64,',
    'data:image/svg+xml;base64,'
  ];
  const matchedHeader = allowedHeaders.find(h => image.startsWith(h));
  if (!matchedHeader) {
    return res.status(400).json({ error: 'Invalid image format. Only JPEG, PNG, and SVG are allowed.' });
  }

  // Security: Check file size (limit to 5MB)
  const base64Data = image.substring(matchedHeader.length);
  const sizeInBytes = (base64Data.length * 3) / 4;
  if (sizeInBytes > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'File size exceeds the 5MB limit.' });
  }

  // Security: Sanitize extension and generate safe randomized filename
  let cleanExt = '.jpeg';
  if (filename.toLowerCase().endsWith('.png')) cleanExt = '.png';
  if (filename.toLowerCase().endsWith('.svg') || matchedHeader.includes('svg')) cleanExt = '.svg';
  
  const uniqueToken = Math.random().toString(36).substring(2, 10) + '_' + Date.now();
  const safeFilename = `upload_${uniqueToken}${cleanExt}`;
  
  const productsDir = join(__dirname, 'public/products');
  const targetPath = join(productsDir, safeFilename);

  // Security: Verify targetPath is strictly inside productsDir boundary (Path Traversal prevention)
  if (!targetPath.startsWith(productsDir + sep)) {
    return res.status(400).json({ error: 'Invalid target path.' });
  }

  // Ensure directories exist
  if (!fs.existsSync(productsDir)) {
    fs.mkdirSync(productsDir, { recursive: true });
  }

  // Write file
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFile(targetPath, buffer, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to save file: ' + err.message });
    }
    res.json({ url: `/products/${safeFilename}` });
  });
});

// Serve static products files from local folder first
app.use('/products', createImageThumbnailsRouter(join(__dirname, 'public/products')));
app.use('/products', express.static(join(__dirname, 'public/products'), {
  maxAge: '1d', dotfiles: 'deny',
  setHeaders(res, path) {
    if (/[/\\]upload_[a-z0-9]+_\d+\.(?:jpe?g|png|svg)$/i.test(path)) res.set('Cache-Control', 'public, max-age=31536000, immutable');
  },
}));

// Serve static files from Vue dist folder if it exists
const distPath = join(__dirname, 'dist');
app.use('/assets', express.static(join(distPath, 'assets'), { maxAge: '1y', immutable: true }));
app.use(express.static(distPath, {
  index:false,
  maxAge: '1d',
  setHeaders(res, path) {
    if (path.endsWith('index.html')) res.set('Cache-Control', 'no-cache');
  },
}));

// Only existing public pages are valid; missing files and unknown paths remain 404.
app.use(createPublicPagesRouter(distPath, () => readCatalog(pool), async (...args) => {
  const { render } = await import('./dist-ssr/entry-server.js');
  return render(...args);
}));

app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'File size exceeds the server limit (50MB).' });
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload.' });
  }
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Internal Server Error', ...(err.code ? { code: err.code } : {}) });
});

const PORT = process.env.PORT || 3002;
if (process.argv[1] && resolve(process.argv[1]) === __filename) {
  app.listen(PORT, () => {
    console.log(`PostgreSQL Backend running at http://localhost:${PORT}`);
  });
}

export default app;
