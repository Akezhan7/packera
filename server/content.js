import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const definitions = {
  products: { table: 'products', key: 'id', fields: ['title','desc','price','unit','category','visual','color','image','images','tasks','sizes','specs','kaspiLink','halykLink','forteLink','sortOrder','categorySortOrder','isVisible'], defaults: { desc:'', price:0, unit:'шт', category:'', visual:'box', color:'', image:'', images:[], tasks:{}, sizes:[], specs:{}, kaspiLink:'', halykLink:'', forteLink:'', sortOrder:0, categorySortOrder:0, isVisible:true } },
  categories: { table: 'categories', key: 'id', fields: ['name','icon','sortOrder'], defaults: { icon:'', sortOrder:0 } },
  tasks: { table: 'tasks', key: 'id', fields: ['title','desc','titleKk','descKk','icon','image','sortOrder'], defaults: { desc:'', titleKk:'', descKk:'', icon:'box', image:'', sortOrder:0 } },
  banners: { table: 'banners', key: 'id', fields: ['image','isActive','sortOrder'], defaults: { isActive:true, sortOrder:0 } },
  settings: { table: 'site_settings', key: 'key', fields: ['value'], defaults: {} },
};
const jsonFields = new Set(['images','tasks','sizes','specs']);
const error = (status, message, details = {}) => Object.assign(new Error(message), { status, ...details });
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const quote = field => `"${field}"`; // Called only for server-owned column names.
const identifier = value => typeof value === 'string' && value.length > 0 && value.length <= 200;

export async function migrateIntegrity(pool) {
  const sql = await readFile(new URL('./migrations/002-integrity.sql', import.meta.url), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(741902001)');
    const exists = await client.query('SELECT version FROM schema_migrations WHERE version = $1', ['002-integrity']);
    if (!exists.rowCount) {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', ['002-integrity']);
    }
    await client.query('COMMIT');
  } catch (failure) { await client.query('ROLLBACK'); throw failure; }
  finally { client.release(); }
}

function parseRow(entity, row) {
  if (!row) return null;
  const result = { ...row };
  if (entity === 'products') {
    for (const field of jsonFields) {
      if (typeof result[field] === 'string') result[field] = JSON.parse(result[field]);
      if (result[field] == null) result[field] = ['images','sizes'].includes(field) ? [] : {};
    }
  }
  if (entity === 'settings') result.value = result.value === 'true' ? true : result.value === 'false' ? false : result.value;
  return result;
}

function validateFields(entity, values) {
  const definition = definitions[entity];
  if (!object(values) || !Object.keys(values).length) throw error(400, 'Пустые или некорректные поля');
  for (const [field, value] of Object.entries(values)) {
    if (!definition.fields.includes(field)) throw error(400, `Недопустимое поле: ${field}`);
    if (['isVisible','isActive'].includes(field) || entity === 'settings') {
      if (typeof value !== 'boolean') throw error(400, `Поле ${field} должно быть boolean`);
    } else if (field === 'price') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw error(400, 'Некорректная цена');
    } else if (['sortOrder','categorySortOrder'].includes(field)) {
      if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) throw error(400, 'Некорректный порядок');
    } else if (field === 'images') {
      if (!Array.isArray(value) || value.length > 1000 || value.some(image => typeof image !== 'string')) throw error(400, 'Некорректный массив изображений');
    } else if (field === 'tasks') {
      if (!object(value) || Object.entries(value).some(([id, level]) => !identifier(id) || ![1,2,3].includes(level))) throw error(400, 'Некорректные рекомендации');
    } else if (field === 'specs') {
      if (!object(value) || Object.entries(value).some(([key, val]) => !identifier(key) || typeof val !== 'string')) throw error(400, 'Некорректные характеристики');
    } else if (field === 'sizes') {
      if (!Array.isArray(value) || value.length > 1000) throw error(400, 'Некорректные размеры');
      for (const size of value) {
        if (!object(size) || typeof size.size !== 'string' || !size.size.trim() || typeof size.price !== 'number' || !Number.isFinite(size.price) || size.price < 0 ||
            Object.keys(size).some(key => !['size','price','image','images','kaspiLink','halykLink','forteLink'].includes(key)) ||
            ['image','kaspiLink','halykLink','forteLink'].some(key => size[key] !== undefined && typeof size[key] !== 'string') ||
            (size.images !== undefined && (!Array.isArray(size.images) || size.images.some(image => typeof image !== 'string')))) throw error(400, 'Некорректный вариант товара');
      }
    } else if (typeof value !== 'string' || value.length > 10000000 || (['title','name'].includes(field) && (!value.trim() || value.length > 500))) {
      throw error(400, `Некорректное поле ${field}`);
    }
  }
}

