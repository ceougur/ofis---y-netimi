// 2.5.1 D3 TUR 5 — VERİ DAMGASININ İZ TÜRÜ LİSTESİ EKSİKSİZ Mİ (KAYNAK TARAMASI; tur 4 raporu DOĞRULANMADI-4 + BM-T4-2 KABUL: "yeni bir veri modülü kendi iz türüyle eklenirse listeye
// girmeli"). Programın (server/**) yazdığı HER denetim izi türü ya veri damgasına girer (plan-reader.mjs DATA_AUDIT_TYPES, NON_DATA_AUDIT_TYPES dışında) ya da aşağıdaki gerekçeli VERİ DIŞI
// listededir; ikisinde de olmayan YENİ iz türü bu testi kırar (yeni bir para yazıcısı listeye girmeden eklenemez). Ayrıca devirde budanan / kalan (B / A) her tablo ya damganın saydığı
// tablolardadır ya da yazımı iz türüyle / gerekçeyle karşılanmıştır. Satır bölme /\r?\n/ (ders 27). Test dosyası okuma dışında hiçbir şey yapmaz.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reader = await import("../server/lib/devir/plan-reader.mjs");

// VERİ DIŞI iz türleri (önek; "." ile biter ya da tam ad) — veri damgasına GİRMEZ. Her satır gerekçesiyle. Bir para tablosuna yazan iz buraya YAZILMAZ.
const VERI_DISI = Object.freeze({
  "auth.": "giriş / kurtarma (oturum)",
  "license.": "lisans",
  "user.": "kullanıcı yönetimi (ortak katman)",
  "role.": "rol yönetimi (ortak katman)",
  "profile.": "kişisel görünüm / parola",
  "whatsapp.": "WhatsApp gönderimi (para tablosu yok)",
  "mobile.": "mobil cihaz",
  "system.": "yedek, güncelleme, ağ ayarı (yedekten geri yükleme dosyanın kendisini değiştirir — damga yeni dosyadan okunur)",
  "report.": "rapor görüntüleme / sütun seçimi",
  "overview.": "Anlık Durum dışa aktarımı",
  "office.": "rapor başlığı (Tabela Adı)",
  "insight.": "Veri Sağlığı bulgusunun görünümü",
  "task.": "görev listesi",
  "message.": "iç ileti",
  "free.": "serbest tablo (para kaydı değil — 2.4.5 tablo-para koparması)",
  "source.": "çalışma verisinin hücreleri (para kaydı değil)",
  "dataset.": "çalışma verisi içe aktarımı / oturumları (para kaydı değil; tahsilat taşıması dataset.bonds.moved veri damgasında)",
  "case.document.": "kayıt belgesi",
  "case.lien.": "haciz bilgisi",
  "case.note.": "kayıt notu",
  "case.phone.": "telefon",
  "case.status_note.": "durum notu",
  "maliyet.": "Maliyet Hesabı sekmeleri (para kaydı değil)",
  "dues.": "Tahsilat Takvimi hatırlatmasının elle kapatılması (ayar; para kaydı değil)",
});

const files = [];
const walk = dir => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".mjs")) files.push(full);
  }
};
walk(path.join(ROOT, "server"));

