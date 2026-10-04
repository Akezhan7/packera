import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {startTestServer} from './helpers/test-server.js';

test('login with old credentials cannot create a session after concurrent login rename',async()=>{
  const server=await startTestServer();
  let blocker,rename,oldLogin;
  try {
    const admin=await server.createUser('login-race-admin');
    const target=await server.createUser('login-race-original','editor');
    const auth=await server.request('/api/auth/login',{method:'POST',body:{login:admin.login,password:admin.password}});
    assert.equal(auth.status,200);
    const headers={Cookie:auth.cookie.split(';')[0],'X-CSRF-Token':auth.body.csrfToken};
    const list=await server.request('/api/users',{headers});
    assert.equal(list.status,200);
    const dto=list.body.users.find(user=>user.id===target.id);
    blocker=await server.pool.connect();
    await blocker.query('BEGIN');
    await blocker.query('SELECT id FROM admin_users WHERE id=$1 FOR UPDATE',[target.id]);
    const waitForLock=async pattern=>{
      const deadline=Date.now()+3000;
      while(Date.now()<deadline) {
        const result=await server.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1",[pattern]);
        if(result.rows[0].count)return;
        await delay(30);
      }
      assert.fail('Request did not reach expected row lock: '+pattern);
    };
    rename=server.request('/api/users/'+target.id,{method:'PATCH',headers,body:{updatedAt:dto.updatedAt,changes:{login:'login-race-renamed'}}});
    await waitForLock('SELECT * FROM admin_users WHERE id=ANY%');
    oldLogin=server.request('/api/auth/login',{method:'POST',body:{login:target.login,password:target.password}});
    await waitForLock('SELECT * FROM admin_users WHERE id = $1 FOR UPDATE');
    await blocker.query('COMMIT');
    blocker.release();blocker=null;
    const changed=await rename;
    assert.equal(changed.status,200,JSON.stringify(changed.body));
    const stale=await oldLogin;
    assert.equal(stale.status,401,'Login begun under old login must be rejected after rename commits');
    const sessions=await server.query('SELECT count(*)::int AS count FROM admin_sessions WHERE user_id=$1',[target.id]);
    assert.equal(sessions.rows[0].count,0,'No session can survive account access settings change');
    const fresh=await server.request('/api/auth/login',{method:'POST',body:{login:'login-race-renamed',password:target.password}});
    assert.equal(fresh.status,200,JSON.stringify(fresh.body));
  } finally {
    if(blocker){await blocker.query('ROLLBACK');blocker.release();}
    await Promise.allSettled([rename,oldLogin].filter(Boolean));
    await server.close();
  }
});
