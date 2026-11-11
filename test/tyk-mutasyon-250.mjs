#!/usr/bin/env node
// 2.5.0 Ç5-B — TYK mutasyon testi (KANIT KURALI 3; ders 7): her kararın KARŞI seçeneği ve sınır kayması lib/obligation-queue.mjs'in AYRI kopyasına (ders 23, 25) enjekte edilir;
// test/tyk-250.test.mjs her mutantta KIRMIZI olmalı (Ç5-B tur 2a: yol / önbellek mutantları API testleriyle, tam kopyada). Kullanım: node test/tyk-mutasyon-250.mjs [--klasor <boş geçici klasör>] [--yalniz-saf]
// Çıkış 0 yalnız bütün mutantlar öldüyse. Yük koşusudur: `flock -s scratchpad/olcum.lock` ile başlatılır (ders 52).
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const base = path.resolve(argv.includes("--klasor") ? argv[argv.indexOf("--klasor") + 1] : path.join(tmpdir(), `tyk-mutasyon-${process.pid}`));
const SOURCE = readFileSync(path.join(ROOT, "server/lib/obligation-queue.mjs"), "utf8");
// [kimlik, karar, eski metin, yeni metin]
const MUTANTS = [
  ["M01", "karar (1) B — havuz (ödeme sonradan doğan borca kayar)", "a.date !== b.date ? (a.date < b.date ? -1 : 1)\n  : a.cls !== b.cls ? a.cls - b.cls", "a.cls !== b.cls ? a.cls - b.cls\n  : a.date !== b.date ? (a.date < b.date ? -1 : 1)"],
  ["M02", "S2 B — belge tarihi sırası", "a.vade !== b.vade ? (a.vade < b.vade ? -1 : 1)\n  : a.date !== b.date", "a.date !== b.date ? (a.date < b.date ? -1 : 1)\n  : a.vade !== b.vade"],
  ["M03", "karar (2) B — bağ önceliği yok (bağlı ödeme bağsız gibi)", "  invoiceLinks(3);\n", "\n"],
  ["M04", "M1f B — vade günü gecikmiş", "item.side === \"receivable\" && item.vade < day", "item.side === \"receivable\" && item.vade <= day"],
  ["M05", "S1 B — vadesiz kalem gecikmez", "byId.get(line.sourceId)?.dueDate || line.date : kind === \"entry\" ? dueDates.get(line.id) || line.date", "byId.get(line.sourceId)?.dueDate || \"9999-12-31\" : kind === \"entry\" ? dueDates.get(line.id) || \"9999-12-31\""],
  ["M06", "S50 B — kart seçilmeden alınan tahsilat taksit kapatmaz", "        if (mode === \"side\" && other.linkedOnly) continue;\n", "        if (mode === \"side\" && other.linkedOnly) continue;\n        if (other.kind === \"installment\" || item.kind === \"installment\") continue;\n"],
  ["M07", "M1e B — Mevcut Borç kartı alttaki borcu tüketmez (çift sayım)", "  const coverEvent = card => {\n", "  const coverEvent = card => {\n    return;\n"],
  ["M08", "karar (5) B — net görünüm yok (yalnız Mahsup Et'le)", "const net = runQueue(input, \"net\", pieces);", "const net = runQueue(input, \"side\", pieces);"],
  ["M09", "S11 B — kilitli dönemde alınan evrakın karşılıksızı yine netleşir", "    if (lock && reversed.date <= lock) continue; // S11 / S18 / S19: kapanış değişmez, karşılıksız ayrı borç\n", "\n"],
  ["M10", "S19 B — karar güncel kilitle (yazım anındaki değil)", "    const lock = lockAt(bounce.at);", "    const lock = lockAt(\"9999-12-31T00:00:00Z\");"],
  ["M11", "M13 B — şüpheli kuyruğu gecikmişe girer", "item.vade < day && item.remaining - item.doubtful > 0.005);\n    const amount = roundMoney(list.reduce((sum, item) => sum + item.remaining - item.doubtful, 0));", "item.vade < day && item.remaining > 0.005);\n    const amount = roundMoney(list.reduce((sum, item) => sum + item.remaining, 0));"],
  ["M12", "karar (1) aynı gün B — önce ödeme sonra borç", "  : a.cls !== b.cls ? a.cls - b.cls", "  : a.cls !== b.cls ? b.cls - a.cls"],
  ["M13", "karar (3) B — kilitli dönem bağı yeniden açar", "      if (lock && target.date <= lock) {\n        if (lockCaps?.has(link.id))", "      if (false) {\n        if (lockCaps?.has(link.id))"],
  // M14: kayıt anı yerine GİRDİ sırası (ders 31) — yalnız s2'den kayıt anını çıkarmak eşdeğer mutanttır (yazım sırası zaten tarih + kayıt anıyla kurulur): s2, olay sırası
  // ve yazım sırası birlikte girdiden.
  ["M14", "S2 eşitlik B — kayıt anı yerine girdi sırası (ders 31)", [
    ["  : a.date !== b.date ? (a.date < b.date ? -1 : 1)\n  : a.at !== b.at ? (a.at < b.at ? -1 : 1)\n  : a.rank", "  : a.date !== b.date ? (a.date < b.date ? -1 : 1)\n  : a.rank"],
    ["  : a.cls !== b.cls ? a.cls - b.cls\n  : a.at !== b.at ? (a.at < b.at ? -1 : 1)\n  : a.rank", "  : a.cls !== b.cls ? a.cls - b.cls\n  : a.rank"],
    ["  const rank = new Map(sorted.map((line, index) => [line.id, index]));\n  const kindOf", "  const rank = new Map(lines.map((line, index) => [line.id, index]));\n  const kindOf"],
  ]],
  ["M15", "Y3-1 / S69 B — gün sayısı her zaman sözden", "const from = promise && promise < vade ? promise : vade;", "const from = promise || vade;"],
  ["M16", "S67 B — takvim durumu söz tarihine göre", "  if (vade < day) {\n    const from", "  if (false) {\n    const from"],
  ["M17", "K8-3 B — yalnız vadesi gelmiş taksit kapanır", "        if (mode === \"side\" && other.linkedOnly) continue;\n", "        if (mode === \"side\" && other.linkedOnly) continue;\n        if ((other.kind === \"installment\" && other.vade >= item.born) || (item.kind === \"installment\" && item.vade >= other.born)) continue;\n"],
  ["M18", "K8-3 / M1e B — Mevcut Borç kartı en yeni borçtan (eski kural)", "    pool.sort(s2);\n    // Kartın tüketebileceği", "    pool.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));\n    // Kartın tüketebileceği"],
  ["M19", "S2 sınır kayması — eşit vadede belge tarihi tersten", "  : a.date !== b.date ? (a.date < b.date ? -1 : 1)\n  : a.at !== b.at", "  : a.date !== b.date ? (a.date < b.date ? 1 : -1)\n  : a.at !== b.at"],
  ["M20", "M1e B — kart tahsilatı en geç vadeli taksitten", "    const ordered = [...card.installments].sort(s2);", "    const ordered = [...card.installments].sort(s2).reverse();"],
  ["M21", "v2.0.23 B — karttan SONRA kaydedilen borç da kapsanır", "&& !(card.at && target.recorded && target.recorded > card.at);", ";"],
  ["M22", "kart kapsamı B — kartın anındaki bilinen satırlar okunmaz (sonraki karşılıksız kapsamı değiştirir)", "  let forced = coverForcing(input, mode, pieces);", "  let forced = null;"],
  ["M23", "kart açılışı gün sınıfı B — aynı gün karttan önce yazılan ödeme karttan sonra sayılır", "events.push({ type: \"cover\", card, date: card.date, cls: 2,", "events.push({ type: \"cover\", card, date: card.date, cls: 1,"],
  ["M24", "gecikmiş B — yalnız yükümlülük rolü (netleşmemiş bağsız ödeme açık borç kalemi sayılmaz)", "item => item.side === \"receivable\" && item.vade < day", "item => item.due && item.side === \"receivable\" && item.vade < day"],
  // M25–M28 (birleşim düzeltmesinin G2 kilit istisnası ve v2.0.24 linkedLeft): tur 2b-2 S99 = A ile kural kalktı — karşı mutantlar API listesinde S99-a / S99-b / S99-c.
  // ---- Ç5-B tur 2a (dar kontrol DK-C5B) — her düzeltmenin karşı mutantı; değerle yakalanmalı ----
  ["Y1-a", "Y-1 geri — Kayıt Tarihi borçtan önce olan kart ön geçişe alınmaz (borç tüketilmez)", "  const late = lateCovers(input, state);", "  const late = new Set();"],
  ["Y1-b", "Y-1 — asıl geçişte kartın açılış günü kaydırılmaz (Kayıt Tarihi'nde tüketecek borç yok)", "const opened = endCover === line.planId ? END_OF_STREAM : shifted > line.date ? shifted : line.date;", "const opened = endCover === line.planId ? END_OF_STREAM : line.date;"],
  ["Y1-c", "Y-1 — ön geçişte kart bilinen satırların sonunda değil Kayıt Tarihi'nde", "endCover: shift ? cover.planId : \"\" });", "endCover: \"\" });"],
  ["Y1-e", "Y-1 — açılış günü tüketilen kalemin en ERKEN günü", "const date = consumed.reduce((max, entry) => (entry.target.born > max ? entry.target.born : max), String(cover.date || \"\"));", "const date = String(cover.date || \"\");"],
  ["O1-a", "O-1 geri — bağın anı düzeltme izinden okunmaz (oluşturulma anı)", "    const edited = linkTimes.get(lineId) || \"\";", "    const edited = \"\";"],
  ["O1-b", "O-1 — Kapatılacak Fatura bağında kilit oluşturulma anından", "lockAt(linkedAt(link.from.lineId, link.from.at))", "lockAt(link.from.at)"],
  ["O1-c", "O-1 — 'Hangi Taksite' bağında kilit oluşturulma anından", "const lock = lockAt(linkedAt(p.line.id, p.line.at));", "const lock = lockAt(p.line.at);"],
  ["T-a", "Hangi Taksite geri — bağlı tahsilat vade sırasıyla (bağ yok sayılır)", "const inst = p.amount > 0 && p.line.itemId ? byItem.get(p.line.itemId) : null;", "const inst = null;"],
  ["T-b", "Hangi Taksite — taksitini aşan kısım kaybolur", "sum + p.amount - (p.targeted || 0), 0);", "sum + p.amount - (p.targeted !== undefined ? p.amount : 0), 0);"],
  ["T-c", "Hangi Taksite × karar (3) — kilitli dönemdeki bütün taksitler ölçüme yazılmaz", "if (lock && !lockCaps && card.payments.some(p => p.targeted !== undefined)) for", "if (false) for"],
  ["T-d", "Hangi Taksite × karar (3) — kesilen payın kilidi bağın anından değil son tahsilatın kaydından", "const when = p.targeted !== undefined ? linkedAt(p.line.id, p.line.at) : \"\";", "const when = \"\";"],
  ["T-e", "Hangi Taksite × iade geri — eksi havuz bağlı payı geri almaz (karşılıksız çekin taksiti açılmaz, Taksit İadesi kalemi olur)", "    if (net < 0 && targets.length) {", "    if (false) {"],
  ["T-f", "Hangi Taksite × iade — bağlı pay EN ESKİ taksitten geri alınır", "pos.get(b.inst) - pos.get(a.inst) || b.index - a.index", "pos.get(a.inst) - pos.get(b.inst) || a.index - b.index"],
  ["T-g", "Hangi Taksite × iade — iade tutarı kadar değil bağlı payın tamamı geri alınır", "const cut = Math.min(t.p.targeted, -net);", "const cut = t.p.targeted;"],
  ["T-h", "Hangi Taksite × iade — geri alınan pay taksite dönmez (kalan değişmez)", "        t.inst.left += cut;\n", "\n"],
  ["B-a", "O-3 Taksit İadesi kaleminin günü son tahsilatın günü (iadenin değil)", "const back = card.payments.filter(p => p.amount < 0).at(-1)?.line || last;", "const back = last;"],
  ["B-b", "O-3 Taksit İadesi kalemi kart kalemlerinde yok", "    if (card.back) map.set(\"back\",", "    if (false) map.set(\"back\","],
  ["N02", "B12 sınır — kayıtla AYNI anda yazılan kilit sayılmaz (dar kontrolün yaşayan mutantı)", "      if (row.at > when) break;", "      if (row.at >= when) break;"],
  ["N06", "M13 B — şüpheli kuyruğu kayıt gününden SONRA doğan kalemi ilk geçişte alır (dar kontrolün yaşayan mutantı)", "        if (pass && item.born > record.date) continue;\n", "\n"],
];
// Ç5-B tur 2a: yol / önbellek düzeltmelerinin mutantları (server/routes/*) GERÇEK programda (API testleri) — tam kopya (server, client, test; node_modules bağı) üzerinde dosya
// değiştir → seçili testler → geri yükle. --yalniz-saf ile atlanır.
const API_MUTANTS = [
  // Y3-a: Ç5-B ilk hâlinin kuralı (iz değişmediyse bütün cariler); yalnız erken dönüşü kapatmak eşdeğerdir (boş artımlı geçiş aynı sonucu verir).
  ["Y3-a", "Y-3 geri — izi değişmeyen yazımda bütün cariler yeniden kurulur", "server/routes/invoices.mjs", "      if (!changed.size) {\n        settledCache = { ...previous, key };\n        return settledCache;\n      }\n      if (!changed.has(LOCK_PRINT) && changed.size <= INCREMENTAL_MAX) {", "      if (changed.size && !changed.has(LOCK_PRINT) && changed.size <= INCREMENTAL_MAX) {", ["test/tyk-onbellek-250.test.mjs", "test/tyk-api-250.test.mjs"]],
  ["Y3-b", "Y-3 — izde Kapatılacak Fatura bağı yok (bayat sayı)", "server/routes/invoices.mjs", "id(\"source_id\"), id(\"invoice_id\"), id(\"refund_of\")", "id(\"source_id\"), id(\"refund_of\")", ["test/tyk-onbellek-250.test.mjs"]],
  ["Y3-c", "Y-3 — izde kartın Kayıt Tarihi yok", "server/routes/invoices.mjs", "word(\"status\", [\"active\", \"closed\"]), day(\"registered_on\"), ", "word(\"status\", [\"active\", \"closed\"]), ", ["test/tyk-onbellek-250.test.mjs"]],
  ["Y3-d", "Y-3 — izde taksitin vadesi yok", "server/routes/invoices.mjs", "\"COALESCE(i.seq, 0)\", day(\"i.due_date\"), ", "\"COALESCE(i.seq, 0)\", ", ["test/tyk-onbellek-250.test.mjs"]],
  ["Y3-e", "Y-3 — kilit izi yazılmaz (N09'un kök nedeni geri)", "server/routes/invoices.mjs", "      prints.set(LOCK_PRINT, `|${", "      prints.set(`x${LOCK_PRINT}`, `|${", ["test/tyk-onbellek-250.test.mjs"]],
  ["N09", "önbellek B — dönem kilidinin izi değişince bütün cariler yeniden kurulmaz (dar kontrolün 'eşdeğere yakın' mutantı)", "server/routes/invoices.mjs", "if (!changed.has(LOCK_PRINT) && changed.size <= INCREMENTAL_MAX) {", "if (changed.size <= INCREMENTAL_MAX) {", ["test/tyk-onbellek-250.test.mjs"]],
  ["O1-API", "O-1 — düzeltme izinde önceki ↔ yeni bağ karşılaştırılmaz (bağın anı okunmaz)", "server/routes/invoices.mjs", "'$.previous.${previousKey}'", "'$.${previousKey}'", ["test/tyk-tur2a-250.test.mjs"]],
  ["O2-a", "O-2 geri — kart tahsilatı yanıtı kartın kendi hesabı", "server/routes/plans.mjs", "    ok(res, { ...detailView(plan.id, user), entryId:", "    ok(res, { ...detail(plan.id, user), entryId:", ["test/tyk-tur2a-250.test.mjs"]],
  ["O2-b", "O-2 geri — kart açılış yanıtı kartın kendi hesabı", "server/routes/plans.mjs", "    ok(res, detailView(id, user));", "    ok(res, result);", ["test/tyk-tur2a-250.test.mjs"]],
  ["O2-c", "O-2 geri — kart düzenleme / durum yanıtı kartın kendi hesabı", "server/routes/plans.mjs", "    ok(res, detailView(result.id, user));\n  });\n\n  router.delete(\"/api/workspace/plans/:id\"", "    ok(res, result);\n  });\n\n  router.delete(\"/api/workspace/plans/:id\"", ["test/tyk-tur2a-250.test.mjs"]],
  ["O3-a", "O-3 geri — kartın taksit dışı kalemleri hiçbir listede yok", "server/routes/plans.mjs", "    if (!map) return [];\n    const out = [];", "    if (true) return [];\n    const out = [];", ["test/tyk-tur2a-250.test.mjs"]],
  ["O3-b", "O-3 — zil / takvim kartın kalanını göstermez", "server/routes/plans.mjs", "      for (const item of [...capToRemaining(ledger), ...queueExtras(plan, queue, day)]) {\n        const amount = roundMoney(item.remaining - (item.held || 0));", "      for (const item of capToRemaining(ledger)) {\n        const amount = roundMoney(item.remaining - (item.held || 0));", ["test/tyk-tur2a-250.test.mjs"]],
  ["O3-c", "O-3 — Vade Takip / nakit akışı kartın kalanını göstermez", "server/routes/plans.mjs", "      for (const item of [...capToRemaining(ledger), ...queueExtras(plan, queue, day)]) {\n        // withoutDoubtful", "      for (const item of capToRemaining(ledger)) {\n        // withoutDoubtful", ["test/tyk-tur2a-250.test.mjs"]],
  ["N08", "M13 B — zilde şüpheli kuyruğundaki taksit kısmı düşülmez (dar kontrolün yaşayan mutantı)", "server/routes/plans.mjs", "        const amount = roundMoney(item.remaining - (item.held || 0));\n        if (amount <= 0.005 || item.state === \"open\"", "        const amount = roundMoney(item.remaining);\n        if (amount <= 0.005 || item.state === \"open\"", ["test/tyk-tur2a-250.test.mjs"]],
  // ---- Ç5-B tur 2b-1 (dar kontrol DK-C5BT2A) — her düzeltmenin karşı mutantları (değerle yakalanmalı) + dar kontrolün yaşayan mutantları (DÜŞÜK-1) ----
  ["G2-a", "G-2 — taksiti olmayan kart da 'taksitlere bölünmemiş kapsam yok' sayılır (açılır açılmaz Bitti)", "server/routes/plans.mjs", "(ownLeft <= 0.005 || (items.length > 0 && unplanned <= 0.005))", "(ownLeft <= 0.005 || unplanned <= 0.005)", ["test/tyk-tur2b1-250.test.mjs"]],
  ["G2-b", "G-2 — Mevcut Borç kartında taksitlere bölünmemiş kısım Bitti'yi engellemez", "server/routes/plans.mjs", "(ownLeft <= 0.005 || (items.length > 0 && unplanned <= 0.005))", "(ownLeft <= 0.005 || items.length > 0)", ["test/tyk-tur2b1-250.test.mjs"]],
  ["G2-c", "G-2 — kartın KENDİ tahsilatıyla ödenmiş taksitsiz kart Bitti olmaz (v2.4.9 kuralı yok)", "server/routes/plans.mjs", "(ownLeft <= 0.005 || (items.length > 0 && unplanned <= 0.005))", "(items.length > 0 && unplanned <= 0.005)", ["test/tyk-tur2b1-250.test.mjs"]],
  ["G2-d", "G-2 geri — boş taksit listesinde 'hepsi ödendi' (eski kural)", "server/routes/plans.mjs", " && items.every(item => item.state === \"paid\") && (ownLeft <= 0.005 || (items.length > 0 && unplanned <= 0.005));", " && items.every(item => item.state === \"paid\");", ["test/tyk-tur2b1-250.test.mjs", "test/tyk-fark-v249-250.test.mjs"]],
  ["O1C-a", "ORTA-1 geri — çek / senet bağının anı hiç okunmaz", "server/routes/invoices.mjs", "linkMoments: lockAt.active ? chequeLinkMoments(accountId) : new Map() };", "linkMoments: new Map() };", ["test/tyk-tur2b1-250.test.mjs"]],
  ["O1C-b", "ORTA-1 — çek bağının anı düzeltme izinden değil ilk olayın kaydından", "server/routes/invoices.mjs", "const at = String(row.changed || \"\") > String(row.created || \"\") ? String(row.changed) : String(row.created || \"\");", "const at = String(row.created || \"\");", ["test/tyk-tur2b1-250.test.mjs"]],
  ["O1C-c", "ORTA-1 — çek satırında kesin an yok (tutar düzeltmesinin yeni satırı bağın anını değiştirir)", "server/lib/obligation-queue.mjs", "    if (linkMoments.has(lineId)) return linkMoments.get(lineId);\n", "\n", ["test/tyk-tur2b1-250.test.mjs"]],
  ["O1C-d", "ORTA-1 — çek bağını değiştiren İLK düzeltmenin anı (son değil)", "server/routes/invoices.mjs", "(SELECT MAX(a.created_at) FROM audit_events a", "(SELECT MIN(a.created_at) FROM audit_events a", ["test/tyk-tur2b1-250.test.mjs"]],
  ["O2V-a", "ORTA-2 geri — yalnız cari kartından yapılan ödeme alacak kalemi", "server/routes/accounts.mjs", "(item.side === \"receivable\" && item.kind !== \"invoice\" && RECEIVABLE_ITEM_ORIGINS.has(item.origin))", "(item.kind === \"payment\" && item.side === \"receivable\" && item.origin === \"account\")", ["test/tyk-tur2b1-250.test.mjs", "test/tyk-fark-v249-250.test.mjs"]],
  ["O2V-b", "ORTA-2 — stoktan Alış İadesi kalem değil", "server/routes/accounts.mjs", "const RECEIVABLE_ITEM_ORIGINS = new Set([\"account\", \"stock\", \"invoice\", \"cheque\", \"pos-fee\"]);", "const RECEIVABLE_ITEM_ORIGINS = new Set([\"account\", \"invoice\", \"cheque\", \"pos-fee\"]);", ["test/tyk-tur2b1-250.test.mjs"]],
  ["O2V-c", "ORTA-2 — faturalı Alış İadesi kalem değil", "server/routes/accounts.mjs", "const RECEIVABLE_ITEM_ORIGINS = new Set([\"account\", \"stock\", \"invoice\", \"cheque\", \"pos-fee\"]);", "const RECEIVABLE_ITEM_ORIGINS = new Set([\"account\", \"stock\", \"cheque\", \"pos-fee\"]);", ["test/tyk-tur2b1-250.test.mjs"]],
  ["O2V-d", "ORTA-2 — fatura kalemi cari kalemi olarak da sayılır (çift)", "server/routes/accounts.mjs", "(item.side === \"receivable\" && item.kind !== \"invoice\" && RECEIVABLE_ITEM_ORIGINS.has(item.origin))", "(item.side === \"receivable\" && RECEIVABLE_ITEM_ORIGINS.has(item.origin))", ["test/tyk-fark-v249-250.test.mjs"]],
  ["G1-a", "G-1 — kart ekranı / yanıtı kuyruksuz (kartın kendi hesabı)", "server/routes/plans.mjs", "    return ledger ? new Map([[accountId, module.obligationsFor(accountId, ledger)]]) : null;", "    return null;", ["test/tyk-tur2b1-250.test.mjs"]],
  ["G1-b", "G-1 — tek cari kuyruğu kart satırları olmadan kurulur", "server/routes/plans.mjs", "new Map([[accountId, module.obligationsFor(accountId, ledger)]])", "new Map([[accountId, module.obligationsFor(accountId, ledger.filter(line => line.origin !== \"plan\"))]])", ["test/tyk-tur2b1-250.test.mjs"]],
  ["G1-c", "G-1 — tek cari kuyruğu carinin tahsilatları olmadan kurulur", "server/routes/plans.mjs", "new Map([[accountId, module.obligationsFor(accountId, ledger)]])", "new Map([[accountId, module.obligationsFor(accountId, ledger.filter(line => line.kind !== \"in\"))]])", ["test/tyk-tur2b1-250.test.mjs"]],
  ["D01", "iz kapsamı — kart hareketinin 'Hangi Taksite' bağı izde yok (DK-C5BT2A yaşayan mutantı)", "server/routes/invoices.mjs", "hash(\"e.rowid\", [\"p.rowid\", id(\"e.item_id\"), ", "hash(\"e.rowid\", [\"p.rowid\", ", ["test/tyk-tur2b1-250.test.mjs"]],
  ["D02", "iz kapsamı — faturanın tutarı (try_payable) izde yok (DK-C5BT2A yaşayan mutantı)", "server/routes/invoices.mjs", "word(\"status\", [\"draft\", \"issued\", \"cancelled\"]), num(\"try_payable\"), ", "word(\"status\", [\"draft\", \"issued\", \"cancelled\"]), ", ["test/tyk-tur2b1-250.test.mjs"]],
  ["D03", "iz kapsamı — çek olayının fatura bağı (UX18) izde yok (DK-C5BT2A yaşayan mutantı)", "server/routes/invoices.mjs", "\"c.rowid\", word(\"ev.kind\", [\"receive\", \"issue\", \"endorse\", \"bounce\", \"collect\", \"pay\", \"return\", \"cancel\"]), id(\"ev.invoice_id\"), ", "\"c.rowid\", word(\"ev.kind\", [\"receive\", \"issue\", \"endorse\", \"bounce\", \"collect\", \"pay\", \"return\", \"cancel\"]), ", ["test/tyk-tur2b1-250.test.mjs"]],
  ["D05", "bağ zamanı — bağı değiştiren İLK düzeltmenin anı (DK-C5BT2A yaşayan mutantı)", "server/routes/invoices.mjs", "MAX(created_at) AS at FROM audit_events", "MIN(created_at) AS at FROM audit_events", ["test/tyk-tur2b1-250.test.mjs"]],
  ["D06", "bağ zamanı — 'Hangi Taksite' bağının düzeltme anı eşleşmez (DK-C5BT2A yaşayan mutantı)", "server/routes/invoices.mjs", "\"itemId\", \"itemId\", \"plan-entry:\");", "\"itemId\", \"itemId\", \"\");", ["test/tyk-tur2b1-250.test.mjs"]],
  ["D10", "O-3 — Taksit İadesi kalemi listelerde yok (DK-C5BT2A yaşayan mutantı)", "server/routes/plans.mjs", "const QUEUE_EXTRAS = [[\"rest\", \"Taksitlendirilmemiş Kalan\"], [\"back\", \"Taksit İadesi\"]];", "const QUEUE_EXTRAS = [[\"rest\", \"Taksitlendirilmemiş Kalan\"]];", ["test/tyk-tur2b1-250.test.mjs"]],
  ["D11", "O-3 — kartın kalanı Taksit İadesi'ni saymaz (DK-C5BT2A yaşayan mutantı)", "server/routes/plans.mjs", "const remaining = roundMoney(items.reduce((sum, item) => sum + item.remaining, 0) + extras.reduce((sum, item) => sum + item.remaining, 0));", "const remaining = roundMoney(items.reduce((sum, item) => sum + item.remaining, 0) + Math.max(0, roundMoney(map.get(\"rest\")?.remaining || 0)));", ["test/tyk-tur2b1-250.test.mjs"]],
  // ---- Ç5-B tur 2b-2 — kararların KARŞI seçenekleri + sınır kaymaları (değerle yakalanmalı; test/tyk-tur2b2-250.test.mjs + komşular) ----
  ["S95-a", "S95 B — netleşme geri alınmaz (satış 4.000 + ödenen 6.000 ayrı)", "server/lib/obligation-queue.mjs", "    if (mode === \"net\" && item.left > 0 && freePayment(item) && nettings.length) unnet(item);\n", "\n", ["test/tyk-tur2b2-250.test.mjs"]],
  ["S97-a", "S97 B / S102 sınır — ödemenin KENDİ günündeki netleşme de geri alınır", "server/lib/obligation-queue.mjs", "const undo = nettings.filter(row => row.amount > 0 && row.date < item.born)", "const undo = nettings.filter(row => row.amount > 0 && row.date <= item.born)", ["test/tyk-tur2b2-250.test.mjs"]],
  ["S102-a", "S102 B — önceki günlerin netleşmesi EN ESKİDEN geri alınır", "server/lib/obligation-queue.mjs", ".sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : b.seq - a.seq));", ".sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.seq - b.seq));", ["test/tyk-tur2b2-250.test.mjs"]],
  ["S103-a", "S103 B — verilen avansın kalemle kapanışı da netleşme sayılır (geri alınır)", "server/lib/obligation-queue.mjs", "if (mode === \"net\" && item.due && other.due) nettings.push(", "if (mode === \"net\" && (item.due || other.due)) nettings.push(", ["test/tyk-tur2b2-250.test.mjs"]],
  ["S98-a", "S98 B / S104 B — gelen ödeme önce yükümlülük kalemlerini, sonra avansı kapatır", "server/lib/obligation-queue.mjs", "      else against.sort(s2);\n", "      else against.sort((a, b) => (Boolean(a.due) === Boolean(b.due) ? s2(a, b) : a.due ? -1 : 1));\n", ["test/tyk-tur2b2-250.test.mjs"]],
  ["S105-a", "S105 B — gelen alış önce vade sırasıyla (alış iadesi önceliği yok)", "server/lib/obligation-queue.mjs", "      if (mode === \"net\" && item.due && item.sign < 0) against.sort(", "      if (false) against.sort(", ["test/tyk-tur2b2-250.test.mjs"]],
  ["S99-a", "S99 B — fatura durumunda taksitli faturanın taksitleri yalnız BAĞLI ödemeyle kapanır (2.4.9 / v2.0.24)", "server/lib/obligation-queue.mjs", "      const instLeft = card ? card.installments.reduce((sum, inst) => sum + inst.left, 0) : 0;", "      const instLeft = card ? card.installments.reduce((sum, inst) => sum + Math.max(0, inst.amount - inst.closures.filter(c => !c.reverse && c.mode === \"linked\").reduce((t, c) => t + c.amount, 0)), 0) : 0;", ["test/tyk-tur2b2-250.test.mjs", "test/tyk-250.test.mjs", "test/bulgu-223.test.mjs"]],
  ["S99-b", "S99 — G2 kilit ölçümünde taksitli faturanın kendi kartı istisnası geri (birleşim düzeltmesinin kuralı)", "server/lib/obligation-queue.mjs", "const closedByL = target ? target.freeClosures", "const closedByL = target && !(mode === \"side\" && target.ownCard) ? target.freeClosures", ["test/tyk-250.test.mjs", "test/tyk-kilit-taksitli-250.test.mjs"]],
  ["S99-c", "S99 — fatura kapatanlarında bağsız (Otomatik) satırlar yok", "server/lib/obligation-queue.mjs", "...(card ? card.installments.flatMap(inst => inst.closures.filter(c => !c.reverse).map(c => closerOf(c))) : [])];", "...(card ? card.installments.flatMap(inst => inst.closures.filter(c => !c.reverse && c.mode === \"linked\").map(c => closerOf(c))) : [])];", ["test/tyk-tur2b2-250.test.mjs", "test/tyk-250.test.mjs"]],
  ["S101-a", "S101 B — avansla kapanmış borca kart: ön ödeme yok (kırpma; kart tahsilatı kaybolur)", "server/lib/obligation-queue.mjs", "  let prepaid = prepaidOf(state);", "  let prepaid = null;", ["test/tyk-tur2b2-250.test.mjs", "test/tyk-250.test.mjs"]],
  ["S101-b", "S101 — avansla ödenmiş kısım SON taksitten (vadesi en önce gelenden değil)", "server/lib/obligation-queue.mjs", "    for (const inst of [...card.installments].sort(s2)) {\n      if (!(paid > 0)) break;", "    for (const inst of [...card.installments].sort(s2).reverse()) {\n      if (!(paid > 0)) break;", ["test/tyk-tur2b2-250.test.mjs"]],
  ["S101-c", "S101 sınır — para dışı kapanış (iade, Alacak) da 'avansla ödenmiş' sayılır", "server/lib/obligation-queue.mjs", "c.payer?.kind === \"payment\").reduce((sum, c) => sum + c.amount, 0);\n      const take = Math.min(money - (target.advClaimed || 0), claim);", "c.payer).reduce((sum, c) => sum + c.amount, 0);\n      const take = Math.min(money - (target.advClaimed || 0), claim);", ["test/tyk-tur2b2-250.test.mjs"]],
  ["S101-d", "S101 — ön ödemeli geçiş tek kez (kararlı olana dek değil)", "server/lib/obligation-queue.mjs", "for (let pass = 0; prepaid && pass < 12; pass += 1) {", "for (let pass = 0; prepaid && pass < 1; pass += 1) {", ["test/tyk-250.test.mjs"]],
  ["S110-a", "S110 B — kart açık borç fazlayken de vade sırasıyla (S2) bütün borçları içine alır", "server/lib/obligation-queue.mjs", "    if (openDebt > cap && card.source !== \"transfer\") {", "    if (false) {", ["test/tyk-tur2b2-250.test.mjs", "test/tyk-fark-v249-250.test.mjs"]],
  ["S110-b", "S110 sınır — açık borç kart tutarına EŞİTKEN de tetiklenir", "server/lib/obligation-queue.mjs", "    if (openDebt > cap && card.source !== \"transfer\") {", "    if (openDebt >= cap && card.source !== \"transfer\") {", ["test/tyk-tur2b2-250.test.mjs"]],
  ["S110-c", "S110 sınır — 1 kuruş fazla tetiklemez", "server/lib/obligation-queue.mjs", "    if (openDebt > cap && card.source !== \"transfer\") {", "    if (openDebt > cap + 1 && card.source !== \"transfer\") {", ["test/tyk-tur2b2-250.test.mjs"]],
  ["S110-d", "S110 — satışla açılan kart kendi satışını tanımaz (elle kol)", "server/lib/obligation-queue.mjs", "      const own = ownSaleOf(card);", "      const own = null;", ["test/tyk-tur2b2-250.test.mjs", "test/tyk-fark-v249-250.test.mjs"]],
  ["S110-e", "S110 / Tablodan Aktar — kararlar Excel / Tablodan Aktar kartına da uygulanır", "server/lib/obligation-queue.mjs", "    if (openDebt > cap && card.source !== \"transfer\") {", "    if (openDebt > cap) {", ["test/tyk-tur2b2-250.test.mjs"]],
  ["S120-a", "S120 B — eşit tek elle borç yoksa bütün borçlar vade sırasıyla (faturalar da)", "server/lib/obligation-queue.mjs", "        chosen = equal.length === 1 ? equal : [...elle, ...candidates.filter(target => !isElle(target))];", "        chosen = equal.length === 1 ? equal : candidates;", ["test/tyk-tur2b2-250.test.mjs"]],
  ["S120-b", "S120 — 'TEK elle borç' istisnası yok (eşit elle borç olsa da eskiden yeniye)", "server/lib/obligation-queue.mjs", "        const equal = elle.filter(target => target.left === cap);", "        const equal = [];", ["test/tyk-tur2b2-250.test.mjs"]],
  ["S122-a", "S122 B — karta gelen ödeme elle borçların Kalan'ını EN YENİDEN düşürür", "server/lib/obligation-queue.mjs", "      for (const { target, take } of card.consumedFrom) {\n        const settled", "      for (const { target, take } of [...card.consumedFrom].reverse()) {\n        const settled", ["test/tyk-tur2b2-250.test.mjs"]],
  // Ç5-B son tur (S126 = A, S128 = A; kullanıcı 11.11 11:16 / 13:29): karşı seçenekler (B) ve sınır kaymaları — test/tyk-son-250.test.mjs DEĞERLE yakalamalı.
  ["S126-a", "S126 B — karta gelen ödeme önce ELLE borçları düşürür (fatura sonra)", "server/lib/obligation-queue.mjs", "      for (const { target, take } of card.consumedFrom) {\n        const settled", "      for (const { target, take } of [...card.consumedFrom].sort((a, b) => Number(b.target.kind === \"entry\") - Number(a.target.kind === \"entry\"))) {\n        const settled", ["test/tyk-son-250.test.mjs"]],
  ["S126-b", "S126 — açık borca eşit kartın içine alma sırası elle borçlar önce (S120 kolu gibi; fatura dahil eskiden yeniye değil)", "server/lib/obligation-queue.mjs", "    let chosen = candidates;\n", "    let chosen = [...candidates.filter(isElle), ...candidates.filter(target => !isElle(target))];\n", ["test/tyk-son-250.test.mjs"]],
  ["S126-c", "S126 / S122 B — karta gelen ödeme kalemleri EN YENİDEN düşürür", "server/lib/obligation-queue.mjs", "      for (const { target, take } of card.consumedFrom) {\n        const settled", "      for (const { target, take } of [...card.consumedFrom].reverse()) {\n        const settled", ["test/tyk-son-250.test.mjs"]],
  ["S128-a", "S128 B — karta gelen ödeme önce fatura ve elle borçları düşürür (stok / karşılıksız sonra)", "server/lib/obligation-queue.mjs", "      for (const { target, take } of card.consumedFrom) {\n        const settled", "      for (const { target, take } of [...card.consumedFrom].sort((a, b) => Number([\"invoice\", \"entry\"].includes(b.target.kind)) - Number([\"invoice\", \"entry\"].includes(a.target.kind)))) {\n        const settled", ["test/tyk-son-250.test.mjs"]],
  ["S128-b", "S128 — fatura / elle borç dışındaki kalem (stok, karşılıksız) kartın ödemesinden pay almaz", "server/lib/obligation-queue.mjs", "        const settled = Math.min(paid, take);", "        const settled = [\"invoice\", \"entry\"].includes(target.kind) ? Math.min(paid, take) : 0;", ["test/tyk-son-250.test.mjs"]],
  ["S126-d", "S126 — kapanan pay yalnız kartın Taksit Tahsilatı'ndan (karta pay düşen bağsız tahsilat — S50 — kalemleri düşürmez)", "server/lib/obligation-queue.mjs", "      let paid = card.installments.reduce((sum, inst) => sum + (inst.amount - inst.left), 0) - (card.advance || 0);", "      let paid = card.paidByCard || 0;", ["test/tyk-son-250.test.mjs"]],
  ["S96-a", "S96 B — çek / senetle ve bankadan verilen avans takvim / zil / Vade Takip kalemi değil", "server/routes/accounts.mjs", "const RECEIVABLE_ITEM_ORIGINS = new Set([\"account\", \"stock\", \"invoice\", \"cheque\", \"pos-fee\"]);", "const RECEIVABLE_ITEM_ORIGINS = new Set([\"account\", \"stock\", \"invoice\"]);", ["test/tyk-tur2b2-250.test.mjs"]],
  ["S118-a", "S118 A — formun önerisi kuyruk kalanından (kartın kendi kalanı değil)", "server/routes/plans.mjs", "      ownNext: ledger.next || null,", "      ownNext: next ? { id: next.id, seq: next.seq, dueDate: next.dueDate, remaining: next.remaining, days: next.days, state: next.state } : null,", ["test/tyk-tur2b2-250.test.mjs"]],
  ["S118-b", "S118 A — taksit satırının 'kendi kalanı' kuyruk kalanı", "server/routes/plans.mjs", "ownRemaining: item.remaining,", "ownRemaining: remaining,", ["test/tyk-tur2b2-250.test.mjs"]],
  ["Y2-a", "Y2 B — gecikmiş taksitlendirilmemiş kalan kartı 'Gecikti' yapmaz", "server/routes/plans.mjs", "overdue.length || lateExtras.length ? \"overdue\" : \"active\";", "overdue.length ? \"overdue\" : \"active\";", ["test/tyk-tur2b2-250.test.mjs", "test/tyk-tur2b1-250.test.mjs"]],
  ["Y2-b", "Y2 — Geciken tutarı taksitlendirilmemiş kalanı saymaz", "server/routes/plans.mjs", "overdue: roundMoney(overdue.reduce((sum, item) => sum + item.remaining, 0) + lateExtras.reduce((sum, item) => sum + item.remaining, 0)),", "overdue: roundMoney(overdue.reduce((sum, item) => sum + item.remaining, 0)),", ["test/tyk-tur2b2-250.test.mjs"]],
  // Ç5-B son tur (hız): tek carinin önbelleği (invoices.obligationsOf) — bayatlık mutantları (eşdeğerlik testi yakalamalı) ve belleğin kullanılmaması (sayaç testi).
  ["HIZ-a", "tek cari belleği yazımdan sonra geçersiz kılınmaz (bayat sonuç)", "server/routes/invoices.mjs", "    if (oneCache.key !== key) oneCache = { key, map: new Map() };", "    if (!oneCache.key) oneCache = { key, map: new Map() };", ["test/tyk-onbellek-250.test.mjs", "test/tyk-son-250.test.mjs"]],
  ["HIZ-b", "bütün carilerin BAYAT önbelleği tek cari okumasında kullanılır (anahtar karşılaştırılmaz)", "server/routes/invoices.mjs", "    if (settledCache.key === key && settledCache.tyk?.has(accountId)) return settledCache.tyk.get(accountId);", "    if (settledCache.tyk?.has(accountId)) return settledCache.tyk.get(accountId);", ["test/tyk-onbellek-250.test.mjs", "test/tyk-son-250.test.mjs"]],
  ["HIZ-c", "artımlı yenileme tek cari belleğini anahtarına bakmadan kullanır (önceki veri durumunun sonucu)", "server/routes/invoices.mjs", "          const memo = oneCache.key === key ? oneCache.map.get(id) || null : null;", "          const memo = oneCache.map.get(id) || null;", ["test/tyk-onbellek-250.test.mjs"]],
  ["HIZ-d", "tek cari belleği yazılmaz (yazımdan sonraki kart okuması kuyruğu yeniden kurar — tur 2b-1 hâli)", "server/routes/invoices.mjs", "    oneCache.map.set(accountId, result);\n", "\n", ["test/tyk-son-250.test.mjs"]],
  // S98 × S99 (fatura durumunda karşı tarafın netleşmemiş bağsız parası kalem) — karşı okuma (2.4.9 / taban: fatura durumunda verilen avans hiç kapanmaz) ve sınırlar.
  ["S98S99-a", "S98 × S99 B — fatura durumunda karşı tarafın avansı gelen paranın karşısında kalem değil (taban)", "server/lib/obligation-queue.mjs", "    if (mode !== \"side\" || !freeMoney(item)) return [own];", "    return [own];", ["test/tyk-tur2b2-250.test.mjs", "test/iade-geri-odeme-246.test.mjs"]],
  ["S98S99-b", "S98 × S99 — karşı tarafın BELGE kalemleri de (yalnız bağsız para değil) eşleşir: karar (5) çiğnenir", "server/lib/obligation-queue.mjs", "[...lists[0], ...lists[1].filter(other => freeMoney(other))]", "[...lists[0], ...lists[1], ...open[`${item.side === \"r\" ? \"p\" : \"r\"}Due`]]", ["test/tyk-tur2b2-250.test.mjs", "test/tyk-250.test.mjs"]],
  ["S98S99-d", "S98 × S99 — faturasız stok iadesinin açık kalanı da karşı tarafın parasıyla bu kuralla kapanır (K-b / KS8.1 kaybolur — kâhin c12 B1)", "server/lib/obligation-queue.mjs", "  const freeMoney = item => !item.due && !item.linkedOnly && item.kind === \"payment\" && (item.line?.origin === \"account\" || item.line?.origin === \"cheque\");", "  const freeMoney = item => freePayment(item);", ["test/tyk-tur2b2-250.test.mjs", "test/tyk-250.test.mjs"]],
  ["S98S99-c", "S98 B (fatura durumu) — avans vade sırasına girmez, yükümlülüklerden SONRA", "server/lib/obligation-queue.mjs", "      else against.sort(s2);", "      else against.sort((a, b) => (mode !== \"side\" || Boolean(a.due) === Boolean(b.due) ? s2(a, b) : a.due ? -1 : 1));", ["test/tyk-tur2b2-250.test.mjs"]],
  // Takvim / zil ufku söz gününe göre (S67 = A, K6.3) — karşı okuma: ufuk vadeden ölçülen gün sayısıyla (Ç5-B'nin gerilemesi).
  ["SOZ-a", "takvim / zil ufku vadeden ölçülen days ile (ileri tarihli sözlü gecikmiş borç ufuk dışında da görünür)", "server/routes/accounts.mjs", "openDueItems(day).filter(item => windowGap(day, item.dueDate) <= DUE_WINDOW.aheadDays);", "openDueItems(day).filter(item => item.days <= DUE_WINDOW.aheadDays);", ["test/tyk-tur2b2-250.test.mjs"]],
  ["SOZ-b", "takvim / zil ufku sınırı kaydı — bugün + 7 dahil değil", "server/routes/accounts.mjs", "openDueItems(day).filter(item => windowGap(day, item.dueDate) <= DUE_WINDOW.aheadDays);", "openDueItems(day).filter(item => windowGap(day, item.dueDate) < 5);", ["test/tyk-tur2b2-250.test.mjs", "test/cari-vade-245.test.mjs", "test/dues.test.mjs"]],
];
rmSync(base, { recursive: true, force: true });
let killed = 0;
const rows = [];
for (const [id, label, from, to] of MUTANTS) {
  const pairs = Array.isArray(from) ? from : [[from, to]];
  let mutated = SOURCE;
  const bad = pairs.map(([a]) => SOURCE.split(a).length - 1).find(count => count !== 1);
  if (bad !== undefined) {
    rows.push(`${id} ENJEKTE EDİLEMEDİ (${bad} eşleşme) — ${label}`);
    continue;
  }
  for (const [a, b] of pairs) mutated = mutated.replace(a, b);
  const dir = path.join(base, id);
  mkdirSync(path.join(dir, "server/lib"), { recursive: true });
  mkdirSync(path.join(dir, "test"), { recursive: true });
  for (const file of ["money.mjs", "invoice-settle.mjs", "plans.mjs"]) cpSync(path.join(ROOT, "server/lib", file), path.join(dir, "server/lib", file));
  writeFileSync(path.join(dir, "server/lib/obligation-queue.mjs"), mutated);
  cpSync(path.join(ROOT, "test/tyk-250.test.mjs"), path.join(dir, "test/tyk-250.test.mjs"));
  writeFileSync(path.join(dir, "package.json"), JSON.stringify({ type: "module" }));
  const run = spawnSync(process.execPath, ["--test", path.join(dir, "test/tyk-250.test.mjs")], { cwd: dir, encoding: "utf8", timeout: 120_000 });
  const fail = Number((run.stdout.match(/^# fail (\d+)/m) || [])[1] || 0);
  const pass = Number((run.stdout.match(/^# pass (\d+)/m) || [])[1] || 0);
  const failed = [...run.stdout.matchAll(/^\s*not ok \d+ - (.*)$/gm)].map(m => m[1]).filter(name => !/^TYK — /.test(name)).slice(0, 3);
  const dead = run.status !== 0 && fail > 0;
  if (dead) killed += 1;
  rows.push(`${id} ${dead ? "ÖLDÜ" : "YAŞADI"} (pass ${pass}, fail ${fail}) — ${label}${dead ? ` · öldüren: ${failed.join(" | ").slice(0, 300)}` : ""}`);
}
// API mutantları: tam kopya (server, client, test; node_modules ROOT'unkine bağ — npm ci YOK, ders 29), taban yeşil değilse koşulmaz.
let apiTotal = 0;
if (!argv.includes("--yalniz-saf")) {
  const full = path.join(base, "tam");
  mkdirSync(full, { recursive: true });
  for (const dir of ["server", "client", "test"]) cpSync(path.join(ROOT, dir), path.join(full, dir), { recursive: true });
  cpSync(path.join(ROOT, "package.json"), path.join(full, "package.json"));
  symlinkSync(realpathSync(path.join(ROOT, "node_modules")), path.join(full, "node_modules"), "junction");
  const env = { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
  const runTests = tests => spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", ...tests], { cwd: full, encoding: "utf8", timeout: 1_800_000, env });
  const count = (out, name) => Number((out.match(new RegExp(`^# ${name} (\\d+)`, "m")) || [])[1] || 0);
  const tests = [...new Set(API_MUTANTS.flatMap(m => m[5]))];
  const baseRun = runTests(tests);
  rows.push(`API TABAN (mutantsız): tests ${count(baseRun.stdout, "tests")}, pass ${count(baseRun.stdout, "pass")}, fail ${count(baseRun.stdout, "fail")}, çıkış ${baseRun.status}`);
  if (baseRun.status === 0) {
    for (const [id, label, file, from, to, list] of API_MUTANTS) {
      apiTotal += 1;
      const target = path.join(full, file);
      const original = readFileSync(target, "utf8");
      const hits = original.split(from).length - 1;
      if (hits !== 1) {
        rows.push(`${id} ENJEKTE EDİLEMEDİ (${hits} eşleşme) — ${label}`);
        continue;
      }
      writeFileSync(target, original.replace(from, to));
      const run = runTests(list);
      writeFileSync(target, original);
      const failed = [...run.stdout.matchAll(/^\s*not ok \d+ - (.*)$/gm)].map(m => m[1]).slice(0, 3);
      const dead = run.status !== 0 && count(run.stdout, "fail") > 0;
      if (dead) killed += 1;
      rows.push(`${id} ${dead ? "ÖLDÜ" : "YAŞADI"} (tests ${count(run.stdout, "tests")}, pass ${count(run.stdout, "pass")}, fail ${count(run.stdout, "fail")}) — ${label}${dead ? ` · öldüren: ${failed.join(" | ").slice(0, 300)}` : ""}`);
    }
  } else rows.push("API TABAN KIRMIZI — API mutantları koşulmadı");
}
rmSync(base, { recursive: true, force: true });
for (const row of rows) console.log(row);
const total = MUTANTS.length + (argv.includes("--yalniz-saf") ? 0 : API_MUTANTS.length);
console.log(`# tests ${total}\n# pass ${killed}\n# fail ${total - killed}`);
process.exitCode = killed === total ? 0 : 1;
