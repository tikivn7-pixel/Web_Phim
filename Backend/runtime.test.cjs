const test=require('node:test'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const express=require('express'),cors=require('cors'),axios=require('axios'),{registerCatalog}=require('./catalog');
test('patched backend dependencies handle real HTTP, compressed JSON and catalog routing',async t=>{
  const app=express();app.use(cors());app.use(express.json());
  app.post('/probe',(req,res)=>res.json(req.body));
  registerCatalog(app,{promise:()=>({query:async sql=>sql.includes('COUNT(*) AS total')?[[{total:1}]]:sql.includes('SELECT payload')?[[{payload:{slug:'runtime-test',title:'Runtime test'}}]]:[[{year:2026,count:1}]]})});
  const server=app.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base='http://127.0.0.1:'+server.address().port;
  const payload={message:'Kiểm tra backend'},response=await fetch(base+'/probe',{method:'POST',headers:{'content-type':'application/json','content-encoding':'gzip'},body:zlib.gzipSync(JSON.stringify(payload))});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),payload);assert.equal(response.headers.get('access-control-allow-origin'),'*');
  const catalog=await axios.get(base+'/api/catalog',{proxy:false,timeout:5000});assert.equal(catalog.status,200);assert.equal(catalog.data.movies[0].slug,'runtime-test');assert.equal(catalog.data.totalItems,1);
});
