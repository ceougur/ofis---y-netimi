// Rapor iş parçacığı (11.10.2026 hız düzeltmesi; docs/BANKA-MODULU-PLAN.md §3.11 madde 5, ölçek docs/kanit/2026-10-11/olcek): büyük banka
// raporları (Banka Hareket, Banka Bakiye ve Banka Masraf Raporu) ana iş parçacığının dışında, SALT OKUNUR ayrı bir bağlantıyla ve TEK okuma
// işleminde (WAL anlık görüntüsü: rapor boyunca yazılan kayıtlar görünmez) hazırlanır. Rapor merkezi ana sunucudakinin AYNISIDIR (aynı kod,
// aynı süzgeçler; yalnız bu raporların okuduğu tek kaynak, banka hesapları/hareketleri okuyucusu ve veri tabanıyla kurulur) — çıktı satır satır
// aynıdır. Hiçbir yazım yapmaz (banka hizmetinin yazım yolları — bank.post, dönem kilidi, defter — burada kurulmaz, çağrılmaz).
// Önceden 100.000 para satırında Bu Yıl / tüm hesaplar Banka Hareket Raporu ~2 sn ana iş parçacığını tutuyor, o sürede bütün kullanıcıların
// istekleri (kayıt, arama, liste) bekliyordu (Node.js tek iş parçacığı, node:sqlite eşzamanlı).
import { parentPort, workerData } from "node:worker_threads";
import { createClock } from "./clock.mjs";
import { createStore, openDatabase } from "./db.mjs";
import { createBankAccounts } from "./bank/accounts.mjs";
import { createBankMovements } from "./bank/movements.mjs";
import { createMoneyLines } from "./bank/money-lines.mjs";
import { createRouter } from "./router.mjs";
import { registerReportCenter } from "../routes/report-center.mjs";

const { dbPath, time, id, query, user, limit, fx = false, later = false } = workerData || {};
let db = null;
let reply;
try {
  db = openDatabase(dbPath, { readOnly: true });
  const store = createStore(db);
  const money = createMoneyLines(store);
  const now = createClock({ time, fixed: true });
  // Banka Masraf Raporu Banka penceresinin masraf verisinden okur (movements.feeReport; banka hesabı denetimi accounts.rowOf). Yalnız okuma
  // yolları kullanılır; ayarların gizli/döviz bayrakları sunucununkiyle aynı (workerData).
  const bankAccounts = createBankAccounts({ store, bank: null, period: null, money, ledger: () => null, now, fxEnabled: () => fx === true, laterOk: () => later === true });
  bankAccounts.movements = createBankMovements({ store, money, accounts: bankAccounts, ledger: () => null, period: null, now });
  const center = registerReportCenter(createRouter(), { store, auth: null, audit: () => {}, dataset: null, money, bankAccounts, now });
  db.exec("BEGIN");
  let data;
  try {
    data = await center.run(user, id, new URLSearchParams(query), { inline: true });
  } finally {
    db.exec("COMMIT");
  }
  // limit: yalnız ilk n satır taşınır (ön izleme 200; toplam sayı ve TOPLAM satırı bütün satırlardan, iş parçacığında hesaplandı).
  reply = { ok: true, data: limit ? { ...data, rows: data.rows.slice(0, limit) } : data };
} catch (error) {
  reply = { ok: false, status: Number(error?.status) || 500, message: error?.message || String(error), extra: error?.extra || {} };
} finally {
  // Bağlantı yanıttan ÖNCE kapanır: ana iş parçacığı yanıtı alıp iş parçacığını sonlandırdığında dosya serbesttir (Windows'ta şirket geri
  // yüklemesi/silmesi açık tanıtıcı yüzünden EBUSY almasın).
  try {
    db?.close();
  } catch {
    // zaten kapalı
  }
}
parentPort.postMessage(reply);