/** Kaynaktaki iz türleri: audit*(…, "tür" | `tür.${…}` | koşul ? "a" : "b"), { audit: { type: "tür" } }, *_TRACE = "tür", INSERT INTO audit_events … VALUES (?, 'tür', …). */
function auditTypes() {
  const out = new Map();
  const add = (type, file, lineNo) => {
    if (!type) return;
    if (!out.has(type)) out.set(type, []);
    out.get(type).push(`${path.relative(ROOT, file)}:${lineNo}`);
  };
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((text, index) => {
      const n = index + 1;
      for (const m of text.matchAll(/\baudit[A-Za-z]*\(\s*[^,()]*?,\s*(["'`])([a-z][\w.$-]*?)(\$\{|\1)/g)) add(m[3] === "${" ? `${m[2]}*` : m[2], file, n);
      for (const m of text.matchAll(/\baudit[A-Za-z]*\(\s*[^,()]*?,\s*[^,]*?\?\s*(["'])([a-z][\w.-]*)\1\s*:\s*(["'])([a-z][\w.-]*)\3/g)) {
        add(m[2], file, n);
        add(m[4], file, n);
      }
      for (const m of text.matchAll(/\baudit:\s*\{\s*type:\s*(["'`])([a-z][\w.$-]*?)(\$\{|\1)/g)) add(m[3] === "${" ? `${m[2]}*` : m[2], file, n);
      for (const m of text.matchAll(/_TRACE\s*=\s*(["'])([a-z][\w.-]*)\1/g)) add(m[2], file, n);
      for (const m of text.matchAll(/INSERT INTO audit_events[^;]*?VALUES \(\?, '([a-z][\w.-]*)'/g)) add(m[1], file, n);
    });
  }
  return out;
}
// LIKE (yalnız % ve tam ad) — plan-reader'ın SQL'iyle aynı anlam; "x*" (şablonun durağan öneki) için önek eşleşmesi.
const like = (pattern, type) => {
  const prefix = type.endsWith("*") ? type.slice(0, -1) : null;
  if (pattern.startsWith("%")) return (prefix ?? type).endsWith(pattern.slice(1)) && !prefix;
  if (pattern.endsWith("%")) return (prefix ?? type).startsWith(pattern.slice(0, -1)) || (prefix !== null && pattern.slice(0, -1).startsWith(prefix));
  return !prefix && pattern === type;
};
const isExcluded = type => reader.NON_DATA_AUDIT_TYPES.some(pattern => like(pattern, type));
const isData = type => reader.DATA_AUDIT_TYPES.some(pattern => like(pattern, type)) && !isExcluded(type);
const isOutside = type => isExcluded(type) || Object.keys(VERI_DISI).some(key => (key.endsWith(".") ? (type.endsWith("*") ? type.slice(0, -1) : type).startsWith(key) : type === key));

describe("D3 tur 5 — veri damgasının iz türü listesi (kaynak taraması)", () => {
  it("tarama boş değil (ders 4): bilinen iz türleri bulunur (fatura, cari hareketi, kilit, defter dondurması, banka)", () => {
    const types = auditTypes();
    for (const type of ["invoice.offset", "account.entry.*", "ledger.period.locked", "ledger.period.unlocked", "ledger.snapshot.frozen", "bank.pos.created", "plan.entry.updated", "case.payment.updated", "auth.login"]) assert.ok(types.has(type), `${type} taramada yok`);
    assert.ok(types.size > 150, `iz türü sayısı ${types.size}`);
  });

  it("her iz türü sınıflandırılmış: ya veri damgasında ya gerekçeli VERİ DIŞI listede (yeni para yazıcısı listeye girmeden eklenemez)", () => {
    const missing = [...auditTypes()].filter(([type]) => !isData(type) && !isOutside(type)).map(([type, at]) => `${type} (${at[0]})`);
    assert.deepEqual(missing, [], "sınıflandırılmamış iz türü: veri damgasına girecekse plan-reader.mjs DATA_AUDIT_TYPES'a, girmeyecekse bu testin VERİ DIŞI listesine gerekçesiyle ekleyin");
  });

  it("çakışma yok: veri damgasındaki bir tür VERİ DIŞI listede değil; dışlananlar (görüntüleme / dışa aktarma) veri ad alanında ve gerçekten var", () => {
    const types = auditTypes();
    // Tek istisna biçimi: VERİ DIŞI önekin içindeki para yazıcısı plan-reader'da TAM adıyla veri damgasına alınmıştır (ör. dataset.bonds.moved — kayıt eşleştirmesi tahsilatı taşır).
    const both = [...types.keys()].filter(type => isData(type) && isOutside(type) && !reader.DATA_AUDIT_TYPES.includes(type));
    assert.deepEqual(both, []);
    for (const pattern of reader.NON_DATA_AUDIT_TYPES) {
      const hits = [...types.keys()].filter(type => like(pattern, type));
      assert.ok(hits.length > 0, `dışlanan ${pattern} kaynakta yok (eskimiş giriş)`);
      assert.ok(hits.some(type => reader.DATA_AUDIT_TYPES.some(data => like(data, type))), `dışlanan ${pattern} hiçbir veri ad alanında değil (gereksiz giriş)`);
    }
    // Para tablosuna yazan bilinen yollar veri damgasında (mutasyon: listeden biri düşerse burası kırılır).
    for (const type of ["invoice.offset", "invoice.edited", "account.entry.updated", "account.entry.*", "plan.entry.updated", "cheque.updated", "cash.entry.created", "stock.move.updated", "doubtful.take", "tax.vat-offset.created", "ledger.period.locked", "case.payment.updated", "dataset.bonds.moved", "bank.voucher.corrected"]) assert.ok(isData(type), `${type} veri damgasına girmeli`);
  });

  it("v-5: devirde budanan / kalan (B / A) her tablo ya damganın saydığı tablolarda ya yazımı iz türüyle / gerekçeyle karşılanmış", () => {
    const counted = new Set(reader.DEVIR_DAMGA_TABLES);
    const covered = {
      plan_imports: "içe aktarma — plan.imported / plan.table-import / plan.import-undone izi (plan.%)",
      ledger_voucher_lines: "fiş satırı fişle birlikte yazılır (ledger_vouchers sayılır; fiş değişmez, ters kayıt yeni fiştir)",
      ledger_snapshots: "dondurma TÜREVİ (kilit değişince; kilit damgada) — veri değişimi değil",
      ledger_snapshot_runs: "dondurma TÜREVİ — veri değişimi değil",
      ledger_valuation_cards: "dondurma TÜREVİ — veri değişimi değil",
      pos_sales: "POS satışı kalemleriyle (pos_items sayılır) + bank.pos.* izi",
      bank_plans: "banka planı — bank.plan.* izi",
      trash: "silme — kaynak tablonun satırı ve silme izi (… .deleted)",
      cheque_collections: "bankaya tahsile verme — çek / senet olayı (cheque_events sayılır) ve cheque.* / bank.* izi",
    };
    const classes = reader.DEVIR_TABLE_CLASSES;
    const uncovered = Object.entries(classes).filter(([, spec]) => spec.sinif === "B" || spec.sinif === "A").map(([table]) => table).filter(table => !counted.has(table) && !covered[table]);
    assert.deepEqual(uncovered, [], "B / A tablosu damgada sayılmıyor ve gerekçesi yok");
    for (const table of Object.keys(covered)) assert.ok(classes[table] && !counted.has(table), `${table}: gerekçe listesi eskimiş`);
  });

  it("ders 27: tarama CRLF'li kaynakta da aynı türleri bulur", () => {
    const sample = 'x();\r\n    audit(user, "invoice.offset", row.id, {});\r\n    audit(user, `account.entry.${kind}`, id);\r\n';
    const found = [];
    for (const text of sample.split(/\r?\n/)) for (const m of text.matchAll(/\baudit[A-Za-z]*\(\s*[^,()]*?,\s*(["'`])([a-z][\w.$-]*?)(\$\{|\1)/g)) found.push(m[3] === "${" ? `${m[2]}*` : m[2]);
    assert.deepEqual(found, ["invoice.offset", "account.entry.*"]);
  });
});