function prepare(operation) {
  if (!object(operation) || !Object.hasOwn(definitions, operation.entity) || !['create','update','delete'].includes(operation.action)) throw error(400, 'Некорректная операция');
  const { entity, action } = operation;
  const allowed = action === 'create' ? ['entity','action','data'] : action === 'update' ? ['entity','action','id','version','changes'] : ['entity','action','id','version'];
  if (Object.keys(operation).some(key => !allowed.includes(key))) throw error(400, 'Недопустимые параметры операции');
  const definition = definitions[entity];
  if (action === 'create') {
    if (entity === 'settings' || !object(operation.data)) throw error(400, 'Некорректные данные создания');
    const { id: suppliedId, ...provided } = operation.data;
    const id = suppliedId ?? (['categories','banners'].includes(entity) ? randomUUID() : undefined);
    if (!identifier(id) || (entity === 'categories' && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))) throw error(400, 'Некорректный идентификатор');
    if ((['products','tasks'].includes(entity) && !Object.hasOwn(provided,'title')) || (entity === 'categories' && !Object.hasOwn(provided,'name')) || (entity === 'banners' && !Object.hasOwn(provided,'image'))) throw error(400, 'Обязательные поля отсутствуют');
    const data = { ...definition.defaults, ...provided };
    validateFields(entity, data);
    return { entity, action, id: entity === 'categories' ? id.toLowerCase() : id, data };
  }
  if (!identifier(operation.id) || (entity === 'categories' && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(operation.id))) throw error(400, 'Некорректный идентификатор');
  if (entity === 'settings' && (action !== 'update' || operation.id !== 'installmentEnabled')) throw error(400, 'Недопустимая настройка');
  if (!Number.isInteger(operation.version) || operation.version < 1 || operation.version > 2147483647) throw error(400, 'Требуется исходная версия');
  if (action === 'update') validateFields(entity, operation.changes);
  return { ...operation, id: entity === 'categories' ? operation.id.toLowerCase() : operation.id };
}

async function checkReferences(client, entity, values) {
  if (entity !== 'products') return;
  if (values.category) {
    const found = await client.query('SELECT 1 FROM categories WHERE name = $1', [values.category]);
    if (!found.rowCount) throw error(400, 'Категория отсутствует. Обновите данные');
  }
  if (values.tasks && Object.keys(values.tasks).length) {
    const keys = Object.keys(values.tasks);
    const found = await client.query('SELECT id FROM tasks WHERE id = ANY($1::text[])', [keys]);
    if (found.rowCount !== keys.length) throw error(400, 'Задача отсутствует. Обновите данные');
  }
}

async function writeAudit(client, actor, entity, id, action, before, after) {
  const changes = {};
  for (const field of definitions[entity].fields) {
    const oldValue = before?.[field] ?? null;
    const newValue = after?.[field] ?? null;
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) changes[field] = { before: oldValue, after: newValue };
  }
  await client.query(`INSERT INTO audit_log (actor_id,entity,entity_id,action,changes,version) VALUES ($1,$2,$3,$4,$5,$6)`,
    [actor, entity, id, action, JSON.stringify(changes), (after || before).version]);
}

