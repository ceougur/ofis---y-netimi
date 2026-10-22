#!/usr/bin/env node
// e-Belge kâhini — program tarafı koşucu (dil "destekofis-ebelge/1"; test/bagimsiz/ebelge/model.py ile aynı senaryo).
//
//   node test/bagimsiz/ebelge/kosucu.mjs <senaryo.json> --cikti <dosya>
//
// Programı geçici veriyle başlatır (test/helpers.mjs startTestServer; e-Belge açık; sahte saat sabit, "gun_ilerlet" ile ilerler;
// HUKUK_LICENSE_URL=http://127.0.0.1:9 — gerçek lisans servisine ulaşmaz, ders 30). Entegratör adresi sahte EDM'nin (test/einvoice-mock.mjs)
// ÖNÜNDEKİ bir vekildir: vekil arıza enjekte eder (ağ yok = bağlantı reddi; tek atımlık geçici hata 500; kopma önce/sonra) ve her
// SendInvoice denemesini (kimlik, ETTN, adım) yazar. Ağa ÇIKILMAZ (fetchImpl yalnız 127.0.0.1).
// Her adımı programın HTTP API'siyle uygular, sonra programın KENDİ liste uçlarından (Tümü, İptal Edilenler, Gönderilecekler) belge
// durumunu OKUR ve sahte EDM'nin kabul ettiği belgeleri (EDM gerçeği) ekler. Beklenen değer HESAPLAMAZ (temiz oda: model.py'yi okumaz).
// Çıkış: 0 koşu tamam · 1 koşucu hatası (kanıt sayılmaz) · 2 kullanım hatası.
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { BUYER_VKN, MULTI_VKN, OUR_VKN, startMockEdm } from "../../einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "../../helpers.mjs";

const args = process.argv.slice(2);
const senaryoYolu = args.find(a => !a.startsWith("--"));
const ciktiYolu = args[args.indexOf("--cikti") + 1];
if (!senaryoYolu || args.indexOf("--cikti") < 0) {
  console.error("kullanım: node kosucu.mjs <senaryo.json> --cikti <dosya>");
  process.exit(2);
}
const senaryo = JSON.parse(readFileSync(senaryoYolu, "utf8"));
if (senaryo.dil !== "destekofis-ebelge/1") {
  console.error(`dil ${senaryo.dil}`);
  process.exit(2);
}

