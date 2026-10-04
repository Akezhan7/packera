import assert from 'node:assert/strict';
import {describe,before,after,test} from 'node:test';
import {startTestServer} from './helpers/test-server.js';

describe('Account management',{concurrency:false},()=>{
  let server,admin,adminSession,editorSession;
  const password='Temporary-test-password-84!';
  const login=async user=>{const r=await server.request('/api/auth/login',{method:'POST',body:{login:user.login,password:user.password}});assert.equal(r.status,200,JSON.stringify(r.body));return {Cookie:r.cookie.split(';')[0],'X-CSRF-Token':r.body.csrfToken};};
  const call=(path,method='GET',body,headers=adminSession)=>server.request(path,{method,body,headers});
  const create=(loginValue,role='editor')=>call('/api/users','POST',{login:loginValue,name:loginValue,role,temporaryPassword:password});
  const patch=(user,changes,headers=adminSession)=>call(`/api/users/${user.id}`,'PATCH',{updatedAt:user.updatedAt,changes},headers);
  const getUser=async id=>(await call('/api/users')).body.users.find(item=>item.id===id);
  before(async()=>{server=await startTestServer();admin=await server.createUser('users-admin');adminSession=await login(admin);editorSession=await login(await server.createUser('users-editor','editor'));});
  after(async()=>{if(server)await server.close();});

  test('anonymous/editor cannot read or manage users or history',async()=>{
    for(const headers of [{},editorSession]) {
      const expected=headers.Cookie?403:401;
      for(const [path,method,body] of [['/api/users','GET'],['/api/users','POST',{login:'no-access',name:'No access',role:'admin',temporaryPassword:password}],[`/api/users/${admin.id}`,'PATCH',{changes:{role:'editor'}}],[`/api/users/${admin.id}/reset-password`,'POST',{temporaryPassword:password}],['/api/audit','GET']]) assert.equal((await call(path,method,body,headers)).status,expected,path);
    }
  });
  test('create returns metadata without secrets and requires a password change',async()=>{
    const r=await create('new-person');assert.equal(r.status,201,JSON.stringify(r.body));const user=r.body.user;
    assert.equal(user.isActive,true);assert.equal(user.mustChangePassword,true);assert.ok(user.updatedAt);
    const list=await call('/api/users');assert.equal(list.status,200);assert.ok(list.body.users.some(item=>item.id===user.id));
    for(const body of [r.body,list.body]) {const s=JSON.stringify(body);assert.ok(!s.includes(password));assert.ok(!/password_hash|token_hash|csrfToken/.test(s));}
    const headers=await login({login:user.login,password});
    assert.equal((await call('/api/upload','POST',{},headers)).body.code,'PASSWORD_CHANGE_REQUIRED');
    assert.equal((await call('/api/users','GET',undefined,headers)).status,403);
    const changed=await call('/api/auth/password','POST',{currentPassword:password,newPassword:'Personal-new-password-95!'},headers);assert.equal(changed.status,200);
    assert.equal((await call('/api/auth/me','GET',undefined,headers)).status,401);
    assert.equal((await call('/api/upload','POST',{},await login({login:user.login,password:'Personal-new-password-95!'}))).status,400);
  });
  test('login normalization and duplicate login are enforced',async()=>{
    const first=await create(' Mixed.Login ');assert.equal(first.status,201);assert.equal(first.body.user.login,'mixed.login');
    const duplicate=await create('MIXED.LOGIN');assert.equal(duplicate.status,409);assert.equal(duplicate.body.code,'LOGIN_TAKEN');
  });
  test('invalid payloads and IDs fail without creating accounts',async()=>{
    const baseline=(await server.query('SELECT count(*)::int AS count FROM admin_users')).rows[0].count;
    for(const body of [{login:'x',name:'X',role:'editor',temporaryPassword:password},{login:'bad-name',name:'',role:'editor',temporaryPassword:password},{login:'bad-role',name:'Name',role:'owner',temporaryPassword:password},{login:'bad-pass',name:'Name',role:'editor',temporaryPassword:'short'},{login:'extra-data',name:'Name',role:'editor',temporaryPassword:password,isActive:true}]) assert.equal((await call('/api/users','POST',body)).status,400);
    assert.equal((await call('/api/users/not-a-uuid','PATCH',{updatedAt:new Date().toISOString(),changes:{name:'X'}})).status,400);
    assert.equal((await call(`/api/users/${admin.id}`,'PATCH',{updatedAt:'invalid',changes:{name:'X'}})).status,400);
    assert.equal((await server.query('SELECT count(*)::int AS count FROM admin_users')).rows[0].count,baseline);
  });
  test('a stale form cannot overwrite newer access settings',async()=>{
    const original=(await create('stale-user')).body.user;const updated=await patch(original,{name:'First edit'});assert.equal(updated.status,200);
    const stale=await patch(original,{role:'admin'});assert.equal(stale.status,409);assert.equal(stale.body.code,'USER_CONFLICT');assert.equal(stale.body.current.name,'First edit');
    assert.equal((await server.query('SELECT role FROM admin_users WHERE id=$1',[original.id])).rows[0].role,'editor');
    assert.equal((await patch(updated.body.user,{name:'Second edit'})).status,200);
  });
  test('disable revokes all sessions; enable cannot revive old sessions',async()=>{
    const user=await server.createUser('disable-person','editor');const one=await login(user),two=await login(user);
    const disabled=await patch(await getUser(user.id),{isActive:false});assert.equal(disabled.status,200);
    for(const headers of [one,two])assert.equal((await call('/api/auth/me','GET',undefined,headers)).status,401);
    assert.equal((await patch(disabled.body.user,{isActive:true})).status,200);
    assert.equal((await call('/api/auth/me','GET',undefined,one)).status,401);
    assert.equal((await call('/api/auth/me','GET',undefined,await login(user))).status,200);
  });
  test('role/login changes revoke sessions; name-only changes preserve them',async()=>{
    const user=await server.createUser('role-person','editor');const old=await login(user);
    const renamed=await patch(await getUser(user.id),{name:'New displayed name'});assert.equal(renamed.status,200);assert.equal((await call('/api/auth/me','GET',undefined,old)).status,200);
    const promoted=await patch(renamed.body.user,{role:'admin',login:'role-renamed'});assert.equal(promoted.status,200);assert.equal((await call('/api/auth/me','GET',undefined,old)).status,401);
    assert.equal((await call('/api/users','GET',undefined,await login({...user,login:'role-renamed'}))).status,200);
  });
  test('password reset forces change, revokes sessions and does not expose the password',async()=>{
    const user=await server.createUser('reset-person','editor');const old=await login(user);const dto=await getUser(user.id);
    const reset=await call(`/api/users/${user.id}/reset-password`,'POST',{updatedAt:dto.updatedAt,temporaryPassword:password});assert.equal(reset.status,200);assert.equal(reset.body.user.mustChangePassword,true);
    assert.equal((await call('/api/auth/me','GET',undefined,old)).status,401);
    assert.equal((await call('/api/auth/login','POST',{login:user.login,password:user.password})).status,401);
    assert.equal((await call('/api/auth/me','GET',undefined,await login({...user,password}))).body.user.mustChangePassword,true);
    assert.ok(!JSON.stringify(reset.body).includes(password));
    assert.equal((await call(`/api/users/${user.id}/reset-password`,'POST',{updatedAt:dto.updatedAt,temporaryPassword:password})).status,409);
  });
  test('an admin session revoked while waiting cannot manage users',async()=>{
    const actor=await server.createUser('waiting-admin');const session=await login(actor);
    const target=(await create('waiting-target')).body.user;
    const lock=await server.pool.connect();
    let pending;
    try {
      await lock.query('BEGIN');await lock.query('SELECT pg_advisory_xact_lock(741902002)');
      pending=patch(target,{name:'Should not save'},session);
      const deadline=Date.now()+3000;let waiting=false;
      while(Date.now()<deadline) {
        const r=await server.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE wait_event='advisory' AND query LIKE '%741902002%'");
        if(r.rows[0].count) {waiting=true;break;}
        await new Promise(resolve=>setTimeout(resolve,30));
      }
      assert.ok(waiting,'request must be queued behind the management lock');
      await server.query('DELETE FROM admin_sessions WHERE user_id=$1',[actor.id]);
      await lock.query('COMMIT');
      const r=await pending;assert.equal(r.status,401);assert.equal(r.body.code,'SESSION_EXPIRED');
      assert.equal((await getUser(target.id)).name,target.name);
    } finally {await lock.query('ROLLBACK');lock.release();if(pending)await pending;}
  });
  test('last active admin cannot be removed, including concurrent removals',async()=>{
    await server.query("UPDATE admin_users SET is_active=FALSE WHERE role='admin' AND id<>$1",[admin.id]);
    const one=await getUser(admin.id);
    for(const changes of [{isActive:false},{role:'editor'}]){const r=await patch(one,changes);assert.equal(r.status,409);assert.equal(r.body.code,'LAST_ADMIN');}
    const second=await server.createUser('concurrent-admin');const secondSession=await login(second);
    const a=await getUser(admin.id),b=await getUser(second.id);
    const attempts=await Promise.all([patch(a,{isActive:false},adminSession),patch(b,{role:'editor'},secondSession)]);
    assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);assert.equal(attempts.find(r=>r.status===409).body.code,'LAST_ADMIN');
    assert.equal((await server.query("SELECT count(*)::int AS count FROM admin_users WHERE role='admin' AND is_active=TRUE")).rows[0].count,1);
  });
});
