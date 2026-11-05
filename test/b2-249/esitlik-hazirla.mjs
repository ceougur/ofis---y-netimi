// 2.4.9 B2 (docs/2.4.9-tasarim/B2-elle-toplu-alici.md §5 E1, §13): eşitlik / ölçüm verisinin hazırlanması — PROGRAMIN KENDİ API'SİYLE (CLAUDE.md test kuralı: test verisi
// programın kendisinin ürettiği veridir; SQL ile yama yok). T9 verisinin (taban-2910 / gecmis-40) taze kopyası programla açılır (göç dahil), alıcı listesinin dişini
// oluşturan sınıflar arayüzün kullandığı uçlarla girilir: Pasife Al, "WhatsApp Mesajı İstemiyor", telefon türleri (boş / geçersiz / yurt dışı / sabit hat / aynı telefon /
// çok numaralı hücre), grup + alt grup, tahsilat, ÇOK TAKSİTLİ cari (1–3 kart, vadesi geçmiş taksitler, mevcut borcu taksitlendiren kart), taksit tahsilatı, silinmiş cari,
// hareketsiz cari, aynı adlı iki cari, ELLE GÖNDERİM GEÇMİŞİ (POST /whatsapp/log, 3 tur × 2.000 kişi, gönderildi + atlandı, iki tür, farklı saatlerde) ve ikinci şirkette
// aynı sınıfların bir kısmı. Sonuç <hazır>/data: eski ve yeni kod bu klasörün TAZE kopyalarıyla koşar (girdi iki yanda bit bit aynı). Sınıf sayıları çıktıya yazılır
// (R4: 0 olan sınıf = eksik kanıt). Ürün kodu DEĞİŞMEZ. Dış istek YOK (ders 30: düzenek test/isz-248/ortak.mjs — sahte Meta / lisans / kapıcı yerel).
// Kullanım: node test/b2-249/esitlik-hazirla.mjs <kaynak veri (içinde data/)> <hazır klasör> <özet.json>
import { writeFileSync } from "node:fs";
import { kurulum, log } from "../isz-248/ortak.mjs";

