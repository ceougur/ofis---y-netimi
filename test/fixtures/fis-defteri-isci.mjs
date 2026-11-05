// 2.5.0 Ç2 — fiş defteri yaşam testinin (test/fis-defteri-yasam-250.test.mjs) AYRI SÜREÇ işçisi: şirket dosyasını kendi bağlantısıyla açar (göç YOK; dosya zaten 46),
// iç API'yle (lib/ledger-vouchers.mjs) fiş yazar. Kipler:
//   post <db> <istekKimliği> <başlamaAnıMs>   → o ana kadar bekler (iki süreç aynı anda), fişi yazar, sonucu JSON olarak stdout'a yazar
//   spin <db> <istekKimliği> <işaretDosyası>  → dış işlem açar, fişi (başlık + satırlar + iz) yazar, işaret dosyasını yazar ve İŞLEMİ KAPATMADAN sonsuz döner
//                                               (ana süreç öldürür: yarım fiş kalmamalı)
// Lisans servisine istek yok (program açılmaz; yalnız veri tabanı).
import { writeFileSync } from "node:fs";
import { createClock } from "../../server/lib/clock.mjs";
import { createStore, openDatabase } from "../../server/lib/db.mjs";
import { createLedgerVouchers } from "../../server/lib/ledger-vouchers.mjs";
import { createPeriod } from "../../server/lib/period.mjs";

const [mode, dbPath, requestKey, arg] = process.argv.slice(2);
const db = openDatabase(dbPath);
const store = createStore(db);
const now = createClock({ time: "2027-01-10T10:00:00+03:00", fixed: true });
const period = createPeriod({ store, now });
const vouchers = createLedgerVouchers({ store, period, now });
const user = { id: `isci-${process.pid}`, display_name: "İşçi" };
const input = { type: "opening-match", date: "2027-01-05", description: "Ayrı süreç", requestKey, lines: [{ account: "590", debit: 4321 }, { account: "519", credit: 4321 }] };

if (mode === "post") {
  const at = Number(arg);
  while (Date.now() < at) {
    // iki süreç aynı anda başlasın (meşgul bekleme; kısa)
  }
  try {
    const result = vouchers.post(user, input);
    process.stdout.write(JSON.stringify({ ok: true, id: result.id, no: result.no, replayed: result.replayed }));
  } catch (error) {
    process.stdout.write(JSON.stringify({ ok: false, status: error.status, code: error.extra?.code, message: error.message }));
  }
  db.close();
} else if (mode === "spin") {
  store.tx(() => {
    vouchers.post(user, { ...input, lines: Array.from({ length: 400 }, (_, i) => ({ account: i % 2 ? "519" : "590", debit: i % 2 ? 0 : 1000, credit: i % 2 ? 1000 : 0, note: `satır ${i + 1}` })) });
    writeFileSync(arg, "yazıldı, işlem açık");
    for (;;) {
      // işlem açık bekler; ana süreç öldürür
    }
  });
} else throw new Error(`kip: post | spin (${mode})`);
