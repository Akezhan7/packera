import express from 'express';
import {normalizeLogin,validateNewPassword,hashPassword} from './auth.js';

const fail=(status,message,code,extra={})=>Object.assign(new Error(message),{status,code,...extra});
const dto=r=>({id:r.id,login:r.login,name:r.name,role:r.role,isActive:r.is_active,mustChangePassword:r.must_change_password,createdAt:r.created_at.toISOString(),updatedAt:r.updated_at.toISOString()});
const fields={login:'login',name:'name',role:'role',isActive:'is_active'};
function exact(body,keys) {
  if(!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(k=>!keys.includes(k))) throw fail(400,'Некорректные поля запроса');
}
function normalize(key,value) {
  if(key==='login') return normalizeLogin(value);
  if(key==='name' && typeof value==='string' && value.trim().length && value.trim().length<=100) return value.trim();
  if(key==='role' && ['admin','editor'].includes(value)) return value;
  if(key==='isActive' && typeof value==='boolean') return value;
  throw fail(400,'Некорректное значение поля '+key);
}
async function audit(client,actor,id,action,changes) {
  await client.query("INSERT INTO audit_log (actor_id,entity,entity_id,action,changes,version) VALUES ($1,'users',$2,$3,$4,nextval('content_version_seq'))",[actor,id,action,JSON.stringify(changes)]);
}
export function createUsersRouter(pool,auth) {
  const router=express.Router();
  router.use('/users',auth.requireRole('admin'));
  router.get('/users',async(req,res)=>{
    const result=await pool.query('SELECT * FROM admin_users ORDER BY created_at,id');
    res.set('Cache-Control','no-store').json({users:result.rows.map(dto)});
  });
  async function mutate(req,res,mode) {
    const body=req.body;
    exact(body,mode==='create'?['login','name','role','temporaryPassword']:mode==='reset'?['updatedAt','temporaryPassword']:['updatedAt','changes']);
    let values={},hash;
    if(mode==='create') for(const key of ['login','name','role']) values[key]=normalize(key,body[key]);
    else {
      if(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(req.params.id)) throw fail(400,'Некорректный пользователь');
      if(typeof body.updatedAt!=='string' || !Number.isFinite(Date.parse(body.updatedAt))) throw fail(400,'Укажите версию пользователя');
      if(mode==='edit') {
        exact(body.changes,Object.keys(fields));
        if(!Object.keys(body.changes).length) throw fail(400,'Нет изменений');
        for(const [key,value] of Object.entries(body.changes)) values[key]=normalize(key,value);
      }
    }
    if(mode!=='edit') {validateNewPassword(body.temporaryPassword);hash=await hashPassword(body.temporaryPassword);}
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(741902002)');
      const ids=[req.auth.user.id,...(mode==='create'?[]:[req.params.id])];
      const locked=await client.query('SELECT * FROM admin_users WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[ids]);
      const actor=locked.rows.find(r=>r.id===req.auth.user.id);
      const session=await client.query('SELECT token_hash FROM admin_sessions WHERE token_hash=$1 AND user_id=$2 AND expires_at>clock_timestamp()',[req.auth.tokenHash,req.auth.user.id]);
      if(!actor?.is_active || !session.rowCount) throw fail(401,'Сессия завершена','SESSION_EXPIRED');
      if(actor.role!=='admin' || actor.must_change_password) throw fail(403,'Нет доступа','FORBIDDEN');
      let row,changes={},revoke=false;
      if(mode==='create') {
        row=(await client.query("INSERT INTO admin_users(login,name,role,password_hash,must_change_password) VALUES($1,$2,$3,$4,TRUE) RETURNING *",[values.login,values.name,values.role,hash])).rows[0];
        for(const [key,value] of Object.entries({...values,isActive:true,mustChangePassword:true})) changes[key]={before:null,after:value};
        await audit(client,actor.id,row.id,'create',changes);
      } else {
        const original=locked.rows.find(r=>r.id===req.params.id);
        if(!original) throw fail(404,'Пользователь не найден');
        if(original.updated_at.toISOString()!==body.updatedAt) throw fail(409,'Пользователь уже изменён. Обновите данные перед сохранением','USER_CONFLICT',{current:dto(original)});
        if(mode==='edit') {
          for(const [key,value] of Object.entries(values)) if(original[fields[key]]!==value) changes[key]={before:original[fields[key]],after:value};
          if(original.role==='admin' && original.is_active && (values.role==='editor' || values.isActive===false)) {
            const count=await client.query("SELECT count(*)::int AS count FROM admin_users WHERE role='admin' AND is_active");
            if(count.rows[0].count<=1) throw fail(409,'Нельзя отключить или понизить последнего администратора','LAST_ADMIN');
          }
        } else changes={passwordReset:{before:false,after:true},mustChangePassword:{before:original.must_change_password,after:true}};
        row=original;
        if(Object.keys(changes).length) {
          const params=[original.id],sets=[];
          for(const key of Object.keys(changes)) if(fields[key]) {params.push(values[key]);sets.push(fields[key]+'=$'+params.length);}
          if(mode==='reset') {params.push(hash);sets.push('password_hash=$'+params.length,'must_change_password=TRUE');}
          sets.push("updated_at=GREATEST(date_trunc('milliseconds',clock_timestamp()),date_trunc('milliseconds',updated_at)+interval '1 millisecond')");
          row=(await client.query('UPDATE admin_users SET '+sets.join(',')+' WHERE id=$1 RETURNING *',params)).rows[0];
          revoke=mode==='reset' || ['role','login','isActive'].some(k=>Object.hasOwn(changes,k));
          if(revoke) await client.query('DELETE FROM admin_sessions WHERE user_id=$1',[row.id]);
          await audit(client,actor.id,row.id,'update',changes);
        }
      }
      await client.query('COMMIT');
      const reauthenticate=revoke && row.id===actor.id;
      if(reauthenticate) auth.clearSessionCookie(res);
      res.status(mode==='create'?201:200).json({user:dto(row),reauthenticate});
    } catch(error) {
      await client.query('ROLLBACK');
      if(error.code==='23505') throw fail(409,'Этот логин уже занят','LOGIN_TAKEN');
      if(error.code==='USER_CONFLICT') return res.status(409).json({error:error.message,code:error.code,current:error.current});
      throw error;
    } finally {client.release();}
  }
  router.post('/users',(req,res)=>mutate(req,res,'create'));
  router.patch('/users/:id',(req,res)=>mutate(req,res,'edit'));
  router.post('/users/:id/reset-password',(req,res)=>mutate(req,res,'reset'));
  return router;
}
