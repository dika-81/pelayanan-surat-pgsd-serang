(function (global) {
  'use strict';
  class PortalError extends Error {
    constructor(code, message) { super(message); this.name = 'PortalError'; this.code = code; }
  }
  class SuratAPI {
    constructor(config) {
      this.config = config;
      this.channel = crypto.randomUUID();
      this.pending = new Map();
      this.peer = null;
      this.connection = null;
      this.frame = null;
      this.session = null;
      try { this.session = JSON.parse(sessionStorage.getItem('surat:session') || 'null'); } catch (_) { /* Penyimpanan dibatasi browser. */ }
      if (this.session && this.session.expires < Date.now()) this.setSession(null);
      this.onMessage = this.onMessage.bind(this);
      global.addEventListener('message', this.onMessage);
    }
    setSession(session) {
      this.session = session;
      try { if (session) sessionStorage.setItem('surat:session', JSON.stringify(session)); else sessionStorage.removeItem('surat:session'); } catch (_) { /* Sesi tetap bekerja selama tab terbuka. */ }
    }
    connect() {
      if (this.connection) return this.connection;
      let endpoint;
      try { endpoint = new URL(this.config.apiUrl); } catch (_) { return Promise.reject(new PortalError('SETUP','Layanan penyimpanan belum diaktifkan. Silakan hubungi admin.')); }
      if (endpoint.origin !== 'https://script.google.com' || !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint.pathname)) return Promise.reject(new PortalError('SETUP','Alamat layanan belum sesuai. Hubungi admin.'));
      this.connection = new Promise((resolve, reject) => {
        this.ready = resolve;
        this.connectionTimer = setTimeout(() => {
          this.frame?.remove(); this.frame = null; this.peer = null; this.connection = null;
          reject(new PortalError('NETWORK','Belum tersambung ke layanan Google. Coba lagi; admin perlu memastikan akses web app diatur untuk Anyone.'));
        }, 45000);
        endpoint.searchParams.set('origin', location.origin);
        endpoint.searchParams.set('channel', this.channel);
        this.frame = document.createElement('iframe');
        this.frame.hidden = true;
        this.frame.title = 'Koneksi aman ke layanan surat';
        this.frame.referrerPolicy = 'no-referrer';
        this.frame.src = endpoint.href;
        document.body.appendChild(this.frame);
      });
      return this.connection;
    }
    onMessage(event) {
      let origin;
      try { origin = new URL(event.origin); } catch (_) { return; }
      if (origin.protocol !== 'https:' || !(origin.hostname === 'script.google.com' || origin.hostname === 'script.googleusercontent.com' || origin.hostname.endsWith('.googleusercontent.com'))) return;
      const msg = event.data;
      if (!msg || msg.channel !== this.channel || !event.source) return;
      if (msg.type === 'surat:ready' && !this.peer && this.frame) {
        this.peer = event.source; this.peerOrigin = event.origin;
        clearTimeout(this.connectionTimer); this.ready(); return;
      }
      if (event.source !== this.peer || event.origin !== this.peerOrigin || msg.type !== 'surat:response') return;
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      clearTimeout(pending.timer); this.pending.delete(msg.id);
      if (msg.result?.ok) pending.resolve(msg.result.data);
      else {
        const error = msg.result?.error || {};
        if (error.code === 'AUTH_REQUIRED') { this.setSession(null); global.dispatchEvent(new Event('surat:session')); }
        pending.reject(new PortalError(error.code || 'SERVER', error.message || 'Permintaan belum dapat diproses.'));
      }
    }
    async call(action, data = {}, timeout = 90000) {
      await this.connect();
      return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        const timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new PortalError('TIMEOUT','Waktu tunggu habis. Periksa status sebelum mengulangi; permintaan mungkin sudah tersimpan.'));
        }, timeout);
        this.pending.set(id, {resolve, reject, timer});
        this.peer.postMessage({type:'surat:request',channel:this.channel,id,action,data,token:this.session?.token || ''}, this.peerOrigin);
      });
    }
    async login(username, password) { const session = await this.call('login', {username,password}); this.setSession(session); return session; }
    async logout() { try { await this.call('logout'); } finally { this.setSession(null); } }
  }
  global.PortalError = PortalError;
  global.SuratAPI = SuratAPI;
})(globalThis);
