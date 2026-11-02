(function () {
  'use strict';
  const config=window.SURAT_CONFIG,api=new SuratAPI(config),pdf=new PDFGenerator(config),views=SuratViews;
  const page=document.getElementById('page'),nav=document.getElementById('navigation'),notifications=document.getElementById('notifications');
  let currentRows=[],pageVersion=0,submissionKey=crypto.randomUUID(),noticeTimer,signing=false;
  const pendingPDFs=new Map();
  function notify(message,error=false,persist=false){
    clearTimeout(noticeTimer);notifications.replaceChildren();
    const el=document.createElement('div');el.className='flash'+(error?' online-error':'');el.textContent=message;el.setAttribute('role',error?'alert':'status');notifications.appendChild(el);
    if(!persist)noticeTimer=setTimeout(()=>notifications.replaceChildren(),error?18000:10000);
  }
  function navigation(){
    nav.innerHTML='<a href="#/">Pengajuan Surat</a><a href="#/riwayat">Riwayat Surat</a>'+(api.session?'<a href="#/kaprodi">Dashboard Kaprodi</a><form class="nav-form" action="#/admin/logout" method="post"><button type="submit">Logout</button></form>':'<a href="#/admin/login">Login Admin</a>');
  }
  function show(name,context={}){
    const result=views.view(name,context);page.innerHTML=result.html;document.title=result.title;
    if(name==='index'){
      initOriginalHome();
      const form=document.getElementById('form-pengajuan');
      const trap=document.createElement('label');trap.className='honeypot';trap.setAttribute('aria-hidden','true');trap.innerHTML='Website<input name="website" tabindex="-1" autocomplete="off">';form.appendChild(trap);
      form.elements.nama.maxLength=160;form.elements.nim.maxLength=24;form.elements.keperluan.maxLength=3000;
      if(!config.apiUrl){
        const notice=document.createElement('div');notice.className='online-notice';notice.setAttribute('role','status');notice.textContent='Layanan online sedang disiapkan. Pengajuan dapat dikirim setelah penyimpanan diaktifkan oleh admin.';page.prepend(notice);
        form.querySelector('button[type="submit"]').disabled=true;
      }
    }
    const heading=page.querySelector('h1');if(heading)heading.tabIndex=-1;
  }
  function loading(){page.innerHTML='<section class="panel"><p role="status">Memuat data surat…</p></section>';}
  function errorPanel(error,retry=true){
    page.innerHTML='<section class="panel"><p class="eyebrow">Layanan Surat</p><h1>Data belum dapat ditampilkan</h1><p class="online-error" role="alert">'+views.escape(error.message)+'</p><div class="retry-actions">'+(retry?'<button class="primary" id="retry-page">Coba Lagi</button>':'')+'<a class="secondary" href="#/">Kembali ke Pengajuan</a></div></section>';
    page.querySelector('#retry-page')?.addEventListener('click',()=>route());
  }
  function routePath(){return (location.hash.slice(1)||'/').split('?')[0];}
  async function route(){
    const version=++pageVersion,path=routePath();navigation();
    try{
      if(path==='/'){show('index');return;}
      if(path==='/riwayat'){show('riwayat');return;}
      if(path==='/admin/login'){show('login');return;}
      if(path==='/kaprodi'){
        if(!api.session){location.hash='/admin/login';return;}
        loading();const rows=await api.call('list');if(version!==pageVersion)return;currentRows=rows;show('kaprodi',{requests:rows});return;
      }
      const match=path.match(/^\/(status|verifikasi)\/([a-zA-Z0-9]+)$/);
      if(match){
        const code=match[2].toUpperCase();loading();
        if(match[1]==='status'){
          const row=await api.call('status',{code});if(version!==pageVersion)return;show('status',{request_data:row});
        }else{
          let result;
          try{result=await api.call('verify',{code});}catch(error){if(error.code!=='NOT_FOUND')throw error;result={request:null};}
          if(version!==pageVersion)return;
          // Jangan render src kosong: logo sementara diganti setelah spesimen selesai dimuat.
          show('verifikasi',{request_data:result.request,code,pejabat:result.pejabat,nip:result.nip,specimen_url:'assets/logo-upi-serang.png'});
          if(result.request?.signature_hash){
            const figure=page.querySelector('.specimen'),image=figure?.querySelector('img');
            if(image)image.hidden=true;
            try{
              const specimen=await api.call('specimen',{code});if(version!==pageVersion)return;
              if(specimen.base64&&image){image.src='data:image/png;base64,'+specimen.base64;image.hidden=false;}
              else if(figure){const p=document.createElement('p');p.textContent='Spesimen belum tersedia. Data otorisasi dan surat asli dapat diperiksa di bawah.';figure.prepend(p);}
            }catch(error){if(version===pageVersion)notify('Spesimen belum dapat ditampilkan. '+error.message,true);}
          }
        }return;
      }
      if(path.startsWith('/unduh/')){
        show('index');await downloadFilename(decodeURIComponent(path.slice(7)));return;
      }
      page.innerHTML='<section class="panel"><h1>Halaman Tidak Ditemukan</h1><a class="primary" href="#/">Kembali ke Pengajuan</a></section>';
    }catch(error){if(version!==pageVersion)return;if(error.code==='AUTH_REQUIRED'){location.hash='/admin/login';notify(error.message,true);}else errorPanel(error);}
  }
  function busy(form,enabled){form.querySelectorAll('button,input,textarea,select').forEach(el=>{el.disabled=enabled;});form.setAttribute('aria-busy',String(enabled));}
  async function submit(form){
    const values=new FormData(form);
    const data=Object.fromEntries(values);data.submission_key=submissionKey;
    const names=values.getAll('anggota_nama'),nims=values.getAll('anggota_nim'),semesters=values.getAll('anggota_semester');
    data.anggota=names.map((nama,i)=>({nama,nim:nims[i]||'',semester:semesters[i]||''}));
    busy(form,true);notify('Menyimpan pengajuan…',false,true);
    try{
      const result=await api.call('submit',data);submissionKey=crypto.randomUUID();
      // Perubahan halaman selama request tidak boleh menghapus halaman yang baru dibuka.
      if(!form.isConnected){notify('Pengajuan tersimpan. Kode Tracking: '+result.tracking_code,false,true);return;}
      show('index');
      const box=document.createElement('div');box.className='tracking-code-box';box.setAttribute('role','status');
      box.append('Kode Tracking: ');const code=document.createElement('strong');code.textContent=result.tracking_code;box.append(code,' ');
      const link=document.createElement('a');link.href='#/status/'+result.tracking_code;link.textContent='Lihat Status Pengajuan';box.append(link);
      page.querySelector('.hero').after(box);notify('Pengajuan berhasil disimpan. Simpan kode tracking Anda.');box.scrollIntoView({behavior:'smooth',block:'center'});
    }finally{if(form.isConnected)busy(form,false);}
  }
  async function history(form){
    const nim=new FormData(form).get('nim'),version=pageVersion;busy(form,true);
    try{const rows=await api.call('history',{nim});if(version!==pageVersion)return;show('riwayat',{nim,requests:rows});}finally{if(form.isConnected)busy(form,false);}
  }
  async function login(form){
    const data=new FormData(form),username=data.get('username'),password=data.get('password');busy(form,true);
    try{await api.login(username,password);form.reset();navigation();location.hash='/kaprodi';notify('Login berhasil.');}finally{if(form.isConnected)busy(form,false);}
  }
  async function sign(form,row){
    if(signing)throw new Error('Pembuatan surat lain masih berlangsung. Tunggu sampai selesai.');
    const data=new FormData(form);signing=true;busy(form,true);
    try{
      notify('Memeriksa otorisasi tanda tangan…',false,true);
      const prepared=await api.call('prepareSign',{code:row.tracking_code,nomor_surat:data.get('nomor_surat'),pin:data.get('pin')});
      form.elements.pin.value='';
      let cached=pendingPDFs.get(row.tracking_code);
      if(!cached||cached.pending_id!==prepared.pending_id){
        const bytes=await pdf.generate(prepared.data,message=>notify(message,false,true));
        cached={pending_id:prepared.pending_id,pdf:bytesToBase64(bytes)};pendingPDFs.set(row.tracking_code,cached);
      }
      notify('Menyimpan surat final ke Google Drive…',false,true);
      const signed=await api.call('completeSign',{code:row.tracking_code,...cached},120000);
      pendingPDFs.delete(row.tracking_code);
      currentRows=currentRows.map(r=>r.tracking_code===signed.tracking_code?signed:r);
      if(routePath()==='/kaprodi')show('kaprodi',{requests:currentRows});
      notify('Surat berhasil dibuat dan disimpan di Google Drive.');
    }finally{signing=false;if(form.isConnected)busy(form,false);}
  }
  async function processAdmin(form,action,id){
    const row=currentRows.find(r=>String(r.id)===id);if(!row)throw new Error('Data pengajuan berubah. Muat ulang dashboard.');
    if(action==='sign')return sign(form,row);
    if(signing)throw new Error('Tunggu pembuatan surat selesai sebelum mengubah pengajuan.');
    const removing=action==='delete';
    if(!confirm(removing?'Hapus pengajuan ini dan pindahkan PDF ke Sampah Drive?':'Tolak pengajuan surat ini?'))return;
    busy(form,true);
    try{await api.call(removing?'remove':'reject',{code:row.tracking_code});await route();notify(removing?'Riwayat pengajuan dihapus.':'Pengajuan ditolak.');}finally{if(form.isConnected)busy(form,false);}
  }
  async function downloadFilename(filename){
    const match=filename.match(/^surat(?:-b)?-([a-fA-F0-9]{10,32})\.pdf$/);if(!match)throw new Error('Nama surat tidak valid.');
    notify('Mengambil surat asli dari Google Drive…',false,true);
    const result=await api.call('download',{code:match[1]});const bytes=base64ToBytes(result.base64);
    if(result.sha256&&(await digestBytes(bytes))!==result.sha256)throw new Error('Unduhan tidak lengkap. Silakan coba lagi.');
    saveBytes(bytes,result.filename);notify('Surat final siap diunduh.');
  }
  document.addEventListener('submit',async event=>{
    const form=event.target;if(!(form instanceof HTMLFormElement))return;event.preventDefault();
    if(form.getAttribute('aria-busy')==='true')return;
    const action=form.getAttribute('action')||'';
    try{
      if(action==='#/admin/logout'){await api.logout();navigation();location.hash='/';notify('Logout berhasil.');return;}
      if(action==='#/pengajuan')return await submit(form);
      if(action==='#/cek-status'){const code=String(new FormData(form).get('tracking_code')||'').trim().toUpperCase();if(!/^[A-F0-9]{10,32}$/.test(code))throw new Error('Masukkan kode tracking yang valid.');location.hash='/status/'+code;return;}
      if(action==='#/riwayat')return await history(form);
      if(routePath()==='/admin/login')return await login(form);
      const admin=action.match(/^#\/kaprodi\/(sign|reject|delete)\/([a-zA-Z0-9]+)$/);if(admin)return await processAdmin(form,admin[1],admin[2]);
    }catch(error){notify(error.message,true,true);if(error.code==='AUTH_REQUIRED'){navigation();location.hash='/admin/login';}}
  });
  document.addEventListener('click',async event=>{
    const link=event.target.closest('a[href^="#/unduh/"]');if(!link)return;event.preventDefault();if(link.getAttribute('aria-busy')==='true')return;
    link.setAttribute('aria-busy','true');try{await downloadFilename(decodeURIComponent(link.getAttribute('href').slice(8)));}catch(error){notify(error.message,true,true);}finally{link.removeAttribute('aria-busy');}
  });
  // Hapus konfirmasi inline lama: konfirmasi dilakukan setelah status/sesi diperiksa.
  const observer=new MutationObserver(()=>page.querySelectorAll('[onsubmit]').forEach(el=>el.removeAttribute('onsubmit')));observer.observe(page,{childList:true,subtree:true});
  window.addEventListener('hashchange',()=>{window.scrollTo(0,0);route();});
  window.addEventListener('surat:session',navigation);
  window.addEventListener('beforeunload',event=>{if(signing){event.preventDefault();event.returnValue='';}});
  route();
})();