async function mutate(client, actor, operation, changesList) {
  const { entity, action, id, version } = operation;
  const definition = definitions[entity];
  const existing = await client.query(`SELECT * FROM ${definition.table} WHERE ${quote(definition.key)} = $1`, [id]);
  const before = parseRow(entity, existing.rows[0]);
  if (action === 'create' && before) throw error(409, 'Идентификатор уже существует', { code:'ALREADY_EXISTS', entity, id, current: before });
  if (action !== 'create' && !before) throw error(404, 'Объект удалён или отсутствует', { code:'NOT_FOUND', entity, id, current: null });
  if (action !== 'create' && before.version !== version) throw error(409, 'Объект изменён другим пользователем', { code:'VERSION_CONFLICT', entity, id, current: before });
  const values = action === 'create' ? operation.data : operation.changes;
  if (action !== 'delete') await checkReferences(client, entity, values);
  let result;
  if (action === 'create') {
    const fields = [definition.key, ...Object.keys(values), 'updated_by'];
    const parameters = [id, ...Object.entries(values).map(([field,value]) => jsonFields.has(field) ? JSON.stringify(value) : value), actor];
    // JSON fields named "tasks" exist only on products, and setting value is stored as TEXT.
    result = await client.query(`INSERT INTO ${definition.table} (${fields.map(quote).join(',')}) VALUES (${parameters.map((_,i) => '$' + (i+1)).join(',')}) RETURNING *`, parameters);
  } else if (action === 'update') {
    const entries = Object.entries(values);
    const parameters = entries.map(([field,value]) => entity === 'products' && jsonFields.has(field) ? JSON.stringify(value) : entity === 'settings' ? String(value) : value);
    parameters.push(actor, id, version);
    result = await client.query(`UPDATE ${definition.table} SET ${entries.map(([field],i) => `${quote(field)}=$${i+1}`).join(',')}, version=nextval('content_version_seq'), updated_at=clock_timestamp(), updated_by=$${entries.length+1} WHERE ${quote(definition.key)}=$${entries.length+2} AND version=$${entries.length+3} RETURNING *`, parameters);
  } else {
    result = await client.query(`DELETE FROM ${definition.table} WHERE ${quote(definition.key)}=$1 AND version=$2 RETURNING *`, [id,version]);
  }
  if (!result.rowCount) throw error(409, 'Конфликт версии', { code:'VERSION_CONFLICT', entity, id, current: before });
  const after = action === 'delete' ? null : parseRow(entity,result.rows[0]);
  await writeAudit(client, actor, entity, id, action, before, after);
  changesList.push({ entity, id, data: after });

  // Relationship edits run under the same transaction lock as product edits.
  if (entity === 'categories' && (action === 'delete' || (action === 'update' && after.name !== before.name))) {
    const related = await client.query('SELECT * FROM products WHERE category=$1 ORDER BY id', [before.name]);
    for (const row of related.rows) await mutate(client, actor, { entity:'products', action:'update', id:row.id, version:row.version, changes:{ category:after?.name || '' } }, changesList);
  }
  if (entity === 'tasks' && action === 'delete') {
    const related = await client.query('SELECT * FROM products ORDER BY id');
    for (const row of related.rows) {
      const product = parseRow('products',row);
      if (Object.hasOwn(product.tasks,id)) {
        const tasks = { ...product.tasks }; delete tasks[id];
        await mutate(client, actor, { entity:'products', action:'update', id:row.id, version:row.version, changes:{tasks} }, changesList);
      }
    }
  }
  return { entity, action, id, data: after };
}

