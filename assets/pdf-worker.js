/* Pembuat surat Python asli berjalan di Web Worker, tanpa server Python. */
'use strict';
let runtimePromise;
function progress(message){self.postMessage({type:'progress',message});}
async function loadRuntime(config,baseUrl){
  progress('Menyiapkan pembuat surat. Unduhan pertama dapat memerlukan beberapa menit…');
  importScripts(config.pyodideUrl+'pyodide.js');
  const pyodide=await loadPyodide({indexURL:config.pyodideUrl});
  await pyodide.loadPackage(['micropip','pillow']);
  progress('Memuat format PDF asli…');
  const micropip=pyodide.pyimport('micropip');
  try{await micropip.install('reportlab=='+config.reportlabVersion);}finally{micropip.destroy();}
  const [source,logo]=await Promise.all([
    fetch(new URL('assets/pdf_generator.py',baseUrl)).then(r=>{if(!r.ok)throw new Error('Format surat tidak tersedia.');return r.text();}),
    fetch(new URL('assets/logo-upi.png',baseUrl)).then(r=>{if(!r.ok)throw new Error('Logo surat tidak tersedia.');return r.arrayBuffer();})
  ]);
  pyodide.FS.mkdirTree('/surat');
  pyodide.FS.writeFile('/surat/pdf_generator.py',source);
  pyodide.FS.writeFile('/surat/logo-upi.png',new Uint8Array(logo));
  await pyodide.runPythonAsync("import sys\nsys.path.insert(0, '/surat')\nfrom pathlib import Path\nfrom pdf_generator import build_pdf\n");
  return pyodide;
}
self.onmessage=async function(event){
  try{
    const {data,config,baseUrl}=event.data;
    if(!runtimePromise)runtimePromise=loadRuntime(config,baseUrl);
    const pyodide=await runtimePromise;
    progress('Menyusun surat dengan format asli…');
    pyodide.globals.set('surat_payload',JSON.stringify(data));
    await pyodide.runPythonAsync("import json\nbuild_pdf(json.loads(surat_payload), Path('/surat/hasil.pdf'), Path('/surat/logo-upi.png'))\n");
    const bytes=pyodide.FS.readFile('/surat/hasil.pdf');
    pyodide.FS.unlink('/surat/hasil.pdf');
    pyodide.globals.delete('surat_payload');
    self.postMessage({type:'done',bytes:bytes.buffer},[bytes.buffer]);
  }catch(error){runtimePromise=null;self.postMessage({type:'error',message:'PDF belum berhasil dibuat. '+String(error.message||error).slice(0,350)});}
};
