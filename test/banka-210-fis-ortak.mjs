// 2.1.0 Aşama 4 (Banka Hareketleri) testlerinin ortak yardımcıları. (Bu dosya test değildir: adı ".test.mjs" ile bitmez.)
//
// Sahte saat 08.10.2026 Perşembe (plan §12.5 ön koşulu). Hesaplar (kabul 1–4): Ziraat Bankası · Ana TL Hesabı 01.10.2026 100.000 (102.01),
// Garanti BBVA · Ana TL Hesabı 50.000 (102.02); ayrıca Kurumsal Kredi Kartı (309.01, açılış borcu 5.000) ve Kredi Hesabı (300.01, açılış 0).
// Bağımsız beklenen: testler her fişin yevmiyesini KENDİ modeline (aşağıdaki Ledger) yazar ve programın mizanını/alt hesap mizanını bu modelle
// karşılaştırır (programın kendi çıktısı beklenen olarak kullanılmaz).
import assert from "node:assert/strict";
import { apiOf, integrityOk } from "./banka-210-ortak.mjs";
import { BANK, NOW, TODAY, bootBank, expectStatus, lockPeriod, must, openAcceptanceAccounts, openAccount, subBalances, trialBalances } from "./banka-210-hesap-ortak.mjs";

export { BANK, NOW, TODAY, apiOf, bootBank, expectStatus, integrityOk, lockPeriod, must, openAccount, subBalances, trialBalances };

/** Kuruş → TL sayı (mizan TL döner). */
export const tl = minor => Math.round(minor) / 100;

/** Hesapları açar: Ziraat, Garanti (kabul 1–4), kurumsal kart (borç 5.000) ve kredi hesabı (0). */
export async function openBankSet(api) {
  const { ziraat, garanti } = await openAcceptanceAccounts(api);
  const card = await openAccount(api, { bankName: "Ziraat Bankası", name: "Şirket Kartı", kind: "card", creditLimit: "50.000", opening: { date: "2026-10-01", amount: "5.000", confirmed: true } });
  const loan = await openAccount(api, { bankName: "Garanti BBVA", name: "Ticari Kredi", kind: "loan", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
  return { ziraat, garanti, card, loan };
}

/**
 * Bağımsız yevmiye modeli: hesap (ve alt hesap) bakiyeleri kuruş, borç artı. Açılışlar dahil; test her fişte beklenen satırları yazar.
 */
export class Ledger {
  constructor() {
    this.accounts = new Map();
    this.subs = new Map();
  }
  post(lines) {
    let net = 0;
    for (const [account, sub, side, minor] of lines) {
      const signed = side === "D" ? minor : -minor;
      net += signed;
      this.accounts.set(account, (this.accounts.get(account) || 0) + signed);
      if (sub) this.subs.set(sub, (this.subs.get(sub) || 0) + signed);
    }
    assert.equal(net, 0, `model fişi dengesiz: ${JSON.stringify(lines)}`);
  }
  /** Programın mizanı ve alt hesap mizanı modelle aynı mı (yalnız modelin bildiği hesaplar)? */
  async assertMatches(api, label) {
    const trial = await trialBalances(api);
    for (const [account, minor] of this.accounts) assert.equal(Math.round((trial[account] || 0) * 100), minor, `${label}: mizan ${account} (program ${trial[account] || 0} / model ${tl(minor)})`);
    const subs = await subBalances(api);
    for (const [sub, minor] of this.subs) assert.equal(Math.round((subs[sub]?.balance || 0) * 100), minor, `${label}: alt hesap ${sub} (program ${subs[sub]?.balance || 0} / model ${tl(minor)})`);
  }
}

/** Kabul hesaplarının açılışlarını modele yazar. */
export function openingModel(ledger, set) {
  ledger.post([["102", set.ziraat.glSub, "D", 10_000_000], ["500", "", "C", 10_000_000]]);
  ledger.post([["102", set.garanti.glSub, "D", 5_000_000], ["500", "", "C", 5_000_000]]);
  ledger.post([["500", "", "D", 500_000], ["309", set.card.glSub, "C", 500_000]]);
}

/** Banka Fişi gönderir; 200 bekler; İşlem Kartı döner. */
export const voucher = (api, body, label = body.type) => must(`fiş ${label}`, api.post(`${BANK}/vouchers`, body));
/** İşlem Kartı. */
export const eventCard = (api, ref) => must(`İşlem Kartı ${ref}`, api.get(`${BANK}/events/${encodeURIComponent(ref)}`));
/** Hesap kartı (bakiye). */
export const accountView = (api, id) => must("hesap", api.get(`${BANK}/accounts/${id}`));
/** Hareketler (sorgu metni). */
export const movements = (api, query = "") => must(`hareketler ${query}`, api.get(`${BANK}/movements${query ? `?${query}` : ""}`));

/** Fişin satırları (rol|THP|alt hesap|taraf|kuruş, sıralı) — karşılaştırma için. */
export const lineKeys = card => card.lines.map(line => `${line.role}|${line.gl}|${line.sub || ""}|${line.side}|${line.tryMinor}`).sort();

/** Tablo sayımları (yazılmadığını göstermek için). */
export const counts = store => ({
  events: store.get("SELECT COUNT(*) AS n FROM fin_events").n,
  lines: store.get("SELECT COUNT(*) AS n FROM bank_lines").n,
  invoices: store.get("SELECT COUNT(*) AS n FROM invoices").n,
  entries: store.get("SELECT COUNT(*) AS n FROM account_entries").n,
});

/** Tedarikçi cari (KDV'li masraf faturasının carisi). */
export const supplier = (api, name = "Ziraat Bankası A.Ş.") => must(`cari ${name}`, api.post("/api/workspace/accounts", { name, type: "supplier", registeredOn: "2026-09-01" }));

export { assert };