const NS = "urn:edm:test";
const LINES = [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }];
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ---- arıza vekili ---------------------------------------------------------------------------------------------------
async function startProxy(target) {
  const hedef = new URL(target);
  const st = { down: false, ariza: null, gecikme: 0, onSend: null, denemeler: [], adim: 0, sockets: new Set() };
  const ileri = async (req, body) => {
    const headers = {};
    for (const k of ["content-type", "soapaction"]) if (req.headers[k]) headers[k] = req.headers[k];
    const r = await fetch(hedef.origin + req.url, { method: req.method, headers, body: req.method === "GET" ? undefined : body });
    return { status: r.status, type: r.headers.get("content-type") || "text/xml", body: Buffer.from(await r.arrayBuffer()) };
  };
  const server = createServer((req, res) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", async () => {
      try {
        const body = Buffer.concat(chunks);
        const s = body.toString("utf8");
        const send = /<(?:\w+:)?SendInvoiceRequest[\s>]/.test(s);
        let ariza = null;
        if (send) {
          const inv = /<(?:\w+:)?INVOICE\b([^>]*)>/.exec(s);
          const attr = name => (inv ? (new RegExp(`\\b${name}="([^"]*)"`).exec(inv[1]) || [])[1] : undefined) || "";
          ariza = st.ariza;
          st.ariza = null;
          st.denemeler.push({ adim: st.adim, id: attr("ID"), uuid: attr("UUID"), ariza: ariza || "" });
          if (st.onSend) {
            const f = st.onSend;
            st.onSend = null;
            f();
          }
        }
        if (ariza === "gecici_hata") {
          res.writeHead(500, { "content-type": "text/xml" }).end(`<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><s:Fault><faultcode>s:Server</faultcode><faultstring>Geçici sistem hatası</faultstring><detail><RequestFault xmlns="${NS}"><ERROR_CODE>11999</ERROR_CODE><ERROR_SHORT_DES>Geçici sistem hatası</ERROR_SHORT_DES></RequestFault></detail></s:Fault></s:Body></s:Envelope>`);
          return;
        }
        if (ariza === "kopma_once") {
          req.socket.destroy();
          return;
        }
        if (send && st.gecikme) await sleep(st.gecikme);
        const r = await ileri(req, body);
        if (ariza === "kopma_sonra") {
          req.socket.destroy();
          return;
        }
        res.writeHead(r.status, { "content-type": r.type }).end(r.body);
      } catch (error) {
        req.socket.destroy();
      }
    });
  });
  server.on("connection", socket => {
    st.sockets.add(socket);
    socket.on("close", () => st.sockets.delete(socket));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  st.url = `http://127.0.0.1:${port}${hedef.pathname}`;
  // Ağ yok: dinleme kapanır, açık bağlantılar koparılır → yeni istek ECONNREFUSED (istek EDM'ye kesin ulaşmaz).
  st.agYok = async () => {
    if (st.down) return;
    st.down = true;
    const kapandi = new Promise(resolve => server.close(resolve));
    for (const s of st.sockets) s.destroy();
    await kapandi;
  };
  st.agVar = async () => {
    if (!st.down) return;
    st.down = false;
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
  };
  st.close = async () => {
    for (const s of st.sockets) s.destroy();
    if (!st.down) await new Promise(resolve => server.close(resolve));
  };
  return st;
}

// ---- koşu -----------------------------------------------------------------------------------------------------------
const edm = await startMockEdm();
const vekil = await startProxy(edm.url);
const fetchImpl = async (input, init) => {
  const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (kâhin): ${url}`);
  return globalThis.fetch(input, init);
};
const server = await startTestServer({
  edocEnabled: true,
  fetchImpl,
  now: { time: `${senaryo.bugun}T10:00:00`, fixed: true },
  edocStatusPollMs: [5, 5],
  env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" },
});
const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
const oturum = async () => {
  const c = server.client();
  const l = await c.login("admin", ADMIN_PASSWORD);
  if (l.status !== 200) throw new Error("giriş başarısız");
  return {
    get: async url => unwrap(await c.get(url)),
    post: async (url, body = {}) => unwrap(await c.post(url, body)),
    put: async (url, body = {}) => unwrap(await c.put(url, body)),
  };
};
let cikis = 0;
const sonuc = { dil: senaryo.dil, senaryo: senaryo.ad, tohum: senaryo.tohum, kurulum: {}, adimlar: [], eStatusDegerleri: {}, hata: null };
try {
  const api = await oturum();
  const api2 = await oturum();
  const ayar = await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, integrator: { env: "test", baseUrl: vekil.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } });
  if (ayar.status !== 200) throw new Error(`ayar ${ayar.status} ${JSON.stringify(ayar.data)}`);
  // Cariler (kurulum doğrulanır: işaret ve PK istenen gibi mi).
  const firm = (name, taxNo, extra) => ({ name, type: "customer", taxNo, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", ...extra });
  const person = (name, taxNo) => ({ name, type: "customer", partyKind: "person", firstName: name.split(" ")[0], familyName: name.split(" ")[1], taxNo, taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir" });
  const tanim = {
    kisi: i => person(["Ayşe Kaya", "Mehmet Demir", "Zeynep Şahin"][i % 3], ["10000000146", "12345678950", "11223344550"][i % 3]),
    mukellef: () => firm("Alıcı Ticaret A.Ş.", BUYER_VKN, { eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" }),
    mukellef_pksiz: () => firm("Çoklu A.Ş.", MULTI_VKN, { eInvoice: true, eAlias: "" }),
    gizli_mukellef: () => firm("Gizli Mükellef A.Ş.", BUYER_VKN, { eInvoice: false, eAlias: "" }),
  };
  const cariId = {};
  let kisiNo = 0;
  for (const [k, tur] of Object.entries(senaryo.cariler)) {
    const govde = tur === "kisi" ? tanim.kisi(kisiNo++) : tanim[tur]();
    const r = await api.post("/api/workspace/accounts", { ...govde, similarOk: true });
    if (r.status !== 200) throw new Error(`cari ${k} ${r.status} ${JSON.stringify(r.data)}`);
    const beklenen = { kisi: [0, ""], mukellef: [1, "urn:mail:defaultpk@alici.com.tr"], mukellef_pksiz: [1, ""], gizli_mukellef: [0, ""] }[tur];
    if (Number(r.data.eInvoice) !== beklenen[0] || r.data.eAlias !== beklenen[1]) throw new Error(`cari ${k} kurulumu istenen gibi değil: ${r.data.eInvoice} ${r.data.eAlias}`);
    cariId[k] = r.data.id;
    sonuc.kurulum[k] = { tur, id: r.data.id, eInvoice: r.data.eInvoice, eAlias: r.data.eAlias };
  }

  const belgeId = {}; // ad → program fatura kimliği
  const idAd = {};
  const belgeCari = {};
  const liste = async tab => {
    const out = [];
    for (let offset = 0; ; ) {
      const r = await api.get(`/api/workspace/invoices?tab=${tab}&limit=200&offset=${offset}`);
      if (r.status !== 200) throw new Error(`liste ${tab} ${r.status}`);
      out.push(...r.data.invoices);
      if (!r.data.hasMore) break;
      offset += r.data.invoices.length;
    }
    return out;
  };
  // Müşteri Fişi olarak bırakılan belgenin e-Belge profili (gönderilirse alacağı tür). API'de görünmez (liste ve kart KAGIT gösterir); yalnız
  // gözlem için veri tabanından okunur, programa hiçbir şey yazılmaz — kâhin türü ondan okur (dar kontrol 3, 2.4.3).
  const eProfilOku = async id => server.app.store.get("SELECT e_profile AS eProfile FROM invoices WHERE id = ?", id)?.eProfile || "";
  const gozle = async () => {
    const tum = new Map();
    for (const x of [...(await liste("all")), ...(await liste("cancelled"))]) tum.set(x.id, x);
    const bekleyen = new Set((await liste("pending")).map(x => x.id));
    const belgeler = {};
    for (const [id, x] of tum) {
      const ad = idAd[id];
      if (!ad) continue;
      sonuc.eStatusDegerleri[x.eStatus ?? "null"] = (sonuc.eStatusDegerleri[x.eStatus ?? "null"] || 0) + 1;
      belgeler[ad] = { id, ettn: x.ettn, numara: x.number || "", eStatus: x.eStatus ?? "", durum: x.status, tarih: x.issueDate, profil: x.profile || "", eProfil: x.eStatus === "withdrawn" ? await eProfilOku(id) : "", accountId: x.accountId, bekleyen: bekleyen.has(id) };
    }
    const yabanci = [...tum.keys()].filter(id => !idAd[id]);
    return { belgeler, yabanci };
  };
  const eslestir = async ad => {
    // Kayıt yanıtı kimlik vermediyse (hata yanıtı) yine de oluşmuş olabilir: listede eşlenmemiş yeni belge aranır.
    const { yabanci } = await gozle();
    if (yabanci.length === 1) {
      belgeId[ad] = yabanci[0];
      idAd[yabanci[0]] = ad;
    } else if (yabanci.length > 1) throw new Error(`${ad}: birden çok eşlenmemiş belge`);
  };
  // Tümünü Gönder istemci gibi (2.4.3 parça parça): bir istek en çok ~20 belge / ~10 sn işler, yanıt `remaining` + `attempted` + `cursor`
  // döndürür; aynı tur `after: cursor` ile kalan bitene ya da ilerleme durana kadar sürer (kara kutu yoklamasıyla öğrenildi). Sonuçlar
  // birleştirilir; ilk başarısız HTTP yanıtı (yoksa sonuncusu) turun yanıtıdır.
  const turGonder = async (istemci, body) => {
    let son = null;
    let hata = null;
    const results = [];
    let parca = 0;
    for (let after; ; ) {
      const r = await istemci.post("/api/workspace/invoices/send-pending", after === undefined ? body : { ...body, after });
      parca += 1;
      son = r;
      if (r.status !== 200) {
        hata = hata || r;
        break;
      }
      results.push(...(r.data?.results || []));
      if (!(r.data?.remaining > 0) || !(r.data?.attempted > 0) || !r.data?.cursor || parca > 500) break;
      after = r.data.cursor;
    }
    const y = hata || son;
    return { status: y.status, data: y.status === 200 ? { ...y.data, results, parca } : y.data };
  };
  const ozet = r => ({ status: r.status, kod: r.data?.error?.code || r.data?.code || r.data?.error || "", veri: JSON.stringify(r.data).slice(0, 400) });
  const govde = (ad, extra = {}) => ({ kind: "sale", scenario: "service_sale", accountId: cariId[belgeCari[ad]], lines: LINES, payment: { rest: "open" }, ...extra });

  for (const adim of senaryo.adimlar) {
    vekil.adim = adim.no;
    const kayitOncesi = edm.state.sent.length;
    const cagriOncesi = edm.state.calls.length;
    const iptalOncesi = edm.state.cancelled.length;
    const kayit = { no: adim.no, islem: adim.islem, yanit: null, ek: null };
    const id = adim.belge ? belgeId[adim.belge] : undefined;
    const i = adim.islem;
    if (i === "kaydet" || i === "kagit_kaydet") {
      belgeCari[adim.belge] = adim.cari;
      if (i === "kagit_kaydet") {
        const kapat = await api.put("/api/workspace/invoices/settings", { efatura: false, earsiv: false });
        if (kapat.status !== 200) throw new Error(`e-dönüşüm kapatılamadı ${kapat.status}`);
      }
      const body = { scenario: "service_sale", accountId: cariId[adim.cari], lines: LINES, payment: { rest: "open" }, issueDate: adim.tarih };
      if (i === "kaydet") body.eSend = adim.gonder === "simdi" ? "now" : "later";
      const r = await api.post("/api/workspace/invoices", body);
      kayit.yanit = ozet(r);
      if (r.status === 200 && r.data?.id) {
        belgeId[adim.belge] = r.data.id;
        idAd[r.data.id] = adim.belge;
      } else await eslestir(adim.belge);
      if (i === "kagit_kaydet") {
        const ac = await api.put("/api/workspace/invoices/settings", { efatura: true, earsiv: true });
        if (ac.status !== 200) throw new Error(`e-dönüşüm açılamadı ${ac.status}`);
      }
    } else if (i === "tur_sirasinda_sil" && !id) {
      // Silinecek belge programda yok (kaydı reddedilmişti): yalnız tur koşar (model de öyle yapar).
      const tur = await turGonder(api, { all: true });
      kayit.yanit = { atlandi: "belge yok; yalnız tur" };
      kayit.ek = { tur: ozet(tur), sonuclar: (tur.data?.results || []).map(x => ({ ad: idAd[x.id] || x.id, ok: x.ok, numara: x.number || "", durum: x.status || "", kod: x.code || x.error || "", ileti: x.message || "" })) };
    } else if (adim.belge && !id && i !== "tumunu_gonder") {
      kayit.yanit = { atlandi: "belge yok" };
    } else if (i === "kart_gonder") {
      kayit.yanit = ozet(await api.post(`/api/workspace/invoices/${id}/send`, {}));
    } else if (i === "tumunu_gonder" && adim.kapsam === "secili" && adim.eski !== undefined) {
      // BAĞLANTI (2.4.4, E6 "Seçilenleri Gönder"; YALNIZ çağrı biçimi — kural/beklenen değer YOK, model bu adımı henüz bilmez): adımda "eski"
      // alanı varsa ekranın yeni yolu sürülür: send-pending { only: [kimlikler] }. Seçilmemiş daha eski bekleyen varsa ilk istek gönderimsiz 409
      // einvoice-selection-older (+ olderIds) döner; "eski": "ekle" → { only: seçili ∪ olderIds } ile tur, başka değer → vazgeçilir (istek yok).
      // Gözlem kayda yazılır (ek.soru). "eski" alanı olmayan seçili adım eski { ids } yolunu sürer (aşağıda). Kuralı kodu görmeyen ayrı el yazar.
      const ids = adim.belgeler.map(ad => belgeId[ad]).filter(Boolean);
      if (!ids.length) kayit.yanit = { atlandi: "seçili belge programda yok" };
      else {
        let r = await turGonder(api, { only: ids });
        const soru = r.status === 409 && r.data?.code === "einvoice-selection-older" ? { sayi: r.data.count, eskiler: (r.data.olderIds || []).map(x => idAd[x] || x) } : null;
        if (soru && adim.eski === "ekle") r = await turGonder(api, { only: [...ids, ...(r.data.olderIds || [])] });
        kayit.yanit = ozet(r);
        kayit.ek = { soru, sonuclar: (r.data?.results || []).map(x => ({ ad: idAd[x.id] || x.id, ok: x.ok, numara: x.number || "", durum: x.status || "", kod: x.code || x.error || "", ileti: x.message || "" })) };
      }
    } else if (i === "tumunu_gonder") {
      const body = adim.kapsam === "secili" ? { ids: adim.belgeler.map(ad => belgeId[ad]).filter(Boolean) } : { all: true };
      const r = await turGonder(api, body);
      kayit.yanit = ozet(r);
      kayit.ek = { sonuclar: (r.data?.results || []).map(x => ({ ad: idAd[x.id] || x.id, ok: x.ok, numara: x.number || "", durum: x.status || "", kod: x.code || x.error || "", ileti: x.message || "" })) };
    } else if (i === "esz_tumunu_gonder") {
      const [a, b] = await Promise.all([turGonder(api, { all: true }), turGonder(api2, { all: true })]);
      kayit.yanit = ozet(a);
      kayit.ek = {
        ikinci: ozet(b),
        sonuclar: [a, b].map(r => (r.data?.results || []).map(x => ({ ad: idAd[x.id] || x.id, ok: x.ok, numara: x.number || "", durum: x.status || "", kod: x.code || x.error || "", ileti: x.message || "" }))),
      };
    } else if (i === "tur_sirasinda_sil") {
      // Tur yavaşlatılır (her SendInvoice 250 ms); ilk SendInvoice vekile ulaşınca ikinci oturum belgeyi Listeden Siler.
      vekil.gecikme = 250;
      let silme = null;
      const silindi = new Promise(resolve => {
        vekil.onSend = () => resolve(api2.post(`/api/workspace/invoices/${id}/withdraw`, {}).then(r => ((silme = { ...ozet(r), sira: "tur-icinde" }), r)));
      });
      const tur = await turGonder(api, { all: true });
      if (vekil.onSend) {
        vekil.onSend = null;
        const r = await api2.post(`/api/workspace/invoices/${id}/withdraw`, {});
        silme = { ...ozet(r), sira: "tur-sonrasi" };
      } else await silindi;
      vekil.gecikme = 0;
      kayit.yanit = silme;
      kayit.ek = { tur: ozet(tur), sonuclar: (tur.data?.results || []).map(x => ({ ad: idAd[x.id] || x.id, ok: x.ok, numara: x.number || "", durum: x.status || "", kod: x.code || x.error || "", ileti: x.message || "" })) };
    } else if (i === "listeden_sil") {
      kayit.yanit = ozet(await api.post(`/api/workspace/invoices/${id}/withdraw`, {}));
    } else if (i === "iptal") {
      kayit.yanit = ozet(await api.post(`/api/workspace/invoices/${id}/cancel`, { reason: "Kâhin iptali" }));
    } else if (i === "duzenle_tarih") {
      kayit.yanit = ozet(await api.post(`/api/workspace/invoices/${id}/edit`, govde(adim.belge, { issueDate: adim.tarih })));
    } else if (i === "duzenle_tur") {
      const kart = await api.get(`/api/workspace/invoices/${id}`);
      kayit.yanit = ozet(await api.post(`/api/workspace/invoices/${id}/edit`, govde(adim.belge, { issueDate: kart.data.issueDate, profile: adim.profil })));
    } else if (i === "ariza") {
      vekil.ariza = adim.tur;
    } else if (i === "ag") {
      if (adim.durum === "yok") await vekil.agYok();
      else await vekil.agVar();
    } else if (i === "durum_sorgula") {
      kayit.yanit = ozet(await api.post(`/api/workspace/invoices/${id}/e-refresh`, {}));
    } else if (i === "gun_ilerlet") {
      server.clock.advance({ days: adim.gun });
    } else throw new Error(`bilinmeyen işlem ${i}`);
    const g = await gozle();
    kayit.gozlem = g.belgeler;
    if (g.yabanci.length) kayit.yabanci = g.yabanci;
    kayit.edm = {
      kabul: edm.state.sent.slice(kayitOncesi).map(x => ({ id: x.id, uuid: x.uuid, earchive: String(x.earchive || ""), vkn: x.receiver?.vkn || "", alias: x.receiver?.alias || "" })),
      iptal: edm.state.cancelled.slice(iptalOncesi),
      cagrilar: edm.state.calls.slice(cagriOncesi).map(c => c.op),
    };
    kayit.bugun = new Date(server.clock.ms()).toISOString().slice(0, 10);
    kayit.arizaBekliyor = vekil.ariza || "";
    kayit.ag = vekil.down ? "yok" : "var";
    // Cari işaretleri (program gönderimde alıcıyı sorgulayıp işareti kendisi değiştirebilir — model bunu ortam olarak alır).
    kayit.cariler = {};
    for (const [k, cid] of Object.entries(cariId)) {
      const r = await api.get(`/api/workspace/accounts/${cid}`);
      kayit.cariler[k] = { eInvoice: Number(r.data?.eInvoice || 0), eAlias: r.data?.eAlias || "" };
    }
    sonuc.adimlar.push(kayit);
  }
  sonuc.denemeler = vekil.denemeler;
  sonuc.ihlalEdm = edm.state.violations;
} catch (error) {
  sonuc.hata = String(error?.stack || error);
  cikis = 1;
} finally {
  writeFileSync(ciktiYolu, JSON.stringify(sonuc, null, 1) + "\n");
  await server.close().catch(() => {});
  await vekil.close().catch(() => {});
  await edm.close().catch(() => {});
}
process.exit(cikis);
