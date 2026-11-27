// 2.5.0 AH — açılış onarımı (repairOwnCards) eşdeğerlik fikstürü: GERÇEK v2.0.26 koduyla (git etiketi), o sürümün API'sinden, kullanıcı gibi
// girilen TOHUMLU rastgele veri (anayasa: test verisi programın kendi ürettiği veri). 2.0.24–2.0.26'da peşinli taksitli satış faturasında iade +
// geri ödeme kartı yeniden büyütüyordu (Canlı Hata 2); bu veride bu kartların bir kısmı yanlış kalır, bir kısmı doğrudur. test/iade-210-onarim'in
// elle seçilmiş yedi senaryosundan farklı olarak: aynı caride birden çok taksitli fatura (bir onarım aynı carinin sonraki adayını etkileyebilir), kısmi /
// tam / iki aşamalı iade, kısmi / tam / sıfır geri ödeme, kart tahsilatı (iadeden önce ve sonra; fazla tahsilat), iade iptali, kart tahsilatının
// silinip Silinenler'den geri yüklenmesi, Mevcut Borç kartı (açık hesap satışını kapsayan) ve en sonda dönem kilidi (bazı onarımlar kilitli kalır).
// Test: test/acilis-onarimi-hiz-250.test.mjs (eski kod ↔ yeni kod çıktısı; kâhin = taban kodun gerçek çıktısı, onarim-hiz-250-beklenen.json).
//
//   Yeniden üret (etiket gerekir: git fetch --tags):
//     node --disable-warning=ExperimentalWarning test/guvenilirlik/onarim-hiz-veri.mjs [--tohum 250] [--cari 40]
//   → test/fixtures/surum-2.0.26-onarim-250 (+ içerik deposu test/fixtures/surum-nesneler)
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { packFixture } from "./fikstur.mjs";
import { bootVersion } from "./surumler.mjs";

