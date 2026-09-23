(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const show = (message = '') => {
    document.documentElement.classList.add('hof-auth-required');
    if (document.getElementById('hof-central-login')) return;
    const node = document.createElement('div');
    node.id = 'hof-central-login';
    node.innerHTML = `<div class="hof-central-login-backdrop"><section class="hof-central-login-card"><div class="hof-central-mark">H</div><p class="hof-central-kicker">HUKUK OFİSİ MERKEZİ</p><h1>Ofis hesabınızla giriş yapın</h1><p class="hof-central-help">Bu sunucuya bağlı tüm bilgisayarlar aynı merkezi çalışma alanını kullanır.</p><form><label>Kullanıcı adı<input name="username" autocomplete="username" required autofocus></label><label>Parola<input name="password" type="password" autocomplete="current-password" required></label><p class="hof-central-error" aria-live="polite">${esc(message)}</p><button type="submit">Giriş yap</button></form><small>Sunucu yöneticinizden hesap bilgilerinizi isteyin.</small></section></div>`;
    document.body.appendChild(node);
    node.querySelector('form').onsubmit = async event => {
      event.preventDefault();
      const button = node.querySelector('button'); const error = node.querySelector('.hof-central-error');
      button.disabled = true; button.textContent = 'Giriş yapılıyor…'; error.textContent = '';
      const form = Object.fromEntries(new FormData(event.currentTarget));
      try {
        const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(form) });
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error || 'Giriş yapılamadı.');
        location.reload();
      } catch (e) { error.textContent = e.message; button.disabled = false; button.textContent = 'Giriş yap'; }
    };
  };
  const check = async () => {
    try { const response = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' }); if (!response.ok) show(); }
    catch { show('Merkezi sunucuya ulaşılamadı.'); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', check, { once: true }); else check();
})();
