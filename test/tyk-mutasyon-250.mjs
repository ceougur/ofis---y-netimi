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
  ["M21", "v2.0.23 B — karttan SONRA kaydedilen borç da kapsanır", "      if (card.at && target.recorded && target.recorded > card.at) continue;\n", "\n"],
  ["M22", "kart kapsamı B — kartın anındaki bilinen satırlar okunmaz (sonraki karşılıksız kapsamı değiştirir)", "  let forced = coverForcing(input, mode, pieces);", "  let forced = null;"],
  ["M23", "kart açılışı gün sınıfı B — aynı gün karttan önce yazılan ödeme karttan sonra sayılır", "events.push({ type: \"cover\", card, date: card.date, cls: 2,", "events.push({ type: \"cover\", card, date: card.date, cls: 1,"],
  ["M24", "gecikmiş B — yalnız yükümlülük rolü (netleşmemiş bağsız ödeme açık borç kalemi sayılmaz)", "item => item.side === \"receivable\" && item.vade < day", "item => item.due && item.side === \"receivable\" && item.vade < day"],
  // Ç5-B birleşim düzeltmesi (mutabakat yıl dönümü tohum 39): fatura durumunda karar (3)'ün kilit ölçümü taksitli faturanın kendi kartını "bağsız kapanmış" saymaz.
  ["M25", "birleşim düzeltmesi geri — G2 kilit ölçümü taksitli faturanın kendi kartının bağsız kapanışını sayar (kart tahsilatı faturayı kapatmaz)", "const closedByL = target && !(mode === \"side\" && target.ownCard) ?", "const closedByL = target ?"],
  ["M26", "istisna iki görünümde — net görünümde de karar (3) kart tahsilatını kesmez (taksit yeniden açılır)", "const closedByL = target && !(mode === \"side\" && target.ownCard) ?", "const closedByL = target && !target.ownCard ?"],
  ["M27", "istisna ters görünümde — yalnız net görünümde", "const closedByL = target && !(mode === \"side\" && target.ownCard) ?", "const closedByL = target && !(mode === \"net\" && target.ownCard) ?"],
  ["M28", "v2.0.24 B — fatura durumu taksitli faturanın bağsız kapanışını da sayar (açık ≠ kartın kalanı)", "const linkedLeft = item => Math.max(0, item.amount - item.closures.filter(c => !c.reverse && c.mode !== \"auto\" && c.mode !== \"locked\").reduce((sum, c) => sum + c.amount, 0));", "const linkedLeft = item => Math.max(0, item.left);"],
  // ---- Ç5-B tur 2a (dar kontrol DK-C5B) — her düzeltmenin karşı mutantı; değerle yakalanmalı ----
  ["Y1-a", "Y-1 geri — Kayıt Tarihi borçtan önce olan kart ön geçişe alınmaz (borç tüketilmez)", "  const late = lateCovers(input, state);", "  const late = new Set();"],
  ["Y1-b", "Y-1 — asıl geçişte kartın açılış günü kaydırılmaz (Kayıt Tarihi'nde tüketecek borç yok)", "const opened = endCover === line.planId ? END_OF_STREAM : shifted > line.date ? shifted : line.date;", "const opened = endCover === line.planId ? END_OF_STREAM : line.date;"],
  ["Y1-c", "Y-1 — ön geçişte kart bilinen satırların sonunda değil Kayıt Tarihi'nde", "endCover: shift ? cover.planId : \"\" });", "endCover: \"\" });"],
  ["Y1-d", "Y-1 — belirsizlik koruması ters (tek okumalı kart kaydırılmaz)", "    if (shift && card?.ambiguous) {", "    if (shift && !card?.ambiguous) {"],
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
  ["O2V-b", "ORTA-2 — stoktan Alış İadesi kalem değil", "server/routes/accounts.mjs", "const RECEIVABLE_ITEM_ORIGINS = new Set([\"account\", \"stock\", \"invoice\"]);", "const RECEIVABLE_ITEM_ORIGINS = new Set([\"account\", \"invoice\"]);", ["test/tyk-tur2b1-250.test.mjs"]],
  ["O2V-c", "ORTA-2 — faturalı Alış İadesi kalem değil", "server/routes/accounts.mjs", "const RECEIVABLE_ITEM_ORIGINS = new Set([\"account\", \"stock\", \"invoice\"]);", "const RECEIVABLE_ITEM_ORIGINS = new Set([\"account\", \"stock\"]);", ["test/tyk-tur2b1-250.test.mjs"]],
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
