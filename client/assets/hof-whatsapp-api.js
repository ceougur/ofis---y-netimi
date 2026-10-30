/*
 * DestekOfis — WhatsApp Business API ile toplu gönderim ekranı (2.4.8 W4; plan docs/erp/WHATSAPP-API-PLANI-2.4.8.md §6 W4, §7a, R1–R3).
 *
 * Cari ekranının WhatsApp penceresinde (hof-whatsapp.js) bağlantı kuruluysa iki yol görünür: "Otomatik (WhatsApp Business API)" (bu dosya) ve
 * "Kendi WhatsApp'ımla (Tek Tek)" (bugünkü wa.me yolu, aynen). Bağlantı hiç kurulmamışsa pencere eskisi gibidir.
 *
 * Otomatik yol: seçilen carilere iki bilgilendirme şablonundan biri — "Ekstre (PDF ile)" (dönemli ekstre PDF'i + kısa ileti) ya da "Ödeme Hatırlatma".
 * Önizleme sunucudan (POST …/batches/preview; Meta'ya yalnız okuma): kaç kişiye gidecek, elenenler ve nedenleri, 24 saatlik sınırdan kalan ve ertesi
 * güne kalacak sayı, tahmini ücret. Bir kez onay ("Aydınlatma metnimi okudum, carilerime ulaştıracağım.") işaretlenmeden "Gönder" pasiftir ve nedeni
 * düğmenin altında görünür yazıyla söylenir; aynı kural sunucuda da (createBatch) vardır. R3: bu dönem daha önce gönderilmiş kişiler sorulur
 * (varsayılan Bunları Çıkar). Başlatınca toplu iş ekranı: sayaçlar, iş satırları (durum etiketleri sunucunun), Duraklat / Devam Et / İptal Et /
 * Başarısızları Yeniden Dene / iş başına "Yine de Gönder" (onaylı). Durum her zaman sunucudan okunur (sayfa yenilense de, iki sekmede de aynı);
 * canlı olay (live:whatsapp.changed) ve süren işte 10 sn'lik yedek yoklama ile tazelenir.
 */
