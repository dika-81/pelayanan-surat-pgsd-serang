const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');

function backend(){
  const properties=new Map([['SPREADSHEET_ID','book'],['SERVER_SECRET',crypto.randomBytes(32).toString('hex')],['PASSWORD_SALT','test-salt'],['ADMIN_USERNAME','kaprodi'],['OUTPUT_FOLDER_ID','out'],['ASSET_FOLDER_ID','assets'],['ALLOWED_ORIGINS','https://dika-81.github.io']]);
  const cache=new Map(),files=new Map();let counter=0,rows=[],logs=[],locked=false;
  const sheet={getLastRow:()=>rows.length, getRange:(r,c,h,w)=>({setNumberFormat(){return this;},setValues(values){values.forEach((line,i)=>{rows[r+i-1]=line.slice();});return this;},getValues:()=>Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>rows[r+i-1]?.[c+j-1]??''))}),deleteRow:r=>rows.splice(r-1,1)};
  function blob(bytes,mime,name){return {getBytes:()=>Array.from(Buffer.from(bytes)),getDataAsString:()=>Buffer.from(bytes).toString(),getName:()=>name,mime};}
  const ctx={console,Date,JSON,Error,Math,Number,String,Array,Object,RegExp,Boolean,
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k)||null,setProperty:(k,v)=>properties.set(k,String(v)),deleteProperty:k=>properties.delete(k)})},
    CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},
    LockService:{getScriptLock:()=>({tryLock:()=>{assert.equal(locked,false);locked=true;return true;},releaseLock:()=>{locked=false;}})},
    SpreadsheetApp:{openById:()=>({getSheetByName:name=>name==='Audit'?{appendRow:x=>logs.push(x)}:sheet}),flush:()=>{}},
    Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,value)=>Array.from(crypto.createHash('sha256').update(typeof value==='string'?value:Buffer.from(value)).digest()),computeHmacSha256Signature:(value,key)=>Array.from(crypto.createHmac('sha256',key).update(value).digest()),formatDate:()=> '2026-11-02 10:20:30',base64Encode:v=>Buffer.from(v).toString('base64'),base64Decode:v=>Array.from(Buffer.from(v,'base64')),newBlob:blob},
    DriveApp:{getFolderById:()=>({getFilesByName:name=>{const list=[...files.values()].filter(f=>f.name===name&&!f.trashed);let i=0;return {hasNext:()=>i<list.length,next:()=>list[i++]};},createFile:b=>{const f={id:'file-'+(++counter),name:b.getName(),bytes:b.getBytes(),getId(){return this.id;},getBlob(){return blob(this.bytes,'application/pdf',this.name);},setTrashed(v){this.trashed=v;}};files.set(f.id,f);return f;}}),getFileById:id=>{const f=files.get(id);if(!f)throw new Error('file missing');return f;}}
  };
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../apps-script/Code.gs'),'utf8'),ctx);
  rows.push([...ctx.COLUMNS_]);properties.set('ADMIN_PASSWORD_HASH',ctx.credentialHash_('contoh-password-kuat-123'));properties.set('PIN_HASH',ctx.credentialHash_('824691'));
  const call=(action,data={},token='')=>JSON.parse(JSON.stringify(ctx.api({origin:'https://dika-81.github.io',action,data,token})));
  const login=()=>{const result=call('login',{username:'kaprodi',password:'contoh-password-kuat-123'});assert.equal(result.ok,true);return result.data.token;};
  const input=(extra={})=>({nama:'Mahasiswa Uji',nim:'001234567',semester:'4',jenis_surat:'Surat Aktif Kuliah',keperluan:'Keperluan akademik',submission_key:crypto.randomUUID(),...extra});
  const submit=(extra={})=>{const r=call('submit',input(extra));assert.equal(r.ok,true,JSON.stringify(r));return r.data.tracking_code;};
  return {ctx,call,login,input,submit,properties,cache,files,rows,logs};
}

