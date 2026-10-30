// Sahte Meta Graph sunucusunun KENDİ birim testleri (DestekOfis 2.4.8 K0). Koşu:
//   node tools/kanit.mjs kos 248-k0-sahte-meta -- node --test test/bagimsiz/whatsapp-248/sahte-meta/sunucu.test.mjs
// Her test bir Meta belgesi cümlesini (ya da işaretli D0 varsayımını) sınar; gerçek Meta'ya istek YOK (yalnız 127.0.0.1).

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import { sahteMetaBaslat, teslimNumarasi, degiskenleri, BASAMAKLAR } from "./sunucu.mjs";
import { imzaDogru, durumGovdesi, YEDI_GUN_MS } from "./kanca.mjs";
import { HATALAR, hataGovdesi, httpDurumu } from "./hatalar.mjs";

const B = "SAHTE-BELIRTEC-1";
const NUMARA = "700000000000001";
const WABA = "800000000000001";
const PDF = Buffer.from("%PDF-1.4\n% sahte ekstre Ayşe Yılmaz 1.250,00 TL\n%%EOF\n");
const ALICI = "+90 532 111 22 33";

const EKSTRE = {
  waba: WABA, name: "destekofis_ekstre", language: "tr", category: "UTILITY", status: "APPROVED",
  components: [
    { type: "HEADER", format: "DOCUMENT", example: { header_handle: ["4::ornek"] } },
    { type: "BODY", text: "Sayın {{1}}, {{2}} firmasındaki cari hesabınızın {{3}} dönemine ait ekstresi ektedir. Güncel bakiye: {{4}}.", example: { body_text: [["Ali", "Firma", "Ekim 2026", "1.250,00 TL"]] } },
    { type: "FOOTER", text: "KVKK aydınlatma metni için firmamıza başvurabilirsiniz." },
  ],
};
const HATIRLATMA = { waba: WABA, name: "destekofis_odeme_hatirlatma", language: "tr", category: "UTILITY", status: "APPROVED",
  components: [{ type: "BODY", text: "Sayın {{1}}, {{2}} firmasındaki hesabınızda {{3}} vadeli {{4}} tutarında ödemeniz bulunmaktadır. Güncel bakiye: {{5}}. Ödeme yaptıysanız bu mesajı dikkate almayınız.", example: { body_text: [["a", "b", "c", "d", "e"]] } }] };

async function kur(senaryo = {}) {
  return sahteMetaBaslat({ senaryo: { sablonlar: [EKSTRE, HATIRLATMA], ...senaryo } });
}

async function graph(s, yol, { method = "GET", belirtec = B, json, form, basliklar = {}, sinyal } = {}) {
  const h = { ...basliklar };
  if (belirtec) h.authorization = `Bearer ${belirtec}`;
  let body;
  if (json !== undefined) { h["content-type"] = "application/json"; body = JSON.stringify(json); }
  if (form) body = form;
  const r = await fetch(s.url + yol, { method, headers: h, body, signal: sinyal });
  const metin = await r.text();
  let govde; try { govde = JSON.parse(metin); } catch { govde = metin; }
  return { http: r.status, govde };
}

function medyaFormu({ icerik = PDF, tur = "application/pdf", ad = "Ekstre Ayşe Yılmaz 2026-10.pdf", urun = "whatsapp", dosyaTuru } = {}) {
  const f = new FormData();
  if (urun !== null) f.append("messaging_product", urun);
  if (tur !== null) f.append("type", tur);
  if (icerik !== null) f.append("file", new Blob([icerik], { type: dosyaTuru ?? tur ?? "application/octet-stream" }), ad);
  return f;
}

function ekstreIletisi(medyaId, { to = ALICI, degerler = ["Ayşe Yılmaz", "Deneme Ticaret", "01.10.2026–31.10.2026", "1.250,00 TL"], opaque } = {}) {
  const g = {
    messaging_product: "whatsapp", recipient_type: "individual", to, type: "template",
    template: { name: "destekofis_ekstre", language: { code: "tr" }, components: [
      { type: "header", parameters: [{ type: "document", document: { id: medyaId, filename: "Ekstre Ayşe Yılmaz 2026-10.pdf" } }] },
      { type: "body", parameters: degerler.map(text => ({ type: "text", text })) },
    ] },
  };
  if (opaque !== undefined) g.biz_opaque_callback_data = opaque;
  return g;
}

async function medyaYukle(s, ops) {
  return graph(s, `/v26.0/${NUMARA}/media`, { method: "POST", form: medyaFormu(ops) });
}

