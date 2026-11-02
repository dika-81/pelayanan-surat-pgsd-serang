/* Portal Surat PGSD — Google Apps Script V8.
 * Semua fungsi internal berakhiran _ agar tidak dapat dipanggil google.script.run.
 * Rahasia hanya di Script Properties; tidak ada password di repositori.
 */
var COLUMNS_ = ['id','tracking_code','nama','nim','semester','jenis_surat','catatan','anggota','nomor_surat','signed_filename','status','document_hash','signature_hash','signed_by','signed_at','created_at','drive_file_id','pdf_sha256','submission_key','pending_id','pending_data','pending_expires'];
var PEJABAT_ = 'Dr. Andika Arisetyawan, M.Si';
var NIP_ = 'NIP. 198103272005021003';
// Spreadsheet milik pengguna; ID dokumen bukan token akses atau password.
var DEFAULT_SPREADSHEET_ID_ = '1ec-bUYgI15BczrsNces1CQlpxj-CyM-d6r79lu1bcG4';

/** Jalankan sekali dari editor setelah mengisi Script Properties (lihat README). */
function setupPortal_() {
  var p = PropertiesService.getScriptProperties();
  var password = p.getProperty('ADMIN_PASSWORD');
  var pin = p.getProperty('KAPRODI_PIN');
  if (!p.getProperty('ADMIN_PASSWORD_HASH') && (!password || password.length < 16)) throw new Error('Isi ADMIN_PASSWORD minimal 16 karakter di Script Properties.');
  if (!p.getProperty('PIN_HASH') && (!pin || !/^\d{6,12}$/.test(pin))) throw new Error('Isi KAPRODI_PIN dengan 6–12 digit.');
  if (!p.getProperty('ALLOWED_ORIGINS')) throw new Error('Isi ALLOWED_ORIGINS, contoh https://dika-81.github.io');
  // Buka dan validasi spreadsheet lebih dulu. Tidak membuat/memindahkan database.
  var spreadsheetId = p.getProperty('SPREADSHEET_ID') || DEFAULT_SPREADSHEET_ID_;
  var book = SpreadsheetApp.openById(spreadsheetId);
  var sheet = book.getSheetByName('Pengajuan');
  if (sheet && sheet.getLastRow() && sheet.getRange(1,1,1,COLUMNS_.length).getValues()[0].join('|') !== COLUMNS_.join('|')) throw new Error('Header Pengajuan tidak sesuai. Data tidak diubah. Jangan mengubah atau menghapus nama kolom.');
  var root;
  if (p.getProperty('ROOT_FOLDER_ID')) {
    root = DriveApp.getFolderById(p.getProperty('ROOT_FOLDER_ID'));
  } else {
    var parents = DriveApp.getFileById(spreadsheetId).getParents();
    if (!parents.hasNext()) throw new Error('Folder spreadsheet tidak dapat dibaca. Isi ROOT_FOLDER_ID dengan ID folder Drive yang akan menyimpan surat, lalu jalankan pemasangan kembali.');
    root = parents.next();
  }
  p.setProperty('SPREADSHEET_ID', spreadsheetId);
  p.setProperty('ROOT_FOLDER_ID', root.getId());
  setupSubfolder_(p, root, 'OUTPUT_FOLDER_ID', 'Surat Final');
  setupSubfolder_(p, root, 'ASSET_FOLDER_ID', 'Aset Privat');
  if (!p.getProperty('SERVER_SECRET')) p.setProperty('SERVER_SECRET', random_() + random_());
  if (!p.getProperty('PASSWORD_SALT')) p.setProperty('PASSWORD_SALT', random_());
  if (!p.getProperty('ADMIN_USERNAME')) p.setProperty('ADMIN_USERNAME', 'kaprodi');
  if (!p.getProperty('SITE_URL')) p.setProperty('SITE_URL','https://dika-81.github.io/pelayanan-surat-pgsd-serang/');
  if (password) { p.setProperty('ADMIN_PASSWORD_HASH', credentialHash_(password)); p.deleteProperty('ADMIN_PASSWORD'); }
  if (pin) { p.setProperty('PIN_HASH', credentialHash_(pin)); p.deleteProperty('KAPRODI_PIN'); }
  sheet = sheet || book.insertSheet('Pengajuan');
  if (!sheet.getLastRow()) {
    sheet.getRange(1,1,1,COLUMNS_.length).setValues([COLUMNS_]);
    sheet.setFrozenRows(1);
    sheet.getRange(1,1,1,COLUMNS_.length).setFontWeight('bold');
  }
  var log = book.getSheetByName('Audit') || book.insertSheet('Audit');
  if (!log.getLastRow()) { log.appendRow(['waktu','aksi','kode','aktor']); log.setFrozenRows(1); }
  console.log('SIAP. Folder Drive: https://drive.google.com/drive/folders/' + root.getId());
  console.log('Database: ' + book.getUrl());
  console.log('Aset Privat: https://drive.google.com/drive/folders/' + p.getProperty('ASSET_FOLDER_ID'));
  console.log('Unggah spesimen-bertanda-air.png ke Aset Privat jika ingin menampilkan spesimen pada verifikasi.');
}

