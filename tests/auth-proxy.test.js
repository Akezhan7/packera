import assert from 'node:assert/strict';
import {test} from 'node:test';
import {startTestServer} from './helpers/test-server.js';
test('trusted single proxy separates clients and ignores forged leftmost forwarding values',async()=>{
  const server=await startTestServer({trustProxy:true});
  try {
    for(let i=0;i<10;i++) {
      const r=await server.request('/api/auth/login',{method:'POST',headers:{'X-Forwarded-For':'198.51.100.'+i+', 203.0.113.50'},body:{login:'proxy-unknown-'+i,password:'Invalid-password-42!'}});
      assert.equal(r.status,401);
    }
    const user=await server.createUser('proxy-real-admin');
    const other=await server.request('/api/auth/login',{method:'POST',headers:{'X-Forwarded-For':'203.0.113.51'},body:{login:user.login,password:user.password}});
    assert.equal(other.status,200,'another client must not inherit the first client rate limit');
    const forged=await server.request('/api/auth/login',{method:'POST',headers:{'X-Forwarded-For':'192.0.2.123, 203.0.113.50'},body:{login:'proxy-forged',password:'Invalid-password-42!'}});
    assert.equal(forged.status,429,'forging the leftmost entry cannot bypass the real client limit');
  } finally {await server.close();}
});
test('direct deployment ignores user-supplied forwarding headers by default',async()=>{
  const server=await startTestServer();
  try {
    for(let i=0;i<10;i++) {
      const r=await server.request('/api/auth/login',{method:'POST',headers:{'X-Forwarded-For':'203.0.113.'+i},body:{login:'direct-unknown-'+i,password:'Invalid-password-42!'}});
      assert.equal(r.status,401);
    }
    assert.equal((await server.request('/api/auth/login',{method:'POST',headers:{'X-Forwarded-For':'203.0.113.250'},body:{login:'direct-next',password:'Invalid-password-42!'}})).status,429);
  } finally {await server.close();}
});