test('pengajuan tersimpan sekali; retry tidak membuat duplikat dan data berbeda ditolak',()=>{
  const b=backend(),data=b.input();const a=b.call('submit',data),retry=b.call('submit',data);
  assert.equal(a.ok,true);assert.equal(a.data.tracking_code,retry.data.tracking_code);assert.equal(b.rows.length,2);
  assert.equal(b.call('submit',{...data,nama:'Berbeda'}).error.code,'CONFLICT');
  const row=b.call('status',{code:a.data.tracking_code}).data;
  assert.equal(row.nim,'001234567');assert.equal(row.status,'Menunggu');assert.equal('submission_key' in row,false);assert.equal('pending_data' in row,false);
});
test('surat B kelompok deduplikasi dan anggota dapat melihat riwayat; surat A mengabaikan anggota',()=>{
  const b=backend();const code=b.submit({jenis_surat:'Surat B',anggota:[{nama:'Anggota',nim:'009876543',semester:'5'},{nama:'Duplikat',nim:'009876543',semester:'5'}]});
  assert.equal(b.call('status',{code}).data.anggota.length,2);assert.equal(b.call('history',{nim:'009876543'}).data.length,1);
  const a=b.submit({anggota:[{nama:'Tak ikut',nim:'008888888',semester:'5'}]});assert.equal(b.call('status',{code:a}).data.anggota.length,0);
});
test('validasi server menolak data rusak, honeypot, semester, tipe, dan formula aktif',()=>{
  const b=backend();for(const extra of [{nim:'abc'},{semester:'15'},{jenis_surat:'Lainnya'},{website:'bot.example'},{nama:''},{keperluan:'x'.repeat(3001)},{jenis_surat:'Surat B',anggota:Array(30).fill({})}])assert.equal(b.call('submit',b.input(extra)).error.code,'VALIDATION');
  const code=b.submit({nama:'=IMPORTXML("url")'});assert.equal(b.rows[1][2].startsWith("'="),true);assert.equal(b.call('status',{code}).data.nama,'=IMPORTXML("url")');
});
test('operasi admin perlu sesi valid, password/PIN salah gagal, logout membatalkan sesi',()=>{
  const b=backend();assert.equal(b.call('list').error.code,'AUTH_REQUIRED');assert.equal(b.call('login',{username:'kaprodi',password:'salah'}).error.code,'AUTH');
  const token=b.login(),code=b.submit();assert.equal(b.call('list',{},token).data.length,1);
  assert.equal(b.call('prepareSign',{code,nomor_surat:'01/2026',pin:'000000'},token).error.code,'PIN');
  assert.equal(b.call('logout',{},token).ok,true);assert.equal(b.call('list',{},token).error.code,'AUTH_REQUIRED');
});
test('persetujuan baru sah setelah PDF tersimpan; retry menyimpan satu PDF; unduhan utuh',()=>{
  const b=backend(),token=b.login(),code=b.submit();const prepared=b.call('prepareSign',{code,nomor_surat:'01/UPI/2026',pin:'824691'},token);
  assert.equal(prepared.ok,true);assert.equal(b.call('status',{code}).data.status,'Menunggu');assert.equal(b.call('download',{code}).error.code,'NOT_READY');
  const retry=b.call('prepareSign',{code,nomor_surat:'01/UPI/2026',pin:'824691'},token);assert.equal(prepared.data.pending_id,retry.data.pending_id);
  const bytes=Buffer.from('%PDF-1.4\n'+ 'test-pdf-content\n'.repeat(30));const data={code,pending_id:prepared.data.pending_id,pdf:bytes.toString('base64')};
  assert.equal(b.call('completeSign',{...data,pending_id:'forged'},token).error.code,'CONFLICT');
  const result=b.call('completeSign',data,token);assert.equal(result.ok,true);assert.equal(result.data.status,'Ditandatangani');assert.equal(result.data.nomor_surat,'01/UPI/2026');
  assert.equal(b.call('completeSign',data,token).ok,true);assert.equal(b.files.size,1);
  const download=b.call('download',{code});assert.equal(download.data.base64,data.pdf);assert.equal(download.data.sha256,crypto.createHash('sha256').update(bytes).digest('hex'));
  assert.equal(b.call('verify',{code}).data.request.signature_hash,result.data.signature_hash);
  [...b.files.values()][0].bytes=[1,2,3];assert.equal(b.call('download',{code}).error.code,'INTEGRITY');
});
test('PDF salah, persetujuan kedaluwarsa dan persetujuan setelah ditolak ditolak server',()=>{
  const b=backend(),token=b.login(),code=b.submit();const p=b.call('prepareSign',{code,nomor_surat:'01',pin:'824691'},token).data;
  assert.equal(b.call('completeSign',{code,pending_id:p.pending_id,pdf:Buffer.from('invalid'.repeat(30)).toString('base64')},token).error.code,'PDF');
  assert.equal(b.call('prepareSign',{code,nomor_surat:'02',pin:'824691'},token).error.code,'CONFLICT');
  b.rows[1][b.ctx.COLUMNS_.indexOf('pending_expires')]='1';
  assert.equal(b.call('completeSign',{code,pending_id:p.pending_id,pdf:Buffer.from('%PDF-'+ 'x'.repeat(200)).toString('base64')},token).error.code,'CONFLICT');
  assert.equal(b.call('reject',{code},token).ok,true);assert.equal(b.call('prepareSign',{code,nomor_surat:'01',pin:'824691'},token).error.code,'CONFLICT');
});
test('XML input di-escape pada payload PDF dan otorisasi tidak diberikan ke mahasiswa',()=>{
  const b=backend(),token=b.login(),code=b.submit({nama:'<b>Nama & lain</b>',jenis_surat:'Surat B',anggota:[{nama:'A < B',nim:'009876543',semester:'4'}]});
  const p=b.call('prepareSign',{code,nomor_surat:'01 & 02',pin:'824691'},token).data;
  assert.equal(p.data.nama,'&lt;b&gt;Nama &amp; lain&lt;/b&gt;');assert.equal(p.data.anggota[1].nama,'A &lt; B');assert.equal(p.data.tanggal,'2 November 2026');
  const publicRow=b.call('status',{code}).data;assert.equal(publicRow.signature_hash,'');assert.equal('pending_id' in publicRow,false);
});
test('rotasi kredensial membatalkan sesi lama dan fungsi internal tidak terdaftar sebagai API',()=>{
  const b=backend(),token=b.login();b.properties.set('ADMIN_PASSWORD','password-baru-sangat-kuat');b.ctx.rotateCredentials_();assert.equal(b.properties.has('ADMIN_PASSWORD'),false);assert.equal(b.call('list',{},token).error.code,'AUTH_REQUIRED');
  assert.equal(b.call('setupPortal_').error.code,'INVALID');assert.equal(b.call('__proto__').error.code,'INVALID');
  assert.equal(b.ctx.api({origin:'https://evil.example',action:'list',token}).error.code,'ORIGIN');
  assert.equal(b.ctx.api({origin:'https://dika-81.github.io',action:['list'],data:{}}).error.code,'INVALID');
});
test('penghapusan memindahkan PDF ke Sampah dan menghapus pengajuan',()=>{
  const b=backend(),token=b.login(),code=b.submit(),p=b.call('prepareSign',{code,nomor_surat:'01',pin:'824691'},token).data;
  b.call('completeSign',{code,pending_id:p.pending_id,pdf:Buffer.from('%PDF-'+'x'.repeat(200)).toString('base64')},token);
  assert.equal(b.call('remove',{code},token).ok,true);assert.equal([...b.files.values()][0].trashed,true);assert.equal(b.call('status',{code}).error.code,'NOT_FOUND');
});
module.exports={backend};
