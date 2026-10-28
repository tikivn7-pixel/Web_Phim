const test=require('node:test'),assert=require('node:assert/strict'),jwt=require('jsonwebtoken');
const {resolveJWTSecret}=require('./auth-secret.cjs');
test('configured strong JWT secrets persist while missing secrets are unpredictable',()=>{
  const secret='a'.repeat(64);assert.deepEqual(resolveJWTSecret({JWT_SECRET:secret}),{secret,ephemeral:false});
  const first=resolveJWTSecret({}),second=resolveJWTSecret({});assert.match(first.secret,/^[a-f0-9]{64}$/);assert.notEqual(first.secret,second.secret);assert.equal(first.ephemeral,true);
  assert.throws(()=>resolveJWTSecret({JWT_SECRET:'short'}),/32 bytes/);
});
test('the old public fallback cannot authenticate tokens after the fix',()=>{
  const runtime=resolveJWTSecret({});const forged=jwt.sign({id:123},'bi_mat_khong_the_tiet_lo_123');
  assert.throws(()=>jwt.verify(forged,runtime.secret,{algorithms:['HS256']}));
  const valid=jwt.sign({id:123},runtime.secret);assert.equal(jwt.verify(valid,runtime.secret,{algorithms:['HS256']}).id,123);
});
