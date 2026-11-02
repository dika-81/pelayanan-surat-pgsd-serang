(function (global) {
  'use strict';
  class PDFGenerator {
    constructor(config) { this.config=config; this.worker=null; this.busy=false; }
    generate(data,onProgress=()=>{}) {
      if(this.busy) return Promise.reject(new Error('Pembuatan PDF lain masih berlangsung.'));
      this.busy=true;
      if(!this.worker) this.worker=new Worker(new URL('assets/pdf-worker.js',document.baseURI));
      return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{this.worker.terminate();this.worker=null;this.busy=false;reject(new Error('Pembuatan PDF terlalu lama. Periksa koneksi internet lalu ulangi dengan nomor surat yang sama.'));},300000);
        const fail=(message)=>{clearTimeout(timer);this.worker?.terminate();this.worker=null;this.busy=false;reject(new Error(message));};
        this.worker.onmessage=(event)=>{
          const msg=event.data;
          if(msg.type==='progress')onProgress(msg.message);
          if(msg.type==='error')fail(msg.message);
          if(msg.type==='done'){clearTimeout(timer);this.busy=false;resolve(new Uint8Array(msg.bytes));}
        };
        this.worker.onerror=()=>fail('Pembuat PDF belum dapat dimuat. Periksa koneksi internet dan coba lagi.');
        this.worker.postMessage({data,config:this.config,baseUrl:new URL('.',document.baseURI).href});
      });
    }
  }
  function bytesToBase64(bytes) { let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary); }
  function base64ToBytes(value) { return Uint8Array.from(atob(value),c=>c.charCodeAt(0)); }
  async function digestBytes(bytes) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join(''); }
  function saveBytes(bytes,filename,mime='application/pdf') {
    const url=URL.createObjectURL(new Blob([bytes],{type:mime}));
    const a=document.createElement('a');a.href=url;a.download=filename;a.hidden=true;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  Object.assign(global,{PDFGenerator,bytesToBase64,base64ToBytes,digestBytes,saveBytes});
})(globalThis);
