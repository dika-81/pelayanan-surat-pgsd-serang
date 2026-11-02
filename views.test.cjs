const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ctx={};ctx.window=ctx;vm.createContext(ctx);
for(const name of ['legacy-templates.js','views.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../docs/assets',name),'utf8'),ctx);
const view=ctx.window.SuratViews.view;
const row={id:'abc123',tracking_code:'0123456789ABCDEF0123',nama:'Siti & Budi <Uji>',nim:'001234567',semester:'4',jenis_surat:'Surat B',catatan:'SD Negeri 1 Serang',anggota:[{nama:'Siti & Budi <Uji>',nim:'001234567',semester:'4'},{nama:'Dewi',nim:'009876543',semester:'5'}],nomor_surat:'01/UPI/2026',signed_filename:'surat-b-0123456789ABCDEF0123.pdf',status:'Ditandatangani',document_hash:'a'.repeat(64),signature_hash:'b'.repeat(64),signed_by:'Dr. Andika Arisetyawan, M.Si',signed_at:'2026-11-02 10:20:30',created_at:'2026-11-01 09:10:20'};
test('semua template asli dapat dirender, termasuk halaman kosong dan surat kelompok',()=>{
  const cases=[['index',{}],['login',{}],['kaprodi',{requests:[]}],['kaprodi',{requests:[row,{...row,id:'b',status:'Menunggu',signed_filename:''},{...row,id:'c',status:'Ditolak',signed_filename:''}]}],['riwayat',{}],['riwayat',{nim:row.nim,requests:[row]}],['riwayat',{nim:row.nim,requests:[]}],['status',{request_data:row}],['status',{request_data:{...row,anggota:[],signature_hash:'',signed_filename:'',signed_at:''}}],['verifikasi',{request_data:null,code:row.tracking_code}],['verifikasi',{request_data:{...row,signature_hash:''},code:row.tracking_code}],['verifikasi',{request_data:row,code:row.tracking_code,pejabat:row.signed_by,nip:'NIP. 198103272005021003',specimen_url:'data:image/png;base64,test'}]];
  for(const [name,context] of cases){const rendered=view(name,context);assert.ok(rendered.html.length>100,name);assert.ok(rendered.title.length);assert.equal(/\{%|\{\{/.test(rendered.html),false,name);}
});
test('render meng-escape data mahasiswa tanpa mengubah struktur tampilan',()=>{
  const html=view('status',{request_data:row}).html;assert.ok(html.includes('Siti &amp; Budi &lt;Uji&gt;'));assert.ok(html.includes('Daftar Mahasiswa Pemohon (2 orang)'));assert.ok(html.includes('#/unduh/surat-b-'));assert.equal(html.includes('Siti & Budi <Uji>'),false);
});
test('dashboard menghitung status dan mempertahankan form PIN serta tombol unduhan',()=>{
  const html=view('kaprodi',{requests:[row,{...row,status:'Menunggu',signed_filename:''}]}).html;assert.ok(html.includes('2 pengajuan'));assert.ok(html.includes('name="pin"'));assert.ok(html.includes('#/kaprodi/sign/abc123'));assert.ok(html.includes('#/kaprodi/delete/abc123'));
});
test('template di browser sama dengan hasil Jinja Python untuk seluruh skenario', {skip:!fs.existsSync(path.join(__dirname,'fixtures/template-parity.json'))},()=>{
  const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/template-parity.json'),'utf8'));
  const normalize=s=>s.replace(/\s+/g,' ').trim();
  for(const fixture of fixtures)assert.equal(normalize(view(fixture.name,fixture.context).html),normalize(fixture.expected),fixture.name+' '+fixture.case);
});
