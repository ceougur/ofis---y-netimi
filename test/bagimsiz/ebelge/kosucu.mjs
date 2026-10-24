#!/usr/bin/env node
// e-Belge kâhini — program tarafı koşucu (dil "destekofis-ebelge/3", /2 ve /1; test/bagimsiz/ebelge/model.py ile aynı senaryo).
//
//   node test/bagimsiz/ebelge/kosucu.mjs <senaryo.json> --cikti <dosya>
//
// Programı geçici veriyle başlatır (test/helpers.mjs startTestServer; e-Belge açık; sahte saat sabit, "gun_ilerlet" ile ilerler;
// HUKUK_LICENSE_URL=http://127.0.0.1:9 — gerçek lisans servisine ulaşmaz, ders 30). Entegratör adresi sahte EDM'nin (test/einvoice-mock.mjs)
// ÖNÜNDEKİ bir vekildir: vekil arıza enjekte eder (ağ yok = bağlantı reddi; tek atımlık geçici hata 500; kopma önce/sonra) ve her
// SendInvoice denemesini (kimlik, ETTN, adım) yazar. Ağa ÇIKILMAZ (fetchImpl yalnız 127.0.0.1).
// /2 (2.4.4): e-SMM makbuzu (program e-SMM adresini e-Fatura adresinden türetir: …/ESmmEDM.svc — vekil aynı yolu yakalar; SendSMM denemeleri de yazılır),
// Seçilenleri Gönder (send-pending { only }; ilk istek 409 einvoice-selection-older + olderIds — kara kutu yoklamasıyla öğrenildi, KARARLAR.md), Yalnız
// Programda İptal (cancel { localOnly, confirmLocal }), kayıttan önce ön hesap (POST invoices/calc: blockers, partyProblems) ve EDM'ye giden UBL'deki
// alıcı alanları (il, vergi dairesi, kimlik, ödenecek) GÖZLENİR. Beklenen değer yine HESAPLANMAZ.
// /3 (23.10.2026): Sil (DELETE invoices/:id?reason=…) ve Silinenler'den Geri Yükle (GET /api/admin/trash → kind "invoice", ref = belge kimliği; POST
// /api/admin/trash/restore { id }) — uç adları test/numara-silinen-244.test.mjs ÇAĞRI satırlarından, yanıt biçimi kara kutu yoklamasından (silinen belge
// hiçbir liste sekmesinde görünmez). Silinenler'deki belge gözleme "cop: true" ile, son görülen alanlarıyla girer (numarası kullanılmış sayılır — K38).
// /3 ek (23.10.2026, K43–K45 [KULLANICI]): vekil her durum sorgusunu (GetInvoiceStatus / GetSMMStatus) adımıyla yazar (gözlem "sorgu": o adımda belge
// için EDM'ye soruldu mu); gönderim arızaları 11048_kendi / _ettnsiz (istek EDM'ye iletilir, EDM'nin gerçek 11048 yanıtı programa verilir; ettnsiz'de
// durum yanıtından ETTN silinir — o belge için sonraki Durum Sorgula adımına dek) ve 11048_baska / _yok (numara sahte EDM'de kullanılmış sayılır —
// usedIds; baska'da o adımın durum sorgusu başka bir ETTN'e yöneltilir); iptal arızaları iptal_kopma_sonra / _once / _red (bir sonraki İptal Et
// isteğine). "esz_sorgu_gonder": oturum 1 Durum Sorgula, EDM'nin yanıtı vekilde tutulur; bu sırada oturum 2 belgeyi gönderir (4 sn içinde biterse sıra
// "eszamanli", bitmezse "bekledi"); sonra tutulan yanıt verilir. 11048 alan belgenin kartındaki/yanıtındaki ileti metinleri (numara geçenler) gözlenir.
// Her adımı programın HTTP API'siyle uygular, sonra programın KENDİ liste uçlarından (Tümü, İptal Edilenler, Gönderilecekler) belge
// durumunu OKUR ve sahte EDM'nin kabul ettiği belgeleri (EDM gerçeği) ekler. Beklenen değer HESAPLAMAZ (temiz oda: model.py'yi okumaz).
// Çıkış: 0 koşu tamam · 1 koşucu hatası (kanıt sayılmaz) · 2 kullanım hatası.
import { randomUUID } from "node:crypto";
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
if (!["destekofis-ebelge/1", "destekofis-ebelge/2", "destekofis-ebelge/3"].includes(senaryo.dil)) {
  console.error(`dil ${senaryo.dil}`);
  process.exit(2);
}

