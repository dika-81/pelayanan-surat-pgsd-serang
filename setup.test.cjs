const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');

const spreadsheetId='1ec-bUYgI15BczrsNces1CQlpxj-CyM-d6r79lu1bcG4';
function setupBackend(options={}){
  const properties=new Map([['ADMIN_PASSWORD','password-untuk-uji-setup-123'],['KAPRODI_PIN','824691'],['ALLOWED_ORIGINS','https://dika-81.github.io']]);
  const opened=[],logs=[],sheets=new Map(),folders=new Map(),created=[];
  function iterator(values){let i=0;return {hasNext:()=>i<values.length,next:()=>values[i++]};}
  function makeSheet(rows=[]){
    return {rows,getLastRow(){return this.rows.length;},setFrozenRows(){return this;},
      getRange(r,c,h,w){const owner=this;return {getValues:()=>Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>owner.rows[r+i-1]?.[c+j-1]??'')),setValues:values=>{values.forEach((line,i)=>owner.rows[r+i-1]=[...line]);return this;},setFontWeight(){return this;}};},
      appendRow(values){this.rows.push([...values]);return this;}};
  }
  function makeFolder(id){
    const children=new Map();
    const folder={children,getId:()=>id,getFoldersByName:name=>iterator(children.has(name)?[children.get(name)]:[]),createFolder:name=>{const child=makeFolder(id+'/'+name);children.set(name,child);created.push(name);return child;}};
    folders.set(id,folder);return folder;
  }
  const parent=makeFolder('folder-database'),override=makeFolder('folder-pilihan');
  const unrelated=makeSheet([['Data lama yang harus tetap utuh'],['001234567']]);sheets.set('Sheet1',unrelated);
  if(options.mismatch)sheets.set('Pengajuan',makeSheet([['Header lain'],['Jangan ditimpa']]));
  const book={getSheetByName:name=>sheets.get(name)||null,insertSheet:name=>{assert.equal(sheets.has(name),false);const sheet=makeSheet();sheets.set(name,sheet);return sheet;},getUrl:()=> 'https://docs.google.com/spreadsheets/d/'+spreadsheetId+'/edit'};
  const ctx={Date,Math,JSON,Error,Array,String,Number,Object,RegExp,Boolean,
    console:{log:(...values)=>logs.push(values.join(' ')),error:()=>{}},
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>properties.get(key)||null,setProperty:(key,value)=>properties.set(key,String(value)),deleteProperty:key=>properties.delete(key)})},
    SpreadsheetApp:{openById:id=>{opened.push(id);if(options.noAccess)throw new Error('Không có quyền truy cập');return book;},create:()=>assert.fail('Tidak boleh membuat spreadsheet baru')},
    DriveApp:{getFileById:id=>{assert.equal(id,properties.get('SPREADSHEET_ID')||spreadsheetId);return {getParents:()=>iterator(options.noParent?[]:[parent]),moveTo:()=>assert.fail('Tidak boleh memindahkan spreadsheet')};},getFolderById:id=>{assert.ok(folders.has(id),'Folder harus ada: '+id);return folders.get(id);},createFolder:()=>assert.fail('Tidak boleh membuat folder di luar folder spreadsheet')},
    Utilities:{getUuid:()=>crypto.randomUUID(),computeHmacSha256Signature:(value,key)=>Array.from(crypto.createHmac('sha256',key).update(value).digest())}
  };
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../apps-script/Code.gs'),'utf8'),ctx);
  return {ctx,properties,opened,logs,sheets,folders,created,parent,override,unrelated};
}

test('pemasangan memakai Google Sheet yang diberikan dan folder induknya tanpa membuat database baru',()=>{
  const b=setupBackend();b.ctx.setupPortal_();
  assert.deepEqual(b.opened,[spreadsheetId]);assert.equal(b.properties.get('SPREADSHEET_ID'),spreadsheetId);assert.equal(b.properties.get('ROOT_FOLDER_ID'),'folder-database');
  assert.deepEqual(b.created,['Surat Final','Aset Privat']);assert.deepEqual([...b.sheets.keys()],['Sheet1','Pengajuan','Audit']);
  assert.deepEqual(b.sheets.get('Pengajuan').rows[0],Array.from(b.ctx.COLUMNS_));assert.equal(b.sheets.get('Audit').rows.length,1);
  assert.deepEqual(b.unrelated.rows,[['Data lama yang harus tetap utuh'],['001234567']]);
  assert.equal(b.properties.has('ADMIN_PASSWORD'),false);assert.equal(b.properties.has('KAPRODI_PIN'),false);assert.ok(b.properties.get('ADMIN_PASSWORD_HASH'));
});
test('pemasangan ulang mempertahankan baris pengajuan dan tidak menggandakan tab/folder',()=>{
  const b=setupBackend();b.ctx.setupPortal_();const row=['data pengajuan yang sudah ada'];b.sheets.get('Pengajuan').rows.push(row);b.ctx.setupPortal_();
  assert.deepEqual(b.created,['Surat Final','Aset Privat']);assert.equal(b.sheets.size,3);assert.equal(b.sheets.get('Pengajuan').rows[1],row);assert.equal(b.sheets.get('Audit').rows.length,1);
});
test('subfolder dengan nama yang sama dipakai ulang dan ROOT_FOLDER_ID eksplisit dihormati',()=>{
  const b=setupBackend();const existing=b.override.createFolder('Surat Final');b.created.length=0;
  b.properties.set('ROOT_FOLDER_ID','folder-pilihan');b.properties.set('SPREADSHEET_ID','spreadsheet-pilihan');b.ctx.setupPortal_();
  assert.deepEqual(b.opened,['spreadsheet-pilihan']);assert.equal(b.properties.get('OUTPUT_FOLDER_ID'),existing.getId());assert.deepEqual(b.created,['Aset Privat']);assert.equal(b.parent.children.size,0);
});
test('header tidak sesuai menghentikan pemasangan sebelum mengubah data atau folder',()=>{
  const b=setupBackend({mismatch:true});const before=JSON.stringify([...b.sheets].map(([name,sheet])=>[name,sheet.rows]));
  assert.throws(()=>b.ctx.setupPortal_(),/Header Pengajuan tidak sesuai/);assert.equal(JSON.stringify([...b.sheets].map(([name,sheet])=>[name,sheet.rows])),before);assert.deepEqual(b.created,[]);assert.equal(b.properties.has('ROOT_FOLDER_ID'),false);assert.ok(b.properties.has('ADMIN_PASSWORD'));
});
test('folder yang tidak dapat dibaca meminta ROOT_FOLDER_ID dan tidak membuat lokasi pengganti',()=>{
  const b=setupBackend({noParent:true});assert.throws(()=>b.ctx.setupPortal_(),/ROOT_FOLDER_ID/);assert.equal(b.sheets.size,1);assert.deepEqual(b.created,[]);assert.equal(b.properties.has('SPREADSHEET_ID'),false);
});
test('kegagalan akses spreadsheet tidak membuat tab atau folder baru',()=>{
  const b=setupBackend({noAccess:true});assert.throws(()=>b.ctx.setupPortal_());assert.equal(b.sheets.size,1);assert.deepEqual(b.created,[]);assert.equal(b.properties.has('SPREADSHEET_ID'),false);
});
