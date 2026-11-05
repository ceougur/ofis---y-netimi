// 2.4.9 B2 (docs/2.4.9-tasarim/B2-elle-toplu-alici.md; ders 47): elle (wa.me, "WhatsApp Web ile Gönder") toplu gönderimin alıcı listesi
// (POST /api/workspace/whatsapp/targets). Kök neden (tasarım notu §1, §8): kişi başı TAM cari kartı (accounts.detail; kartın ekran ekleri dahil) okunuyordu ve ekstre
// metni her tutarda yeni Intl.NumberFormat kuruyordu → 2.000 caride ~25 sn, 3.014 caride ~37 sn, olay döngüsü kilitli. Düzeltme: kartın eleme çekirdeği
// (accounts.waFacts — detail ile aynı işlevler, aynı girdi; İş Z) + modül düzeyinde tek biçimleyici. Davranış AYNEN; tek bilinçli fark (§13 b, İLKEYLE — "kime kaç kez"
// ilke 4 "çıkmaz yok"): kartın bir ekran eki hata verirse kişi listeden sessizce DÜŞMEZ.
// Bu dosya: (1) YAPI — tam kart okuması 0, (2) YAPI — ekstre hazırlanırken biçimleyici kurulumu 0 (ikisi eski kodda e3f74093 beklenen nedenle kırmızı — ders 38),
// (3) KÂHİN = SINIF TANIMI (ders 5; sayılar testin girdiği veriden elle yazıldı, programın çıktısından değil), (4) çekirdek ↔ tam kart alıcı listesinin okuduğu alanlarda,
// (5) BİLİNÇLİ TEK FARK (eski kodda kişi düşer, yeni kodda görünür). Gerçek program + yerel sahte Meta (ders 30), sahte saat (ders 13).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { startWa } from "./whatsapp-248-ortak.mjs";

const TARGETS = "/api/workspace/whatsapp/targets";
const BUGUN = "2026-12-22T10:00:00+03:00";

async function kur() {
  // Bağlantı ve onay gerekmez: wa.me yolu WhatsApp Business API'ye bağlı değildir.
  const ctx = await startWa({ connect: false, ack: false });
  try {
    return await doldur(ctx);
  } catch (error) {
    await ctx.close();
    throw error;
  }
}