export function createContentRouter(pool, auth) {
  const router = Router();
  async function execute(req,res,operations,batch) {
    if (!Array.isArray(operations) || !operations.length || operations.length > 2000) throw error(400,'Требуется от 1 до 2000 операций');
    const prepared = operations.map(prepare);
    const ids = prepared.map(op => `${op.entity}:${op.id}`);
    if (new Set(ids).size !== ids.length) throw error(400,'Объект повторяется в операции');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Small admin workload: one transaction lock avoids cross-entity deadlocks
      // and makes category/task relationship checks atomic with product writes.
      await client.query('SELECT pg_advisory_xact_lock(741902003)');
      const results = [], changes = [];
      for (const operation of prepared) results.push(await mutate(client, req.auth.user.id, operation, changes));
      await client.query('COMMIT');
      res.status(!batch && prepared[0].action === 'create' ? 201 : 200).json({success:true, ...(batch ? { results } : { data:results[0].data }), changes});
    } catch (failure) {
      await client.query('ROLLBACK');
      if (failure.code === '23505') failure = error(409,'Имя или идентификатор уже занят',{code:'ALREADY_EXISTS'});
      if (failure.status) res.status(failure.status).json({error:failure.message, ...Object.fromEntries(['code','entity','id','current'].filter(key => Object.hasOwn(failure,key)).map(key => [key,failure[key]]))});
      else throw failure;
    } finally { client.release(); }
  }
  for (const entity of ['products','categories','tasks','banners']) {
    router.post(`/${entity}`, (req,res) => execute(req,res,[{entity,action:'create',data:req.body}],false));
    router.patch(`/${entity}/:id`, (req,res) => {
      if (!object(req.body) || Object.keys(req.body).some(key => !['version','changes'].includes(key))) throw error(400,'Некорректный запрос');
      return execute(req,res,[{entity,action:'update',id:req.params.id,...req.body}],false);
    });
    router.delete(`/${entity}/:id`, (req,res) => {
      if (!object(req.body) || Object.keys(req.body).some(key => key !== 'version')) throw error(400,'Некорректный запрос');
      return execute(req,res,[{entity,action:'delete',id:req.params.id,...req.body}],false);
    });
  }
  router.patch('/settings',(req,res) => {
    if (!object(req.body) || Object.keys(req.body).some(key => !['key','version','changes'].includes(key))) throw error(400,'Некорректный запрос');
    return execute(req,res,[{entity:'settings',action:'update',id:req.body.key,version:req.body.version,changes:req.body.changes}],false);
  });
  router.post('/content/batch',(req,res) => {
    if (!object(req.body) || Object.keys(req.body).some(key => key !== 'operations')) throw error(400,'Некорректный запрос');
    return execute(req,res,req.body.operations,true);
  });
  router.get('/audit',auth.requireRole('admin'),async (req,res) => {
    const allowed = ['entity','id','actor','from','to','limit','offset'];
    if (Object.keys(req.query).some(key => !allowed.includes(key) || typeof req.query[key] !== 'string')) throw error(400,'Некорректные фильтры');
    const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
    const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) throw error(400,'Некорректная пагинация');
    const conditions = [], params = [];
    for (const [key,column] of [['entity','a.entity'],['id','a.entity_id'],['actor','a.actor_id']]) {
      if (req.query[key]) {
        if (key === 'entity' && req.query[key] !== 'users' && !Object.hasOwn(definitions,req.query[key])) throw error(400,'Некорректная сущность');
        if (key === 'actor' && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(req.query[key])) throw error(400,'Некорректный автор');
        params.push(req.query[key]); conditions.push(`${column}=$${params.length}`);
      }
    }
    for (const [key,operator] of [['from','>='],['to','<=']]) {
      if (req.query[key]) {
        if (!Number.isFinite(Date.parse(req.query[key]))) throw error(400,'Некорректная дата');
        params.push(new Date(req.query[key]).toISOString()); conditions.push(`a.created_at ${operator} $${params.length}::timestamptz`);
      }
    }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const client = await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const count = await client.query(`SELECT count(*)::int AS total FROM audit_log a ${where}`,params);
      const items = await client.query(`SELECT a.*,u.name AS actor_name,u.login AS actor_login FROM audit_log a JOIN admin_users u ON u.id=a.actor_id ${where} ORDER BY a.id DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,[...params,limit,offset]);
      await client.query('COMMIT');
      res.set('Cache-Control','no-store').json({items:items.rows,total:count.rows[0].total,limit,offset});
    } catch (failure) { await client.query('ROLLBACK'); throw failure; }
    finally { client.release(); }
  });
  return router;
}