export const ONARIM_FIXTURE = "surum-2.0.26-onarim-250";
const TAG = "v2.0.26";
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
// Tohumlu sözde rastgele (mulberry32): aynı tohum aynı senaryo dizisi.
const rng = seed => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export async function produce({ seed = 250, accounts = 40, log = console.log } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-onarim-hiz-"));
  const dataDir = path.join(root, "data");
  const backupDir = path.join(root, "backups");
  const server = await bootVersion(TAG, { dataDir, backupDir });
  const random = rng(seed);
  const pick = list => list[Math.floor(random() * list.length)];
  const between = (lo, hi) => lo + Math.floor(random() * (hi - lo + 1));
  const stats = { cari: 0, satis: 0, iade: 0, geriOdemeli: 0, iptal: 0, tahsilat: 0, silGeriYukle: 0, mevcutBorc: 0, red: [] };
  try {
    const api = await server.login();
    const must = async (label, promise) => {
      const res = await promise;
      if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      return res.data;
    };
    // Program bir isteği reddederse (ör. iade tahsil edilenden fazla) veri yine programın kendi verisidir; ret sayılır, sessiz geçilmez (ders 3).
    const maybe = async (label, promise) => {
      const res = await promise;
      if (res.status === 200) return res.data;
      stats.red.push(`${label}: ${res.status} ${String(res.data?.error || "").slice(0, 120)}`);
      return null;
    };
    const T = (await must("bugün", api.get("/api/workspace/ledger/lock"))).today;
    const saleDay = addDays(T, -60);
    const nakit = amount => [{ amount, method: "cash" }];
    // Kasa açılışı: geri ödemeler Kasa'yı eksiye düşürüp reddedilmesin (program eksi Kasa'yı 409 ile sorar).
    await must("Kasa açılışı", api.post("/api/workspace/cash", { kind: "in", amount: "200000", method: "cash", description: "Açılış", date: addDays(T, -90) }));
    for (let k = 1; k <= accounts; k += 1) {
      const acc = await must(`cari ${k}`, api.post("/api/workspace/accounts", { name: `Onarım Hız ${String(k).padStart(2, "0")}`, type: "customer", registeredOn: addDays(T, -90) }));
      stats.cari += 1;
      // Her dördüncü caride önce açık hesap satışı + onu kapsayan Mevcut Borç kartı (taksitli satışlardan önce: borç henüz kartsız); sonunda geri ödemeli iadesi.
      let open = null;
      if (k % 4 === 0) {
        open = await must("açık satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: acc.id, issueDate: saleDay, currency: "TRY", rate: 1, pricesIncludeVat: false, lines: [{ name: "Hizmet", qty: 10, unitPrice: 100, vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [], rest: "open", dueDate: addDays(T, -10) }, force: true }));
        const cover = await maybe("Mevcut Borç kartı", api.post("/api/workspace/plans", { name: acc.name, accountId: acc.id, total: "600", registeredOn: addDays(T, -50), coversBalance: true, count: 2, firstDue: addDays(T, between(-45, 10)), everyMonths: 1 }));
        if (cover) stats.mevcutBorc += 1;
      }
      const sales = between(1, 3);
      for (let s = 0; s < sales; s += 1) {
        const price = pick([100, 150, 200, 250]);
        const total = 10 * price;
        const cashShare = pick([0, 0, 0.3, 0.5, 0.5]);
        const cash = cashShare ? nakit(Math.round(total * cashShare)) : [];
        const count = between(1, 3);
        const firstDue = addDays(T, between(-50, 40));
        const doc = await must("satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: acc.id, issueDate: saleDay, currency: "TRY", rate: 1, pricesIncludeVat: false, lines: [{ name: "Hizmet", qty: 10, unitPrice: price, vatRate: 0 }], payment: { cash, cheques: [], endorse: [], rest: "installments", installments: { count, firstDue, everyMonths: 1 } }, force: true }));
        stats.satis += 1;
        const inv = { id: doc.id, planId: doc.plan?.id || doc.planId, lineId: doc.lines[0].id };
        const collect = amount => maybe("kart tahsilatı", api.post(`/api/workspace/plans/${inv.planId}/entries`, { kind: "in", amount: String(amount), method: "cash", date: T }));
        if (random() < 0.35) if (await collect(Math.round((total - (cash[0]?.amount || 0)) * pick([0.2, 0.3, 0.5])))) stats.tahsilat += 1;
        let qtyLeft = 10;
        const returns = between(1, 2);
        let lastReturn = null;
        for (let r = 0; r < returns && qtyLeft > 0; r += 1) {
          const qty = r === returns - 1 && random() < 0.5 ? qtyLeft : between(1, qtyLeft);
          const amount = qty * price;
          const refund = pick([0, amount, amount, Math.round(amount / 2)]);
          const ret = await maybe("iade", api.post("/api/workspace/invoices", { kind: "sale_return", accountId: acc.id, originalId: inv.id, issueDate: T, lines: [{ originLineId: inv.lineId, qty }], payment: { cash: refund ? nakit(refund) : [], cheques: [], endorse: [], rest: "open" }, force: true }));
          if (!ret) continue;
          stats.iade += 1;
          if (refund) stats.geriOdemeli += 1;
          qtyLeft -= qty;
          lastReturn = ret;
        }
        if (lastReturn && random() < 0.15 && (await maybe("iade iptali", api.post(`/api/workspace/invoices/${lastReturn.id}/cancel`, {})))) stats.iptal += 1;
        // İadeden sonra kart tahsilatı (fazla tahsilat olabilir; program reddederse sayılır).
        if (random() < 0.2 && (await collect(pick([100, 300, 500])))) stats.tahsilat += 1;
        // Kart tahsilatı silinir ve Silinenler'den geri yüklenir (aynı tutar ve tarihle geri eklenir).
        if (random() < 0.15) {
          const entry = await collect(pick([50, 150]));
          const entryId = entry?.entryId || "";
          if (entryId && (await maybe("tahsilat silme", api.del(`/api/workspace/plans/${inv.planId}/entries/${entryId}`)))) {
            const trash = await must("Silinenler", api.get("/api/admin/trash"));
            const item = (Array.isArray(trash) ? trash : trash.items || []).find(row => row.kind === "plan-entry");
            if (item && (await maybe("geri yükleme", api.post("/api/admin/trash/restore", { id: item.id })))) stats.silGeriYukle += 1;
          }
        }
      }
      if (open) {
        if (await maybe("açık satış iadesi", api.post("/api/workspace/invoices", { kind: "sale_return", accountId: acc.id, originalId: open.id, issueDate: T, lines: [{ originLineId: open.lines[0].id, qty: 3 }], payment: { cash: nakit(300), cheques: [], endorse: [], rest: "open" }, force: true }))) stats.iade += 1;
      }
    }
    const lockedUntil = addDays(T, -30);
    await must("dönem kilidi", api.put("/api/admin/period-lock", { lockedUntil }));
    await server.close();
    log(`${TAG} veri: ${JSON.stringify({ ...stats, red: stats.red.length })}`);
    if (stats.red.length) log(`reddedilen istekler (programın kendi kuralı): ${stats.red.slice(0, 8).join(" | ")}`);
    const packed = packFixture({ name: ONARIM_FIXTURE, dataDir, backupDir, manifest: { cut: TAG, commit: server.commit, today: T, lockedUntil, seed, accounts, stats } });
    log(`${ONARIM_FIXTURE}: ${packed.files} dosya, ${packed.bytes} bayt`);
    return { today: T, stats };
  } catch (error) {
    await server.close().catch(() => {});
    throw error;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const opt = (name, fallback) => (argv.includes(`--${name}`) ? Number(argv[argv.indexOf(`--${name}`) + 1]) : fallback);
  await produce({ seed: opt("tohum", 250), accounts: opt("cari", 40) });
}