async function doldur(ctx) {
  const c = {};
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data.data;
  };
  const yeni = async (anahtar, ad, telefon, ek = {}, acilis = 0) => {
    c[anahtar] = await ctx.account(ad, telefon, acilis, { registeredOn: "2026-11-01", ...ek });
    return c[anahtar];
  };
  // Saat 03.11.2026 (startWa); kayıt tarihi 01.11.2026 → açılış bakiyesi satırı 01.11.2026'da.
  await yeni("olagan", "Olağan Bir", "0532 100 00 01", {}, 1500);
  await yeni("olagan2", "Olağan İki", "0532 100 00 02", {}, 800);
  await yeni("pasif", "Pasif Cari", "0532 100 00 03", { status: "passive" }, 300);
  await yeni("istemiyor", "İstemiyor Cari", "0532 100 00 04", { waOptOut: true }, 300);
  await yeni("telefonsuz", "Telefonsuz Cari", "", {}, 200);
  await yeni("gecersiz", "Geçersiz Telefon", "123", {}, 200);
  await yeni("yurtdisi", "Yurt Dışı Telefon", "+44 20 7946 0958", {}, 200);
  await yeni("sabit", "Sabit Hat", "0212 555 01 02", {}, 200);
  await yeni("ayniA", "Aynı Ad", "0532 100 00 09", {}, 100);
  await yeni("ayniB", "Aynı Ad", "0532 100 00 19", {}, 100);
  await yeni("hareketsiz", "Hareketsiz Cari", "0532 100 00 10");
  await yeni("ileri", "İleri Tarihli Cari", "0532 100 00 11");
  await yeni("taksitli", "Taksitli Gecikmiş", "0532 100 00 12");
  await yeni("kapsayan", "Mevcut Borcu Taksitli", "0532 100 00 13", {}, 900);
  await yeni("taksitTahsil", "Taksit Tahsilatlı", "0532 100 00 15");
  await yeni("silinen", "Silinen Cari", "0532 100 00 14");
  await must("tahsilat", ctx.api.post(`/api/workspace/accounts/${c.olagan.id}/entries`, { kind: "in", amount: "250", date: "2026-11-02", method: "cash" }));
  const kartlar = {};
  for (const [anahtar, govde] of [
    ["taksitli", { name: "Taksit", total: "3000", count: 3, firstDue: "2026-11-15", startDate: "2026-11-03" }],
    ["kapsayan", { name: "Mevcut Borç", total: "900", count: 3, firstDue: "2026-11-20", startDate: "2026-11-03", coversBalance: true }],
    ["taksitTahsil", { name: "Tahsilatlı Kart", total: "1200", count: 3, firstDue: "2026-11-10", startDate: "2026-11-03" }],
  ]) kartlar[anahtar] = await must(`taksit kartı ${anahtar}`, ctx.api.post("/api/workspace/plans", { accountId: c[anahtar].id, ...govde }));
  assert.equal((await ctx.api.del(`/api/workspace/accounts/${c.silinen.id}`)).status, 200, "silinen cari silinemedi");
  // Saat ileri akar (geri alınınca programın kapısı ileri tarihli hareketi reddeder): 10.11 taksit tahsilatı, 10.12 borç + elle gönderim geçmişi, 30.12 ileri tarihli borç.
  ctx.clock.set("2026-11-10T10:00:00+03:00");
  await must("taksit tahsilatı", ctx.api.post(`/api/workspace/plans/${kartlar.taksitTahsil.id}/entries`, { kind: "in", amount: "400", date: "2026-11-10", method: "cash" }));
  ctx.clock.set("2026-12-10T10:00:00+03:00");
  await must("aralık borcu", ctx.api.post(`/api/workspace/accounts/${c.olagan2.id}/entries`, { kind: "debt", amount: "200", date: "2026-12-10", note: "Aralık satışı" }));
  // Elle gönderim geçmişi (programın kendi ucu): Olağan Bir "gönderildi", Olağan İki "atlandı" (son gönderim yalnız "sent").
  await must("gönderim kaydı", ctx.api.post("/api/workspace/whatsapp/log", { batchId: "wa-249", accountId: c.olagan.id, kind: "statement", phone: "905321000001", body: "Sayın Olağan Bir…", status: "sent" }));
  await must("atlama kaydı", ctx.api.post("/api/workspace/whatsapp/log", { batchId: "wa-249", accountId: c.olagan2.id, kind: "statement", status: "skipped" }));
  // İleri tarihli hareket (programda bugünden ileri tarih girilemez): saat 30.12.2026'ya alınıp borç o güne yazılır, sonra 22.12.2026'ya döner (bundan sonra yazma yok).
  ctx.clock.set("2026-12-30T10:00:00+03:00");
  await must("ileri borç", ctx.api.post(`/api/workspace/accounts/${c.ileri.id}/entries`, { kind: "debt", amount: "700", date: "2026-12-30" }));
  ctx.clock.set(BUGUN);
  const user = ctx.store.get("SELECT id, username, display_name, role FROM users WHERE username = 'admin'");
  const ids = [...Object.values(c).map(a => a.id), "olmayan-cari-kimligi"];
  return { ctx, c, user, ids };
}

