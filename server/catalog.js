const parseJsonField = (value, fallback) => {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
};

// API and rendered HTML read the same committed snapshot with the same parsing.
export async function readCatalog(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const catRes = await client.query('SELECT * FROM categories ORDER BY "sortOrder" ASC, name ASC');
    const taskRes = await client.query('SELECT * FROM tasks ORDER BY "sortOrder" ASC');
    const bannerRes = await client.query('SELECT * FROM banners ORDER BY "sortOrder" ASC');
    const prodRes = await client.query('SELECT * FROM products');
    const parsedProducts = prodRes.rows.map(p => ({
      ...p,
      images:parseJsonField(p.images, []), tasks:parseJsonField(p.tasks, {}),
      taskSortOrders:parseJsonField(p.taskSortOrders, {}), sizes:parseJsonField(p.sizes, []), specs:parseJsonField(p.specs, {}),
    }));
    const settingsRes = await client.query('SELECT key, value, version FROM site_settings');
    const siteSettings = {};
    settingsRes.rows.forEach(r => { siteSettings[r.key] = r.key === 'hero' ? JSON.parse(r.value) : r.value === 'true' ? true : r.value === 'false' ? false : r.value; });
    await client.query('COMMIT');
    return {
      categories:catRes.rows.map(c => ({ ...c, icon:c.icon || '', sortOrder:c.sortOrder || 0 })),
      products:parsedProducts, tasks:taskRes.rows, banners:bannerRes.rows, siteSettings,
      settingVersions:Object.fromEntries(settingsRes.rows.map(r => [r.key, r.version])),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