function setupSubfolder_(p, root, property, name) {
  if (p.getProperty(property)) {
    DriveApp.getFolderById(p.getProperty(property));
    return;
  }
  var matches = root.getFoldersByName(name);
  var folder = matches.hasNext() ? matches.next() : root.createFolder(name);
  p.setProperty(property, folder.getId());
}

/** Mengganti password/PIN: isi nilai baru di Properties, lalu jalankan fungsi ini. */
function rotateCredentials_() {
  var p = PropertiesService.getScriptProperties();
  var pass = p.getProperty('ADMIN_PASSWORD'), pin = p.getProperty('KAPRODI_PIN');
  if (pass && pass.length < 16) throw new Error('Password minimal 16 karakter.');
  if (pin && !/^\d{6,12}$/.test(pin)) throw new Error('PIN harus 6–12 digit.');
  if (pass) { p.setProperty('ADMIN_PASSWORD_HASH', credentialHash_(pass)); p.deleteProperty('ADMIN_PASSWORD'); }
  if (pin) { p.setProperty('PIN_HASH', credentialHash_(pin)); p.deleteProperty('KAPRODI_PIN'); }
  p.setProperty('AUTH_VERSION', random_());
  console.log('Kredensial diperbarui; sesi admin lama tidak berlaku.');
}

