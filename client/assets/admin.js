(() => {
  const $ = selector => document.querySelector(selector);
  const notice = (message, error = false) => { const node = $('#notice'); node.hidden = false; node.textContent = message; node.className = `notice${error ? ' error' : ''}`; };
  const api = async (url, options = {}) => { const response = await fetch(url, { credentials: 'same-origin', ...options }); const payload = await response.json(); if (!response.ok || !payload.ok) throw new Error(payload.error || 'İşlem tamamlanamadı.'); return payload.data; };
  const formData = form => Object.fromEntries(new FormData(form));
  const renderUsers = users => { $('#users').innerHTML = users.map(user => `<tr><td>${escapeHtml(user.name)}</td><td>${escapeHtml(user.username)}</td><td>${escapeHtml(user.role)}</td><td>${user.active ? 'Aktif' : 'Pasif'}</td><td>${user.username === 'admin' ? 'Ana yönetici' : `<button data-id="${user.id}" data-active="${user.active ? 'false' : 'true'}">${user.active ? 'Pasifleştir' : 'Aktifleştir'}</button>`}</td></tr>`).join(''); document.querySelectorAll('[data-id]').forEach(button => { button.onclick = async () => { try { await api(`/api/admin/users/${button.dataset.id}`, { method: 'PATCH', headers: {'content-type':'application/json'}, body: JSON.stringify({ active: button.dataset.active === 'true' }) }); notice('Kullanıcı durumu güncellendi.'); loadUsers(); } catch (error) { notice(error.message, true); } }; }); };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const loadUsers = async () => { try { renderUsers(await api('/api/admin/users')); } catch (error) { notice(error.message, true); } };
  const boot = async () => { try { await api('/api/auth/me'); $('#app').hidden = false; loadUsers(); } catch { $('#login-card').hidden = false; } };
  $('#login-form').onsubmit = async event => { event.preventDefault(); try { await api('/api/auth/login', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(formData(event.currentTarget)) }); $('#login-card').hidden = true; $('#app').hidden = false; loadUsers(); notice('Yönetici girişi başarılı.'); } catch(error) { notice(error.message, true); } };
  $('#user-form').onsubmit = async event => { event.preventDefault(); try { await api('/api/admin/users', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(formData(event.currentTarget)) }); event.currentTarget.reset(); notice('Kullanıcı oluşturuldu.'); loadUsers(); } catch(error) { notice(error.message, true); } };
  $('#password-form').onsubmit = async event => { event.preventDefault(); try { await api('/api/auth/change-password', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(formData(event.currentTarget)) }); event.currentTarget.reset(); notice('Parolanız değiştirildi.'); } catch(error) { notice(error.message, true); } };
  $('#refresh').onclick = loadUsers;
  boot();
})();