const hazirla = async (ctx, govde) => {
  const r = await ctx.api.post(TARGETS, govde);
  assert.equal(r.status, 200, `alıcı listesi: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
  return r.data.data;
};
const kisiler = data => Object.fromEntries(data.recipients.map(r => [r.id, r]));

// Alıcı listesinin karttan okuduğu alanlar (routes/whatsapp.mjs /targets + statementText; tasarım notu §2 — koddan sayıldı).
const aliciAlanlari = account => ({
  id: account.id,
  refNo: account.refNo,
  name: account.name,
  type: account.type,
  phone: account.phone,
  status: account.status,
  waOptOut: account.waOptOut,
  balance: account.totals?.balance,
  overdue: account.totals?.overdue,
  overdueCount: account.totals?.overdueCount,
  plans: (account.plans || []).map(plan => ({ status: plan.status, next: plan.next })),
  ledger: (account.ledger || []).map(line => ({ kind: line.kind, date: line.date, label: line.label, note: line.note, debit: line.debit, credit: line.credit, balance: line.balance })),
});
const oku = (fn, ...args) => {
  try {
    return { ok: aliciAlanlari(fn(...args)) };
  } catch (error) {
    return { hata: `${error.status || ""} ${error.message}` };
  }
};

describe("2.4.9 B2 — elle toplu WhatsApp alıcı listesi kartın eleme çekirdeğiyle (davranış aynen)", () => {
  it("YAPI: alıcı listesi kişi başı tam cari kartı (accounts.detail) okumaz — her dönemde, ekstre ve mesajda, seçili ve 'Tümüne'", async () => {
    const { ctx, ids } = await kur();
    try {
      const service = ctx.server.app.context.accounts;
      const detail = service.detail;
      let kartOkuma = 0;
      service.detail = (...args) => {
        kartOkuma += 1;
        return detail.apply(service, args);
      };
      try {
        const sayim = [];
        for (const govde of [
          { kind: "statement", ids, preset: "thisMonth" },
          { kind: "statement", ids, preset: "lastMonth" },
          { kind: "statement", ids, preset: "last3" },
          { kind: "statement", ids, preset: "all" },
          { kind: "message", ids },
          { kind: "statement", all: true, status: "all", preset: "thisMonth" },
          { kind: "message", all: true, balance: "debtor" },
        ]) {
          const once = kartOkuma;
          const data = await hazirla(ctx, govde);
          sayim.push({ govde: `${govde.kind} ${govde.preset || ""} ${govde.all ? "Tümüne" : "seçili"}`, alici: data.recipients.length, tamKartOkuma: kartOkuma - once });
        }
        const toplam = sayim.reduce((s, x) => s + x.tamKartOkuma, 0);
        assert.equal(toplam, 0, `alıcı listesi kişi başı tam cari kartı okuyor: ${toplam} çağrı (beklenen 0) — ${JSON.stringify(sayim)}`);
      } finally {
        service.detail = detail;
      }
    } finally {
      await ctx.close();
    }
  });

  it("YAPI: ekstre metni hazırlanırken tutar başına yeni biçimleyici (Intl.NumberFormat) kurulmaz — taksit kartı olmayan hareketli carilerde 0", async () => {
    const { ctx, c } = await kur();
    try {
      // Not: lib/accounts.mjs tlText taksit kartı satırında kurar (tasarım notu §9 KÖR NOKTA, 2.5.0) → bu denetim kartsız carilerde.
      const ozgun = Intl.NumberFormat;
      let kurulum = 0;
      Intl.NumberFormat = new Proxy(ozgun, {
        construct(target, args) {
          kurulum += 1;
          return Reflect.construct(target, args);
        },
        apply(target, self, args) {
          kurulum += 1;
          return Reflect.apply(target, self, args);
        },
      });
      let data;
      try {
        data = await hazirla(ctx, { kind: "statement", ids: [c.olagan.id, c.olagan2.id, c.ileri.id, c.hareketsiz.id], preset: "all" });
      } finally {
        Intl.NumberFormat = ozgun;
      }
      assert.equal(data.recipients.length, 4);
      assert.ok(data.recipients.every(r => /\d,\d\d TL/.test(r.statement)), "ekstre metninde tutar yok (denetim boş geçerdi)");
      assert.equal(kurulum, 0, `ekstre metni her tutarda yeni biçimleyici kuruyor: ${kurulum} (beklenen 0)`);
    } finally {
      await ctx.close();
    }
  });

  it("KÂHİN = SINIF TANIMI: geçerlilik/neden, silinmiş ve olmayan cari, bakiye, sıradaki taksit, gecikmiş, son tahsilat, son gönderim, ekstre metni (devir, dönem, ileri tarih)", async () => {
    const { ctx, c } = await kur();
    try {
      const ids = [...Object.values(c).map(a => a.id), "olmayan-cari-kimligi"];
      const data = await hazirla(ctx, { kind: "statement", ids, preset: "thisMonth" });
      assert.deepEqual(data.range, { from: "2026-12-01", to: "2026-12-22" });
      assert.equal(data.today, "2026-12-22");
      const k = kisiler(data);
      // Silinmiş ve olmayan cari listede YOK; geri kalan 16 cari seçim sırasıyla.
      assert.equal(k[c.silinen.id], undefined);
      assert.equal(k["olmayan-cari-kimligi"], undefined);
      assert.deepEqual(data.recipients.map(r => r.id), ids.filter(id => id !== c.silinen.id && id !== "olmayan-cari-kimligi"));
      // Geçerlilik ve neden (wa.me kuralı: sabit hat / yurt içi eksik hane elenir; yurt dışı açılır; pasif ve "WhatsApp Mesajı İstemiyor" elenir).
      const beklenenNeden = {
        olagan: "", olagan2: "", pasif: "Pasif Cari", istemiyor: "WhatsApp Mesajı İstemiyor", telefonsuz: "Telefon yok", gecersiz: "Numara biçimi tanınmadı", yurtdisi: "",
        sabit: "Sabit hat (WhatsApp cep numarası değil)", ayniA: "", ayniB: "", hareketsiz: "", ileri: "", taksitli: "", kapsayan: "", taksitTahsil: "",
      };
      for (const [anahtar, neden] of Object.entries(beklenenNeden)) {
        assert.equal(k[c[anahtar].id].reason, neden, `${anahtar} nedeni`);
        assert.equal(k[c[anahtar].id].valid, neden === "", `${anahtar} geçerli`);
      }
      assert.equal(k[c.pasif.id].passive, true);
      assert.equal(k[c.istemiyor.id].optOut, true);
      assert.equal(k[c.olagan.id].wa, "905321000001");
      // Aynı adlı iki kişi ayrı kimlikle, ikisi de listede.
      assert.notEqual(c.ayniA.id, c.ayniB.id);
      assert.equal(k[c.ayniA.id].name, "Aynı Ad");
      assert.equal(k[c.ayniB.id].name, "Aynı Ad");
      // Bakiye (Borç − Alacak; mevcut borcu taksitlendiren kart borç eklemez; ileri tarihli borç bakiyeye girer).
      const beklenenBakiye = { olagan: 1250, olagan2: 1000, pasif: 300, istemiyor: 300, hareketsiz: 0, ileri: 700, taksitli: 3000, kapsayan: 900, taksitTahsil: 800, ayniA: 100 };
      for (const [anahtar, bakiye] of Object.entries(beklenenBakiye)) assert.equal(k[c[anahtar].id].balance, bakiye, `${anahtar} bakiye`);
      // Sıradaki taksit = aktif kartın en erken ödenmemiş taksiti (vadesi geçmiş olsa da); gecikmiş = vadesi bugünden önce olan ödenmemiş taksitler.
      assert.deepEqual(k[c.taksitli.id].next, { dueDate: "2026-11-15", amount: 1000 });
      assert.deepEqual(k[c.taksitli.id].overdue, { count: 2, amount: 2000 });
      assert.deepEqual(k[c.kapsayan.id].next, { dueDate: "2026-11-20", amount: 300 });
      assert.deepEqual(k[c.kapsayan.id].overdue, { count: 2, amount: 600 });
      assert.deepEqual(k[c.taksitTahsil.id].next, { dueDate: "2026-12-10", amount: 400 });
      assert.deepEqual(k[c.taksitTahsil.id].overdue, { count: 1, amount: 400 });
      for (const anahtar of ["olagan", "olagan2", "hareketsiz", "ileri"]) {
        assert.equal(k[c[anahtar].id].next, null, `${anahtar} sıradaki taksit`);
        assert.deepEqual(k[c[anahtar].id].overdue, { count: 0, amount: 0 }, `${anahtar} gecikmiş`);
      }
      // Son tahsilat: cari tahsilatı ("in") ya da taksit tahsilatı ("plan-in"), son satır.
      assert.deepEqual(k[c.olagan.id].lastPayment, { date: "2026-11-02", amount: 250 });
      assert.deepEqual(k[c.taksitTahsil.id].lastPayment, { date: "2026-11-10", amount: 400 });
      assert.equal(k[c.olagan2.id].lastPayment, null);
      // Son gönderim yalnız "gönderildi" kaydı ("atlandı" sayılmaz).
      assert.equal(k[c.olagan.id].lastSend?.status, "sent");
      assert.equal(k[c.olagan.id].lastSend?.at, "2026-12-10T07:00:00.000Z");
      assert.equal(k[c.olagan2.id].lastSend, null);
      // Ekstre metni (Bu Ay = 01.12.2026 – 22.12.2026): devir dönem öncesinin son bakiyesi; ileri tarihli hareket dönem sonundan sonra → girmez.
      assert.equal(k[c.olagan.id].statement, ["Sayın Olağan Bir,", "Örnek Ticaret cari hesap ekstreniz (01.12.2026 – 22.12.2026):", "", "Devir: 1.250,00 TL (borcunuz)", "Bu dönemde hareket yok.", "", "*Güncel bakiye: 1.250,00 TL (borcunuz)*", "", "İyi günler dileriz."].join("\n"));
      assert.equal(k[c.olagan2.id].statement, ["Sayın Olağan İki,", "Örnek Ticaret cari hesap ekstreniz (01.12.2026 – 22.12.2026):", "", "Devir: 800,00 TL (borcunuz)", "10.12.2026 Borç · Aralık satışı: +200,00 TL", "", "*Güncel bakiye: 1.000,00 TL (borcunuz)*", "", "İyi günler dileriz."].join("\n"));
      assert.equal(k[c.ileri.id].statement, ["Sayın İleri Tarihli Cari,", "Örnek Ticaret cari hesap ekstreniz (01.12.2026 – 22.12.2026):", "", "Bu dönemde hareket yok.", "", "*Güncel bakiye: 0,00 TL*", "", "İyi günler dileriz."].join("\n"));
      assert.match(k[c.taksitli.id].statement, /\nVadesi geçen: 2 taksit, 2\.000,00 TL\nSıradaki taksit: 15\.11\.2026 · 1\.000,00 TL\n/);
      // Mesaj türünde ekstre metni yok; alanlar aynı.
      const mesaj = kisiler(await hazirla(ctx, { kind: "message", ids }));
      assert.equal(mesaj[c.olagan.id].statement, "");
      assert.deepEqual(mesaj[c.taksitli.id].next, { dueDate: "2026-11-15", amount: 1000 });
      // Tek kayıt (cari kartı yolu) ve boş seçim.
      assert.equal((await hazirla(ctx, { kind: "message", ids: [c.olagan.id] })).recipients.length, 1);
      const bos = await ctx.api.post(TARGETS, { kind: "message", ids: [] });
      assert.equal(bos.status, 400);
      assert.match(JSON.stringify(bos.data), /Gönderilecek carileri seçin/);
      // "Tümüne" (etkin cariler): pasif ve silinmiş yok; 14 etkin cari.
      const tumu = await hazirla(ctx, { kind: "message", all: true });
      assert.equal(tumu.recipients.length, 14);
      assert.equal(kisiler(tumu)[c.pasif.id], undefined);
    } finally {
      await ctx.close();
    }
  });

  it("ÇEKİRDEK ↔ KART: her cari sınıfında alıcı listesinin okuduğu alanlar (bakiye, gecikmiş, kartlar, defter satırları) waFacts ↔ detail birebir aynı", async () => {
    const { ctx, c, user, ids } = await kur();
    try {
      const service = ctx.server.app.context.accounts;
      assert.equal(typeof service.waFacts, "function", "cari servisinde waFacts yok");
      for (const id of ids) assert.deepEqual(oku(service.waFacts, id, user), oku(service.detail, id, user), `alıcı alanları farklı: ${id}`);
      // Eşitlik boş geçmesin: sınıflar kuruldu.
      const t = oku(service.waFacts, c.taksitTahsil.id, user).ok;
      assert.ok(t.ledger.some(line => line.kind === "plan-in") && t.overdueCount === 1 && t.plans[0].next, `taksit tahsilatlı cari kurulmadı: ${JSON.stringify(t)}`);
      assert.ok(oku(service.waFacts, c.silinen.id, user).hata && oku(service.detail, c.silinen.id, user).hata, "silinen cari okunabildi");
    } finally {
      await ctx.close();
    }
  });

  it("BİLİNÇLİ TEK FARK (§13 b, İLKEYLE): kartın bir ekran eki (fatura kalanları) hata verirse kişi alıcı listesinden sessizce DÜŞMEZ, kendi bakiyesiyle görünür", async () => {
    const { ctx, c } = await kur();
    try {
      const invoices = ctx.server.app.context.invoices;
      const entryStates = invoices.entryStates;
      invoices.entryStates = (accountId, ...rest) => {
        if (accountId === c.olagan2.id) throw new Error("ekran eki hatası (test)");
        return entryStates.call(invoices, accountId, ...rest);
      };
      let data;
      try {
        data = await hazirla(ctx, { kind: "statement", ids: [c.olagan.id, c.olagan2.id], preset: "thisMonth" });
      } finally {
        invoices.entryStates = entryStates;
      }
      const k = kisiler(data);
      assert.ok(k[c.olagan.id], "etkilenmeyen kişi listede değil");
      assert.ok(k[c.olagan2.id], "ekran eki hata verince kişi alıcı listesinden sessizce düşüyor (beklenen: listede, kendi bakiyesiyle — ilke 4 çıkmaz yok)");
      assert.equal(k[c.olagan2.id].balance, 1000);
      assert.equal(k[c.olagan2.id].valid, true);
      assert.match(k[c.olagan2.id].statement, /\*Güncel bakiye: 1\.000,00 TL \(borcunuz\)\*/);
      // Kartın kendisi (cari kartı ekranı) bu ekin hatasını yine gösterir: davranış farkı yalnız alıcı listesinde.
      invoices.entryStates = (accountId, ...rest) => {
        if (accountId === c.olagan2.id) throw new Error("ekran eki hatası (test)");
        return entryStates.call(invoices, accountId, ...rest);
      };
      try {
        assert.notEqual((await ctx.api.get(`/api/workspace/accounts/${c.olagan2.id}`)).status, 200);
      } finally {
        invoices.entryStates = entryStates;
      }
    } finally {
      await ctx.close();
    }
  });
});
