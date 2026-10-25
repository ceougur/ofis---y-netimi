/* DestekOfis — Maliyet Hesap Kartı (2.4.6 madde 4). Stok penceresinden açılır; giriş YALNIZ şirketin sektörü "Duşakabin Üretimi" iken görünür
 * (GET /api/maliyet/durum → acik; kullanıcı kararı 25.10.2026) ve kişide "Maliyet Hesap Kartı Görüntüleme" (maliyet.view) yetkisi varken; kart
 * hiçbir yere bağlı değildir (stok, cari, kasa, fatura, defter).
 *
 * HESAP SUNUCUDADIR (tek hesap yeri, server/lib/maliyet/hesap.mjs): bu dosya hiçbir tutarı hesaplamaz. Her düzenleme pencerenin taslağına yazılır ve
 * POST /api/maliyet/onizle'ye gönderilir (hiçbir şey yazılmaz); ekrandaki her hesaplanmış değer o yanıttan gelir. Ön izleme reddederse (ör. K1
 * "Bölen 0 olamaz.") değişiklik taslağa girmez, alan önceki değerine döner ve ileti kartın altında yazar. Kaydet = PUT /api/maliyet (pencere başına tek
 * Kaydet; kart ve sekme sürümleriyle — başka biri arada kaydettiyse 409, hangi kart olduğu yazar, taslak ekranda kalır).
 *
 * Kaydedilmemiş değişiklik: ön izlemenin "degisti" işareti (değeri yazıp geri alınca soru YOK) + sekme adları. Çık / Esc / × / Geri tuşu / pencere dışı
 * → değişiklik varsa "Kaydedilmemiş Değişiklik" sorusu (Forma Dön · Kaydetmeden Kapat · Kaydet; programın ortak sorusuyla aynı başlık ve düğme
 * işaretleri), yoksa sorusuz kapanır. Alanlar çekirdeğin taslak izleyicisine girmez (data-nodirty); kirlilik bu dosyanın taslağıdır.
 *
 * Sayı girişi Türkçe: "12,5", "1.250,75" (nokta binlik); boş = değer yok. Gösterim tr-TR (binlik ayırıcı); hesaplanan tutar iki basamak (kuruş
 * yuvarlaması YALNIZ gösterimde — ham değer data-deger'de, sunucunun döndürdüğü gibi). Yetki: görüntüleme maliyet.view, düzenleme maliyet.manage
 * (varsayılan yalnız yönetici; canManage false → salt okunur: girdi, ✎, satır ekle / sil ve Kaydet yok).
 *
 * Test kancaları (yalnız okunur nitelikler): pencere kökü [data-maliyet] data-bekleyen (sırada ya da yolda ön izleme), data-duzenleme (biten
 * düzenleme sayısı) + data-duzenleme-sonuc / data-duzenleme-neden, data-kayit + data-kayit-sonuc / data-kayit-neden, data-kirli. Her değer
 * data-deger'de JSON (null / sayı / metin). */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const API = "/api/maliyet";
  const TITLE = "Maliyet Hesap Kartı";

  // ---------- Sayı ----------
  const SAYI = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 15 });
  const TUTAR = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const KILO = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 });
  const girdiYazi = value => (typeof value === "number" && Number.isFinite(value) ? SAYI.format(value) : value === null || value === undefined ? "" : String(value));
  const tutarYazi = value => (typeof value === "number" && Number.isFinite(value) ? TUTAR.format(value) : "—");
  const kiloYazi = value => (typeof value === "number" && Number.isFinite(value) ? KILO.format(value) : "—");
  /** Türkçe sayı: "12,5" → 12.5; "1.250,75" → 1250.75; "1.250" → 1250 (nokta binlik); "12.5" → 12.5. Boş → null. Sayı değilse metin döner (sunucu iletisiyle reddeder). */
  const sayiOku = text => {
    const raw = String(text ?? "").trim().replace(/\s+/g, "");
    if (!raw) return null;
    let t = raw;
    if (/^[+-]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
    else if (/^[+-]?(\d+(,\d+)?|,\d+)$/.test(t)) t = t.replace(",", ".");
    else if (!/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(t)) return raw;
    const value = Number(t);
    return Number.isFinite(value) ? value : raw;
  };
  const json = value => esc(JSON.stringify(value === undefined ? null : value));
  const adNormal = text => String(text ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();

  // ---------- Durum (giriş görünürlüğü) ----------
  let durum = null;
  let durumIstek = null;
  async function refresh() {
    const once = Boolean(durum?.acik);
    if (!HOF.can?.("maliyet.view")) durum = null;
    else {
      const istek = (durumIstek = HOF.api(`${API}/durum`, { background: true }).catch(() => null));
      const sonuc = await istek;
      if (istek !== durumIstek) return durum;
      durum = sonuc;
    }
    if (once !== Boolean(durum?.acik)) HOF.emit("maliyet-durum", durum);
    return durum;
  }

  // ---------- Pencere ----------
  let st = null;
  const kok = () => st?.modal?.dialog.querySelector("[data-maliyet]");
  const kirli = () => Boolean(st) && (st.degisti || [...st.sekmeAd.entries()].some(([kod, ad]) => adNormal(ad) !== (st.data.sekmeler.find(sekme => sekme.kod === kod)?.ad ?? "")));
  const isaretle = () => {
    const root = kok();
    if (!root || !st) return;
    root.dataset.bekleyen = String(st.bekleyen);
    root.dataset.kirli = kirli() ? "1" : "0";
  };

  /** Kayıtlı görünümden programın kabul ettiği kart gövdesi (taslağın başlangıcı). */
  function kartGovdesi(kod) {
    const kart = st.data.kartlar[kod];
    if (kart.tur === "zincir") {
      return {
        kod,
        rev: kart.rev,
        ad: kart.ad,
        satirlar: kart.satirlar.map(({ id, ad, birim, miktar, fiyat }) => ({ id, ad, birim, miktar, fiyat })),
        adimlar: kart.adimlar.map(adim => ({ kod: adim.kod, etiket: adim.etiket, ...(adim.kod === "yuzde" || adim.kod === "yuzde_ekle" ? { oran: adim.oran } : adim.kod === "bolme" ? { bolen: adim.bolen } : adim.kod === "cm_elle" ? { deger: adim.deger } : {}) })),
      };
    }
    if (kart.tur === "gramaj") {
      return {
        kod,
        rev: kart.rev,
        ad: kart.ad,
        sutunlar: {},
        satirlar: kart.satirlar.map(satir => ({ id: satir.id, parca: satir.parca, cins: satir.cins, giden_mt: satir.giden_mt, boy: satir.boy, br_gramaj: satir.br_gramaj, alis_ft: satir.alis_ft, ...(satir.elle_kg ? { giden_kg: satir.giden_kg_girdi ?? null } : {}) })),
      };
    }
    if (kart.tur === "matris") return { kod, rev: kart.rev, ad: kart.ad, sutunlar: {}, olculer: {}, hucreler: {} };
    return { kod, rev: kart.rev, ad: kart.ad, sutunlar: {}, satirlar: kart.satirlar.map(({ id, ad, degerler }) => ({ id, ad, degerler: [...degerler] })) };
  }
  const taslakKart = kod => structuredClone(st.taslak.get(kod) || kartGovdesi(kod));
  const govde = (taslak = st.taslak, sekmeAd = st.sekmeAd) => ({
    kartlar: [...taslak.values()],
    sekmeler: [...sekmeAd.entries()].map(([kod, ad]) => ({ kod, ad, rev: st.data.sekmeler.find(sekme => sekme.kod === kod)?.rev })),
  });

  // Düzenlemeler sırayla gider (her ön izleme öncekileri içerir; yanıtlar sırasız gelmez).
  let kuyruk = Promise.resolve();
  const sirala = is => {
    const oturum = st;
    oturum.bekleyen += 1;
    isaretle();
    const sonraki = kuyruk.then(() => (st === oturum ? is() : null)).catch(error => {
      if (st === oturum) HOF.toastError(error);
      return null;
    });
    kuyruk = sonraki.finally(() => {
      oturum.bekleyen -= 1;
      if (st === oturum) isaretle();
    });
    return sonraki;
  };
  const bosalt = () => kuyruk.then(() => null);

  /**
   * Bir düzenleme: taslağa uygula, sunucuya ön izlet. Ret (400) → taslak değişmez, { ret: ileti }. canli: yazarken (yalnız başarıda taslağa girer, sayılmaz).
   */
  function duzenle(kod, degistir, { canli = false, sekme = null } = {}) {
    return sirala(async () => {
      const taslak = new Map(st.taslak);
      const sekmeAd = new Map(st.sekmeAd);
      if (kod) {
        const kart = taslakKart(kod);
        degistir(kart);
        taslak.set(kod, kart);
      }
      if (sekme) sekmeAd.set(sekme.kod, sekme.ad);
      let sonuc;
      try {
        const yanit = await HOF.api(`${API}/onizle`, { method: "POST", body: govde(taslak, sekmeAd) });
        st.taslak = taslak;
        st.sekmeAd = sekmeAd;
        st.degisti = Boolean(yanit.degisti);
        for (const [k, gorunum] of Object.entries(yanit.kartlar || {})) st.gorunum[k] = gorunum;
        sonuc = { tamam: true };
      } catch (error) {
        if (error?.status !== 400) throw error;
        sonuc = { ret: error.message, kart: error.data?.kart || kod };
      }
      if (!canli) {
        const root = kok();
        if (root) {
          root.dataset.duzenleme = String(Number(root.dataset.duzenleme || 0) + 1);
          root.dataset.duzenlemeSonuc = sonuc.ret ? "ret" : "tamam";
          root.dataset.duzenlemeNeden = sonuc.ret || "";
        }
      }
      isaretle();
      return sonuc;
    });
  }

  // ---------- Çizim ----------
  const duzenleyebilir = () => Boolean(st?.canManage);
  const kalem = (hedef, attrs, ad) => (duzenleyebilir() ? `<button type="button" class="hof-mini hof-maliyet-kalem" data-ad-degistir="${hedef}" ${attrs} title="Adı Değiştir" aria-label="${esc(ad ? `${ad} adını değiştir` : "Adı değiştir")}">✎</button>` : "");
  const adYazi = (ad, alan, attrs = "") => `<span class="hof-maliyet-ad" data-alan="${alan}" data-deger="${json(ad)}" ${attrs}>${ad ? esc(ad) : '<span class="hof-muted">—</span>'}</span>`;
  const sayiAlani = (alan, value, etiket, extra = "") =>
    duzenleyebilir()
      ? `<input type="text" inputmode="decimal" autocomplete="off" class="hof-maliyet-sayi" data-nodirty data-sayi data-alan="${alan}" data-deger="${json(value)}" value="${esc(girdiYazi(value))}" aria-label="${esc(etiket)}" ${extra}>`
      : `<span class="hof-maliyet-deger" data-alan="${alan}" data-deger="${json(value)}">${esc(girdiYazi(value)) || '<span class="hof-muted">—</span>'}</span>`;
  const metinAlani = (alan, value, etiket, max = 40, extra = "") =>
    duzenleyebilir()
      ? `<input type="text" autocomplete="off" class="hof-maliyet-metin" data-nodirty data-metin data-alan="${alan}" data-deger="${json(value)}" value="${esc(value ?? "")}" maxlength="${max}" aria-label="${esc(etiket)}" ${extra}>`
      : `<span class="hof-maliyet-deger is-metin" data-alan="${alan}" data-deger="${json(value)}">${value === null || value === undefined || value === "" ? '<span class="hof-muted">—</span>' : esc(value)}</span>`;
  const hesap = (alan, value, yazi = tutarYazi) => `<b class="hof-maliyet-hesap" data-alan="${alan}" data-hesap data-deger="${json(value)}">${esc(yazi(value))}</b>`;
  const silDugmesi = ad => (duzenleyebilir() ? `<button type="button" class="hof-mini hof-mini-danger" data-satir-sil title="Satırı Sil" aria-label="${esc(ad ? `${ad} satırını sil` : "Satırı sil")}">×</button>` : "");
  const ekleDugmesi = () => (duzenleyebilir() ? '<div class="hof-maliyet-ekle"><button type="button" class="hof-button hof-button-small hof-button-ghost" data-satir-ekle>+ Satır Ekle</button></div>' : "");

  function zincirHtml(kart) {
    const satir = s => `<tr data-satir="${esc(s.id)}"><td class="hof-maliyet-adhucre">${adYazi(s.ad, "ad")}${kalem("satir", "", s.ad || "Malzeme")}</td><td>${metinAlani("birim", s.birim, "Birim")}</td><td class="num">${sayiAlani("miktar", s.miktar, "Miktar")}</td><td class="num">${sayiAlani("fiyat", s.fiyat, "Birim Fiyat")}</td><td class="num">${hesap("tutar", s.tutar)}</td><td class="hof-maliyet-islem">${silDugmesi(s.ad)}</td></tr>`;
    const adim = a => {
      const param =
        a.kod === "yuzde" || a.kod === "yuzde_ekle"
          ? `<span class="hof-maliyet-param">%${sayiAlani("oran", a.oran, `${a.etiket || "Oran"} Oranı`)}</span>`
          : a.kod === "bolme"
            ? `<span class="hof-maliyet-param">÷${sayiAlani("bolen", a.bolen, "Bölen")}</span>`
            : '<span class="hof-maliyet-param"></span>';
      const deger = a.kod === "cm_elle" ? `<span class="hof-maliyet-param">${sayiAlani("deger", a.deger, a.etiket || "CM Maliyeti")}</span>` : hesap("deger", a.deger);
      return `<div class="hof-maliyet-adim${a.kod === kart.sonucAdim ? " is-sonuc" : ""}" data-adim="${esc(a.kod)}" data-islem="${esc(a.islem)}" data-hata="${json(a.hata ?? null)}"><span class="hof-maliyet-adim-ad">${adYazi(a.etiket, "etiket")}${kalem("adim", "", a.etiket || "Adım")}</span>${param}<span class="hof-maliyet-adim-deger">${a.hata ? '<b class="hof-maliyet-hesap is-hata" data-alan="deger" data-hesap data-deger="null">—</b>' : deger}</span></div>`;
    };
    return `<table class="hof-table hof-maliyet-tablo hof-maliyet-zincir"><colgroup><col class="c-ad"><col class="c-birim"><col class="c-sayi"><col class="c-sayi"><col class="c-tutar"><col class="c-islem"></colgroup><thead><tr><th>Malzeme</th><th>Birim</th><th class="num">Miktar</th><th class="num">Birim Fiyat</th><th class="num">Tutar</th><th></th></tr></thead><tbody>${kart.satirlar.map(satir).join("")}</tbody></table>${ekleDugmesi()}<div class="hof-maliyet-adimlar">${kart.adimlar.map(adim).join("")}</div>`;
  }

  function gramajHtml(kart) {
    const SIRA = ["parca", "giden_mt", "boy", "br_gramaj", "cins", "giden_kg", "alis_ft", "satir_top"];
    const baslik = kod => `<th class="${kod === "parca" || kod === "cins" ? "" : "num"}" data-sutun="${kod}">${adYazi(kart.sutunlar?.[kod] ?? "", "sutun")}${kalem("sutun", `data-kimlik="${kod}"`, kart.sutunlar?.[kod] || "Sütun")}</th>`;
    const satir = s => `<tr data-satir="${esc(s.id)}"${s.elle_kg ? ' data-elle-kg="1"' : ""}><td class="hof-maliyet-adhucre">${adYazi(s.parca, "parca")}${kalem("satir", "", s.parca || "Parça")}</td><td class="num">${sayiAlani("giden_mt", s.giden_mt, "Giden MT")}</td><td class="num">${sayiAlani("boy", s.boy, "Boy")}</td><td class="num">${sayiAlani("br_gramaj", s.br_gramaj, "Br.Gramaj")}</td><td>${metinAlani("cins", s.cins, "Cins")}</td><td class="num">${s.elle_kg ? `${sayiAlani("giden_kg", s.giden_kg_girdi ?? null, "Giden Kğ")}<span hidden data-alan="giden_kg_hesap" data-deger="${json(s.giden_kg)}"></span>` : hesap("giden_kg", s.giden_kg, kiloYazi)}</td><td class="num">${sayiAlani("alis_ft", s.alis_ft, "Alış Ft")}</td><td class="num">${hesap("satir_top", s.satir_top)}</td><td class="hof-maliyet-islem">${silDugmesi(s.parca)}</td></tr>`;
    return `<div class="hof-maliyet-kaydir"><table class="hof-table hof-maliyet-tablo hof-maliyet-gramaj"><thead><tr>${SIRA.map(baslik).join("")}<th></th></tr></thead><tbody>${kart.satirlar.map(satir).join("")}</tbody><tfoot><tr><th colspan="5">Toplam</th><td class="num">${hesap("toplam_giden_kg", kart.toplam.giden_kg, kiloYazi)}</td><td></td><td class="num">${hesap("toplam_satir_top", kart.toplam.satir_top)}</td><td></td></tr></tfoot></table></div>${ekleDugmesi()}`;
  }

  function matrisHtml(kart) {
    const hucre = (r, c) => {
      const kod = `${r.kod}${c.kod}`;
      const item = kart.hucreler[kod];
      if (!item) return "<td></td>";
      const taban = item.tur === "taban";
      const girdi = taban ? item.taban : item.fark;
      return `<td class="num hof-maliyet-hucre${taban ? " is-taban" : ""}" data-hucre="${esc(kod)}" data-tur="${taban ? "taban" : "fark"}"${taban ? "" : ` data-kaynak="${esc(item.kaynak)}"`}>${sayiAlani(taban ? "taban" : "fark", girdi, `${r.ad} · ${c.ad} · ${taban ? "Taban" : "Fark"}`, `placeholder="${taban ? "Taban" : "+ Fark"}"`)}${hesap("deger", item.deger)}</td>`;
    };
    return `<div class="hof-maliyet-kaydir"><table class="hof-table hof-maliyet-tablo hof-maliyet-matris"><thead><tr><th data-olcu-basligi>${adYazi(kart.olcuBasligi, "olcu-basligi")}${kalem("olcu-basligi", "", kart.olcuBasligi || "Ölçü")}</th>${kart.sutunlar.map(c => `<th class="num" data-sutun="${esc(c.kod)}">${adYazi(c.ad, "sutun")}${kalem("sutun", `data-kimlik="${esc(c.kod)}"`, c.ad)}</th>`).join("")}</tr></thead><tbody>${kart.olculer.map(r => `<tr data-olcu="${esc(r.kod)}"><th scope="row">${adYazi(r.ad, "olcu")}${kalem("olcu", `data-kimlik="${esc(r.kod)}"`, r.ad)}</th>${kart.sutunlar.map(c => hucre(r, c)).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function bilgiHtml(kart) {
    return `<table class="hof-table hof-maliyet-tablo hof-maliyet-bilgi"><thead><tr><th></th>${kart.sutunlar.map(c => `<th data-sutun="${esc(c.kod)}">${adYazi(c.ad, "sutun")}${kalem("sutun", `data-kimlik="${esc(c.kod)}"`, c.ad)}</th>`).join("")}</tr></thead><tbody>${kart.satirlar.map(s => `<tr data-satir="${esc(s.id)}"><td class="hof-maliyet-adhucre">${adYazi(s.ad, "ad")}${kalem("satir", "", s.ad)}</td>${kart.sutunlar.map((c, index) => `<td data-sira="${index}">${metinAlani("bilgi", s.degerler[index], `${s.ad} · ${c.ad}`, 200, `data-sira="${index}" data-bilgi`)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }

  const TUR_HTML = { zincir: zincirHtml, gramaj: gramajHtml, matris: matrisHtml, bilgi: bilgiHtml };
  function kartHtml(kod) {
    const kart = st.gorunum[kod];
    if (!kart) return "";
    const hata = st.hatalar.get(kod) || "";
    return `<article class="hof-maliyet-kart hof-maliyet-${kart.tur}" data-kart="${esc(kod)}" data-tur="${esc(kart.tur)}" data-sonuc="${json(kart.sonuc ?? null)}"><header class="hof-maliyet-kart-bas"><h4>${adYazi(kart.ad, "kart-ad")}</h4>${kalem("kart", "", kart.ad)}</header>${TUR_HTML[kart.tur](kart)}<p class="hof-maliyet-hata" role="alert" data-kart-hata${hata ? "" : " hidden"}>${esc(hata)}</p></article>`;
  }

  const sekmeAdi = sekme => (st.sekmeAd.has(sekme.kod) ? adNormal(st.sekmeAd.get(sekme.kod)) : sekme.ad);
  function render() {
    const root = kok();
    if (!root || !st) return;
    const sekme = st.data.sekmeler.find(item => item.kod === st.sekme) || st.data.sekmeler[0];
    st.sekme = sekme?.kod || "";
    const tabs = st.data.sekmeler.map(item => `<span class="hof-maliyet-sekme"><button type="button" data-sekme="${esc(item.kod)}" aria-pressed="${String(item.kod === st.sekme)}">${esc(sekmeAdi(item))}</button>${duzenleyebilir() ? `<button type="button" class="hof-mini hof-maliyet-kalem" data-ad-degistir="sekme" data-kimlik="${esc(item.kod)}" title="Adı Değiştir" aria-label="${esc(`${sekmeAdi(item)} sekmesinin adını değiştir`)}">✎</button>` : ""}</span>`).join("");
    const bayat = st.bayat
      ? `<div class="hof-maliyet-bayat" role="alert" data-bayat="${json(st.bayat.kartlar.map(item => item.kod))}"><p>${esc(st.bayat.ileti)}</p><div class="hof-actions"><button type="button" class="hof-button hof-button-small hof-button-ghost" data-bayat-yukle>Güncel Hâli Yükle</button><button type="button" class="hof-button hof-button-small" data-bayat-ustune>Benimkiyle Değiştir</button></div></div>`
      : "";
    root.innerHTML = `<div class="hof-tabs hof-maliyet-sekmeler" role="group" aria-label="Sekmeler">${tabs}</div>${bayat}<div class="hof-maliyet-kartlar" data-sekme-kartlar="${esc(st.sekme)}">${(sekme?.kartlar || []).map(kartHtml).join("")}</div><div class="hof-actions hof-maliyet-alt"><button type="button" class="hof-button hof-button-ghost" data-cik>Çık</button>${duzenleyebilir() ? '<button type="button" class="hof-button" data-kaydet>Kaydet</button>' : ""}</div>`;
    isaretle();
  }
  function kartCiz(kod) {
    const node = kok()?.querySelector(`[data-kart="${CSS.escape(kod)}"]`);
    if (!node) return;
    node.outerHTML = kartHtml(kod);
  }
  // Ön izleme yanıtı: yalnız hesaplanmış değerler ve hata işaretleri yerinde güncellenir (yazılan alan yeniden çizilmez; imleç yerinde kalır).
  function hesapYaz(kod) {
    const node = kok()?.querySelector(`[data-kart="${CSS.escape(kod)}"]`);
    const kart = st.gorunum[kod];
    if (!node || !kart) return;
    const yaz = (el, value, yazi = tutarYazi) => {
      if (!el) return;
      el.dataset.deger = JSON.stringify(value ?? null);
      el.textContent = yazi(value);
    };
    node.dataset.sonuc = JSON.stringify(kart.sonuc ?? null);
    if (kart.tur === "zincir") {
      for (const s of kart.satirlar) yaz(node.querySelector(`tr[data-satir="${CSS.escape(s.id)}"] [data-alan="tutar"]`), s.tutar);
      for (const a of kart.adimlar) {
        const satir = node.querySelector(`[data-adim="${CSS.escape(a.kod)}"]`);
        if (!satir) continue;
        const once = satir.dataset.hata;
        satir.dataset.hata = JSON.stringify(a.hata ?? null);
        if (a.kod === "cm_elle") continue;
        if (once !== satir.dataset.hata) {
          satir.querySelector(".hof-maliyet-adim-deger").innerHTML = a.hata ? '<b class="hof-maliyet-hesap is-hata" data-alan="deger" data-hesap data-deger="null">—</b>' : hesap("deger", a.deger);
        } else if (!a.hata) yaz(satir.querySelector('[data-alan="deger"]'), a.deger);
      }
    } else if (kart.tur === "gramaj") {
      for (const s of kart.satirlar) {
        const tr = node.querySelector(`tr[data-satir="${CSS.escape(s.id)}"]`);
        if (!tr) continue;
        if (s.elle_kg) {
          const gizli = tr.querySelector('[data-alan="giden_kg_hesap"]');
          if (gizli) gizli.dataset.deger = JSON.stringify(s.giden_kg ?? null);
        } else yaz(tr.querySelector('[data-alan="giden_kg"]'), s.giden_kg, kiloYazi);
        yaz(tr.querySelector('[data-alan="satir_top"]'), s.satir_top);
      }
      yaz(node.querySelector('[data-alan="toplam_giden_kg"]'), kart.toplam.giden_kg, kiloYazi);
      yaz(node.querySelector('[data-alan="toplam_satir_top"]'), kart.toplam.satir_top);
    } else if (kart.tur === "matris") {
      for (const [kodH, item] of Object.entries(kart.hucreler)) yaz(node.querySelector(`[data-hucre="${CSS.escape(kodH)}"] [data-alan="deger"]`), item.deger);
    }
  }
  // Girdi alanının data-deger'i sunucunun görünümündeki değerle eşitlenir (alan yazısına dokunulmaz).
  function girdiDegerleri(kod) {
    const node = kok()?.querySelector(`[data-kart="${CSS.escape(kod)}"]`);
    const kart = st.gorunum[kod];
    if (!node || !kart) return;
    const set = (el, value) => el && (el.dataset.deger = JSON.stringify(value ?? null));
    if (kart.tur === "zincir") {
      for (const s of kart.satirlar) {
        const tr = node.querySelector(`tr[data-satir="${CSS.escape(s.id)}"]`);
        if (!tr) continue;
        set(tr.querySelector('[data-alan="birim"]'), s.birim);
        set(tr.querySelector('[data-alan="miktar"]'), s.miktar);
        set(tr.querySelector('[data-alan="fiyat"]'), s.fiyat);
      }
      for (const a of kart.adimlar) {
        const satir = node.querySelector(`[data-adim="${CSS.escape(a.kod)}"]`);
        if (!satir) continue;
        if (a.kod === "yuzde" || a.kod === "yuzde_ekle") set(satir.querySelector('[data-alan="oran"]'), a.oran);
        if (a.kod === "bolme") set(satir.querySelector('[data-alan="bolen"]'), a.bolen);
        if (a.kod === "cm_elle") set(satir.querySelector('[data-alan="deger"]'), a.deger);
      }
    } else if (kart.tur === "gramaj") {
      for (const s of kart.satirlar) {
        const tr = node.querySelector(`tr[data-satir="${CSS.escape(s.id)}"]`);
        if (!tr) continue;
        for (const alan of ["giden_mt", "boy", "br_gramaj", "alis_ft", "cins"]) set(tr.querySelector(`[data-alan="${alan}"]`), s[alan]);
        if (s.elle_kg) set(tr.querySelector('input[data-alan="giden_kg"], span[data-alan="giden_kg"]'), s.giden_kg_girdi ?? null);
      }
    } else if (kart.tur === "matris") {
      for (const [kodH, item] of Object.entries(kart.hucreler)) set(node.querySelector(`[data-hucre="${CSS.escape(kodH)}"] [data-alan="${item.tur === "taban" ? "taban" : "fark"}"]`), item.tur === "taban" ? item.taban : item.fark);
    } else {
      for (const s of kart.satirlar) {
        const tr = node.querySelector(`tr[data-satir="${CSS.escape(s.id)}"]`);
        if (!tr) continue;
        s.degerler.forEach((value, index) => set(tr.querySelector(`[data-alan="bilgi"][data-sira="${index}"]`), value));
      }
    }
  }
  const hataYaz = (kod, ileti) => {
    if (ileti) st.hatalar.set(kod, ileti);
    else st.hatalar.delete(kod);
    const node = kok()?.querySelector(`[data-kart="${CSS.escape(kod)}"] [data-kart-hata]`);
    if (!node) return;
    node.textContent = ileti || "";
    node.hidden = !ileti;
  };

  // ---------- Alan → taslak ----------
  // Alanın taslakta karşılığını değiştiren işlev (kart gövdesi üstünde).
  function alanDegistirici(input) {
    const kartNode = input.closest("[data-kart]");
    const kod = kartNode?.dataset.kart;
    const tur = kartNode?.dataset.tur;
    const alan = input.dataset.alan;
    const raw = input.value;
    const deger = input.hasAttribute("data-sayi") ? sayiOku(raw) : input.hasAttribute("data-bilgi") ? (raw.trim() ? (typeof sayiOku(raw) === "number" ? sayiOku(raw) : raw) : null) : raw;
    if (!kod) return null;
    if (tur === "zincir") {
      const adim = input.closest("[data-adim]")?.dataset.adim;
      if (adim) {
        return kart => {
          const item = kart.adimlar.find(a => a.kod === adim);
          if (!item) return;
          if (alan === "oran") item.oran = deger;
          else if (alan === "bolen") item.bolen = deger;
          else if (alan === "deger") item.deger = deger;
        };
      }
      const id = input.closest("[data-satir]")?.dataset.satir;
      return kart => {
        const satir = kart.satirlar.find(s => s.id === id);
        if (satir) satir[alan] = deger;
      };
    }
    if (tur === "gramaj") {
      const id = input.closest("[data-satir]")?.dataset.satir;
      return kart => {
        const satir = kart.satirlar.find(s => s.id === id);
        if (satir) satir[alan] = deger;
      };
    }
    if (tur === "matris") {
      const hucre = input.closest("[data-hucre]")?.dataset.hucre;
      return kart => {
        kart.hucreler = { ...(kart.hucreler || {}), [hucre]: { [alan]: deger } };
      };
    }
    const id = input.closest("[data-satir]")?.dataset.satir;
    const sira = Number(input.dataset.sira);
    return kart => {
      const satir = kart.satirlar.find(s => s.id === id);
      if (!satir) return;
      const degerler = [...satir.degerler];
      degerler[sira] = deger;
      satir.degerler = degerler;
    };
  }
  const zamanlayicilar = new WeakMap();
  function canliOnizle(input) {
    clearTimeout(zamanlayicilar.get(input));
    zamanlayicilar.set(
      input,
      setTimeout(() => {
        zamanlayicilar.delete(input);
        alanGonder(input, { canli: true });
      }, 250),
    );
    st.bekleyenYazim.add(input);
    isaretle();
  }
  async function alanGonder(input, { canli = false } = {}) {
    if (!st || !input.isConnected) return;
    if (!canli) {
      clearTimeout(zamanlayicilar.get(input));
      zamanlayicilar.delete(input);
    }
    st.bekleyenYazim.delete(input);
    const degistir = alanDegistirici(input);
    if (!degistir) return;
    const kod = input.closest("[data-kart]").dataset.kart;
    const sonuc = await duzenle(kod, degistir, { canli });
    if (!st || !sonuc) return;
    if (sonuc.ret) {
      input.setAttribute("aria-invalid", "true");
      hataYaz(kod, sonuc.ret);
      if (!canli) {
        // Ret: değişiklik taslağa girmedi; alan son kabul edilen değere döner, ileti kalır.
        const value = JSON.parse(input.dataset.deger || "null");
        input.value = input.hasAttribute("data-sayi") ? girdiYazi(value) : value ?? "";
        input.removeAttribute("aria-invalid");
      }
      return;
    }
    input.removeAttribute("aria-invalid");
    if (st.hatalar.get(kod)) hataYaz(kod, "");
    hesapYaz(kod);
    girdiDegerleri(kod);
    if (!canli && input.hasAttribute("data-sayi") && document.activeElement !== input) input.value = girdiYazi(JSON.parse(input.dataset.deger || "null"));
  }
  // Odaktaki alanın henüz gönderilmemiş yazısı (Esc, Kaydet'ten hemen önce) gönderilir; sonra kuyruk boşalır.
  async function hepsiniGonder() {
    if (!st) return;
    for (const input of [...st.bekleyenYazim]) await alanGonder(input);
    const active = document.activeElement;
    if (active?.matches?.("[data-maliyet] input[data-alan]") && active.value !== girdiYazi(JSON.parse(active.dataset.deger || "null")) && active.value !== (JSON.parse(active.dataset.deger || "null") ?? "")) await alanGonder(active);
    await bosalt();
  }

  // ---------- Ad değiştirme (✎) ----------
  const HEDEF_ETIKETI = { kart: "Kart Adı", sekme: "Sekme Adı", satir: "Ad", adim: "Etiket", sutun: "Sütun Adı", olcu: "Ölçü", "olcu-basligi": "Başlık" };
  function adDegistir(button) {
    const hedef = button.dataset.adDegistir;
    const kartNode = button.closest("[data-kart]");
    const kod = kartNode?.dataset.kart || "";
    const tur = kartNode?.dataset.tur || "";
    const kimlik = button.dataset.kimlik || button.closest("[data-satir]")?.dataset.satir || button.closest("[data-adim]")?.dataset.adim || "";
    const kart = kod ? st.gorunum[kod] : null;
    let mevcut = "";
    let label = HEDEF_ETIKETI[hedef] || "Ad";
    if (hedef === "sekme") mevcut = sekmeAdi(st.data.sekmeler.find(item => item.kod === kimlik) || { kod: kimlik, ad: "" });
    else if (hedef === "kart") mevcut = kart.ad;
    else if (hedef === "satir") {
      const satir = kart.satirlar.find(s => s.id === kimlik);
      mevcut = (tur === "gramaj" ? satir?.parca : satir?.ad) || "";
      label = tur === "gramaj" ? "Parça Adı" : tur === "zincir" ? "Malzeme Adı" : "Satır Adı";
    } else if (hedef === "adim") mevcut = kart.adimlar.find(a => a.kod === kimlik)?.etiket || "";
    else if (hedef === "sutun") mevcut = (Array.isArray(kart.sutunlar) ? kart.sutunlar.find(c => c.kod === kimlik)?.ad : kart.sutunlar?.[kimlik]) || "";
    else if (hedef === "olcu") mevcut = kart.olculer.find(o => o.kod === kimlik)?.ad || "";
    else if (hedef === "olcu-basligi") mevcut = kart.olcuBasligi || "";
    HOF.formModal({
      title: "Adı Değiştir",
      eyebrow: "MALİYET HESAP KARTI",
      size: "small",
      fields: [{ name: "ad", label, value: mevcut, maxlength: hedef === "sekme" ? 60 : 120, autofocus: true }],
      submitLabel: "Tamam",
      onSubmit: async data => {
        const ad = String(data.ad ?? "");
        const sonuc =
          hedef === "sekme"
            ? await duzenle("", () => null, { sekme: { kod: kimlik, ad } })
            : await duzenle(kod, govde => {
                if (hedef === "kart") govde.ad = ad;
                else if (hedef === "satir") {
                  const satir = govde.satirlar.find(s => s.id === kimlik);
                  if (satir) satir[tur === "gramaj" ? "parca" : "ad"] = ad;
                } else if (hedef === "adim") {
                  const adim = govde.adimlar.find(a => a.kod === kimlik);
                  if (adim) adim.etiket = ad;
                } else if (hedef === "sutun") govde.sutunlar = { ...(govde.sutunlar || {}), [kimlik]: ad };
                else if (hedef === "olcu") govde.olculer = { ...(govde.olculer || {}), [kimlik]: ad };
                else if (hedef === "olcu-basligi") govde.olcuBasligi = ad;
              });
        if (!sonuc) throw new Error("Ad değiştirilemedi.");
        if (sonuc.ret) throw new Error(sonuc.ret);
        if (hedef === "sekme") render();
        else kartCiz(kod);
      },
    });
  }

  // ---------- Satır ekle / sil ----------
  const yeniKimlik = () => `y-${HOF.requestId().slice(0, 8)}`;
  async function satirEkle(kod) {
    const kart = st.gorunum[kod];
    const id = yeniKimlik();
    const sonuc = await duzenle(kod, govde => {
      govde.satirlar.push(kart.tur === "gramaj" ? { id, parca: "", cins: "", giden_mt: null, boy: null, br_gramaj: null, alis_ft: null } : { id, ad: "", birim: "", miktar: null, fiyat: null });
    });
    if (!sonuc || !st) return;
    if (sonuc.ret) return hataYaz(kod, sonuc.ret);
    kartCiz(kod);
    kok()?.querySelector(`[data-kart="${CSS.escape(kod)}"] tr[data-satir="${CSS.escape(id)}"] [data-ad-degistir]`)?.focus();
  }
  async function satirSil(kod, id) {
    const sonuc = await duzenle(kod, govde => {
      govde.satirlar = govde.satirlar.filter(s => s.id !== id);
    });
    if (!sonuc || !st) return;
    if (sonuc.ret) return hataYaz(kod, sonuc.ret);
    kartCiz(kod);
  }

  // ---------- Kaydet ----------
  async function kaydet() {
    await hepsiniGonder();
    if (!st) return false;
    const root = kok();
    const bitir = (sonuc, neden = "") => {
      if (!root) return;
      root.dataset.kayit = String(Number(root.dataset.kayit || 0) + 1);
      root.dataset.kayitSonuc = sonuc;
      root.dataset.kayitNeden = neden;
    };
    const button = root?.querySelector("[data-kaydet]");
    if (button) button.disabled = true;
    try {
      const sonuc = await HOF.api(API, { method: "PUT", body: govde() });
      yukle(sonuc);
      st.bayat = null;
      render();
      const sayi = sonuc.degisen.kartlar.length + sonuc.degisen.sekmeler.length;
      HOF.toast(sayi ? "Maliyet Hesap Kartı kaydedildi." : "Kaydedilecek değişiklik yoktu.", { type: sayi ? "success" : "info" });
      bitir("tamam");
      return true;
    } catch (error) {
      if (error?.status === 409 && error.data?.code === "maliyet-stale") {
        // Başka biri arada kaydetti: hiçbir şey yazılmadı; taslak ekranda kalır, hangi kart olduğu yazar.
        st.bayat = { ileti: `${error.message.replace(/ Pencereyi yeniden açıp değişikliği yeniden yapın\.?$/, "")} Değişiklikleriniz ekranda duruyor.`, kartlar: error.data.bayat || [] };
        render();
        bitir("ret", st.bayat.ileti);
        return false;
      }
      if (error?.status === 400) {
        const kod = error.data?.kart;
        if (kod) hataYaz(kod, error.message);
      }
      HOF.toastError(error);
      bitir("ret", error?.message || "");
      return false;
    } finally {
      const again = kok()?.querySelector("[data-kaydet]");
      if (again) again.disabled = false;
    }
  }
  // 409 çözümü: güncel hâli yükle (bayat kartlardaki taslak bırakılır) ya da kendi taslağını güncel sürümün üstüne yaz (onaylı).
  async function bayatCoz(ustune) {
    if (!st?.bayat) return;
    const kodlar = new Set(st.bayat.kartlar.map(item => item.kod));
    if (ustune && !(await HOF.confirm({ title: "Başka Biri Kaydetti", message: "Başka birinin bu kartlarda yaptığı değişiklik sizinkiyle değişecek. Devam edilsin mi?", confirmLabel: "Benimkiyle Değiştir", cancelLabel: "Vazgeç" }))) return;
    const taze = await HOF.api(API);
    if (!st) return;
    const taslak = new Map(st.taslak);
    const sekmeAd = new Map(st.sekmeAd);
    for (const kod of kodlar) {
      if (taslak.has(kod)) {
        if (ustune) taslak.set(kod, { ...taslak.get(kod), rev: taze.kartlar[kod]?.rev });
        else taslak.delete(kod);
      }
      if (!ustune) sekmeAd.delete(kod);
    }
    st.data = taze;
    st.gorunum = { ...taze.kartlar };
    st.taslak = taslak;
    st.sekmeAd = sekmeAd;
    st.bayat = null;
    st.degisti = false;
    if (taslak.size) await duzenle("", () => null);
    render();
    if (ustune) await kaydet();
  }

  function yukle(data) {
    st.data = data;
    st.canManage = Boolean(data.canManage);
    st.gorunum = { ...data.kartlar };
    st.taslak = new Map();
    st.sekmeAd = new Map();
    st.degisti = false;
    st.hatalar = new Map();
    if (!data.sekmeler.some(item => item.kod === st.sekme)) st.sekme = data.sekmeler[0]?.kod || "";
  }

  // "Kaydedilmemiş Değişiklik" (ortak sorunun başlığı ve düğme işaretleri; burada üçüncü seçenek Kaydet).
  const soru = () =>
    new Promise(resolve => {
      let done = false;
      const modal = HOF.modal({
        title: "Kaydedilmemiş Değişiklik",
        eyebrow: "ONAY",
        size: "small",
        body: `<p class="hof-modal-text">Maliyet Hesap Kartı’ndaki değişiklikler kaydedilmedi. Kaydedilsin mi?</p><div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-answer="no">Forma Dön</button><button type="button" class="hof-button hof-button-ghost hof-button-danger-ghost" data-answer="yes">Kaydetmeden Kapat</button><button type="button" class="hof-button" data-answer="save" autofocus>Kaydet</button></div>`,
        onClose: () => {
          if (!done) resolve("no");
        },
      });
      modal.dialog.addEventListener("click", event => {
        const answer = event.target.closest("[data-answer]")?.dataset.answer;
        if (!answer) return;
        done = true;
        resolve(answer);
        modal.close();
      });
    });
  const sorarakKapat = async () => {
    if (!st?.canManage) return true;
    await hepsiniGonder();
    if (!kirli()) return true;
    const answer = await soru();
    if (answer === "yes") return true;
    if (answer === "save") return kaydet();
    return false;
  };
  function kapatmaSorusu() {
    // Bekleyen yazım yoksa soru eşzamanlı çıkar (Esc'e basıldığı anda pencere açılır); varsa önce gönderilir.
    if (!st?.canManage) return true;
    const active = document.activeElement;
    const yazimVar = st.bekleyen > 0 || st.bekleyenYazim.size > 0 || (active?.matches?.("[data-maliyet] input[data-alan]") && active.value !== girdiYazi(JSON.parse(active.dataset.deger || "null")) && active.value !== (JSON.parse(active.dataset.deger || "null") ?? ""));
    if (yazimVar) return sorarakKapat();
    if (!kirli()) return true;
    return soru().then(answer => (answer === "yes" ? true : answer === "save" ? kaydet() : false));
  }

  async function open() {
    if (!HOF.can("maliyet.view")) return HOF.toast("Maliyet Hesap Kartı için yetkiniz yok.", { type: "error" });
    if (st?.modal && document.body.contains(st.modal.node)) return;
    const oturum = { modal: null, data: null, sekme: "", taslak: new Map(), sekmeAd: new Map(), gorunum: {}, degisti: false, bekleyen: 0, bekleyenYazim: new Set(), hatalar: new Map(), bayat: null, canManage: false };
    st = oturum;
    oturum.modal = HOF.modal({
      title: TITLE,
      eyebrow: "STOK",
      size: "wide",
      body: '<div class="hof-maliyet" data-maliyet data-bekleyen="0" data-kirli="0"><p class="hof-empty">Yükleniyor…</p></div>',
      beforeClose: () => kapatmaSorusu(),
      onClose: () => {
        if (st === oturum) st = null;
      },
    });
    const modal = oturum.modal;
    modal.isDirty = () => st === oturum && kirli();
    modal.dialog.classList.add("hof-maliyet-modal");
    modal.dialog.addEventListener("click", onClick);
    modal.dialog.addEventListener("input", event => {
      const input = event.target.closest?.("[data-maliyet] input[data-alan]");
      if (input && st === oturum) canliOnizle(input);
    });
    modal.dialog.addEventListener("change", event => {
      const input = event.target.closest?.("[data-maliyet] input[data-alan]");
      if (input && st === oturum) alanGonder(input);
    });
    modal.dialog.addEventListener("keydown", event => {
      const input = event.target.closest?.("[data-maliyet] input[data-alan]");
      if (input && event.key === "Enter") {
        event.preventDefault();
        alanGonder(input);
      }
    });
    try {
      const data = await HOF.api(API);
      if (st !== oturum) return;
      oturum.sekme = data.sekmeler[0]?.kod || "";
      yukle(data);
      render();
      kok()?.querySelector("[data-sekme]")?.focus({ preventScroll: true });
    } catch (error) {
      if (st !== oturum) return;
      const root = kok();
      if (root) root.innerHTML = `<p class="hof-empty">${esc(error.message)}</p><div class="hof-actions"><button type="button" class="hof-button" data-cik>Çık</button></div>`;
    }
  }

  function onClick(event) {
    if (!st) return;
    const button = event.target.closest("button");
    if (!button || !kok()?.contains(button)) return;
    if (button.dataset.sekme) {
      st.sekme = button.dataset.sekme;
      render();
      kok()?.querySelector(`[data-sekme="${CSS.escape(st.sekme)}"]`)?.focus({ preventScroll: true });
      return;
    }
    if ("cik" in button.dataset) return st.modal.dismiss();
    if ("kaydet" in button.dataset) return kaydet();
    if (button.dataset.adDegistir) return adDegistir(button);
    const kod = button.closest("[data-kart]")?.dataset.kart;
    if ("satirEkle" in button.dataset && kod) return satirEkle(kod);
    if ("satirSil" in button.dataset && kod) return satirSil(kod, button.closest("[data-satir]")?.dataset.satir);
    if ("bayatYukle" in button.dataset) return bayatCoz(false);
    if ("bayatUstune" in button.dataset) return bayatCoz(true);
  }

  HOF.maliyet = { open, refresh, durum: () => durum };

  HOF.whenReady(() => {
    // Sektör değişince (bu ya da başka bilgisayarda) giriş görünür / gizlenir.
    HOF.on("profile", () => refresh());
    HOF.on("live:workspace.changed", change => {
      if (change?.kind !== "maliyet" || !st || kirli() || st.bekleyen) return;
      // Başka biri kaydetti; bu pencerede değişiklik yok → güncel hâl sessizce yüklenir.
      const oturum = st;
      HOF.api(API, { background: true })
        .then(data => {
          if (st !== oturum || kirli() || st.bekleyen) return;
          yukle(data);
          render();
        })
        .catch(() => null);
    });
  });
})();
