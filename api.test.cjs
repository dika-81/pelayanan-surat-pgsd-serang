const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {webcrypto}=require('node:crypto');

function client(){
  const stored=new Map(),frames=[],listeners={},sent=[];
  const peer={postMessage:(message,origin)=>sent.push({message,origin})};
  const ctx={URL,Map,Promise,Error,Date,JSON,Event,crypto:webcrypto,setTimeout:(fn,ms)=>{const timer=setTimeout(fn,ms);timer.unref();return timer;},clearTimeout,location:{origin:'https://dika-81.github.io'},
    sessionStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)},
    addEventListener:(name,fn)=>listeners[name]=fn,dispatchEvent:()=>{},
    document:{createElement:()=>({remove(){this.removed=true;}}),body:{appendChild:frame=>frames.push(frame)}}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../docs/assets/api.js'),'utf8'),ctx);
  const api=new ctx.SuratAPI({apiUrl:'https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec'});
  const message=(data,origin='https://n-test-script.googleusercontent.com',source=peer)=>api.onMessage({origin,source,data});
  const ready=()=>message({type:'surat:ready',channel:api.channel});
  return {ctx,api,stored,frames,listeners,sent,peer,message,ready};
}
test('koneksi memakai iframe dan mengabaikan pesan origin/channel palsu',async()=>{
  const c=client(),connection=c.api.connect();assert.equal(c.frames.length,1);assert.ok(c.frames[0].src.includes('origin=https%3A%2F%2Fdika-81.github.io'));
  c.message({type:'surat:ready',channel:c.api.channel},'https://evil.example');assert.equal(c.api.peer,null);
  c.message({type:'surat:ready',channel:'salah'});assert.equal(c.api.peer,null);
  c.ready();await connection;assert.equal(c.api.peer,c.peer);
});
test('RPC menyampaikan token dalam pesan dan mengikat respons pada source, ID, dan channel',async()=>{
  const c=client();c.api.setSession({token:'token-uji',expires:Date.now()+60000});const connection=c.api.connect();c.ready();await connection;
  const call=c.api.call('status',{code:'AABBCCDDEE'});await new Promise(resolve=>setImmediate(resolve));
  const req=c.sent[0];assert.equal(req.message.token,'token-uji');assert.equal(req.origin,'https://n-test-script.googleusercontent.com');assert.equal(c.frames[0].src.includes('token-uji'),false);
  c.message({type:'surat:response',channel:c.api.channel,id:req.message.id,result:{ok:true,data:{bad:true}}},req.origin,{postMessage(){}});assert.equal(c.api.pending.size,1);
  c.message({type:'surat:response',channel:c.api.channel,id:req.message.id,result:{ok:true,data:{status:'Menunggu'}}});
  assert.equal((await call).status,'Menunggu');assert.equal(c.api.pending.size,0);
});
test('sesi kedaluwarsa dibersihkan dan error backend tidak menjadi sukses palsu',async()=>{
  const c=client();c.api.setSession({token:'old',expires:Date.now()+60000});const connection=c.api.connect();c.ready();await connection;
  const call=c.api.call('list');await new Promise(resolve=>setImmediate(resolve));const req=c.sent[0].message;
  c.message({type:'surat:response',channel:c.api.channel,id:req.id,result:{ok:false,error:{code:'AUTH_REQUIRED',message:'Login kembali'}}});
  await assert.rejects(call,{code:'AUTH_REQUIRED'});assert.equal(c.api.session,null);assert.equal(c.stored.size,0);
});
test('alamat belum disetel tidak mengirim data ke tujuan lain',async()=>{
  const c=client();c.api.config.apiUrl='';await assert.rejects(c.api.call('submit',{}),{code:'SETUP'});assert.equal(c.frames.length,0);
  c.api.config.apiUrl='https://evil.example/macros/s/abc/exec';await assert.rejects(c.api.call('submit',{}),{code:'SETUP'});assert.equal(c.frames.length,0);
});