const [VERI, HAZIR, OZET] = process.argv.slice(2);
if (!VERI || !HAZIR || !OZET) throw new Error("kullanım: esitlik-hazirla.mjs <veri> <hazır> <özet.json>");
const SAAT = "2026-11-02T10:00:00+03:00";
const ctx = await kurulum({ veri: VERI, is: HAZIR, saat: { time: SAAT, fixed: true }, isci: "manual", aralik: 0, tier: "TIER_10K", onEk: `b2h${Date.now().toString(36)}` });
const ozet = { veri: VERI, saat: SAAT, sirket: {} };
try {
  const { admin } = ctx;
  const sirketIcin = async (sirketKod, olcek) => {
    const sirket = ctx.sirketler.find(c => String(c.code) === sirketKod);
    const at = u => `${u}${u.includes("?") ? "&" : "?"}hofCompany=${encodeURIComponent(sirket.id)}`;
    const s = { reddedilen: {} };
    const say = (ad, n = 1) => {
      s[ad] = (s[ad] || 0) + n;
    };
    const iste = async (ad, yontem, yol, govde) => {
      const r = yontem === "get" ? await admin.get(at(yol)) : yontem === "del" ? await admin.del(at(yol)) : await admin[yontem](at(yol), govde);
      if (r.status === 200) say(ad);
      else {
        s.reddedilen[ad] = (s.reddedilen[ad] || 0) + 1;
        if (s.reddedilen[ad] <= 2) log("reddedildi", sirketKod, ad, r.status, JSON.stringify(r.data).slice(0, 200));
      }
      return r;
    };
    const L = (await admin.get(at("/api/workspace/accounts?status=all&limit=5000"))).data.data.accounts.map(a => a.id);
    const n = k => Math.round(k * olcek);
    const kart = async id => (await admin.get(at(`/api/workspace/accounts/${id}`))).data.data;
    const duzelt = async (ad, id, yama) => iste(ad, "put", `/api/workspace/accounts/${id}`, { ...(await kart(id)), ...yama });
    const dilim = (a, b) => L.slice(n(a), n(b));
    for (const id of dilim(10, 40)) await duzelt("pasif", id, { status: "passive" });
    for (const id of dilim(40, 70)) await duzelt("istemiyor", id, { waOptOut: true });
    for (const id of dilim(65, 70)) await duzelt("istemiyorVePasif", id, { status: "passive" });
    for (const [ad, telefon, a, b] of [
      ["telefonGecersiz", "123", 70, 75],
      ["telefonBos", "", 75, 80],
      ["telefonYurtDisi", "+44 20 7946 0958", 80, 83],
      ["telefonSabitHat", "0212 555 01 02", 83, 86],
      ["telefonAyni", "0532 111 22 33", 86, 88],
      ["telefonCokNumara", "0537 111 22 33 / 0532 222 33 44", 88, 90],
    ]) for (const id of dilim(a, b)) await duzelt(ad, id, { phone: telefon });
    for (const [i, id] of dilim(100, 160).entries()) await duzelt("grup", id, { groupId: "", groupName: "B2 Grup A", ...(i < n(30) ? { subgroupName: "Alt 1" } : {}) });
    for (const id of dilim(200, 400)) await iste("tahsilat", "post", `/api/workspace/accounts/${id}/entries`, { kind: "in", amount: "50", date: "2026-10-30", method: "cash", note: "B2 tahsilat" });
    // Çok taksitli cariler: her biri 1–3 kart; ilk kartın vadeleri ağustostan (gecikmiş), ikincisi ekimden, üçüncüsü mevcut borcu taksitlendirir.
    for (const [i, id] of dilim(400, 700).entries()) {
      const a = await iste("kart1", "post", "/api/workspace/plans", { accountId: id, name: "B2 Kart 1", total: "1200", count: 4, firstDue: "2026-08-15", startDate: "2026-08-01", registeredOn: "2026-08-01" });
      if (i % 2 === 0) await iste("kart2", "post", "/api/workspace/plans", { accountId: id, name: "B2 Kart 2", total: "600", count: 3, firstDue: "2026-10-05", startDate: "2026-09-20", registeredOn: "2026-09-20" });
      if (i % 2 === 1 && a.status === 200) await iste("taksitTahsilati", "post", `/api/workspace/plans/${a.data.data.id}/entries`, { kind: "in", amount: "300", date: "2026-10-31", method: "cash" });
    }
    // Mevcut borcu taksitlendiren kart (kartsız borçlu carilerde; borcun bir kısmı, gecikmiş taksitli) — ilk tur kartlı carilerde borcun tamamı kartta olduğundan program reddeder.
    const borclu = (await admin.get(at("/api/workspace/accounts?status=all&limit=5000"))).data.data.accounts.filter(a => a.balance >= 200).map(a => a.id).filter(id => !L.slice(n(400), n(700)).includes(id));
    for (const id of borclu.slice(0, n(60))) await iste("kartMevcutBorc", "post", "/api/workspace/plans", { accountId: id, name: "B2 Mevcut Borç", total: "100", count: 2, firstDue: "2026-10-20", startDate: "2026-10-01", coversBalance: true });
    // Silinmiş cari (hareketli), hareketsiz cari, aynı adlı iki cari — "+ Yeni Cari" ucu.
    s.silinmisIds = [];
    for (let i = 1; i <= n(15); i += 1) {
      const r = await iste("silinecekAcildi", "post", "/api/workspace/accounts", { name: `B2 Silinen ${i}`, phone: `0532 900 00 ${String(i).padStart(2, "0")}`, openingBalance: "150", registeredOn: "2026-10-01" });
      if (r.status === 200 && (await iste("silinmis", "del", `/api/workspace/accounts/${r.data.data.id}`)).status === 200) s.silinmisIds.push(r.data.data.id);
    }
    for (let i = 1; i <= 5; i += 1) await iste("hareketsiz", "post", "/api/workspace/accounts", { name: `B2 Hareketsiz ${i}`, phone: `0532 901 00 0${i}` });
    for (const telefon of ["0532 902 00 01", "0532 902 00 02"]) await iste("ayniAd", "post", "/api/workspace/accounts", { name: "B2 Aynı Ad", phone: telefon, openingBalance: "75" });
    // Elle gönderim geçmişi: seçimin ilk 2.000'i (ölçek oranında) × 3 tur, farklı saatlerde; her üç kişiden biri "atlandı"; 2. tur "message".
    const T = (await admin.get(at("/api/workspace/accounts?status=all&limit=5000"))).data.data.accounts.map(a => a.id).slice(0, n(2000));
    for (let tur = 0; tur < 3; tur += 1) {
      ctx.saat.set(`2026-11-02T0${tur + 7}:00:00+03:00`);
      for (const [i, id] of T.entries()) {
        await iste(`gonderimKaydi${tur + 1}`, "post", "/api/workspace/whatsapp/log", { batchId: `b2-tur-${tur + 1}`, accountId: id, kind: tur === 1 ? "message" : "statement", phone: "905320000000", body: `B2 tur ${tur + 1}`, status: (i + tur) % 3 === 0 ? "skipped" : "sent" });
      }
    }
    ctx.saat.set(SAAT);
    s.cariSayisi = (await admin.get(at("/api/workspace/accounts?status=all&limit=5000"))).data.data.accounts.length;
    ozet.sirket[sirketKod] = s;
    log("şirket", sirketKod, JSON.stringify(s).slice(0, 600));
  };
  await sirketIcin("001", 1);
  if (ctx.sirketler.some(c => String(c.code) === "002")) await sirketIcin("002", 0.2);
} finally {
  await ctx.kapat();
}
ozet.bitti = new Date().toISOString();
writeFileSync(OZET, `${JSON.stringify(ozet, null, 1)}\n`);
log("hazır", HAZIR);
