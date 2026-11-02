/* Interpreter kecil untuk AST template Jinja asli: tanpa eval atau dependensi CDN. */
(function (global) {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const truth = value => Array.isArray(value) ? value.length > 0 : Boolean(value);
  const filters = {
    length: v => v?.length || 0, lower: v => String(v ?? '').toLowerCase(),
    replace: (v,a,b) => String(v ?? '').split(a).join(b), list: v => Array.from(v || []),
    daftar_anggota: v => { if(Array.isArray(v))return v;try{return JSON.parse(v || '[]');}catch(_){return [];} },
    selectattr: (v,key,op,expected) => (v || []).filter(x => op === 'equalto' ? x[key] === expected : truth(x[key])),
    map: (v,options) => (v || []).map(x => x[options.attribute]), join: (v,separator) => (v || []).join(separator)
  };
  function expression(n,s) {
    if(n == null)return null;
    switch(n.type) {
      case 'Const': return n.value;
      case 'Name': return s[n.name];
      case 'Getattr': return expression(n.node,s)?.[n.attr];
      case 'Getitem': return expression(n.node,s)?.[expression(n.arg,s)];
      case 'List': case 'Tuple': return n.items.map(x=>expression(x,s));
      case 'Or': { const a=expression(n.left,s);return truth(a)?a:expression(n.right,s); }
      case 'And': { const a=expression(n.left,s);return truth(a)?expression(n.right,s):a; }
      case 'Not': return !truth(expression(n.node,s));
      case 'CondExpr': return expression(truth(expression(n.test,s))?n.expr1:n.expr2,s);
      case 'Compare': {
        let a=expression(n.expr,s);
        for(const op of n.ops){ const b=expression(op.expr,s);let pass;
          switch(op.op){case 'gt':pass=a>b;break;case 'gteq':pass=a>=b;break;case 'lt':pass=a<b;break;case 'lteq':pass=a<=b;break;case 'eq':pass=a===b;break;case 'ne':pass=a!==b;break;case 'in':pass=b?.includes(a);break;default:throw new Error('Perbandingan template tidak didukung.');}
          if(!pass)return false;a=b;
        }return true;
      }
      case 'Test': if(n.name==='none')return expression(n.node,s)==null;throw new Error('Tes template tidak didukung: '+n.name);
      case 'Filter': {
        const fn=filters[n.name];if(!fn)throw new Error('Filter template tidak didukung: '+n.name);
        const args=n.args.map(x=>expression(x,s));
        if(n.kwargs?.length)args.push(Object.fromEntries(n.kwargs.map(x=>[x.key,expression(x.value,s)])));
        return fn(expression(n.node,s),...args);
      }
      case 'Call': {
        const args=n.args.map(x=>expression(x,s));
        if(n.kwargs?.length)args.push(Object.fromEntries(n.kwargs.map(x=>[x.key,expression(x.value,s)])));
        if(n.node.type==='Getattr')return expression(n.node.node,s)?.[n.node.attr](...args);
        const fn=expression(n.node,s);if(typeof fn!=='function')throw new Error('Fungsi template tidak tersedia.');return fn(...args);
      }
      default: throw new Error('Ekspresi template tidak didukung: '+n.type);
    }
  }
  function assign(target,value,s) {
    if(target.type==='Name')s[target.name]=value;
    else if(target.type==='Tuple')target.items.forEach((n,i)=>assign(n,value[i],s));
    else throw new Error('Penugasan template tidak didukung.');
  }
  function render(nodes,s) {
    let out='';
    for(const n of nodes) {
      switch(n.type) {
        case 'Output': for(const x of n.nodes)out+=x.type==='TemplateData'?x.data:escape(expression(x,s));break;
        case 'Assign': assign(n.target,expression(n.node,s),s);break;
        case 'Block': out+=render(n.body,s);break;
        case 'With': { const local={...s};n.targets.forEach((x,i)=>assign(x,expression(n.values[i],s),local));out+=render(n.body,local);break; }
        case 'If': {
          if(truth(expression(n.test,s)))out+=render(n.body,s);
          else { const match=n.elif_?.find(x=>truth(expression(x.test,s)));out+=render(match?match.body:n.else_,s); }break;
        }
        case 'For': {
          let items=expression(n.iter,s)||[];
          if(n.test)items=items.filter(item=>{const local={...s};assign(n.target,item,local);return truth(expression(n.test,local));});
          if(!items.length)out+=render(n.else_,s);
          else items.forEach((item,i)=>{const local={...s,loop:{index:i+1,index0:i,first:i===0,last:i===items.length-1,length:items.length}};assign(n.target,item,local);out+=render(n.body,local);});break;
        }
        default: throw new Error('Blok template tidak didukung: '+n.type);
      }
    }return out;
  }
  function urlFor(name,options={}) {
    const routes={index:'/',check_status:'/cek-status',student_history:'/riwayat',admin_login:'/admin/login',admin_logout:'/admin/logout',kaprodi:'/kaprodi',submit_request:'/pengajuan'};
    if(name==='static')return 'assets/'+options.filename;
    if(name==='status')return '#/status/'+encodeURIComponent(options.code);
    if(name==='verifikasi')return '#/verifikasi/'+encodeURIComponent(options.code);
    if(name==='download_signed')return '#/unduh/'+encodeURIComponent(options.filename);
    if(name==='sign_request')return '#/kaprodi/sign/'+options.request_id;
    if(name==='reject_request')return '#/kaprodi/reject/'+options.request_id;
    if(name==='delete_request')return '#/kaprodi/delete/'+options.request_id;
    return '#'+(routes[name]||'/');
  }
  function view(name,context={}) {
    const scope={requests:[],request_data:null,nim:'',code:'',pejabat:'',nip:'',specimen_url:'',session:{get:()=>false},url_for:urlFor,get_flashed_messages:()=>[],...context};
    const html=render(global.LEGACY_TEMPLATES[name],scope);
    return {html,title:scope.title||'Layanan Mahasiswa PGSD UPI Kampus Serang'};
  }
  global.SuratViews={view,escape,urlFor};
})(globalThis);