(() => {
  "use strict";
  const HOF = window.HOF;
  if (!HOF) return;
  const esc = value => HOF.esc(value);
  const BASE = "/api/workspace/whatsapp";
  const KIND_TITLES = { statement: "Ekstre (PDF ile)", reminder: "Ödeme Hatırlatma" };
  const PRESETS = [["thisMonth", "Bu Ay"], ["lastMonth", "Geçen Ay"], ["last3", "Son 3 Ay"], ["all", "Tüm Hareketler"]];
  // Sunucunun iş durumları (lib/whatsapp/queue.mjs JOB_STATES) — gösterim sırası. Etiket sunucudan gelir; burada yalnız sıra ve renk.
  const STATE_ORDER = ["pending", "preparing", "sending", "accepted", "sent", "delivered", "read", "limited", "held", "paused", "uncertain", "failed", "expired", "skipped", "canceled", "stopped"];
  const OPEN_STATES = ["pending", "preparing", "sending", "limited", "held", "paused"];
  const TONE = { delivered: "ok", read: "ok", accepted: "info", sent: "info", failed: "error", uncertain: "warn", limited: "warn", held: "warn", paused: "warn", expired: "muted", skipped: "muted", canceled: "muted", stopped: "muted" };
  const UNIT_USD = 0.0009; // yedek; sunucunun stats.unitUsd'si esastır (Meta tarifesi 01.10.2026, Türkiye utility)
  const usd = value => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
  const count = value => Number(value || 0).toLocaleString("tr-TR");
  const when = value => (value ? HOF.formatDateTime(value) : "");
  const day = iso => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
  // Telefonun yalnız son 4 hanesi (ekranda tam numara gerekmez; kişi adıyla ayırt edilir).
  const tail = phone => (phone ? `…${String(phone).replace(/\D/g, "").slice(-4)}` : "—");
  const periodLabel = period => (period?.from ? `${day(period.from)} – ${day(period.to)}` : period?.to ? `Tüm Hareketler (${day(period.to)} tarihine kadar)` : "");

  /** Pencerenin hangi yolu açacağı (sunucu: GET …/sending-status; accounts.view). Hata → null (bugünkü yol). */
  async function status() {
    try {
      return await HOF.api(`${BASE}/sending-status`);
    } catch {
      return null;
    }
  }
  // Otomatik yolu kullanmaya engel olan ilk neden (sıra §7a 29: bağlı değil → yetki → lisans → onay → şablon; burada lisans yetkiden önce söylenir çünkü
  // salt okunurda gönderim yetkisi ekrandan düşer ve asıl neden lisanstır).
  function usageBlock(info) {
    if (!info?.configured) return "WhatsApp Business API bağlantısı yok; yönetici Yönetim → WhatsApp'ta Elle Bağla ile bağlamalı.";
    if (!info.api) return "Bu kurulumda otomatik gönderim çekirdeği çalışmıyor.";
    if (!info.writable) return "Program salt okunur çalışıyor (lisans); WhatsApp ile otomatik gönderim yapılamaz.";
    if (!info.canSend) return "WhatsApp ile otomatik gönderim yetkiniz yok (yetkiyi yönetici verir: WhatsApp ile Otomatik Gönder).";
    if (info.linkBlock) return info.linkBlock;
    return "";
  }
  /** Bağlantı varsa ve şablon son denetimde gönderime hazırsa otomatik yol varsayılandır. */
  const ready = (info, kind) => !usageBlock(info) && Boolean(info.templates?.[kind]?.usable);

  /**
   * Otomatik yol paneli.
   * @param {HTMLElement} root boş kapsayıcı (pencerenin içinde)
   * @param {{ kind: "statement"|"reminder", selection: object, info: object, onDone?: Function, onTitle?: Function }} options
   */
  function mount(root, { kind = "statement", selection = {}, info = null, onDone = null }) {
    const state = { kind, preset: "thisMonth", sendAgain: false, info, preview: null, error: null, loading: false, requestId: HOF.requestId(), view: "compose", batchId: "", batch: null, list: null, busy: false, seq: 0 };
    root.setAttribute("data-nodirty", "");
    let pollTimer = 0;
    let liveTimer = 0;
    const alive = () => document.body.contains(root);
    const can = () => !usageBlock(state.info);

    async function refreshInfo() {
      state.info = (await status()) || state.info;
    }
    async function loadPreview() {
      if (!can()) {
        state.preview = null;
        state.error = null;
        return render();
      }
      const seq = (state.seq += 1);
      state.loading = true;
      render();
      try {
        const answer = await HOF.api(`${BASE}/batches/preview`, { method: "POST", body: { ...selection, kind: state.kind, ...(state.kind === "statement" ? { preset: state.preset } : {}), sendAgain: state.sendAgain } });
        if (seq !== state.seq) return;
        state.preview = answer;
        state.error = null;
      } catch (error) {
        if (seq !== state.seq) return;
        state.preview = null;
        state.error = error;
      }
      state.loading = false;
      if (alive()) render();
    }

    // Gönder'i pasif bırakan ilk neden (görünür yazı). Boş → etkin.
    function sendBlock() {
      const block = usageBlock(state.info);
      if (block) return block;
      if (state.loading) return "Önizleme hazırlanıyor…";
      if (state.error) return state.error.message;
      const p = state.preview;
      if (!p) return "Önizleme alınamadı.";
      if (p.template && !p.template.ok) return p.template.reason;
      if (!p.ack?.acknowledged) return `Gönderim için onay kutusunu işaretleyin: "${p.ack?.text || "Aydınlatma metnimi okudum, carilerime ulaştıracağım."}"`;
      if (p.startBlock) return p.startBlock.message;
      if (!p.sendable) return "Gönderilebilecek kişi yok (seçilenlerin hepsi elendi; nedenler yukarıda).";
      return "";
    }

    function ackBox() {
      const p = state.preview;
      const ack = p?.ack || state.info?.ack;
      if (!ack) return "";
      const admin = Boolean(state.info?.canManage);
      const editable = admin && state.info?.writable && !ack.acknowledged;
      const why = ack.acknowledged
        ? `Onaylandı: ${esc(when(ack.at))}${ack.byName ? ` · ${esc(ack.byName)}` : ""}. Değiştirmek için Yönetim → WhatsApp.`
        : admin
          ? "Onay bu şirket için bir kez verilir; bütün WhatsApp gönderimleri için geçerlidir."
          : "Onayı yalnız yönetici verebilir (Yönetim → WhatsApp); onay verilene dek gönderim başlamaz.";
      const notice = admin ? ' <a href="/admin.html#whatsapp" target="_blank" rel="noopener" data-wa-api-notice>Aydınlatma Metni</a>' : "";
      return `<div class="hof-wa-api-ack${ack.acknowledged ? " is-done" : ""}" data-wa-api-ackbox>
        <label class="hof-check"><input type="checkbox" data-wa-api-ack ${ack.acknowledged ? "checked" : ""} ${editable ? "" : "disabled"}><span>${esc(ack.text)}</span></label>
        <p class="hof-wa-api-note" data-wa-api-ack-why>${why}${notice}</p>
      </div>`;
    }

    function againBox(p) {
      const again = p?.alreadySent;
      if (!again?.count) return "";
      const last = again.last ? ` (son gönderim ${esc(when(again.last))})` : "";
      return `<div class="hof-wa-api-again" data-wa-api-again role="group" aria-label="Daha Önce Gönderilenler">
        <p><b>${count(again.count)} kişiye bu dönem daha önce gönderildi${last}.</b> Aynı ekstre ya da hatırlatma bu kişilere yeniden gitsin mi?</p>
        <label class="hof-check"><input type="radio" name="wa-api-again" value="skip" data-wa-api-again-choice ${state.sendAgain ? "" : "checked"}><span>Bunları Çıkar</span></label>
        <label class="hof-check"><input type="radio" name="wa-api-again" value="send" data-wa-api-again-choice ${state.sendAgain ? "checked" : ""}><span>Yine de Gönder</span></label>
      </div>`;
    }

    function composeView() {
      const p = state.preview;
      const info = state.info || {};
      const block = sendBlock();
      const active = (info.active || []).length;
      const head = `<div class="hof-wa-api-bar">
          <fieldset class="hof-wa-api-kind"><legend>Gönderim Türü</legend>
            ${["statement", "reminder"].map(id => `<label class="hof-check"><input type="radio" name="wa-api-kind" value="${id}" data-wa-api-kind ${state.kind === id ? "checked" : ""}><span>${esc(KIND_TITLES[id])}</span></label>`).join("")}
          </fieldset>
          ${state.kind === "statement" ? `<label class="hof-field"><span>Ekstre Dönemi</span><select data-wa-api-preset>${PRESETS.map(([id, label]) => `<option value="${id}" ${id === state.preset ? "selected" : ""}>${label}</option>`).join("")}</select></label>` : ""}
          ${info.canSend ? `<button type="button" class="hof-button hof-button-ghost hof-button-small" data-wa-api-list>Gönderimler${active ? ` (${active} Süren)` : ""}</button>` : ""}
        </div>`;
      const usage = usageBlock(info);
      if (usage) {
        return `${head}<p class="hof-wa-api-empty" data-wa-api-empty>${esc(usage)}</p>${ackBox()}
          <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-wa-api-close>Vazgeç</button><button type="button" class="hof-button hof-whatsapp" data-wa-api-send disabled>Gönder</button></div>
          <p class="hof-wa-api-why" data-wa-api-why>${esc(usage)}</p>`;
      }
      let body = "";
      if (state.loading && !p) body = '<p class="hof-empty" data-wa-api-loading>Önizleme hazırlanıyor…</p>';
      else if (state.error) body = `<div class="hof-wa-api-error" data-wa-api-error><p>${esc(state.error.message)}</p><button type="button" class="hof-button hof-button-small hof-button-ghost" data-wa-api-retry>Yeniden Dene</button></div>`;
      else if (p) {
        const skippedTotal = Object.values(p.skipped || {}).reduce((sum, n) => sum + n, 0);
        const limit = p.limit || {};
        const unlimited = limit.limit === "unlimited";
        const unit = Number(info.stats?.unitUsd) || UNIT_USD;
        const stats = info.stats;
        const skipList = Object.entries(p.skipped || {}).sort((a, b) => b[1] - a[1]).map(([reason, n]) => `<li data-wa-api-skip="${esc(reason)}"><span>${esc(reason)}</span><b>${count(n)}</b></li>`).join("");
        const people = (p.people || []).map(item => `<tr class="${item.skip ? "is-muted" : ""}" data-wa-api-person="${esc(item.id)}"><td>${esc(item.name || "—")}</td><td>${esc(tail(item.phone))}</td><td>${item.skip ? `<span class="hof-wa-api-tag is-muted">${esc(item.skip)}</span>` : '<span class="hof-wa-api-tag is-ok">Gönderilecek</span>'}${item.sentBefore ? `<small>Daha önce: ${esc(when(item.sentBefore))}</small>` : ""}</td></tr>`).join("");
        body = `
          <div class="hof-wa-head hof-wa-api-counts">
            <div data-wa-api-count="total"><strong>${count(p.total)}</strong><span>Seçilen Cari</span></div>
            <div data-wa-api-count="sendable"><strong>${count(p.sendable)}</strong><span>Gönderilecek</span></div>
            <div data-wa-api-count="skipped" class="${skippedTotal ? "is-warn" : ""}"><strong>${count(skippedTotal)}</strong><span>Elenen</span></div>
            <div data-wa-api-count="later" class="${limit.later ? "is-warn" : ""}"><strong>${count(limit.later)}</strong><span>Ertesi Güne Kalacak</span></div>
          </div>
          <div class="hof-wa-grid">
            <div class="hof-wa-left">
              ${skipList ? `<p class="hof-wa-label">Elenenler ve Nedenleri</p><ul class="hof-wa-api-skips" data-wa-api-skips>${skipList}</ul>` : '<p class="hof-wa-api-note">Seçilenlerden elenen yok.</p>'}
              <div class="hof-wa-list"><table class="hof-table"><thead><tr><th>Cari</th><th>Telefon</th><th>Durum</th></tr></thead><tbody>${people}</tbody></table></div>
            </div>
            <div class="hof-wa-right">
              <p class="hof-wa-label">Gönderim Özeti</p>
              <dl class="hof-wa-api-facts" data-wa-api-facts>
                <div><dt>Şablon</dt><dd>${esc(KIND_TITLES[state.kind])}${p.template?.template?.name ? ` · <code>${esc(p.template.template.name)}</code>` : ""}${p.template?.ok ? " · Onaylı" : ""}</dd></div>
                ${state.kind === "statement" ? `<div><dt>Dönem</dt><dd data-wa-api-period>${esc(periodLabel(p.period))}</dd></div>` : ""}
                <div><dt>24 Saatlik Gönderim Sınırı</dt><dd data-wa-api-limit>${unlimited ? "Sınırsız" : `${count(limit.limit)} farklı kişi (bugün kullanılan ${count(limit.used)}, kalan ${count(limit.left)})`}</dd></div>
                ${limit.later ? `<div class="is-warn"><dt>Ertesi Güne Kalacak</dt><dd data-wa-api-later>${count(limit.later)} kişi sınır nedeniyle bekler; 24 saatlik pencere açılınca kendiliğinden gönderilir.</dd></div>` : ""}
                ${limit.holdUntil ? `<div class="is-warn"><dt>Meta Sınırı Nedeniyle Bekleme</dt><dd>${esc(when(limit.holdUntil))} tarihine kadar</dd></div>` : ""}
                <div><dt>Tahmini Ücret</dt><dd data-wa-api-cost>≈ ${usd(p.sendable * unit)} USD (${count(p.sendable)} ileti × ${usd(unit)} USD; yalnız teslim edilen ileti ücretlidir, Meta faturası esastır)</dd></div>
                <div><dt>Tahmini Süre</dt><dd>${p.seconds > 90 ? `yaklaşık ${Math.ceil(p.seconds / 60)} dakika` : `yaklaşık ${Math.max(1, p.seconds)} saniye`}</dd></div>
                ${stats?.configured ? `<div><dt>Bu Ay Gönderilen İleti Sayısı</dt><dd data-wa-api-month>${count(stats.delivered)} teslim edildi (ücretli ${count(stats.billable)}; yaklaşık ${usd(stats.approxUsd)} USD)</dd></div>` : ""}
              </dl>
              <p class="hof-wa-api-note">İletiler programdan sırayla kendiliğinden gider; pencereyi kapatabilirsiniz. Ücreti Meta, işletmenizin Meta hesabından çeker.</p>
            </div>
          </div>
          ${againBox(p)}`;
      }
      return `${head}${active ? `<p class="hof-wa-api-active" data-wa-api-active>Süren gönderim var (${active}). Durumunu <button type="button" class="hof-link-button" data-wa-api-list>Gönderimler</button> ekranından izleyebilirsiniz.</p>` : ""}${body}${ackBox()}
        <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-wa-api-close>Vazgeç</button><button type="button" class="hof-button hof-whatsapp" data-wa-api-send ${block || state.busy ? "disabled" : ""}>Gönder${p?.sendable ? ` (${count(p.sendable)} Kişi)` : ""}</button></div>
        ${block ? `<p class="hof-wa-api-why" data-wa-api-why>${esc(block)}</p>` : ""}`;
    }

    function batchView() {
      const b = state.batch;
      if (!b) return '<p class="hof-empty">Gönderim yükleniyor…</p>';
      const c = b.counts || {};
      const total = b.total || 0;
      const waiting = OPEN_STATES.reduce((sum, key) => sum + (c[key] || 0), 0);
      const done = Math.max(0, total - waiting);
      const labels = Object.fromEntries((b.jobs || []).map(job => [job.state, job.stateLabel]));
      const chips = STATE_ORDER.filter(key => c[key]).map(key => `<span class="hof-wa-api-tag is-${TONE[key] || "info"}" data-wa-count="${key}">${esc(labels[key] || key)}: <b>${count(c[key])}</b></span>`).join("");
      const offline = b.stateLabel === "Bağlantı Bekleniyor";
      const notes = [
        offline ? `<p class="hof-wa-api-wait" data-wa-api-offline><b>Bağlantı Bekleniyor:</b> Meta'ya ulaşılamıyor (internet bağlantısını denetleyin). İletiler başarısız sayılmaz; bağlantı dönünce kendiliğinden sürer${b.waitingUntil ? ` (sonraki deneme ${esc(when(b.waitingUntil))})` : ""}.</p>` : "",
        c.limited ? `<p class="hof-wa-api-wait" data-wa-api-limited><b>Sınır Nedeniyle Bekliyor:</b> ${count(c.limited)} kişi Meta'nın 24 saatlik gönderim sınırına takıldı; pencere açılınca kendiliğinden gönderilir.</p>` : "",
        c.held ? `<p class="hof-wa-api-wait"><b>Meta Bekletti:</b> ${count(c.held)} kişi 24 saat sonra bir kez yeniden denenecek.</p>` : "",
        c.uncertain ? `<p class="hof-wa-api-wait is-warn" data-wa-api-uncertain><b>Sonucu Belirsiz:</b> ${count(c.uncertain)} iletinin Meta'ya ulaşıp ulaşmadığı bilinmiyor; kendiliğinden yeniden gönderilmez. Satırdaki "Yine de Gönder" ile yeniden gönderebilirsiniz (kişiye iki kez gidebilir).</p>` : "",
        b.state === "paused" && b.pauseReason ? `<p class="hof-wa-api-wait is-warn" data-wa-api-pause><b>Duraklatıldı:</b> ${esc(b.pauseReason)}</p>` : "",
        b.state === "stopped" && b.pauseReason ? `<p class="hof-wa-api-wait is-warn"><b>Durduruldu:</b> ${esc(b.pauseReason)}</p>` : "",
      ].join("");
      const writable = state.info?.writable !== false;
      const rows = (b.jobs || []).map(job => `<tr data-wa-job="${esc(job.id)}" data-wa-job-state="${esc(job.state)}"><td>${esc(job.accountName || "—")}</td><td>${esc(tail(job.phone))}</td><td><span class="hof-wa-api-tag is-${TONE[job.state] || "info"}">${esc(job.stateLabel)}</span></td><td class="hof-wa-api-reason">${esc(job.reason || "")}</td><td>${job.state === "uncertain" && writable ? `<button type="button" class="hof-button hof-button-small hof-button-ghost" data-wa-api-anyway="${esc(job.id)}">Yine de Gönder</button>` : ""}</td></tr>`).join("");
      const actions = [
        b.state === "running" ? '<button type="button" class="hof-button hof-button-ghost" data-wa-api-act="pause">Duraklat</button>' : "",
        b.state === "paused" && writable ? '<button type="button" class="hof-button" data-wa-api-act="resume">Devam Et</button>' : "",
        ["running", "paused"].includes(b.state) ? '<button type="button" class="hof-button hof-button-danger" data-wa-api-act="cancel">İptal Et</button>' : "",
        c.failed && writable ? '<button type="button" class="hof-button hof-button-ghost" data-wa-api-act="retry-failed">Başarısızları Yeniden Dene</button>' : "",
      ].join("");
      return `<div class="hof-wa-api-batch" data-wa-batch="${esc(b.id)}">
        <div class="hof-wa-api-bar"><p class="hof-wa-api-title"><b>${esc(b.kindLabel)}</b>${b.period?.from || b.period?.to ? ` · ${esc(periodLabel(b.period))}` : ""} · ${esc(when(b.createdAt))}${b.createdByName ? ` · ${esc(b.createdByName)}` : ""}</p>
          <span class="hof-wa-api-state is-${b.state}${offline ? " is-offline" : ""}" data-wa-batch-state>${esc(b.stateLabel)}</span>
          <button type="button" class="hof-button hof-button-ghost hof-button-small" data-wa-api-list>Gönderimler</button></div>
        <div class="hof-wa-progress" role="progressbar" aria-label="Gönderim İlerlemesi" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><span style="width:${total ? Math.round((done / total) * 100) : 0}%"></span></div>
        <p class="hof-wa-step" data-wa-api-progress><b>${count(done)} / ${count(total)}</b> işlendi${waiting ? ` · ${count(waiting)} sırada` : ""}</p>
        <div class="hof-wa-api-chips" data-wa-api-chips>${chips}</div>
        ${notes}
        <div class="hof-wa-list hof-wa-api-jobs"><table class="hof-table"><thead><tr><th>Cari</th><th>Telefon</th><th>Durum</th><th>Neden</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
        <div class="hof-actions hof-wa-actions">${actions}<button type="button" class="hof-button hof-button-ghost" data-wa-api-close>Kapat</button></div>
      </div>`;
    }

    function listView() {
      const rows = (state.list || []).map(b => {
        const c = b.counts || {};
        return `<tr data-wa-api-open="${esc(b.id)}" tabindex="0"><td>${esc(when(b.createdAt))}</td><td>${esc(b.kindLabel)}</td><td>${esc(periodLabel(b.period))}</td><td><span class="hof-wa-api-state is-${b.state}">${esc(b.stateLabel)}</span></td><td class="num">${count(b.total)}</td><td class="num">${count((c.delivered || 0) + (c.read || 0))}</td><td class="num">${count(c.failed)}</td></tr>`;
      }).join("");
      return `<div class="hof-wa-api-bar"><p class="hof-wa-api-title"><b>WhatsApp Gönderimleri</b></p><button type="button" class="hof-button hof-button-ghost hof-button-small" data-wa-api-new>Yeni Gönderim</button></div>
        ${state.list === null ? '<p class="hof-empty">Yükleniyor…</p>' : rows ? `<div class="hof-wa-list"><table class="hof-table"><thead><tr><th>Başlangıç</th><th>Tür</th><th>Dönem</th><th>Durum</th><th class="num">Kişi</th><th class="num">Teslim Edildi</th><th class="num">Başarısız</th></tr></thead><tbody data-wa-api-batches>${rows}</tbody></table></div>` : '<p class="hof-empty" data-wa-api-batches-empty>Henüz otomatik gönderim yapılmadı.</p>'}
        <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-wa-api-close>Kapat</button></div>`;
    }

    function render() {
      if (!alive()) return;
      const html = state.view === "batch" ? batchView() : state.view === "list" ? listView() : composeView();
      HOF.swap ? HOF.swap(root, html) : (root.innerHTML = html);
      schedulePoll();
    }

    async function openBatch(id) {
      state.view = "batch";
      state.batchId = id;
      state.batch = null;
      render();
      await loadBatch();
    }
    async function loadBatch() {
      try {
        state.batch = await HOF.api(`${BASE}/batches/${encodeURIComponent(state.batchId)}`, { background: true });
      } catch (error) {
        HOF.toastError(error);
      }
      render();
    }
    async function openList() {
      state.view = "list";
      state.list = null;
      render();
      try {
        state.list = await HOF.api(`${BASE}/batches?limit=30`, { background: true });
      } catch (error) {
        state.list = [];
        HOF.toastError(error);
      }
      render();
    }
    // Süren işte yedek yoklama (canlı olay kaçarsa); bitmiş işte ve pencere kapanınca durur.
    function schedulePoll() {
      clearTimeout(pollTimer);
      if (!alive() || state.view !== "batch" || !state.batch || !["running", "paused"].includes(state.batch.state)) return;
      pollTimer = setTimeout(() => alive() && state.view === "batch" && loadBatch(), 10_000);
    }
    let unsubscribe = null;
    const onLive = () => {
      if (!alive()) return unsubscribe?.();
      clearTimeout(liveTimer);
      liveTimer = setTimeout(() => {
        if (!alive()) return;
        if (state.view === "batch") loadBatch();
        else if (state.view === "list") openList();
        else refreshInfo().then(() => alive() && render());
      }, 400);
    };
    unsubscribe = HOF.on?.("live:whatsapp.changed", onLive) || null;

    async function start() {
      const p = state.preview;
      if (sendBlock() || !p) return;
      const what = state.kind === "statement" ? `dönemli ekstre PDF'i (${periodLabel(p.period)})` : "ödeme hatırlatması";
      const later = p.limit?.later ? ` ${count(p.limit.later)} kişi 24 saatlik sınır nedeniyle ertesi gün gönderilir.` : "";
      const sure = await HOF.confirm({ title: "Gönderim Başlasın mı?", message: `${count(p.sendable)} kişiye WhatsApp ile ${what} gönderilecek.${later} İletiler sırayla kendiliğinden gider.`, confirmLabel: `Gönder (${count(p.sendable)} Kişi)` });
      if (!sure || !alive()) return;
      state.busy = true;
      render();
      try {
        const answer = await HOF.api(`${BASE}/batches`, { method: "POST", body: { ...selection, kind: state.kind, ...(state.kind === "statement" ? { preset: state.preset } : {}), sendAgain: state.sendAgain, requestId: state.requestId } });
        state.requestId = HOF.requestId();
        state.busy = false;
        HOF.toast(answer.reused ? "Bu gönderim zaten başlatılmıştı." : `Gönderim başladı: ${count(answer.summary?.sendable ?? answer.batch.total)} kişi.`, { type: "success" });
        onDone?.({ batchId: answer.batch.id });
        await refreshInfo();
        await openBatch(answer.batch.id);
      } catch (error) {
        state.busy = false;
        HOF.toastError(error);
        await refreshInfo();
        await loadPreview();
      }
    }
    async function act(action) {
      const b = state.batch;
      if (!b) return;
      if (action === "cancel" && !(await HOF.confirm({ title: "Gönderim İptal Edilsin mi?", message: "Henüz gönderilmemiş iletiler gönderilmez; gönderilmiş olanlar geri alınamaz.", confirmLabel: "İptal Et", danger: true }))) return;
      try {
        const answer = await HOF.api(`${BASE}/batches/${encodeURIComponent(b.id)}/${action}`, { method: "POST", body: action === "retry-failed" ? { requestId: HOF.requestId() } : {} });
        if (action === "retry-failed") {
          HOF.toast(`Başarısız iletiler için yeni gönderim başladı (${count(answer.summary?.sendable ?? answer.batch.total)} kişi).`, { type: "success" });
          return openBatch(answer.batch.id);
        }
        state.batch = { ...state.batch, ...answer, jobs: state.batch.jobs };
        await loadBatch();
      } catch (error) {
        HOF.toastError(error);
        await loadBatch();
      }
    }
    async function sendAnyway(jobId) {
      const sure = await HOF.confirm({ title: "Yine de Gönderilsin mi?", message: "Bu iletinin Meta'ya ulaşıp ulaşmadığı bilinmiyor. Yeniden gönderilirse kişiye iki kez gidebilir.", confirmLabel: "Yine de Gönder", danger: true });
      if (!sure) return;
      try {
        const answer = await HOF.api(`${BASE}/jobs/${encodeURIComponent(jobId)}/send-anyway`, { method: "POST", body: { confirm: true, requestId: HOF.requestId() } });
        HOF.toast("İleti yeniden gönderime alındı.", { type: "success" });
        await openBatch(answer.batch.id);
      } catch (error) {
        HOF.toastError(error);
        await loadBatch();
      }
    }
    async function setAck(value) {
      try {
        await HOF.api(`${BASE}/ack`, { method: "PUT", body: { ack: value } });
      } catch (error) {
        HOF.toastError(error);
      }
      await refreshInfo();
      await loadPreview();
    }

    root.addEventListener("change", event => {
      const target = event.target;
      if (target.matches("[data-wa-api-kind]")) {
        state.kind = target.value;
        state.sendAgain = false;
        loadPreview();
      } else if (target.matches("[data-wa-api-preset]")) {
        state.preset = target.value;
        state.sendAgain = false;
        loadPreview();
      } else if (target.matches("[data-wa-api-again-choice]")) {
        state.sendAgain = target.value === "send";
        loadPreview();
      } else if (target.matches("[data-wa-api-ack]")) {
        if (target.checked) setAck(true);
      }
    });
    root.addEventListener("click", event => {
      const target = event.target.closest("button, tr[data-wa-api-open]");
      if (!target || target.disabled) return;
      if (target.matches("[data-wa-api-send]")) start();
      else if (target.matches("[data-wa-api-retry]")) loadPreview();
      else if (target.matches("[data-wa-api-list]")) openList();
      else if (target.matches("[data-wa-api-new]")) {
        state.view = "compose";
        refreshInfo().then(loadPreview);
      } else if (target.matches("[data-wa-api-open]")) openBatch(target.dataset.waApiOpen);
      else if (target.dataset.waApiAct) act(target.dataset.waApiAct);
      else if (target.dataset.waApiAnyway) sendAnyway(target.dataset.waApiAnyway);
    });
    root.addEventListener("keydown", event => {
      const row = event.target.closest?.("tr[data-wa-api-open]");
      if (row && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        openBatch(row.dataset.waApiOpen);
      }
    });
    loadPreview();
    return {
      stop: () => {
        clearTimeout(pollTimer);
        clearTimeout(liveTimer);
        unsubscribe?.();
      },
      openBatch,
      openList,
    };
  }

  HOF.whatsappApi = { status, usageBlock, ready, mount, KIND_TITLES };
})();
