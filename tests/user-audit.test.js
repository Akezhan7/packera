import assert from 'node:assert/strict';
import {describe,before,after,test} from 'node:test';
import {startTestServer} from './helpers/test-server.js';
describe('User audit transactions',{concurrency:false},()=>{
  let server,admin,headers,target;
  const password='Temporary-audit-password-93!';
  const call=(path,method='GET',body,h=headers)=>server.request(path,{method,body,headers:h});
  const login=async user=>{const r=await call('/api/auth/login','POST',{login:user.login,password:user.password},{});assert.equal(r.status,200);return {Cookie:r.cookie.split(';')[0],'X-CSRF-Token':r.body.csrfToken};};
  before(async()=>{server=await startTestServer();admin=await server.createUser('audit-admin');headers=await login(admin);});
  after(async()=>{if(server)await server.close();});
  test('creation and access edits are attributed, filterable and contain no secrets',async()=>{
    const r=await call('/api/users','POST',{login:'audit-person',name:'Audit person',role:'editor',temporaryPassword:password});
    assert.equal(r.status,201);target=r.body.user;
    const edited=await call('/api/users/'+target.id,'PATCH',{updatedAt:target.updatedAt,changes:{name:'Changed name',role:'admin'}});assert.equal(edited.status,200);target=edited.body.user;
    const history=await call('/api/audit?entity=users&id='+target.id+'&actor='+admin.id+'&limit=1');
    assert.equal(history.status,200);assert.equal(history.body.total,2);assert.equal(history.body.items.length,1);
    assert.equal(history.body.items[0].actor_login,admin.login);
    assert.deepEqual(history.body.items[0].changes.role,{before:'editor',after:'admin'});
    const next=await call('/api/audit?entity=users&id='+target.id+'&limit=1&offset=1');assert.equal(next.body.items[0].action,'create');
    assert.ok(!/password_hash|token_hash|scrypt/.test(JSON.stringify(next.body)));assert.ok(!JSON.stringify(next.body).includes(password));
    assert.equal((await call('/api/audit?entity=unknown')).status,400);
    assert.equal((await call('/api/audit?entity=users&from=2100-01-01')).body.total,0);
  });
  test('stale requests do not produce successful history entries',async()=>{
    const before=(await call('/api/audit?entity=users')).body.total;
    const r=await call('/api/users/'+target.id,'PATCH',{updatedAt:'2000-01-01T00:00:00.000Z',changes:{name:'Stale'}});
    assert.equal(r.status,409);assert.equal((await call('/api/audit?entity=users')).body.total,before);
  });
  test('audit insertion failure rolls back account changes and session revocation',async()=>{
    const user=await server.createUser('rollback-user','editor');const old=await login(user);
    const dto=(await call('/api/users')).body.users.find(u=>u.id===user.id);
    await server.query("CREATE FUNCTION reject_user_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity='users' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END $$");
    await server.query('CREATE TRIGGER test_user_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION reject_user_audit()');
    try {
      const r=await call('/api/users/'+user.id,'PATCH',{updatedAt:dto.updatedAt,changes:{isActive:false}});
      assert.equal(r.status,500);
      assert.equal((await server.query('SELECT is_active FROM admin_users WHERE id=$1',[user.id])).rows[0].is_active,true);
      assert.equal((await call('/api/auth/me','GET',undefined,old)).status,200);
    } finally {await server.query('DROP TRIGGER test_user_audit ON audit_log');await server.query('DROP FUNCTION reject_user_audit()');}
  });
  test('password reset and personal password change record only safe flags',async()=>{
    const user=await server.createUser('password-audit','editor');let dto=(await call('/api/users')).body.users.find(u=>u.id===user.id);
    assert.equal((await call('/api/users/'+user.id+'/reset-password','POST',{updatedAt:dto.updatedAt,temporaryPassword:password})).status,200);
    const h=await login({...user,password});
    assert.equal((await call('/api/auth/password','POST',{currentPassword:password,newPassword:'Personal-audit-password-94!'},h)).status,200);
    const history=(await call('/api/audit?entity=users&id='+user.id)).body;
    assert.equal(history.total,2);
    assert.deepEqual(history.items[0].changes.passwordChanged,{before:false,after:true});
    assert.equal(history.items[0].actor_id,user.id);
    assert.ok(!JSON.stringify(history).includes(password));assert.ok(!/password_hash|scrypt|Personal-audit/.test(JSON.stringify(history)));
  });
});