function doGet(e) {
  var origin = String(e && e.parameter && e.parameter.origin || '');
  var channel = String(e && e.parameter && e.parameter.channel || '');
  var allowed = allowedOrigins_();
  if (allowed.indexOf(origin) < 0 || !/^[a-zA-Z0-9-]{20,80}$/.test(channel)) return HtmlService.createHtmlOutput('<p>Layanan surat PGSD. Buka portal resmi untuk mengakses layanan ini.</p>');
  var t = HtmlService.createTemplateFromFile('Bridge');
  t.boot = JSON.stringify({origin:origin, channel:channel}).replace(/</g,'\\u003c');
  return t.evaluate().setTitle('Koneksi Layanan Surat').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Satu-satunya RPC untuk browser. Otentikasi tetap diperiksa di server. */
function api(request) {
  try {
    if (!request || typeof request !== 'object' || typeof request.action !== 'string') fail_('INVALID','Permintaan tidak valid.');
    if (JSON.stringify(request).length > 5000000) fail_('LIMIT','Ukuran permintaan terlalu besar.');
    if (allowedOrigins_().indexOf(String(request.origin || '')) < 0) fail_('ORIGIN','Alamat portal belum diizinkan.');
    var data = request.data || {}, user = null;
    var actions = {ping:ping_, submit:submit_, status:status_, history:history_, verify:verify_, download:download_, login:login_, logout:logout_, list:list_, prepareSign:prepareSign_, completeSign:completeSign_, reject:reject_, remove:remove_, specimen:specimen_};
    if (!Object.prototype.hasOwnProperty.call(actions,request.action)) fail_('INVALID','Operasi tidak dikenal.');
    if (['list','prepareSign','completeSign','reject','remove','logout'].indexOf(request.action) >= 0) user = requireAdmin_(request.token);
    var result = actions[request.action](data,user,request.token);
    return {ok:true, data:result};
  } catch (error) {
    if (error.portalCode) return {ok:false,error:{code:error.portalCode,message:error.message}};
    console.error(error.stack || error);
    return {ok:false,error:{code:'SERVER',message:'Layanan Google belum dapat memproses permintaan. Coba lagi; hubungi admin jika berulang.'}};
  }
}

function ping_() { sheet_(); return {ready:true, pejabat:PEJABAT_, nip:NIP_}; }
function props_() { return PropertiesService.getScriptProperties(); }
function random_() { return Utilities.getUuid().replace(/-/g,''); }
function now_() { return Utilities.formatDate(new Date(),'Asia/Jakarta','yyyy-MM-dd HH:mm:ss'); }
function fail_(code,message) { var error = new Error(message); error.portalCode=code; throw error; }
function allowedOrigins_() { return String(props_().getProperty('ALLOWED_ORIGINS') || '').split(',').map(function(s){return s.trim().replace(/\/$/,'');}).filter(Boolean); }
function sheet_() {
  var id = props_().getProperty('SPREADSHEET_ID');
  if (!id) fail_('SETUP','Penyimpanan belum diaktifkan oleh admin.');
  var sheet = SpreadsheetApp.openById(id).getSheetByName('Pengajuan');
  if (!sheet) fail_('SETUP','Database belum disiapkan.');
  return sheet;
}
function sha_(value) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value).map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join(''); }
function hmac_(value) { return Utilities.computeHmacSha256Signature(String(value),props_().getProperty('SERVER_SECRET')).map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join(''); }
function credentialHash_(value) { return hmac_(props_().getProperty('PASSWORD_SALT') + '|' + value); }
function equal_(a,b) { a=String(a||'');b=String(b||'');var difference=a.length^b.length; for(var i=0;i<Math.max(a.length,b.length);i++) difference |= (a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return difference===0; }
function locked_(fn) { var lock=LockService.getScriptLock(); if(!lock.tryLock(20000)) fail_('BUSY','Layanan sedang sibuk. Silakan coba lagi.');try{return fn();}finally{lock.releaseLock();} }
function text_(value,name,max) { var s=String(value==null?'':value).trim(); if(!s || s.length>max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s)) fail_('VALIDATION',name+' wajib diisi dan maksimal '+max+' karakter.'); return s; }
function code_(value) { var s=String(value||'').toUpperCase().trim(); if(!/^[A-F0-9]{10,32}$/.test(s)) fail_('NOT_FOUND','Kode tracking tidak ditemukan.');return s; }
function nim_(value) { var s=text_(value,'NIM',24);if(!/^\d{5,24}$/.test(s)) fail_('VALIDATION','NIM harus berisi 5–24 angka.');return s; }
function semester_(value) { var s=text_(value,'Semester',2);if(!/^\d+$/.test(s)||Number(s)<1||Number(s)>14) fail_('VALIDATION','Semester harus antara 1 dan 14.');return String(Number(s)); }
function safeCell_(value) { var s=String(value==null?'':value);return /^[=+@-]/.test(s)?"'"+s:s; }
function record_(values,index) { var row={_row:index};COLUMNS_.forEach(function(k,i){ var v=values[i]==null?'':String(values[i]);row[k]=/^'[=+@-]/.test(v)?v.slice(1):v; });return row; }
function records_() { var sh=sheet_();if(sh.getLastRow()<2)return [];return sh.getRange(2,1,sh.getLastRow()-1,COLUMNS_.length).getValues().map(function(v,i){return record_(v,i+2);}); }
function find_(code) { var row=records_().filter(function(r){return r.tracking_code===code;})[0];if(!row)fail_('NOT_FOUND','Kode tracking tidak ditemukan.');return row; }
function save_(row) { sheet_().getRange(row._row,1,1,COLUMNS_.length).setNumberFormat('@').setValues([COLUMNS_.map(function(k){return safeCell_(row[k]);})]);SpreadsheetApp.flush(); }
function public_(row) {
  var result={};COLUMNS_.slice(0,16).forEach(function(k){result[k]=row[k]||'';});
  try { result.anggota=JSON.parse(result.anggota||'[]'); } catch (_) { result.anggota=[]; }
  result.pdf_sha256=row.pdf_sha256||'';return result;
}
function audit_(action,code,actor) {
  try { SpreadsheetApp.openById(props_().getProperty('SPREADSHEET_ID')).getSheetByName('Audit').appendRow([now_(),action,code,actor||'mahasiswa']); }catch(e){console.error('Audit: '+e.message);}
}
function throttle_(key,limit,seconds) {
  var cache=CacheService.getScriptCache(), k='rate:'+key, count=Number(cache.get(k)||0);
  if(count>=limit)fail_('RATE_LIMIT','Terlalu banyak percobaan. Silakan tunggu beberapa menit.');
  cache.put(k,String(count+1),seconds);
}

function submit_(d) {
  if(d.website)fail_('VALIDATION','Pengajuan tidak dapat diproses.');
  var nama=text_(d.nama,'Nama mahasiswa',160),nim=nim_(d.nim),semester=semester_(d.semester);
  var jenis=text_(d.jenis_surat,'Jenis surat',80),catatan=text_(d.keperluan,'Keperluan',3000);
  if(['Surat Aktif Kuliah','Surat B'].indexOf(jenis)<0)fail_('VALIDATION','Jenis surat tidak tersedia.');
  var key=text_(d.submission_key,'ID pengajuan',80);if(!/^[a-zA-Z0-9-]{20,80}$/.test(key))fail_('VALIDATION','ID pengajuan tidak valid.');
  var anggota=[];
  if(jenis==='Surat B') {
    if(!Array.isArray(d.anggota||[])||(d.anggota||[]).length>29)fail_('VALIDATION','Maksimal 30 mahasiswa dalam satu surat.');
    anggota=[{nama:nama,nim:nim,semester:semester}];
    (d.anggota||[]).forEach(function(item){if(!item.nama&&!item.nim)return;anggota.push({nama:text_(item.nama,'Nama anggota',160),nim:nim_(item.nim),semester:semester_(item.semester)});});
    var seen={};anggota=anggota.filter(function(x){if(seen[x.nim])return false;seen[x.nim]=true;return true;});
    if(anggota.length<2)anggota=[];
  }
  return locked_(function(){
    var rows=records_(), existing=rows.filter(function(r){return r.submission_key===key;})[0];
    var document=JSON.stringify([nama,nim,semester,jenis,catatan,anggota]);
    if(existing) {
      if(existing.document_hash!==sha_(existing.tracking_code+'|'+document))fail_('CONFLICT','ID pengajuan ini sudah dipakai untuk data berbeda. Muat ulang halaman untuk pengajuan baru.');
      return {tracking_code:existing.tracking_code};
    }
    throttle_('submit:'+sha_(nim),10,3600);
    var code;do{code=random_().slice(0,20).toUpperCase();}while(rows.some(function(r){return r.tracking_code===code;}));
    var row={id:random_(),tracking_code:code,nama:nama,nim:nim,semester:semester,jenis_surat:jenis,catatan:catatan,anggota:JSON.stringify(anggota),status:'Menunggu',document_hash:sha_(code+'|'+document),created_at:now_(),submission_key:key};
    row._row=sheet_().getLastRow()+1;save_(row);audit_('pengajuan',code);return {tracking_code:code};
  });
}
function status_(d) { return public_(find_(code_(d.code))); }
function history_(d) {
  var nim=nim_(d.nim);
  return records_().filter(function(r){if(r.nim===nim)return true;try{return JSON.parse(r.anggota||'[]').some(function(a){return a.nim===nim;});}catch(_){return false;}}).reverse().map(public_);
}
function verify_(d) { var row=find_(code_(d.code));return {request:public_(row),pejabat:PEJABAT_,nip:NIP_}; }
function download_(d) {
  var row=find_(code_(d.code));
  if(row.status!=='Ditandatangani'||!row.drive_file_id)fail_('NOT_READY','Surat final belum tersedia.');
  var blob=DriveApp.getFileById(row.drive_file_id).getBlob(),bytes=blob.getBytes();
  if(row.pdf_sha256&&!equal_(sha_(bytes),row.pdf_sha256))fail_('INTEGRITY','Arsip surat berubah. Hubungi admin sebelum menggunakan dokumen ini.');
  return {filename:row.signed_filename,mime:'application/pdf',base64:Utilities.base64Encode(bytes),sha256:row.pdf_sha256};
}
function login_(d) {
  var username=String(d.username||'').trim(),password=String(d.password||'');
  if(username.length>100||password.length>200)fail_('AUTH','Login gagal.');
  return locked_(function(){
    throttle_('login',30,300);
    if(!equal_(username,props_().getProperty('ADMIN_USERNAME'))||!equal_(credentialHash_(password),props_().getProperty('ADMIN_PASSWORD_HASH')))fail_('AUTH','Username atau password salah.');
    var token=random_()+random_(),expires=Date.now()+7200000;
    CacheService.getScriptCache().put('session:'+sha_(token),JSON.stringify({username:username,expires:expires,version:props_().getProperty('AUTH_VERSION')||''}),7200);
    audit_('login','',username);return {token:token,expires:expires,username:username};
  });
}
function requireAdmin_(token) {
  if(!/^[a-fA-F0-9]{64}$/.test(String(token||'')))fail_('AUTH_REQUIRED','Silakan login kembali.');
  var raw=CacheService.getScriptCache().get('session:'+sha_(token)),s=raw?JSON.parse(raw):null;
  if(!s||s.expires<Date.now()||s.version!==(props_().getProperty('AUTH_VERSION')||''))fail_('AUTH_REQUIRED','Sesi admin berakhir. Silakan login kembali.');
  return s;
}
function logout_(d,user,token) { CacheService.getScriptCache().remove('session:'+sha_(token));return {loggedOut:true}; }
function list_() { return records_().reverse().map(public_); }
function xml_(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function pdfData_(row,nomor,signedAt,hash) {
  var parts=signedAt.slice(0,10).split('-'),months=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  var data={nomor:xml_(nomor),nomor_surat:xml_(nomor),jenis_surat:xml_(row.jenis_surat),layanan:row.jenis_surat==='Surat B'?'surat_b':'surat_a',nama:xml_(row.nama),nim:xml_(row.nim),semester:xml_(row.semester),keperluan:xml_(row.catatan),tanggal:Number(parts[2])+' '+months[Number(parts[1])-1]+' '+parts[0],pejabat:PEJABAT_,nip:NIP_,verifikasi_kode:row.tracking_code,verifikasi_hash:hash,verifikasi_waktu:signedAt};
  data.anggota=JSON.parse(row.anggota||'[]').map(function(x){return {nama:xml_(x.nama),nim:xml_(x.nim),semester:xml_(x.semester)};});return data;
}
function prepareSign_(d,user) {
  return locked_(function(){
    throttle_('pin:'+user.username,20,300);
    if(!equal_(credentialHash_(String(d.pin||'')),props_().getProperty('PIN_HASH')))fail_('PIN','PIN salah.');
    var row=find_(code_(d.code)),nomor=text_(d.nomor_surat,'Nomor surat',140);
    if(row.status!=='Menunggu')fail_('CONFLICT','Pengajuan ini sudah diproses.');
    if(row.pending_id&&Number(row.pending_expires)>Date.now()) {
      var previous=JSON.parse(row.pending_data);
      if(previous.nomor!==xml_(nomor))fail_('CONFLICT','Pembuatan PDF sebelumnya masih berlangsung. Gunakan nomor surat yang sama atau tunggu satu jam.');
      return {pending_id:row.pending_id,data:previous,filename:(previous.layanan==='surat_b'?'surat-b-':'surat-')+row.tracking_code+'.pdf'};
    }
    var signedAt=now_(),hash=hmac_(row.tracking_code+'|'+row.document_hash+'|'+nomor+'|'+PEJABAT_+'|'+signedAt);
    var data=pdfData_(row,nomor,signedAt,hash);
    row.pending_id=random_();row.pending_data=JSON.stringify(data);row.pending_expires=String(Date.now()+3600000);save_(row);
    return {pending_id:row.pending_id,data:data,filename:(data.layanan==='surat_b'?'surat-b-':'surat-')+row.tracking_code+'.pdf'};
  });
}
function completeSign_(d,user) {
  if(typeof d.pdf!=='string'||d.pdf.length>4500000||!/^[A-Za-z0-9+/]+={0,2}$/.test(d.pdf))fail_('PDF','PDF tidak valid atau terlalu besar.');
  var bytes=Utilities.base64Decode(d.pdf);
  if(bytes.length<100||bytes.length>3300000||Utilities.newBlob(bytes.slice(0,5)).getDataAsString()!=='%PDF-')fail_('PDF','Berkas harus berupa PDF yang valid.');
  return locked_(function(){
    var row=find_(code_(d.code)),digest=sha_(bytes);
    if(row.status==='Ditandatangani'&&equal_(row.pdf_sha256,digest))return public_(row);
    if(row.status!=='Menunggu'||!row.pending_id||!equal_(row.pending_id,d.pending_id)||Number(row.pending_expires)<Date.now())fail_('CONFLICT','Otorisasi pembuatan PDF tidak berlaku. Ulangi persetujuan.');
    var data=JSON.parse(row.pending_data),filename=(data.layanan==='surat_b'?'surat-b-':'surat-')+row.tracking_code+'.pdf';
    var folder=DriveApp.getFolderById(props_().getProperty('OUTPUT_FOLDER_ID'));
    // Nama unik + hash membuat retry aman jika penyimpanan Sheets sempat gagal.
    var matches=folder.getFilesByName(filename),file=null;
    while(matches.hasNext()){var candidate=matches.next();if(equal_(sha_(candidate.getBlob().getBytes()),digest)){file=candidate;break;}}
    if(!file) file=folder.createFile(Utilities.newBlob(bytes,'application/pdf',filename));
    row.nomor_surat=data.nomor.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
    row.status='Ditandatangani';row.signed_filename=filename;row.signature_hash=data.verifikasi_hash;row.signed_by=PEJABAT_;row.signed_at=data.verifikasi_waktu;row.drive_file_id=file.getId();row.pdf_sha256=digest;row.pending_id='';row.pending_data='';row.pending_expires='';save_(row);
    audit_('ditandatangani',row.tracking_code,user.username);return public_(row);
  });
}
function reject_(d,user) { return locked_(function(){var row=find_(code_(d.code));if(row.status!=='Menunggu')fail_('CONFLICT','Pengajuan sudah diproses.');row.status='Ditolak';row.pending_id='';row.pending_data='';row.pending_expires='';save_(row);audit_('ditolak',row.tracking_code,user.username);return public_(row);}); }
function remove_(d,user) { return locked_(function(){var row=find_(code_(d.code));if(row.drive_file_id)DriveApp.getFileById(row.drive_file_id).setTrashed(true);sheet_().deleteRow(row._row);audit_('dihapus',row.tracking_code,user.username);return {removed:true};}); }
function specimen_(d) {
  var row=find_(code_(d.code));if(row.status!=='Ditandatangani'||!row.signature_hash)fail_('NOT_READY','Tanda tangan tidak tersedia.');
  var folder=DriveApp.getFolderById(props_().getProperty('ASSET_FOLDER_ID')),files=folder.getFilesByName('spesimen-bertanda-air.png');
  if(!files.hasNext())return {base64:null,pejabat:PEJABAT_,nip:NIP_};
  return {base64:Utilities.base64Encode(files.next().getBlob().getBytes()),pejabat:PEJABAT_,nip:NIP_};
}