const NS = "urn:edm:test";
const LINES = [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }];
// /2 tutar: "olagan" 500 + %20 = 600 TL, "buyuk" 40.000 + %20 = 48.000 TL (nihai tüketici sınırından uzak; sınır denenmez — KARARLAR.md K36).
const SATIRLAR = { olagan: LINES, buyuk: [{ name: "Danışmanlık", qty: 1, unitPrice: 40000, vatRate: 20 }] };
const smmMi = senaryo.adimlar.some(a => a.belge_turu === "esmm");
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ---- arıza vekili ---------------------------------------------------------------------------------------------------
async function startProxy(target) {
  const hedef = new URL(target);
  const st = { down: false, ariza: null, gecikme: 0, onSend: null, denemeler: [], adim: 0, sockets: new Set(),
    // /3 ek (K43–K45)
    edm: null, iptalAriza: null, sorgular: [], iptalIstekleri: [], yanit11048: [], ettnSil: new Set(), ettnDegis: new Map(), tut: null };
  const kaydet11048 = (r, uuid) => {
    if (/ERROR_CODE(?: xmlns="")?>11048</.test(r.body.toString("utf8"))) st.yanit11048.push({ adim: st.adim, uuid });
  };
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
        const smm = /<(?:\w+:)?SendSMMRequest[\s>]/.test(s);
        const send = smm || /<(?:\w+:)?SendInvoiceRequest[\s>]/.test(s);
        let ariza = null;
        if (send) {
          let id = "";
          let uuid = "";
          if (smm) {
            // e-SMM: SMM öğesinde ID/UUID ÇOCUK öğedir (sahte servisin sözleşmesi, test/esmm-mock.mjs başlığı).
            const blok = (/<(?:\w+:)?SMM\b[^>]*>([\s\S]*?)<\/(?:\w+:)?SMM>/.exec(s) || [])[1] || "";
            id = ((/<(?:\w+:)?ID>([^<]*)</.exec(blok) || [])[1] || "").trim();
            uuid = ((/<(?:\w+:)?UUID>([^<]*)</.exec(blok) || [])[1] || "").trim().toLowerCase();
          } else {
            const inv = /<(?:\w+:)?INVOICE\b([^>]*)>/.exec(s);
            const attr = name => (inv ? (new RegExp(`\\b${name}="([^"]*)"`).exec(inv[1]) || [])[1] : undefined) || "";
            id = attr("ID");
            uuid = attr("UUID").toLowerCase();
          }
          ariza = st.ariza;
          st.ariza = null;
          st.denemeler.push({ adim: st.adim, id, uuid, ariza: ariza || "", servis: smm ? "smm" : "efatura" });
          if (st.onSend) {
            const f = st.onSend;
            st.onSend = null;
            f();
          }
          if (ariza && ariza.startsWith("11048_")) {
            // K44: EDM "bu numara daha önce gönderildi" (11048). kendi/ettnsiz: istek EDM'ye bir kez iletilir (EDM belgeyi alır, yanıt programa verilmez),
            // ikinci iletimin gerçek 11048 yanıtı programa gider. baska/yok: numara sahte EDM'de kullanılmış sayılır (usedIds) → gerçek 11048.
            const dep = smm ? st.edm.state.smm : st.edm.state;
            if (ariza === "11048_kendi" || ariza === "11048_ettnsiz") await ileri(req, body);
            else dep.usedIds.add(id);
            if (ariza === "11048_ettnsiz") st.ettnSil.add(uuid);
            if (ariza === "11048_baska") {
              const baska = randomUUID();
              dep.statuses.set(baska, ["SEND - SUCCEED"]);
              st.ettnDegis.set(uuid, { baska, adim: st.adim });
            }
            const r = await ileri(req, body);
            kaydet11048(r, uuid);
            res.writeHead(r.status, { "content-type": r.type }).end(r.body);
            return;
          }
        }
        if (/<(?:\w+:)?Get(?:Invoice|SMM)StatusRequest[\s>]/.test(s)) {
          // K43–K45: durum sorgusu günlüğü; K44 ETTN'siz / başka ETTN yanıtı; K43 yanıt tutma.
          const kucuk = s.toLowerCase();
          const kayit = { adim: st.adim, govde: kucuk, degisti: "" };
          st.sorgular.push(kayit);
          let govde = body;
          for (const [u, v] of st.ettnDegis) {
            if (v.adim === st.adim && kucuk.includes(u)) {
              govde = Buffer.from(s.replace(new RegExp(u, "gi"), v.baska));
              kayit.degisti = "ettn-baska";
            }
          }
          const sil = [...st.ettnSil].some(u => kucuk.includes(u));
          if (sil) kayit.degisti = "ettn-silindi";
          const tut = st.tut && !st.tut.yakalandi && st.tut.uuid && kucuk.includes(st.tut.uuid) ? st.tut : null;
          if (tut) tut.yakalandi = true;
          let r = await ileri(req, govde);
          if (sil) r = { ...r, body: Buffer.from(r.body.toString("utf8").replace(/\sUUID="[^"]*"/g, "").replace(/<(?:\w+:)?UUID>[^<]*<\/(?:\w+:)?UUID>/g, "")) };
          if (kayit.degisti) kayit.yanit = (/<(?:\w+:)?(?:INVOICE|SMM)_STATUS\b[\s\S]*?<\/(?:\w+:)?(?:INVOICE|SMM)_STATUS>|<(?:\w+:)?Fault>[\s\S]*?<\/(?:\w+:)?Fault>/.exec(r.body.toString("utf8")) || [""])[0].slice(0, 400);
          if (tut) {
            tut.yakala();
            await tut.birakildi;
          }
          res.writeHead(r.status, { "content-type": r.type }).end(r.body);
          return;
        }
        if (/<(?:\w+:)?Cancel(?:Invoice|SMM)Request[\s>]/.test(s)) {
          const ia = st.iptalAriza;
          st.iptalAriza = null;
          st.iptalIstekleri.push({ adim: st.adim, ariza: ia || "" });
          if (ia === "iptal_kopma_once") {
            req.socket.destroy();
            return;
          }
          if (ia === "iptal_red") {
            const smmIptal = /CancelSMMRequest/.test(s);
            res.writeHead(500, { "content-type": "text/xml" }).end(smmIptal
              ? `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><s:Fault><faultcode>s:Client</faultcode><faultstring>İptal talebi kabul edilmedi</faultstring><detail><RequestFault xmlns="http://tempuri.org/"><INTL_TXN_ID xmlns="">0</INTL_TXN_ID><ERROR_CODE xmlns="">11050</ERROR_CODE><ERROR_SHORT_DES xmlns="">İptal talebi kabul edilmedi</ERROR_SHORT_DES></RequestFault></detail></s:Fault></s:Body></s:Envelope>`
              : `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><s:Fault><faultcode>s:Client</faultcode><faultstring>İptal talebi kabul edilmedi</faultstring><detail><RequestFault xmlns="${NS}"><ERROR_CODE>11050</ERROR_CODE><ERROR_SHORT_DES>İptal talebi kabul edilmedi</ERROR_SHORT_DES></RequestFault></detail></s:Fault></s:Body></s:Envelope>`);
            return;
          }
          if (ia === "iptal_kopma_sonra") {
            await ileri(req, body);
            req.socket.destroy();
            return;
          }
        }
        if (ariza === "gecici_hata" && smm) {
          res.writeHead(500, { "content-type": "text/xml" }).end(`<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><s:Fault><faultcode>s:Server</faultcode><faultstring>Geçici sistem hatası</faultstring><detail><RequestFault xmlns="http://tempuri.org/"><INTL_TXN_ID xmlns="">0</INTL_TXN_ID><ERROR_CODE xmlns="">11999</ERROR_CODE><ERROR_SHORT_DES xmlns="">Geçici sistem hatası</ERROR_SHORT_DES></RequestFault></detail></s:Fault></s:Body></s:Envelope>`);
          return;
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
        if (send) kaydet11048(r, ((/\bUUID="([^"]*)"/.exec(s) || /<(?:\w+:)?UUID>([^<]*)</.exec(s) || [])[1] || "").toLowerCase());
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
vekil.edm = edm;
const fetchImpl = async (input, init) => {
  const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (kâhin): ${url}`);
  return globalThis.fetch(input, init);
};
const server = await startTestServer({
  edocEnabled: true,
  ...(smmMi ? { esmmEnabled: true } : {}),
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
    del: async url => unwrap(await c.del(url)),
  };
};
let cikis = 0;
const sonuc = { dil: senaryo.dil, senaryo: senaryo.ad, tohum: senaryo.tohum, kurulum: {}, adimlar: [], eStatusDegerleri: {}, hata: null };
try {
  const api = await oturum();
  const api2 = await oturum();
  const ayar = await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, ...(smmMi ? { esmm: true } : {}), integrator: { env: "test", baseUrl: vekil.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } });
  if (ayar.status !== 200) throw new Error(`ayar ${ayar.status} ${JSON.stringify(ayar.data)}`);
  // Cariler (kurulum doğrulanır: işaret ve PK istenen gibi mi).
  const firm = (name, taxNo, extra) => ({ name, type: "customer", taxNo, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", ...extra });
  const person = (name, taxNo) => ({ name, type: "customer", partyKind: "person", firstName: name.split(" ")[0], familyName: name.split(" ")[1], taxNo, taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir" });
  const tanim = {
    kisi: i => person(["Ayşe Kaya", "Mehmet Demir", "Zeynep Şahin"][i % 3], ["10000000146", "12345678950", "11223344550"][i % 3]),
    mukellef: () => firm("Alıcı Ticaret A.Ş.", BUYER_VKN, { eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" }),
    mukellef_pksiz: () => firm("Çoklu A.Ş.", MULTI_VKN, { eInvoice: true, eAlias: "" }),
    gizli_mukellef: () => firm("Gizli Mükellef A.Ş.", BUYER_VKN, { eInvoice: false, eAlias: "" }),
    // /2 (K36): il yok · vergi dairesi yok · Nihai Tüketici (11111111111; il var, adres yok)
    ilsiz_kisi: () => ({ name: "İlsiz Kişi", type: "customer", partyKind: "person", firstName: "İlsiz", familyName: "Kişi", taxNo: "12345678950", address: "Bir Sk. 1" }),
    vdsiz_mukellef: () => ({ name: "Vergi Dairesiz A.Ş.", type: "customer", partyKind: "company", taxNo: BUYER_VKN, address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" }),
    nihai: () => ({ name: "Nihai Tüketici", type: "customer", partyKind: "person", firstName: "Nihai", familyName: "Tüketici", taxNo: "11111111111", city: "Ankara" }),
  };
  const cariId = {};
  let kisiNo = 0;
  for (const [k, tur] of Object.entries(senaryo.cariler)) {
    const govde = tur === "kisi" ? tanim.kisi(kisiNo++) : tanim[tur]();
    const r = await api.post("/api/workspace/accounts", { ...govde, similarOk: true });
    if (r.status !== 200) throw new Error(`cari ${k} ${r.status} ${JSON.stringify(r.data)}`);
    const beklenen = { kisi: [0, ""], mukellef: [1, "urn:mail:defaultpk@alici.com.tr"], mukellef_pksiz: [1, ""], gizli_mukellef: [0, ""], ilsiz_kisi: [0, ""], vdsiz_mukellef: [1, "urn:mail:defaultpk@alici.com.tr"], nihai: [0, ""] }[tur];
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
  const sonGorulen = {}; // ad → son canlı gözlem (Silinenler'deki belgenin alanları buradan; /3)
  const copListesi = async () => {
    const r = await api.get("/api/admin/trash");
    if (r.status !== 200) throw new Error(`Silinenler ${r.status}`);
    return (Array.isArray(r.data) ? r.data : r.data?.items || []).filter(x => x.kind === "invoice");
  };
  const gozle = async () => {
    const tum = new Map();
    for (const x of [...(await liste("all")), ...(await liste("cancelled"))]) tum.set(x.id, x);
    const bekleyen = new Set((await liste("pending")).map(x => x.id));
    const belgeler = {};
    for (const [id, x] of tum) {
      const ad = idAd[id];
      if (!ad) continue;
      sonuc.eStatusDegerleri[x.eStatus ?? "null"] = (sonuc.eStatusDegerleri[x.eStatus ?? "null"] || 0) + 1;
      belgeler[ad] = { id, ettn: String(x.ettn || "").toLowerCase(), numara: x.number || "", eStatus: x.eStatus ?? "", durum: x.status, tarih: x.issueDate, profil: x.profile || "", eProfil: x.eStatus === "withdrawn" ? await eProfilOku(id) : "", accountId: x.accountId, bekleyen: bekleyen.has(id), eUnsent: x.eUnsent ?? null, eBlocked: x.eBlocked ?? null };
      sonGorulen[ad] = belgeler[ad];
    }
    if (senaryo.dil === "destekofis-ebelge/3") {
      for (const it of await copListesi()) {
        const ad = idAd[it.ref];
        if (!ad || belgeler[ad]) continue;
        if (!sonGorulen[ad]) throw new Error(`${ad}: Silinenler'de ama hiç canlı görülmedi`);
        belgeler[ad] = { ...sonGorulen[ad], cop: true, bekleyen: false };
      }
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
  const belgeSenaryo = {}; // ad → "smm" | "service_sale"
  const belgeSatir = {}; // ad → satırlar
  const govde = (ad, extra = {}) => ({ kind: "sale", scenario: belgeSenaryo[ad] || "service_sale", accountId: cariId[belgeCari[ad]], lines: belgeSatir[ad] || LINES, payment: { rest: "open" }, ...extra });
  const sonuclarOf = r => (r.data?.results || []).map(x => ({ ad: idAd[x.id] || x.id, ok: x.ok, numara: x.number || "", durum: x.status || "", kod: x.code || x.error || "", ileti: x.message || "" }));
  // UBL'den alıcı alanları (gözlem; K36 değişmezi fark.py'de): il, vergi dairesi, kimlik, ödenecek. Okunamayan alan null (ders 4: "bilinmiyor").
  const aliciOku = xml => {
    if (!xml) return null;
    const blok = (/<cac:AccountingCustomerParty>([\s\S]*?)<\/cac:AccountingCustomerParty>/.exec(xml) || [])[1];
    if (!blok) return null;
    const ilk = re => { const m = re.exec(blok); return m ? m[1].trim() : ""; };
    const pts = (/<cac:PartyTaxScheme>([\s\S]*?)<\/cac:PartyTaxScheme>/.exec(blok) || [])[1] || "";
    const kimlik = /<cbc:ID schemeID="(TCKN|VKN)"[^>]*>([^<]*)</.exec(blok);
    const odenecek = /<cac:LegalMonetaryTotal>[\s\S]*?<cbc:PayableAmount[^>]*>([^<]*)</.exec(xml);
    return { il: ilk(/<cac:PostalAddress>[\s\S]*?<cbc:CityName>([^<]*)</), vd: ((/<cbc:Name>([^<]*)</.exec(pts) || [])[1] || "").trim(), kimlikTur: kimlik ? kimlik[1] : "", kimlik: kimlik ? kimlik[2].trim() : "", odenecek: odenecek ? Number(odenecek[1]) : null };
  };

  for (const adim of senaryo.adimlar) {
    vekil.adim = adim.no;
    const kayitOncesi = edm.state.sent.length;
    const cagriOncesi = edm.state.calls.length;
    const iptalOncesi = edm.state.cancelled.length;
    const smmKayitOncesi = edm.state.smm.sent.length;
    const smmCagriOncesi = edm.state.smm.calls.length;
    const smmIptalOncesi = edm.state.smm.cancelled.length;
    const kayit = { no: adim.no, islem: adim.islem, yanit: null, ek: null };
    const id = adim.belge ? belgeId[adim.belge] : undefined;
    const i = adim.islem;
    if (i === "kaydet" || i === "kagit_kaydet") {
      belgeCari[adim.belge] = adim.cari;
      if (i === "kagit_kaydet") {
        const kapat = await api.put("/api/workspace/invoices/settings", { efatura: false, earsiv: false });
        if (kapat.status !== 200) throw new Error(`e-dönüşüm kapatılamadı ${kapat.status}`);
      }
      belgeSenaryo[adim.belge] = adim.belge_turu === "esmm" ? "smm" : "service_sale";
      belgeSatir[adim.belge] = SATIRLAR[adim.tutar || "olagan"];
      const body = { scenario: belgeSenaryo[adim.belge], accountId: cariId[adim.cari], lines: belgeSatir[adim.belge], payment: { rest: "open" }, issueDate: adim.tarih };
      if (i === "kaydet") {
        body.eSend = adim.gonder === "simdi" ? "now" : "later";
        // Ön hesap (POST invoices/calc — UX9 testinin ÇAĞRI satırından + kara kutu yoklamasından): kayıttan ÖNCE ne dediği gözlenir (K37 değişmezi).
        const c = await api.post("/api/workspace/invoices/calc", { kind: "sale", scenario: body.scenario, accountId: body.accountId, issueDate: body.issueDate, issueTime: "10:00", lines: body.lines });
        kayit.onHesap = { status: c.status, blockers: (c.data?.blockers || []).map(x => (typeof x === "string" ? x : x?.message || JSON.stringify(x))), partyProblems: c.data?.partyProblems || [], aliasBlock: c.data?.aliasBlock || "", nextNumber: c.data?.nextNumber || "" };
      }
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
      // K33 Seçilenleri Gönder (/2): send-pending { only: [kimlikler] } (istek biçimi test/ebelge-244-secilenleri-gonder.test.mjs ÇAĞRI satırından; yanıt
      // kara kutu yoklamasından: 409 einvoice-selection-older + count + olderIds). Soru gelirse "eski": "ekle" → { only: seçili ∪ olderIds }, "vazgec" →
      // istek yok. İlk istekte EDM denemesi ve numara değişimi ayrıca gözlenir (K33: soru gönderimden ÖNCE). Beklenen değer yok — model.py verir.
      const ids = adim.belgeler.map(ad => belgeId[ad]).filter(Boolean);
      if (!ids.length) kayit.yanit = { atlandi: "seçili belge programda yok" };
      else {
        const denemeOncesi = vekil.denemeler.length;
        const numaraOncesi = Object.fromEntries(Object.entries((await gozle()).belgeler).map(([ad, b]) => [ad, b.numara]));
        let r = await turGonder(api, { only: ids });
        const soru = r.status === 409 && r.data?.code === "einvoice-selection-older" ? { sayi: r.data.count, eskiler: (r.data.olderIds || []).map(x => idAd[x] || x) } : null;
        if (soru) {
          const sonra = (await gozle()).belgeler;
          soru.ilkIstekDeneme = vekil.denemeler.length - denemeOncesi;
          soru.ilkIstekNumaraDegisen = Object.keys(sonra).filter(ad => (sonra[ad].numara || "") !== (numaraOncesi[ad] || ""));
        }
        const ilk = ozet(r);
        if (soru && adim.eski === "ekle") r = await turGonder(api, { only: [...ids, ...(r.data.olderIds || [])] });
        kayit.yanit = ozet(r);
        kayit.ek = { soru, ilk, sonuclar: sonuclarOf(r) };
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
      // /2 "yerel": Yalnız Programda İptal (cancel { localOnly, confirmLocal } — test/ebelge-244-iptal-suresi.test.mjs ÇAĞRI satırından).
      const body = adim.yerel ? { reason: "Kâhin iptali", localOnly: true, confirmLocal: true } : { reason: "Kâhin iptali" };
      kayit.yanit = ozet(await api.post(`/api/workspace/invoices/${id}/cancel`, body));
    } else if (i === "duzenle_tarih") {
      kayit.yanit = ozet(await api.post(`/api/workspace/invoices/${id}/edit`, govde(adim.belge, { issueDate: adim.tarih })));
    } else if (i === "duzenle_tur") {
      const kart = await api.get(`/api/workspace/invoices/${id}`);
      kayit.yanit = ozet(await api.post(`/api/workspace/invoices/${id}/edit`, govde(adim.belge, { issueDate: kart.data.issueDate, profile: adim.profil })));
    } else if (i === "ariza") {
      if (String(adim.tur).startsWith("iptal_")) vekil.iptalAriza = adim.tur; // K45: bir sonraki İptal Et isteğine
      else vekil.ariza = adim.tur;
    } else if (i === "ag") {
      if (adim.durum === "yok") await vekil.agYok();
      else await vekil.agVar();
    } else if (i === "sil") {
      kayit.yanit = ozet(await api.del(`/api/workspace/invoices/${id}?reason=${encodeURIComponent("Kâhin silme")}`));
    } else if (i === "geri_yukle") {
      const it = (await copListesi()).find(x => x.ref === id);
      kayit.yanit = it ? ozet(await api.post("/api/admin/trash/restore", { id: it.id })) : { atlandi: "Silinenler'de yok" };
    } else if (i === "durum_sorgula") {
      const e = sonGorulen[adim.belge]?.ettn;
      if (e) vekil.ettnSil.delete(e); // K44 ettnsiz: bu sorguda EDM'nin olağan yanıtı (kendi ETTN'i)
      kayit.yanit = ozet(await api.post(`/api/workspace/invoices/${id}/e-refresh`, {}));
    } else if (i === "esz_sorgu_gonder") {
      // K43: oturum 1 Durum Sorgula; EDM'nin yanıtı vekilde tutulur; oturum 2 kart Gönder; sonra tutulan yanıt verilir.
      let yakala;
      const yakalandi = new Promise(resolve => (yakala = resolve));
      let birak;
      const birakildi = new Promise(resolve => (birak = resolve));
      vekil.tut = { uuid: sonGorulen[adim.belge]?.ettn || "", yakalandi: false, yakala, birakildi };
      const p1 = api.post(`/api/workspace/invoices/${id}/e-refresh`, {});
      const tutuldu = await Promise.race([yakalandi.then(() => true), sleep(3000).then(() => false)]);
      if (!tutuldu) vekil.tut = null;
      const p2 = api2.post(`/api/workspace/invoices/${id}/send`, {});
      let r2 = null;
      let sira = "tutulamadi";
      let ara = null;
      if (tutuldu) {
        r2 = await Promise.race([p2, sleep(4000).then(() => null)]);
        sira = r2 ? "eszamanli" : "bekledi";
        if (r2) {
          // Gönderim bitti, sorgu yanıtı henüz verilmedi: belgenin o anki durumu (geç sonuçtan ÖNCE; kanıt — ders 38)
          const k = await api2.get(`/api/workspace/invoices/${id}`);
          ara = { status: k.status, eStatus: k.data?.eStatus ?? null, eUnsent: k.data?.eUnsent ?? null, number: k.data?.number || "" };
        }
      }
      birak();
      vekil.tut = null;
      const r1 = await p1;
      if (!r2) r2 = await p2;
      kayit.yanit = ozet(r1);
      kayit.ek = { gonder: ozet(r2), sira, gonderimSonrasi: ara };
    } else if (i === "gun_ilerlet") {
      server.clock.advance({ days: adim.gun });
    } else throw new Error(`bilinmeyen işlem ${i}`);
    const g = await gozle();
    kayit.gozlem = g.belgeler;
    if (g.yabanci.length) kayit.yabanci = g.yabanci;
    kayit.edm = {
      kabul: [
        ...edm.state.sent.slice(kayitOncesi).map(x => ({ id: x.id, uuid: String(x.uuid || "").toLowerCase(), earchive: String(x.earchive || ""), vkn: x.receiver?.vkn || "", alias: x.receiver?.alias || "", servis: "efatura", alici: aliciOku(x.xml) })),
        // e-SMM servisinin kabul ettikleri (earchive "smm": e-Arşiv/e-Fatura ayrımı uygulanmaz)
        ...edm.state.smm.sent.slice(smmKayitOncesi).map(x => ({ id: x.id, uuid: String(x.uuid || "").toLowerCase(), earchive: "smm", vkn: "", alias: "", servis: "smm", alici: aliciOku(x.xml) })),
      ],
      iptal: [...edm.state.cancelled.slice(iptalOncesi).map(u => String(u).toLowerCase()), ...edm.state.smm.cancelled.slice(smmIptalOncesi).map(u => String(u).toLowerCase())],
      iptalServis: [...edm.state.cancelled.slice(iptalOncesi).map(() => "efatura"), ...edm.state.smm.cancelled.slice(smmIptalOncesi).map(() => "smm")],
      cagrilar: [...edm.state.calls.slice(cagriOncesi).map(c => c.op), ...edm.state.smm.calls.slice(smmCagriOncesi).map(c => `smm:${c.op}`)],
    };
    kayit.bugun = new Date(server.clock.ms()).toISOString().slice(0, 10);
    kayit.arizaBekliyor = vekil.ariza || "";
    kayit.iptalArizaBekliyor = vekil.iptalAriza || "";
    // K43–K45: bu adımda belge için EDM'ye durum sorgusu gitti mi (ETTN ya da numara sorgu gövdesinde)
    const adimSorgu = vekil.sorgular.filter(q => q.adim === adim.no);
    kayit.sorgu = Object.fromEntries(Object.entries(g.belgeler).map(([ad, b]) => [ad, adimSorgu.some(q => (b.ettn && q.govde.includes(b.ettn)) || (b.numara && q.govde.includes(b.numara.toLowerCase())))]));
    kayit.iptalIstek = vekil.iptalIstekleri.filter(x => x.adim === adim.no).length;
    const degisen = adimSorgu.filter(q => q.degisti).map(q => ({ degisti: q.degisti, yanit: q.yanit || "" }));
    if (degisen.length) kayit.sorguDegisen = degisen; // K44 kanıtı: vekilin değiştirdiği durum yanıtları
    // K44: 11048 alan belgenin iletisi (kart + adım yanıtı; numara/11048/çakış/daha önce geçen metinler)
    const y11048 = vekil.yanit11048.filter(x => x.adim === adim.no);
    if (y11048.length) {
      kayit.ileti = {};
      for (const x of y11048) {
        const ad = Object.entries(g.belgeler).find(([, b]) => b.ettn && b.ettn === x.uuid)?.[0];
        if (!ad || kayit.ileti[ad]) continue;
        const kart = await api.get(`/api/workspace/invoices/${belgeId[ad]}`);
        const metinler = [];
        const tara = o => (typeof o === "string" ? (/(numara|11048|çakış|daha önce)/i.test(o) ? metinler.push(o.slice(0, 600)) : null) : o && typeof o === "object" ? Object.values(o).forEach(tara) : null);
        tara(kart.data);
        tara(kayit.yanit);
        tara(kayit.ek);
        kayit.ileti[ad] = metinler.slice(0, 12);
      }
    }
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
  sonuc.ihlalEdm = [...edm.state.violations, ...edm.state.smm.violations.map(v => `e-SMM: ${v}`)];
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