async function alici(durumKodu = 200) {
  const gelen = [];
  const sunucu = http.createServer((req, res) => {
    const p = []; req.on("data", c => p.push(c));
    req.on("end", () => {
      const ham = Buffer.concat(p).toString("utf8");
      const u = new URL(req.url, "http://x");
      gelen.push({ method: req.method, url: req.url, basliklar: req.headers, ham, govde: ham ? JSON.parse(ham) : null });
      if (req.method === "GET") { res.writeHead(200); return res.end(u.searchParams.get("hub.challenge") ?? ""); }
      res.writeHead(typeof durumKodu === "function" ? durumKodu(gelen.length) : durumKodu); res.end("ok");
    });
  });
  await new Promise(r => sunucu.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${sunucu.address().port}/wa/kanca/gizli`, gelen, kapat: () => new Promise(r => sunucu.close(r)) };
}

// ---- saf yardımcılar ---------------------------------------------------------------------------------------------------------
test("teslimNumarasi: + varsa yalnız rakamlar; + yoksa işletme ülke kodu başa eklenir (belge tablosu)", () => {
  assert.equal(teslimNumarasi("+1 (631) 555-1234", "91"), "16315551234");
  assert.equal(teslimNumarasi("(631) 555-1234", "91"), "916315551234");
  assert.equal(teslimNumarasi("1 (631) 555-1234", "91"), "9116315551234");
  assert.equal(teslimNumarasi("+90 (532) 111-22-33", "90"), "905321112233");
  assert.equal(teslimNumarasi("905321112233", "90"), "90905321112233", "plan §2.2: '+' olmadan '905…' YANLIŞ kişiye gider");
});

test("değişken ayrıştırma ve hata gövdesi biçimi (belge 'Error response syntax')", () => {
  assert.deepEqual(degiskenleri("Sayın {{1}}, {{2}} … {{4}}."), ["1", "2", "4"]);
  const g = hataGovdesi(130429);
  assert.equal(g.error.message, "(#130429) Rate limit hit");
  assert.equal(g.error.code, 130429);
  assert.equal(g.error.error_data.messaging_product, "whatsapp");
  assert.ok(g.error.fbtrace_id);
  assert.equal("error_subcode" in g.error, false, "v16.0+ subcode dönmez");
  assert.equal(httpDurumu(132018), 400);
  assert.ok(HATALAR[131049] && HATALAR[131026] && HATALAR[132015] && HATALAR[80007]);
  assert.equal(BASAMAKLAR.TIER_250, 250);
});

// ---- ileti --------------------------------------------------------------------------------------------------------------------
test("ekstre şablonu + belge başlığı (medya id) kabul edilir; yanıt contacts/messages, kayıt değişkenleri tutar", async () => {
  const s = await kur();
  try {
    const m = await medyaYukle(s);
    assert.equal(m.http, 200); assert.match(m.govde.id, /^\d+$/);
    const r = await graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: ekstreIletisi(m.govde.id, { opaque: "is-42" }) });
    assert.equal(r.http, 200, JSON.stringify(r.govde));
    assert.equal(r.govde.messaging_product, "whatsapp");
    assert.deepEqual(r.govde.contacts, [{ input: ALICI, wa_id: "905321112233" }]);
    assert.match(r.govde.messages[0].id, /^wamid\./);
    const k = s.kayit();
    assert.equal(k.mesajlar.length, 1);
    assert.equal(k.mesajlar[0].medyaId, m.govde.id);
    assert.deepEqual(k.mesajlar[0].degiskenler, ["Ayşe Yılmaz", "Deneme Ticaret", "01.10.2026–31.10.2026", "1.250,00 TL"]);
    assert.equal(k.mesajlar[0].opaque, "is-42");
    assert.equal(k.sayilar.mesajIstegi["905321112233"], 1);
  } finally { await s.kapat(); }
});

test("şablon yok / PENDING → 132001, PAUSED → 132015, DISABLED → 132016; değişken sayısı → 132000", async () => {
  const s = await kur();
  try {
    const m = await medyaYukle(s);
    const g = ekstreIletisi(m.govde.id);
    const yok = await graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: { ...g, template: { ...g.template, name: "olmayan" } } });
    assert.equal(yok.govde.error.code, 132001);
    for (const [durum, kod] of [["PENDING", 132001], ["REJECTED", 132001], ["PAUSED", 132015], ["DISABLED", 132016]]) {
      s.meta.sablonlar.find(x => x.name === "destekofis_ekstre").status = durum;
      const r = await graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: g });
      assert.equal(r.govde.error.code, kod, durum);
    }
    s.meta.sablonlar.find(x => x.name === "destekofis_ekstre").status = "APPROVED";
    const eksik = ekstreIletisi(m.govde.id, { degerler: ["a", "b", "c"] });
    assert.equal((await graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: eksik })).govde.error.code, 132000);
    const dilYanlis = { ...g, template: { ...g.template, language: { code: "en_US" } } };
    assert.equal((await graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: dilYanlis })).govde.error.code, 132001);
    assert.equal(s.kayit().mesajlar.length, 0);
  } finally { await s.kapat(); }
});

test("D0 değişken kuralı: satır sonu / sekme / 5+ ardışık boşluk → 132018; boşluklu tek satır kabul", async () => {
  const s = await kur();
  try {
    const m = await medyaYukle(s);
    for (const kotu of ["Ayşe\nYılmaz", "Ayşe\tYılmaz", "Ayşe     Yılmaz"]) {
      const r = await graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: ekstreIletisi(m.govde.id, { degerler: [kotu, "F", "D", "1,00 TL"] }) });
      assert.equal(r.govde.error.code, 132018, JSON.stringify(kotu));
    }
    const iyi = await graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: ekstreIletisi(m.govde.id, { degerler: ["Şükrü Öğüt 😀 Çağ", "F", "D", "1,00 TL"] }) });
    assert.equal(iyi.http, 200);
  } finally { await s.kapat(); }
});

test("silinmiş ya da 30 günü geçmiş medya kimliğiyle gönderim reddedilir (D0: 131053) ve ayrıca kaydedilir", async () => {
  const s = await kur();
  try {
    s.saat(Date.parse("2026-10-30T10:00:00+03:00"));
    const m = await medyaYukle(s);
    const sil = await graph(s, `/v26.0/${m.govde.id}`, { method: "DELETE" });
    assert.deepEqual(sil.govde, { success: true });
    const r = await graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: ekstreIletisi(m.govde.id) });
    assert.equal(r.govde.error.code, 131053);
    const m2 = await medyaYukle(s);
    s.saat(Date.parse("2026-11-30T10:00:01+03:00"));
    const r2 = await graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: ekstreIletisi(m2.govde.id) });
    assert.equal(r2.govde.error.code, 131053);
    assert.deepEqual(s.kayit().gecersizMedyaDenemeleri.map(x => x.neden), ["silinmis", "suresi-dolmus"]);
  } finally { await s.kapat(); }
});

test("+ olmadan gönderim: işletme numarasının ülke kodu eklenir (yanlış kişi riski kayıtta görünür)", async () => {
  const s = await kur();
  try {
    const m = await medyaYukle(s);
    const r = await graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: ekstreIletisi(m.govde.id, { to: "905321112233" }) });
    assert.equal(r.http, 200);
    assert.equal(r.govde.contacts[0].wa_id, "90905321112233");
    assert.equal(s.kayit().mesajlar[0].teslimNumarasi, "90905321112233");
  } finally { await s.kapat(); }
});

test("gönderen = alıcı → 131021; şablonsuz ileti müşteri hizmeti penceresi dışında → 131047", async () => {
  const s = await kur();
  try {
    const m = await medyaYukle(s);
    assert.equal((await graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: ekstreIletisi(m.govde.id, { to: "+90 212 555 00 00" }) })).govde.error.code, 131021);
    const metin = { messaging_product: "whatsapp", to: ALICI, type: "text", text: { body: "merhaba" } };
    assert.equal((await graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: metin })).govde.error.code, 131047);
  } finally { await s.kapat(); }
});

test("hesap/numara: kayıtsız 133010, bakım 131057, ödeme yöntemi yok 131042, kısıtlı 368", async () => {
  const s = await kur();
  try {
    const m = await medyaYukle(s);
    const gonder = () => graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: ekstreIletisi(m.govde.id) });
    const n = s.meta.numaralar.get(NUMARA); const w = s.meta.wabalar.get(WABA);
    n.kayitli = false; assert.equal((await gonder()).govde.error.code, 133010); n.kayitli = true;
    n.bakim = true; assert.equal((await gonder()).govde.error.code, 131057); n.bakim = false;
    w.odemeYontemi = false; assert.equal((await gonder()).govde.error.code, 131042); w.odemeYontemi = true;
    w.kisitli = 368; assert.equal((await gonder()).govde.error.code, 368); w.kisitli = null;
    assert.equal((await gonder()).http, 200);
  } finally { await s.kapat(); }
});

test("belirteç: yok (POST) 190, süresi dolmuş 190/401, iptal 0, ileti izni yok 10, varlık erişimi yok 200/403", async () => {
  const s = await kur({ belirtecler: {
    [B]: { izinler: ["whatsapp_business_management", "whatsapp_business_messaging"] },
    ESKI: { durum: "suresi_dolmus", izinler: ["whatsapp_business_messaging"] },
    IPTAL: { durum: "iptal", izinler: ["whatsapp_business_messaging"] },
    YONETIMSIZ: { izinler: ["whatsapp_business_messaging"] },
    MESAJSIZ: { izinler: ["whatsapp_business_management"] },
    BASKAWABA: { izinler: ["whatsapp_business_messaging", "whatsapp_business_management"], wabalar: ["999"] },
  } });
  try {
    const m = await medyaYukle(s);
    const g = ekstreIletisi(m.govde.id);
    const kod = async belirtec => (await graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: g, belirtec }));
    assert.equal((await kod(null)).govde.error.code, 190);
    const eski = await kod("ESKI"); assert.equal(eski.govde.error.code, 190); assert.equal(eski.http, 401);
    assert.equal((await kod("IPTAL")).govde.error.code, 0);
    assert.equal((await kod("MESAJSIZ")).govde.error.code, 10);
    const baska = await kod("BASKAWABA"); assert.equal(baska.govde.error.code, 200); assert.equal(baska.http, 403);
    assert.equal((await graph(s, `/v26.0/${WABA}/message_templates`, { belirtec: "YONETIMSIZ" })).govde.error.code, 200);
    assert.equal((await graph(s, `/v26.0/${NUMARA}?fields=id`, { belirtec: null })).govde.error.code, 200, "GET belirteçsiz: 'Provide valid app ID'");
  } finally { await s.kapat(); }
});

// ---- senaryo kuralları (ağ arızası, hata dizisi) -----------------------------------------------------------------------------
test("kural: 1. denemede 131000, 2. denemede kabul; sayılar her denemeyi tutar", async () => {
  const s = await kur();
  try {
    s.kural({ yol: "messages", to: ALICI, deneme: 1, yanit: { hata: 131000 } });
    const m = await medyaYukle(s);
    const r1 = await graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: ekstreIletisi(m.govde.id) });
    assert.equal(r1.govde.error.code, 131000); assert.equal(r1.http, 500);
    const r2 = await graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: ekstreIletisi(m.govde.id) });
    assert.equal(r2.http, 200);
    const k = s.kayit();
    assert.equal(k.sayilar.mesajIstegi["905321112233"], 2);
    assert.equal(k.sayilar.kabul["905321112233"], 1);
  } finally { await s.kapat(); }
});

test("kural koptu:'sonra' → ileti KABUL edildi ama yanıt gelmez (çift gönderim tuzağı); 'once' → kabul yok", async () => {
  const s = await kur();
  try {
    const m = await medyaYukle(s);
    s.kural({ yol: "messages", deneme: 1, to: ALICI, yanit: { koptu: "sonra" } });
    await assert.rejects(graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: ekstreIletisi(m.govde.id) }));
    assert.equal(s.kayit().sayilar.toplamKabul, 1, "Meta iletiyi aldı");
    s.kural({ yol: "messages", deneme: 2, to: ALICI, yanit: { koptu: "once" } });
    await assert.rejects(graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: ekstreIletisi(m.govde.id) }));
    const k = s.kayit();
    assert.equal(k.sayilar.toplamKabul, 1);
    assert.equal(k.sayilar.koptu, 2);
    assert.deepEqual(k.istekler.filter(i => i.islem === "messages").map(i => i.sonuc), ["koptu-sonra", "koptu-once"]);
  } finally { await s.kapat(); }
});

test("kural: gövdesiz 5xx (işlendi / işlenmedi), gecikme (istemci zaman aşımı, ileti yine kabul), bozuk yanıt", async () => {
  const s = await kur();
  try {
    const m = await medyaYukle(s);
    const g = ekstreIletisi(m.govde.id);
    s.kural({ yol: "messages", deneme: 1, to: ALICI, yanit: { http: 502, islendi: false } });
    s.kural({ yol: "messages", deneme: 2, to: ALICI, yanit: { http: 500, islendi: true } });
    s.kural({ yol: "messages", deneme: 3, to: ALICI, yanit: { gecikmeMs: 400 } });
    s.kural({ yol: "messages", deneme: 4, to: ALICI, yanit: { bozuk: true } });
    const r1 = await graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: g });
    assert.equal(r1.http, 502); assert.equal(r1.govde, "");
    const r2 = await graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: g });
    assert.equal(r2.http, 500); assert.equal(r2.govde, "");
    await assert.rejects(graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: g, sinyal: AbortSignal.timeout(100) }));
    await new Promise(r => setTimeout(r, 500));
    const r4 = await graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: g });
    assert.equal(r4.http, 200); assert.equal(typeof r4.govde, "string");
    assert.equal(s.kayit().sayilar.toplamKabul, 3, "işlendi 5xx + geciken + bozuk yanıtlı: Meta'da 3 ileti");
  } finally { await s.kapat(); }
});

test("hız: numara başına mps aşılınca 130429 (belge: throughput)", async () => {
  const s = await kur({ hiz: { mps: 2 } });
  try {
    const m = await medyaYukle(s);
    // üçü aynı anda (yavaş koşucuda ardışık istekler 1 sn pencereyi aşıp yanlış yeşil/kırmızı vermesin); hangisinin düştüğü serbest
    const yanitlar = await Promise.all([0, 1, 2].map(i => graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: ekstreIletisi(m.govde.id, { to: `+90532111223${i}` }) })));
    assert.deepEqual(yanitlar.map(r => r.govde?.error?.code ?? 0).sort(), [0, 0, 130429]);
  } finally { await s.kapat(); }
});

test("gönderim sınırı (D0 kodu): kayan 24 saatte FARKLI alıcı; aynı alıcıya yeniden yer tutmaz; 24 sa sonra açılır", async () => {
  const t0 = Date.parse("2026-10-30T10:00:00+03:00");
  const dis = Array.from({ length: 249 }, (_, i) => ({ t: t0, alici: `90533000${String(i).padStart(4, "0")}` }));
  const s = await kur({ sinir: { etkin: true, disKullanim: dis } });
  try {
    s.saat(t0 + 60e3);
    const m = await medyaYukle(s);
    const g = to => graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: ekstreIletisi(m.govde.id, { to }) });
    assert.equal((await g("+905321112233")).http, 200, "250. farklı alıcı");
    assert.equal((await g("+905321112233")).http, 200, "aynı alıcı yeni yer tutmaz");
    assert.equal((await g("+905321112299")).govde.error.code, 131048, "251. farklı alıcı → D0 kod");
    s.saat(t0 + 24 * 3600e3 + 1);
    assert.equal((await g("+905321112299")).http, 200, "dış kullanım penceresi kaydı → yer açıldı");
  } finally { await s.kapat(); }
});

// ---- medya --------------------------------------------------------------------------------------------------------------------
test("medya: PDF dışı içerik application/pdf → 131053; desteklenmeyen tür → 131053; messaging_product yok → 100; dosya yok → 131008", async () => {
  const s = await kur();
  try {
    assert.equal((await medyaYukle(s, { icerik: Buffer.from("merhaba") })).govde.error.code, 131053);
    assert.equal((await medyaYukle(s, { tur: "application/zip" })).govde.error.code, 131053);
    assert.equal((await medyaYukle(s, { urun: null })).govde.error.code, 100);
    assert.equal((await medyaYukle(s, { icerik: null })).govde.error.code, 131008);
    assert.equal((await medyaYukle(s, { dosyaTuru: "text/plain" })).govde.error.code, 131053, "D0: file Content-Type ≠ type");
    const iyi = await medyaYukle(s);
    assert.equal(iyi.http, 200);
    const kayit = s.kayit().medyalar.find(x => x.id === iyi.govde.id);
    assert.equal(kayit.dosyaAdi, "Ekstre Ayşe Yılmaz 2026-10.pdf", "Türkçe dosya adı korunur");
    assert.equal(kayit.boyut, PDF.length);
  } finally { await s.kapat(); }
});

test("medya GET (url/mime/sha256/boyut), indirme belirteç ister, DELETE success, ikinci DELETE ve süresi dolmuş GET hata", async () => {
  const s = await kur();
  try {
    s.saat(Date.parse("2026-10-30T10:00:00Z"));
    const m = await medyaYukle(s);
    const g = await graph(s, `/v26.0/${m.govde.id}?phone_number_id=${NUMARA}`);
    assert.equal(g.govde.mime_type, "application/pdf");
    assert.equal(g.govde.file_size, String(PDF.length));
    assert.match(g.govde.sha256, /^[0-9a-f]{64}$/);
    assert.equal((await fetch(g.govde.url)).status, 401);
    const ind = await fetch(g.govde.url, { headers: { authorization: `Bearer ${B}` } });
    assert.equal(ind.status, 200); assert.deepEqual(Buffer.from(await ind.arrayBuffer()), PDF);
    assert.equal((await graph(s, `/v26.0/${m.govde.id}?phone_number_id=999`)).govde.error.code, 100);
    assert.deepEqual((await graph(s, `/v26.0/${m.govde.id}`, { method: "DELETE" })).govde, { success: true });
    assert.equal((await graph(s, `/v26.0/${m.govde.id}`, { method: "DELETE" })).govde.error.code, 100);
    const m2 = await medyaYukle(s);
    s.saat(Date.parse("2026-11-29T10:00:01Z"));
    assert.equal((await graph(s, `/v26.0/${m2.govde.id}`)).govde.error.code, 100);
    assert.equal(s.kayit().sayilar.medyaSilme, 1);
  } finally { await s.kapat(); }
});

// ---- şablonlar ----------------------------------------------------------------------------------------------------------------
async function surdurulebilir(s, icerik = PDF) {
  const b = await graph(s, `/v26.0/900000000000001/uploads?file_name=ornek.pdf&file_length=${icerik.length}&file_type=application/pdf`, { method: "POST" });
  const r = await fetch(`${s.url}/v26.0/${b.govde.id}`, { method: "POST", headers: { authorization: `OAuth ${B}`, file_offset: "0" }, body: icerik });
  return { baslat: b, parca: await r.json() };
}

test("şablon oluşturma: ad kuralı 100, aynı ad+dil 100/2388024, alt satır > 60 → 2388040, sondaki değişken 2388299", async () => {
  const s = await kur({ sablonlar: [] });
  try {
    const olustur = govde => graph(s, `/v26.0/${WABA}/message_templates`, { method: "POST", json: govde });
    const temel = { name: "destekofis_odeme_hatirlatma", language: "tr", category: "UTILITY", components: HATIRLATMA.components };
    assert.equal((await olustur({ ...temel, name: "Destekofis Ekstre" })).govde.error.code, 100);
    assert.equal((await olustur({ ...temel, category: "PROMO" })).govde.error.code, 100);
    assert.equal((await olustur({ ...temel, language: "xx" })).govde.error.code, 100);
    const ilk = await olustur(temel);
    assert.equal(ilk.http, 200); assert.equal(ilk.govde.status, "PENDING"); assert.equal(ilk.govde.category, "UTILITY");
    const ikinci = await olustur(temel);
    assert.equal(ikinci.govde.error.code, 100); assert.equal(ikinci.govde.error.error_subcode, 2388024);
    const uzunAlt = { ...temel, name: "a1", components: [...temel.components, { type: "FOOTER", text: "x".repeat(61) }] };
    assert.equal((await olustur(uzunAlt)).govde.error.code, 2388040);
    const kvkk = { ...temel, name: "a2", components: [...temel.components, { type: "FOOTER", text: "KVKK aydınlatma metni için firmamıza başvurabilirsiniz." }] };
    assert.equal((await olustur(kvkk)).http, 200, "plan alt satırı 55 karakter");
    const sonda = { ...temel, name: "a3", components: [{ type: "BODY", text: "Bakiyeniz {{1}}", example: { body_text: [["5"]] } }] };
    assert.equal((await olustur(sonda)).govde.error.code, 2388299);
    const ornekSiz = { ...temel, name: "a4", components: [{ type: "BODY", text: "Sayın {{1}} merhaba" }] };
    assert.equal((await olustur(ornekSiz)).govde.error.code, 100);
  } finally { await s.kapat(); }
});

test("belge başlıklı şablon: Resumable Upload tutamağı şart (D0 akışı); Meta UTILITY isteneni MARKETING onaylayabilir", async () => {
  const s = await kur({ sablonlar: [], kategoriKarari: { destekofis_ekstre: "MARKETING" } });
  try {
    const govde = h => ({ name: "destekofis_ekstre", language: "tr", category: "UTILITY", components: [
      { type: "HEADER", format: "DOCUMENT", example: { header_handle: [h] } }, EKSTRE.components[1], EKSTRE.components[2]] });
    assert.equal((await graph(s, `/v26.0/${WABA}/message_templates`, { method: "POST", json: govde("4::uydurma") })).govde.error.code, 100);
    const yanlisUygulama = await graph(s, `/v26.0/123/uploads?file_length=10&file_type=application/pdf`, { method: "POST" });
    assert.equal(yanlisUygulama.govde.error.code, 100);
    const { baslat, parca } = await surdurulebilir(s);
    assert.match(baslat.govde.id, /^upload:/);
    assert.match(parca.h, /^4::/);
    const r = await graph(s, `/v26.0/${WABA}/message_templates`, { method: "POST", json: govde(parca.h) });
    assert.equal(r.http, 200, JSON.stringify(r.govde));
    assert.equal(r.govde.category, "MARKETING", "belge: 09.04.2025'ten beri UTILITY isteneni MARKETING onaylar");
  } finally { await s.kapat(); }
});

test("şablon listesi: fields + status süzgeci, quality_score {score,date}, sayfalama", async () => {
  const s = await kur();
  try {
    s.meta.sablonEkle({ waba: WABA, name: "eski_sablon", status: "REJECTED", category: "MARKETING" });
    const tum = await graph(s, `/v26.0/${WABA}/message_templates?fields=name,language,status,category,quality_score`);
    assert.equal(tum.govde.data.length, 3);
    const e = tum.govde.data.find(x => x.name === "destekofis_ekstre");
    assert.deepEqual(Object.keys(e).sort(), ["category", "id", "language", "name", "quality_score", "status"]);
    assert.equal(e.quality_score.score, "UNKNOWN");
    assert.equal(typeof e.quality_score.date, "number");
    const onayli = await graph(s, `/v26.0/${WABA}/message_templates?fields=name,status&status=approved`);
    assert.deepEqual(onayli.govde.data.map(x => x.name).sort(), ["destekofis_ekstre", "destekofis_odeme_hatirlatma"]);
    const sayfa = await graph(s, `/v26.0/${WABA}/message_templates?fields=name&limit=2`);
    assert.equal(sayfa.govde.data.length, 2); assert.ok(sayfa.govde.paging.next);
    const sonraki = await graph(s, `/v26.0/${WABA}/message_templates?fields=name&limit=2&after=${sayfa.govde.paging.cursors.after}`);
    assert.equal(sonraki.govde.data.length, 1);
    const id = e.id;
    const tek = await graph(s, `/v26.0/${id}?fields=quality_score`);
    assert.deepEqual(Object.keys(tek.govde).sort(), ["id", "quality_score"]);
  } finally { await s.kapat(); }
});

test("şablon silme: ada göre; onaylı silinen ad 30 gün açılamaz (D0 kod); DISABLED silinemez; düzenleme sınırları", async () => {
  const s = await kur();
  try {
    s.saat(Date.parse("2026-10-30T10:00:00Z"));
    assert.deepEqual((await graph(s, `/v26.0/${WABA}/message_templates?name=destekofis_odeme_hatirlatma`, { method: "DELETE" })).govde, { success: true });
    assert.equal((await graph(s, `/v26.0/${WABA}/message_templates?name=destekofis_odeme_hatirlatma`, { method: "DELETE" })).govde.error.code, 100);
    const yeniden = { name: "destekofis_odeme_hatirlatma", language: "tr", category: "UTILITY", components: HATIRLATMA.components };
    assert.equal((await graph(s, `/v26.0/${WABA}/message_templates`, { method: "POST", json: yeniden })).govde.error.code, 100);
    s.saat(Date.parse("2026-11-30T10:00:00Z"));
    assert.equal((await graph(s, `/v26.0/${WABA}/message_templates`, { method: "POST", json: yeniden })).http, 200);
    const e = s.meta.sablonlar.find(x => x.name === "destekofis_ekstre");
    assert.equal((await graph(s, `/v26.0/${e.id}`, { method: "POST", json: { components: EKSTRE.components } })).govde.success, true);
    assert.equal((await graph(s, `/v26.0/${e.id}`, { method: "POST", json: { components: EKSTRE.components } })).govde.error.code, 100, "24 saatte 1 düzenleme");
    assert.equal((await graph(s, `/v26.0/${e.id}`, { method: "POST", json: { category: "MARKETING" } })).govde.error.code, 100, "onaylının kategorisi düzenlenemez");
    const bekleyen = s.meta.sablonlar.find(x => x.name === "destekofis_odeme_hatirlatma" && !x.silindi);
    assert.equal((await graph(s, `/v26.0/${bekleyen.id}`, { method: "POST", json: { components: HATIRLATMA.components } })).govde.error.code, 2388039);
    e.status = "DISABLED";
    assert.equal((await graph(s, `/v26.0/${WABA}/message_templates?name=destekofis_ekstre`, { method: "DELETE" })).govde.error.code, 100);
  } finally { await s.kapat(); }
});

// ---- numara, abonelik, kayıt, kod değişimi ------------------------------------------------------------------------------------
test("numara: whatsapp_business_manager_messaging_limit TIER_250; messaging_limit_tier reddedilir (kaldırıldı); webhook_configuration", async () => {
  const s = await kur({ uygulama: { kancaAdresi: "https://kapi.example/wa/meta" } });
  try {
    const r = await graph(s, `/v26.0/${NUMARA}?fields=whatsapp_business_manager_messaging_limit`);
    assert.deepEqual(r.govde, { whatsapp_business_manager_messaging_limit: "TIER_250", id: NUMARA });
    assert.equal((await graph(s, `/v26.0/${NUMARA}?fields=messaging_limit_tier`)).govde.error.code, 100);
    assert.equal((await graph(s, `/v26.0/${NUMARA}`, { method: "POST", json: { webhook_configuration: { override_callback_uri: "https://ofis.example/n", verify_token: "v" } } })).govde.success, true);
    await graph(s, `/v26.0/${WABA}/subscribed_apps`, { method: "POST", json: { override_callback_uri: "https://ofis.example/w", verify_token: "v2" } });
    const wc = await graph(s, `/v26.0/${NUMARA}?fields=webhook_configuration`);
    assert.deepEqual(wc.govde.webhook_configuration, { phone_number: "https://ofis.example/n", whatsapp_business_account: "https://ofis.example/w", application: "https://kapi.example/wa/meta" });
    s.meta.numaralar.get(NUMARA).basamak = "TIER_2K";
    assert.equal((await graph(s, `/v26.0/${NUMARA}?fields=whatsapp_business_manager_messaging_limit,throughput`)).govde.whatsapp_business_manager_messaging_limit, "TIER_2K");
  } finally { await s.kapat(); }
});

test("subscribed_apps: override ≤ 200 karakter + verify_token; GET override_callback_uri gösterir; gövdesiz POST override'ı kaldırır", async () => {
  const s = await kur();
  try {
    assert.equal((await graph(s, `/v26.0/${WABA}/subscribed_apps`, { method: "POST", json: { override_callback_uri: "https://a/" + "x".repeat(200), verify_token: "v" } })).govde.error.code, 100);
    assert.equal((await graph(s, `/v26.0/${WABA}/subscribed_apps`, { method: "POST", json: { override_callback_uri: "https://ofis.example/wa" } })).govde.error.code, 100);
    assert.equal((await graph(s, `/v26.0/${WABA}/subscribed_apps`, { method: "POST", json: { override_callback_uri: "https://ofis.example/wa", verify_token: "v" } })).govde.success, true);
    const g = await graph(s, `/v26.0/${WABA}/subscribed_apps`);
    assert.equal(g.govde.data[0].override_callback_uri, "https://ofis.example/wa");
    assert.equal(g.govde.data[0].whatsapp_business_api_data.id, "900000000000001");
    await graph(s, `/v26.0/${WABA}/subscribed_apps`, { method: "POST" });
    assert.equal("override_callback_uri" in (await graph(s, `/v26.0/${WABA}/subscribed_apps`)).govde.data[0], false);
  } finally { await s.kapat(); }
});

test("register: 72 saatte 10 deneme, 11. → 133016; yanlış PIN 133005; birlikte kullanımda deregister reddi (D0)", async () => {
  const s = await kur();
  try {
    s.saat(Date.parse("2026-10-30T10:00:00Z"));
    s.meta.numaralar.get(NUMARA).pin = "123456";
    assert.equal((await graph(s, `/v26.0/${NUMARA}/register`, { method: "POST", json: { messaging_product: "whatsapp", pin: "000000" } })).govde.error.code, 133005);
    for (let i = 0; i < 9; i += 1) assert.equal((await graph(s, `/v26.0/${NUMARA}/register`, { method: "POST", json: { messaging_product: "whatsapp", pin: "123456" } })).http, 200);
    assert.equal((await graph(s, `/v26.0/${NUMARA}/register`, { method: "POST", json: { messaging_product: "whatsapp", pin: "123456" } })).govde.error.code, 133016);
    s.saat(Date.parse("2026-11-02T10:00:01Z"));
    assert.equal((await graph(s, `/v26.0/${NUMARA}/register`, { method: "POST", json: { messaging_product: "whatsapp", pin: "123456" } })).http, 200);
    s.meta.numaralar.get(NUMARA).birlikteKullanim = true;
    assert.equal((await graph(s, `/v26.0/${NUMARA}/deregister`, { method: "POST" })).govde.error.code, 100);
  } finally { await s.kapat(); }
});

test("oauth/access_token: kod → iş belirteci; ikinci kullanım ve 30 sn sonrası ret; yanlış gizli anahtar ret", async () => {
  const s = await kur();
  try {
    s.saat(Date.parse("2026-10-30T10:00:00Z"));
    const kod = s.esKoduUret({ waba: WABA });
    const yanlis = await graph(s, `/v26.0/oauth/access_token?client_id=900000000000001&client_secret=yanlis&code=${kod}`, { belirtec: null });
    assert.equal(yanlis.govde.error.code, 100);
    const r = await graph(s, `/v26.0/oauth/access_token?client_id=900000000000001&client_secret=SAHTE-UYGULAMA-SIRRI&code=${kod}`, { belirtec: null });
    assert.equal(r.govde.token_type, "bearer");
    assert.match(r.govde.access_token, /^SAHTE-IS-BELIRTECI-/);
    assert.equal((await graph(s, `/v26.0/${WABA}/message_templates?fields=name`, { belirtec: r.govde.access_token })).http, 200);
    assert.equal((await graph(s, `/v26.0/oauth/access_token?client_id=900000000000001&client_secret=SAHTE-UYGULAMA-SIRRI&code=${kod}`, { belirtec: null })).govde.error.code, 100);
    const kod2 = s.esKoduUret({ waba: WABA });
    s.saat(Date.parse("2026-10-30T10:00:31Z"));
    assert.equal((await graph(s, `/v26.0/oauth/access_token?client_id=900000000000001&client_secret=SAHTE-UYGULAMA-SIRRI&code=${kod2}`, { belirtec: null })).govde.error.code, 100);
  } finally { await s.kapat(); }
});

// ---- durum kancası ------------------------------------------------------------------------------------------------------------
test("kanca gövdesi belge biçiminde: sent (fiyatsız) → delivered (pricing utility/regular) → read (fiyatsız); opaque geri gelir; imza (D0)", async () => {
  const a = await alici();
  const s = await kur({ uygulama: { imzala: true } });
  try {
    await graph(s, `/v26.0/${WABA}/subscribed_apps`, { method: "POST", json: { override_callback_uri: a.url, verify_token: "dogrula" } });
    const m = await medyaYukle(s);
    const r = await graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: ekstreIletisi(m.govde.id, { opaque: "is-7" }) });
    const wamid = r.govde.messages[0].id;
    for (const d of ["sent", "delivered", "read"]) await s.durumGonder({ wamid, durum: d });
    assert.equal(a.gelen.length, 3);
    for (const g of a.gelen) {
      assert.equal(g.govde.object, "whatsapp_business_account");
      assert.equal(g.govde.entry[0].id, WABA);
      assert.equal(g.govde.entry[0].changes[0].field, "messages");
      assert.deepEqual(g.govde.entry[0].changes[0].value.metadata, { display_phone_number: "902125550000", phone_number_id: NUMARA });
      const st = g.govde.entry[0].changes[0].value.statuses[0];
      assert.equal(st.id, wamid); assert.equal(st.recipient_id, "905321112233"); assert.equal(st.biz_opaque_callback_data, "is-7");
      assert.match(st.timestamp, /^\d+$/);
      assert.equal("conversation" in st, false, "v24.0+ conversation yok");
      // bağımsız doğrulama (sunucunun kendi imza işleviyle DEĞİL): HMAC-SHA256(uygulama gizli anahtarı, ham gövde) — D0 biçim
      assert.equal(g.basliklar["x-hub-signature-256"], "sha256=" + crypto.createHmac("sha256", "SAHTE-UYGULAMA-SIRRI").update(g.ham).digest("hex"));
      assert.ok(imzaDogru(g.ham, g.basliklar["x-hub-signature-256"], "SAHTE-UYGULAMA-SIRRI"));
      assert.equal(imzaDogru(g.ham, g.basliklar["x-hub-signature-256"], "BASKA-SIR"), false);
    }
    const fiyat = a.gelen.map(g => g.govde.entry[0].changes[0].value.statuses[0].pricing ?? null);
    assert.equal(fiyat[0], null); assert.deepEqual(fiyat[1], { billable: true, pricing_model: "PMP", type: "regular", category: "utility" }); assert.equal(fiyat[2], null);
  } finally { await s.kapat(); await a.kapat(); }
});

test("kanca: failed + errors[] (131026), yinelenen olay (tekrar), sahte/bilinmeyen wamid ham gönderimi", async () => {
  const a = await alici();
  const s = await kur({ uygulama: { kancaAdresi: a.url } });
  try {
    const m = await medyaYukle(s);
    const r = await graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: ekstreIletisi(m.govde.id) });
    await s.durumGonder({ wamid: r.govde.messages[0].id, durum: "failed", hataKodu: 131026 });
    await s.durumGonder({ wamid: r.govde.messages[0].id, durum: "delivered", tekrar: 3 });
    await s.durumGonder({ wamid: "wamid.SAHTE", durum: "delivered", sahte: { numaraKimligi: NUMARA, alici: "+905339998877", waba: "123" } });
    assert.equal(a.gelen.length, 5);
    const ilk = a.gelen[0].govde.entry[0].changes[0].value.statuses[0];
    assert.equal(ilk.status, "failed"); assert.equal(ilk.errors[0].code, 131026); assert.equal("pricing" in ilk, false);
    assert.equal(a.gelen[4].govde.entry[0].id, "123");
    assert.equal(a.gelen[4].govde.entry[0].changes[0].value.statuses[0].id, "wamid.SAHTE");
    assert.equal("x-hub-signature-256" in a.gelen[0].basliklar, false, "imza kapalıyken başlık yok");
  } finally { await s.kapat(); await a.kapat(); }
});

test("kanca 200 dışı → Meta kuyruğu; sonraki işlemede teslim; 7 günü geçen düşer (belge: 7 güne kadar yeniden deneme)", async () => {
  const a = await alici(n => (n <= 1 ? 503 : 200));
  const s = await kur({ uygulama: { kancaAdresi: a.url } });
  try {
    const t0 = Date.parse("2026-10-30T10:00:00Z");
    s.saat(t0);
    const m = await medyaYukle(s);
    const r = await graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: ekstreIletisi(m.govde.id) });
    await s.durumGonder({ wamid: r.govde.messages[0].id, durum: "delivered" });
    assert.equal(s.kayit().kancaKuyrugu, 1);
    assert.deepEqual(await s.kuyruguIsle(), [], "süresi gelmeden denenmez");
    s.saat(t0 + 61e3);
    const sonuc = await s.kuyruguIsle();
    assert.equal(sonuc[0].durum, "teslim");
    assert.equal(a.gelen.length, 2);
    // 7 gün: ikinci kanca hiç kabul edilmesin
    a.gelen.length = 0;
    const b = await alici(503);
    s.meta.ayar.uygulama.kancaAdresi = b.url;
    await s.durumGonder({ wamid: r.govde.messages[0].id, durum: "read" });
    s.saat(t0 + 61e3 + YEDI_GUN_MS + 1);
    const son = await s.kuyruguIsle({ hepsi: true });
    assert.equal(son[0].durum, "dustu");
    assert.equal(s.kayit().kancaDusen, 1);
    await b.kapat();
  } finally { await s.kapat(); await a.kapat(); }
});

test("kanca doğrulama GET (D0): hub.mode/hub.verify_token/hub.challenge; alıcı challenge'ı dönerse geçti", async () => {
  const a = await alici();
  const s = await kur();
  try {
    await graph(s, `/v26.0/${WABA}/subscribed_apps`, { method: "POST", json: { override_callback_uri: a.url, verify_token: "dogrula-1" } });
    const r = await (await fetch(`${s.url}/__sahte/kanca/dogrula`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).json();
    assert.equal(r.gecti, true);
    const u = new URL(a.gelen[0].url, "http://x");
    assert.equal(u.searchParams.get("hub.mode"), "subscribe");
    assert.equal(u.searchParams.get("hub.verify_token"), "dogrula-1");
  } finally { await s.kapat(); await a.kapat(); }
});

test("WhatsApp kullanmayan alıcı: ileti KABUL edilir, failed 131026 kancası kendiliğinden gelir (plan §2.7 D0: teslim hatası kancada)", async () => {
  const a = await alici();
  const s = await kur({ uygulama: { kancaAdresi: a.url }, alicilar: { "905321112233": { whatsapp: false } } });
  try {
    const m = await medyaYukle(s);
    const r = await graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: ekstreIletisi(m.govde.id) });
    assert.equal(r.http, 200);
    for (let i = 0; i < 300 && !a.gelen.length; i += 1) await new Promise(x => setTimeout(x, 10));
    assert.equal(a.gelen[0].govde.entry[0].changes[0].value.statuses[0].errors[0].code, 131026);
  } finally { await s.kapat(); await a.kapat(); }
});

// ---- güvenlik / denetim uçları ------------------------------------------------------------------------------------------------
test("belirteç sızıntısı: belirteç gövdede/sorguda görülürse kayda düşer (Authorization başlığı sayılmaz)", async () => {
  const s = await kur();
  try {
    const m = await medyaYukle(s);
    await graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: ekstreIletisi(m.govde.id) });
    assert.equal(s.kayit().sizintilar.length, 0);
    await graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: ekstreIletisi(m.govde.id, { degerler: [B, "F", "D", "1,00 TL"] }) });
    await graph(s, `/v26.0/${NUMARA}?fields=id&access_token=${B}`, { belirtec: null });
    assert.deepEqual(s.kayit().sizintilar.map(x => x.yer), ["govde", "sorgu"]);
  } finally { await s.kapat(); }
});

test("sürüm: sürümsüz yol çalışır; kaldırılmış sürüm reddedilir (D0)", async () => {
  const s = await kur({ kaldirilmisSurumler: ["v20.0"] });
  try {
    assert.equal((await graph(s, `/${NUMARA}?fields=id`)).http, 200);
    assert.equal((await graph(s, `/v20.0/${NUMARA}?fields=id`)).govde.error.code, 100);
    assert.equal(s.kayit().istekler.at(-1).surum, "v20.0");
  } finally { await s.kapat(); }
});

test("denetim uçları HTTP üzerinden: /__sahte/kural, /__sahte/saat, /__sahte/sablon, /__sahte/kayit", async () => {
  const s = await kur();
  try {
    const post = (yol, g) => fetch(`${s.url}/__sahte/${yol}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(g) }).then(r => r.json());
    assert.ok((await post("kural", { yol: "messages", yanit: { hata: 190 } })).kimlik);
    assert.equal((await post("saat", { simdi: "2026-12-31T23:59:59+03:00" })).simdi, Date.parse("2026-12-31T23:59:59+03:00"));
    assert.equal((await post("sablon", { name: "destekofis_ekstre", category: "MARKETING" })).category, "MARKETING");
    const m = await medyaYukle(s);
    const r = await graph(s, `/v26.0/${NUMARA}/messages`, { method: "POST", json: ekstreIletisi(m.govde.id) });
    assert.equal(r.govde.error.code, 190);
    const k = await (await fetch(`${s.url}/__sahte/kayit`)).json();
    assert.equal(k.sayilar.toplamMesajIstegi, 1);
    assert.equal(k.istekler.at(-1).kural, 1);
    const ham = await fetch(`${s.url}/__sahte/medya/${m.govde.id}`);
    assert.deepEqual(Buffer.from(await ham.arrayBuffer()), PDF);
  } finally { await s.kapat(); }
});

test("durumGovdesi saf: birden çok durum tek gövdede (Meta toplu teslim edebilir)", () => {
  const g = durumGovdesi({ wabaId: 1, gorunenNumara: "15550783881", numaraKimligi: 2, durumlar: [{ id: "a", status: "sent", timestamp: 1, recipient_id: 3 }, { id: "b", status: "read", timestamp: 2, recipient_id: 4 }] });
  assert.equal(g.entry[0].changes[0].value.statuses.length, 2);
  assert.equal(g.entry[0].changes[0].value.statuses[1].timestamp, "2");
});
