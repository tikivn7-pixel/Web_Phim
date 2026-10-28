'use strict';
const crypto=require('node:crypto');
function resolveJWTSecret(env=process.env){
  const configured=String(env.JWT_SECRET||'').trim();
  if(configured){
    if(Buffer.byteLength(configured,'utf8')<32)throw Error('JWT_SECRET must contain at least 32 bytes. Configure a long random secret before starting the backend.');
    return{secret:configured,ephemeral:false};
  }
  // Never fall back to a predictable secret from the public source tree.
  return{secret:crypto.randomBytes(32).toString('hex'),ephemeral:true};
}
module.exports={resolveJWTSecret};
