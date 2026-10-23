// Kayda bağlı veriler (2.4.4 31e B1–B3): kayıt tahsilatı, not, düzeltme, "Ödendi say", cari ve taksit kartı bağı… kaydın anahtarına (case_key)
// bağlıdır. Excel/Sheets yeniden yüklenince ya da eşitlenince bir kaydın anahtarı değişebilir: Dosya No'suz satırın anahtarı bütün hücrelerinin
// parmak izidir (bir hücre değişince, kolon eklenince değişir); kimlik kolonu eklenince/silinince anahtarın biçimi değişir. 2.4.3'e kadar bağlar
// eski anahtarda kalıyor, yeni satıra bağlanmıyordu (ödemiş kişi Takvim'de tam tutarla gecikmiş, not ve düzeltme görünmez) — sessizce.
//
// Kural (baş mimar kararı, 23.10.2026):
// 1. Hiçbir yükleme/eşitleme bağı SESSİZCE koparmaz.
// 2. Güvenli eşleşmede bağ yeni anahtara taşınır. Güvenli eşleşme: eski ve yeni satır aynı KİŞİ DEĞERİNİ taşır (ad; ikisinde de varsa telefon ve
//    geçerli TCKN/VKN de aynı) VE o kişi değeri eski tablonun o sekmesinde de yeni tablonunkinde de TEK satırdır — ya da aynı row_id'de aynı kişi
//    değeri (ve kişi değerinin sekmedeki sayısı iki tabloda aynı: bir satır silinip sonrakiler kaydıysa aynı row_id başka satırdır). Körlemesine
//    row_id'ye göre taşıma yok. Taşıma, satırların yazıldığı işlemde (yedekten sonra) yapılır ve işlem geçmişine yazılır.
// 3. Eşleşmeyen bağ: önizlemede adlarıyla söylenir, açık onay ister; eşitleme bekler.
// 4. Devamı olarak ekle: aynı konumdaki FARKLI kişi mevcut satırın yerine geçmez (yeni kayıt); mevcut kayıtla aynı kişi + aynı tutar/tarih görünen
//    yeni satır önizlemede söylenir ve onay ister (kendiliğinden birleştirme yok).
// 5. Eşleşmeyen bağlı veri silinmez; eski anahtarda kalır.
import { isTotalLabel } from "./insight/cells.mjs";
import { analyzeColumns, primaryColumns } from "./insight/columns.mjs";
import { foldText, isTckn, isVkn } from "./insight/validators.mjs";
import { columnOrder } from "./sources.mjs";

const isPositional = id => String(id).startsWith("p|");
const CHUNK = 400;
const chunks = list => {
  const out = [];
  for (let index = 0; index < list.length; index += CHUNK) out.push(list.slice(index, index + CHUNK));
  return out;
};

// ---------- Kişi değeri ----------
// Sekmenin kişi kolonu (ad; "Adı" + "Soyadı" ayrıysa ikisi), telefonu, kimlik numarası ve tutar/tarih kolonları — programın kolon analiziyle.
const PERSON_HEADER = /^(ad soyad|adi soyadi|ad soyadi|isim soyisim|isim|ad|adi|unvan|unvani|musteri|musteri adi|borclu|borclu adi|kisi|uye|uye adi|ogrenci|hasta|kiraci|cari|cari adi|firma|firma adi|alici|name|customer)$/;
const IDENTITY_HEADER = /\b(tc|t c|tckn|tc no|tc kimlik|kimlik no|vkn|vergi no|vergi numarasi|vergi kimlik)\b/;
function layoutOf(rows) {
  const sample = rows.slice(0, 2000);
  const columns = columnOrder(sample);
  let analyses = [];
  try {
    analyses = analyzeColumns(sample, columns, { now: new Date() });
  } catch {
    analyses = [];
  }
  const primary = analyses.length ? primaryColumns(analyses) : {};
  const person = primary.personParts ? null : primary.person || columns.find(column => PERSON_HEADER.test(foldText(column))) || null;
  const tax = analyses.filter(item => item.role === "tckn" || item.role === "vkn" || (IDENTITY_HEADER.test(foldText(item.column)) && item.role !== "phone")).map(item => item.column);
  const money = analyses.filter(item => item.role === "money").map(item => item.column);
  const dates = analyses.filter(item => item.role === "date").map(item => item.column);
  return { person, parts: primary.personParts || null, phone: primary.phone || null, tax, money, dates };
}
const digits = value => String(value ?? "").replace(/\D+/g, "");
const clean = value => foldText(value).replace(/\s+/g, " ").trim();
export function signatureOf(values, layout) {
  let name = "";
  if (layout.parts) name = layout.parts.map(column => String(values?.[column] ?? "").trim()).filter(Boolean).join(" ");
  else if (layout.person) name = String(values?.[layout.person] ?? "");
  name = isTotalLabel(name) ? "" : clean(name);
  let tax = "";
  for (const column of layout.tax) {
    const value = digits(values?.[column]);
    if ((value.length === 11 && isTckn(value)) || (value.length === 10 && isVkn(value))) {
      tax = value;
      break;
    }
  }
  const phoneDigits = layout.phone ? digits(values?.[layout.phone]) : "";
  return { name, tax, phone: phoneDigits.length >= 10 ? phoneDigits.slice(-10) : "" };
}
/** İki satır aynı kişi mi: adları (ya da geçerli kimlik numaraları) ikisinde de var ve aynı; ikisinde de bulunan telefon/kimlik çelişmiyor. */
export function samePerson(a, b) {
  if (!a || !b) return false;
  if (!((a.name && b.name) || (a.tax && b.tax))) return false;
  if (a.name && b.name && a.name !== b.name) return false;
  if (a.tax && b.tax && a.tax !== b.tax) return false;
  if (a.phone && b.phone && a.phone !== b.phone) return false;
  return true;
}
const anchorOf = sig => (sig?.name ? `n:${sig.name}` : sig?.tax ? `t:${sig.tax}` : "");
const hasPerson = sig => Boolean(anchorOf(sig));

/** Eski satırlar (dataset_rows) ve gelen satırlar için kişi değerleri; sekme başına kolon analizi yalnız gerektiğinde. */
export function createPeople(storedRows, entries) {
  const tabOfRow = row => String(row.tab ?? row.values?.__sheet ?? "");
  const tabOfEntry = entry => String(entry.tab ?? entry.values?.__sheet ?? "");
  const side = (list, tabOf) => {
    let byTab = null;
    const layouts = new Map();
    const sigs = new Map();
    let counts = null;
    const groups = () => {
      if (!byTab) {
        byTab = new Map();
        for (const item of list) {
          const tab = tabOf(item);
          if (!byTab.has(tab)) byTab.set(tab, []);
          byTab.get(tab).push(item);
        }
      }
      return byTab;
    };
    const layout = tab => {
      if (!layouts.has(tab)) layouts.set(tab, layoutOf((groups().get(tab) || []).map(item => item.values || {})));
      return layouts.get(tab);
    };
    // Önbellek satırın değerleri nesnesine bağlı: resolveIncoming kimliği değişen satırı kopyalar, değerleri aynı nesnedir.
    const sig = item => {
      const values = item.values || {};
      if (!sigs.has(values)) sigs.set(values, signatureOf(values, layout(tabOf(item))));
      return sigs.get(values);
    };
    const count = (tab, anchor) => {
      if (!anchor) return 0;
      if (!counts) counts = new Map();
      if (!counts.has(tab)) {
        const map = new Map();
        for (const item of groups().get(tab) || []) {
          const key = anchorOf(sig(item));
          if (key) map.set(key, (map.get(key) || 0) + 1);
        }
        counts.set(tab, map);
      }
      return counts.get(tab).get(anchor) || 0;
    };
    const only = (tab, anchor) => (groups().get(tab) || []).filter(item => anchorOf(sig(item)) === anchor);
    return { sig, count, only, tabs: () => [...groups().keys()], layout };
  };
  const stored = side(storedRows, tabOfRow);
  const incoming = side(entries, tabOfEntry);
  return { stored, incoming, tabOfRow, tabOfEntry, anchorOf };
}

// ---------- Devamı olarak ekle / eşitleme: gelen satırın hangi mevcut satır olduğu ----------
// Dosya No'suz (konuma bağlı row_id'li) satırlarda konum tek başına kimlik değildir: dosyanın başına satır eklenince bütün satırlar kayar.
// Sıra: (1) aynı row_id + aynı anahtar → aynı satır; (2) aynı sekmede aynı anahtarlı (içerik özdeş) mevcut satır → o satır; (3) aynı row_id'deki
// mevcut satır aynı kişi değerini taşıyor (ve o kişinin sekmedeki sayısı iki tabloda aynı) ya da iki satırda da kişi değeri yok → o satır güncellenir;
// (4) değilse yeni kayıt (mevcut satır ve bağları durur). Dönüş: kimliği gerekirse değişmiş yeni dizi + "farklı kişi" yüzünden yeni sayılan satır sayısı.
export function resolveIncoming(entries, storedRows, people, { byPerson = false } = {}) {
  const byId = new Map(storedRows.map(row => [row.rowId, row]));
  const byKey = new Map();
  for (const row of storedRows) {
    if (!isPositional(row.rowId)) continue;
    const key = `${people.tabOfRow(row)}\u0000${row.caseKey}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(row);
  }
  const claimed = new Set();
  const out = entries.slice();
  const pending = [];
  out.forEach((entry, index) => {
    if (!isPositional(entry.id)) {
      if (byId.has(entry.id)) claimed.add(entry.id);
      return;
    }
    const row = byId.get(entry.id);
    if (row && row.caseKey === entry.caseKey) claimed.add(row.rowId);
    else pending.push(index);
  });
  const later = [];
  for (const index of pending) {
    const entry = out[index];
    const twin = (byKey.get(`${people.tabOfEntry(entry)}\u0000${entry.caseKey}`) || []).find(row => !claimed.has(row.rowId));
    if (twin) {
      claimed.add(twin.rowId);
      if (twin.rowId !== entry.id) out[index] = { ...entry, id: twin.rowId };
    } else later.push(index);
  }
  let differentPerson = 0;
  const fresh = [];
  for (const index of later) {
    const entry = out[index];
    const row = byId.get(entry.id);
    if (!row || claimed.has(row.rowId) || !isPositional(row.rowId)) {
      if (row && claimed.has(row.rowId)) fresh.push(index);
      continue;
    }
    const a = people.stored.sig(row);
    const b = people.incoming.sig(entry);
    const tab = people.tabOfEntry(entry);
    const anchor = anchorOf(a);
    const keep = (!hasPerson(a) && !hasPerson(b)) || (samePerson(a, b) && people.stored.count(people.tabOfRow(row), anchor) === people.incoming.count(tab, anchor));
    if (keep) claimed.add(row.rowId);
    else {
      if (hasPerson(a) || hasPerson(b)) differentPerson += 1;
      fresh.push(index);
    }
  }
  // (5) Eşitleme (byPerson): Sheet tek doğrudur; kişi o sekmede iki tabloda da TEK satırsa (dosyada satırlar kaymış ve değişmiş) gelen satır o mevcut
  // satırın güncellemesidir. Devamı olarak eklemede yapılmaz (kendiliğinden birleştirme yok; findDuplicates "person" onay ister).
  if (byPerson && fresh.length) {
    const left = [];
    for (const index of fresh) {
      const entry = out[index];
      const sig = people.incoming.sig(entry);
      const anchor = anchorOf(sig);
      const tab = people.tabOfEntry(entry);
      const row = anchor && people.incoming.count(tab, anchor) === 1 && people.stored.count(tab, anchor) === 1 ? people.stored.only(tab, anchor)[0] : null;
      if (row && isPositional(row.rowId) && !claimed.has(row.rowId) && samePerson(people.stored.sig(row), sig)) {
        claimed.add(row.rowId);
        out[index] = { ...entry, id: row.rowId };
      } else left.push(index);
    }
    fresh.length = 0;
    fresh.push(...left);
  }
  if (fresh.length) {
    // Yeni kimlik: aynı sekmenin konum kimliklerinde kullanılmayan ilk sıra (mevcut satırlar ve gelenler).
    const taken = new Set([...storedRows.map(row => row.rowId), ...out.map(entry => entry.id)]);
    const next = new Map();
    for (const index of fresh) {
      const entry = out[index];
      const base = entry.id.slice(0, entry.id.lastIndexOf("#"));
      let n = next.get(base) ?? 0;
      while (taken.has(`${base}#${n}`)) n += 1;
      const id = `${base}#${n}`;
      taken.add(id);
      next.set(base, n + 1);
      out[index] = { ...entry, id };
    }
  }
  return { entries: out, differentPerson };
}

// ---------- Kaybolan anahtarlar ve güvenli eşleşme ----------
/**
 * mode "replace": gelenler tablonun yerini alır; "merge" / "sync": gelmeyen mevcut satırlar kalır (entries resolveIncoming'den geçmiş olmalı).
 * bonded(keys) → Map(anahtar → { tür: adet }) (yalnız bağı olanlar); elsewhere(keys) → Set (başka veri sayfasında da bulunan anahtarlar).
 * Dönüş: { moves: [{ from, to, name, tab, bonds }], unmatched: [{ key, name, tab, bonds }], lost }.
 */
export function planRebind({ storedRows, entries, mode, people, bonded, elsewhere = () => new Set() }) {
  const incomingIds = new Set(entries.map(entry => entry.id));
  const finalKeys = new Set(entries.map(entry => entry.caseKey));
  if (mode !== "replace") for (const row of storedRows) if (!incomingIds.has(row.rowId)) finalKeys.add(row.caseKey);
  const oldKeys = new Set(storedRows.map(row => row.caseKey));
  const lost = [...oldKeys].filter(key => !finalKeys.has(key));
  if (!lost.length) return { moves: [], unmatched: [], lost: 0 };
  const bonds = bonded(lost);
  const losing = lost.filter(key => bonds.has(key));
  if (!losing.length) return { moves: [], unmatched: [], lost: lost.length };
  const rowsOfKey = new Map();
  for (const row of storedRows) {
    if (!rowsOfKey.has(row.caseKey)) rowsOfKey.set(row.caseKey, []);
    rowsOfKey.get(row.caseKey).push(row);
  }
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const fresh = entry => !oldKeys.has(entry.caseKey);
  // Yeniden adlandırılmış tek sekme: eski tabloda olup yenide olmayan TEK sekme ile yenide olup eskide olmayan TEK sekme aynı sekmedir.
  const oldTabs = new Set(people.stored.tabs());
  const newTabs = new Set(people.incoming.tabs());
  const goneTabs = [...oldTabs].filter(tab => !newTabs.has(tab));
  const bornTabs = [...newTabs].filter(tab => !oldTabs.has(tab));
  const tabFor = tab => (newTabs.has(tab) ? tab : goneTabs.length === 1 && bornTabs.length === 1 && goneTabs[0] === tab ? bornTabs[0] : null);
  const candidate = new Map();
  for (const key of losing) {
    const rows = rowsOfKey.get(key) || [];
    if (rows.length !== 1) continue; // bir anahtar birden çok satırda (dosya no + kefiller): hangi satıra gideceği belli değil
    const row = rows[0];
    const sig = people.stored.sig(row);
    const anchor = anchorOf(sig);
    if (!anchor) continue;
    const oldTab = people.tabOfRow(row);
    // (a) aynı row_id'de aynı kişi (ve kişinin sekmedeki sayısı iki tabloda aynı)
    const same = byId.get(row.rowId);
    if (same && same.caseKey !== key && fresh(same) && samePerson(sig, people.incoming.sig(same)) && people.stored.count(oldTab, anchor) === people.incoming.count(people.tabOfEntry(same), anchor)) {
      candidate.set(key, same);
      continue;
    }
    // (b) kişi değeri eski ve yeni sekmede TEK satır
    const tab = tabFor(oldTab);
    if (tab === null || people.stored.count(oldTab, anchor) !== 1 || people.incoming.count(tab, anchor) !== 1) continue;
    const [match] = people.incoming.only(tab, anchor);
    if (match && fresh(match) && samePerson(sig, people.incoming.sig(match))) candidate.set(key, match);
  }
  // Tek hedef: iki eski anahtar aynı yeni anahtara gidemez; başka veri sayfasında da bulunan anahtar (genel tablolardaki bağ o sayfanın da olabilir) taşınmaz.
  const targets = new Map();
  for (const [key, entry] of candidate) targets.set(entry.caseKey, (targets.get(entry.caseKey) || 0) + 1);
  const shared = elsewhere([...new Set([...candidate.keys(), ...[...candidate.values()].map(entry => entry.caseKey)])]);
  const moves = [];
  const unmatched = [];
  const nameOf = row => {
    const values = row.values || {};
    const layout = people.stored.layout(people.tabOfRow(row));
    const raw = layout.parts ? layout.parts.map(column => String(values[column] ?? "").trim()).filter(Boolean).join(" ") : layout.person ? String(values[layout.person] ?? "").trim() : "";
    return raw || firstText(values);
  };
  for (const key of losing) {
    const row = (rowsOfKey.get(key) || [])[0];
    const entry = candidate.get(key);
    const base = { name: row ? nameOf(row) : key, tab: row ? people.tabOfRow(row) : "", bonds: bonds.get(key) };
    if (entry && targets.get(entry.caseKey) === 1 && !shared.has(key) && !shared.has(entry.caseKey)) moves.push({ from: key, to: entry.caseKey, ...base });
    else unmatched.push({ key, ...base });
  }
  return { moves, unmatched, lost: lost.length };
}
const firstText = values => {
  for (const [key, value] of Object.entries(values || {})) {
    if (key.startsWith("__")) continue;
    const text = String(value ?? "").trim();
    if (text) return text.slice(0, 60);
  }
  return "";
};

// ---------- Devamı olarak ekle: mevcut kayıtla aynı görünen yeni satırlar (B3) ----------
// Yeni (mevcut satıra eşlenmemiş) satır iki türlü söylenir, ikisi de onay ister (kendiliğinden birleştirme yok):
// "same"   — aynı sekmedeki bir mevcut satırla aynı kişi değeri VE iki tabloda da bulunan tutar/tarih kolonlarında aynı değerler (en az biri karşılaştırılmış
//            olmalı; tutar/tarih kolonu yoksa ortak bütün kolonlar): aynı kayıt ikinci kez ekleniyor (ör. Dosya No eklenmiş aynı dosya).
// "person" — tutar/tarih farklı ama kişi o sekmede iki tabloda da TEK satır ve mevcut satırı bu yüklemede güncellenmiyor: büyük olasılıkla aynı kaydın
//            yenisi (dosyada satırlar kaymış); Devamı olarak ekle onu ayrı kayıt yapar, güncellemek için Yerine Koy.
export function findDuplicates({ storedRows, entries, people }) {
  const storedIds = new Set(storedRows.map(row => row.rowId));
  const touched = new Set(entries.map(entry => entry.id).filter(id => storedIds.has(id)));
  const added = entries.filter(entry => !storedIds.has(entry.id));
  if (!added.length || !storedRows.length) return [];
  const byAnchor = new Map();
  for (const row of storedRows) {
    const anchor = anchorOf(people.stored.sig(row));
    if (!anchor) continue;
    const key = `${people.tabOfRow(row)}\u0000${anchor}`;
    if (!byAnchor.has(key)) byAnchor.set(key, []);
    byAnchor.get(key).push(row);
  }
  const same = (a, b) => String(a ?? "").trim().replace(/\s+/g, " ") === String(b ?? "").trim().replace(/\s+/g, " ");
  const out = [];
  for (const entry of added) {
    const sig = people.incoming.sig(entry);
    const anchor = anchorOf(sig);
    const tab = people.tabOfEntry(entry);
    const rows = (byAnchor.get(`${tab}\u0000${anchor}`) || []).filter(row => samePerson(people.stored.sig(row), sig));
    if (!rows.length) continue;
    const layout = people.incoming.layout(tab);
    const identical = rows.some(row => {
      const shared = column => Object.hasOwn(row.values || {}, column) && Object.hasOwn(entry.values || {}, column);
      let columns = [...layout.money, ...layout.dates].filter(shared);
      if (!columns.length) columns = Object.keys(entry.values || {}).filter(column => !column.startsWith("__") && shared(column));
      return columns.length > 0 && columns.every(column => same(row.values[column], entry.values[column]));
    });
    const name = personName(entry.values, layout) || firstText(entry.values);
    if (identical) out.push({ kind: "same", name, tab });
    else if (rows.length === 1 && !touched.has(rows[0].rowId) && people.stored.count(tab, anchor) === 1 && people.incoming.count(tab, anchor) === 1) out.push({ kind: "person", name, tab });
  }
  return out;
}
const personName = (values, layout) => (layout.parts ? layout.parts.map(column => String(values?.[column] ?? "").trim()).filter(Boolean).join(" ") : layout.person ? String(values?.[layout.person] ?? "").trim() : "");

// ---------- Bağlı tablolar ----------
// kind: uyarıda sayılan tür (null: taşınır ama sayılmaz — sohbet bağlantısı, eski mesaj). scope: anahtarın veri sayfasına bağlandığı kolon (yoksa
// anahtar şirket genelidir). live: sayılan satırın koşulu (silinmişler taşınır, sayılmaz). guard: hedefte aynısı varsa taşınmaz (üzerine yazılmaz).
export const BOND_TABLES = Object.freeze([
  { table: "payments", kind: "payment", money: true },
  { table: "notes", kind: "note" },
  { table: "case_notes", kind: "note", unique: true },
  { table: "phones", kind: "phone" },
  { table: "liens", kind: "lien" },
  { table: "tasks", kind: "task" },
  { table: "case_documents", kind: "document", live: "deleted_at IS NULL" },
  { table: "overrides", kind: "override", scope: "source_name", unique: true },
  { table: "deleted_records", kind: "deleted", scope: "source_name", unique: true },
  { table: "accounts", kind: "account", scope: "case_source", live: "deleted_at IS NULL", guard: "deleted_at IS NULL", stamp: true },
  { table: "plans", kind: "plan", scope: "case_source", live: "deleted_at IS NULL", stamp: true },
  { table: "messages", kind: null },
  { table: "chat_messages", kind: null },
]);
// Uyarı metnindeki adlar (iyelik ekiyle: "N kaydın tahsilatı / notu …").
export const BOND_LABELS = Object.freeze({
  payment: "tahsilatı",
  note: "notu",
  phone: "telefonu",
  lien: "haczi",
  task: "görevi",
  document: "belgesi",
  override: "düzeltmesi",
  deleted: "silme işareti",
  account: "cari bağı",
  plan: "taksit kartı bağı",
  settled: "“Ödendi Say” işareti",
  unflagged: "“Sorun Yok” işareti",
});
const KIND_ORDER = Object.keys(BOND_LABELS);
/** Uyarı özeti: kayıt sayısı, türler (sırayla), adlar (en çok 12). */
export function summarizeBonds(list, limit = 12) {
  const kinds = new Set();
  for (const item of list) for (const kind of Object.keys(item.bonds || {})) kinds.add(kind);
  const names = [];
  for (const item of list) if (item.name && !names.includes(item.name) && names.length < limit) names.push(item.name);
  return { count: list.length, kinds: KIND_ORDER.filter(kind => kinds.has(kind)), labels: KIND_ORDER.filter(kind => kinds.has(kind)).map(kind => BOND_LABELS[kind]), names, more: Math.max(0, new Set(list.map(item => item.name)).size - names.length) };
}
/** "3 kaydın tahsilatı / notu / cari bağı bu yüklemeyle eşleşmedi: Ali Veli, Can Er" */
export function unmatchedSentence(summary, { sync = false } = {}) {
  if (!summary?.count) return "";
  const names = `${summary.names.join(", ")}${summary.more ? ` ve ${summary.more} kayıt daha` : ""}`;
  return `${summary.count} kaydın ${summary.labels.join(" / ")} ${sync ? "bu eşitlemeyle" : "bu yüklemeyle"} eşleşmedi: ${names}.`;
}

/**
 * Bağların okunup taşındığı yer. store: şirketin veritabanı; datasetKey: veri sayfası; setting(name): sayfanın ayar adı (dues.settled vb.);
 * bank: merkezi para yazımı (kayıt tahsilatının anahtarı bank.post'un "assign" bağlamında değişir; K6).
 */
export function createBondStore({ store, datasetKey, setting, bank = null }) {
  const scopeArgs = spec => (spec.scope ? [datasetKey] : []);
  const scopeSql = spec => (spec.scope ? ` AND ${spec.scope} = ?` : "");
  const indexed = new Set(["payments", "notes", "case_notes", "phones", "liens", "case_documents", "overrides", "deleted_records", "accounts", "plans"]);
  const json = key => {
    try {
      const value = JSON.parse(store.setting(key, "") || "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  };
  const settledKeyOf = id => (String(id).startsWith("due|") ? String(id).split("|")[2] || "" : "");
  /** Map(anahtar → { tür: adet }) — yalnız bağı olan anahtarlar. */
  function counts(keys) {
    const wanted = new Set(keys);
    const out = new Map();
    const add = (key, kind, n) => {
      if (!kind || !n || !wanted.has(key)) return;
      if (!out.has(key)) out.set(key, {});
      const item = out.get(key);
      item[kind] = (item[kind] || 0) + n;
    };
    for (const spec of BOND_TABLES) {
      if (!spec.kind) continue;
      const live = spec.live ? ` AND ${spec.live}` : "";
      if (indexed.has(spec.table) && wanted.size <= 20_000) {
        for (const part of chunks([...wanted])) {
          const marks = part.map(() => "?").join(", ");
          for (const row of store.all(`SELECT case_key AS k, COUNT(*) AS n FROM ${spec.table} WHERE case_key IN (${marks})${scopeSql(spec)}${live} GROUP BY case_key`, ...part, ...scopeArgs(spec))) add(row.k, spec.kind, row.n);
        }
      } else {
        for (const row of store.all(`SELECT case_key AS k, COUNT(*) AS n FROM ${spec.table} WHERE case_key IS NOT NULL AND case_key <> ''${scopeSql(spec)}${live} GROUP BY case_key`, ...scopeArgs(spec))) add(row.k, spec.kind, row.n);
      }
    }
    for (const id of Object.keys(json(setting("dues.settled")))) add(settledKeyOf(id), "settled", 1);
    for (const key of Object.keys(json(setting("dataset.unflagged")))) add(key, "unflagged", 1);
    return out;
  }
  /** Bağları taşır (çağıran işlemin içinde). Dönüş: { tablo: taşınan satır } + yerinde kalan (hedefte aynısı olduğu için) satırlar. */
  function move(moves, { user = null, at = new Date().toISOString() } = {}) {
    const moved = {};
    const kept = {};
    if (!moves.length) return { moved, kept };
    const note = (table, n) => n && (moved[table] = (moved[table] || 0) + n);
    for (const spec of BOND_TABLES) {
      const run = () => {
        for (const { from, to } of moves) {
          let sql;
          let args;
          if (spec.unique) {
            sql = `UPDATE OR IGNORE ${spec.table} SET case_key = ? WHERE case_key = ?${scopeSql(spec)}`;
            args = [to, from, ...scopeArgs(spec)];
          } else if (spec.guard) {
            sql = `UPDATE ${spec.table} SET case_key = ?${spec.stamp ? ", updated_at = ?" : ""} WHERE case_key = ?${scopeSql(spec)} AND NOT EXISTS (SELECT 1 FROM ${spec.table} other WHERE other.case_key = ?${spec.scope ? ` AND other.${spec.scope} = ?` : ""} AND other.${spec.guard})`;
            args = [to, ...(spec.stamp ? [at] : []), from, ...scopeArgs(spec), to, ...scopeArgs(spec)];
          } else {
            sql = `UPDATE ${spec.table} SET case_key = ?${spec.stamp ? ", updated_at = ?" : ""} WHERE case_key = ?${scopeSql(spec)}`;
            args = [to, ...(spec.stamp ? [at] : []), from, ...scopeArgs(spec)];
          }
          note(spec.table, store.run(sql, ...args).changes);
          const left = store.get(`SELECT COUNT(*) AS n FROM ${spec.table} WHERE case_key = ?${scopeSql(spec)}`, from, ...scopeArgs(spec))?.n || 0;
          if (left) kept[spec.table] = (kept[spec.table] || 0) + left;
        }
      };
      // Kayıt tahsilatı para tablosudur: anahtarı yalnız bank.post bağlamında değişir (K6); olayın kopyası (tutar, yol, hesap, tarih) değişmez.
      if (spec.money && bank) bank.post({ user: user || { id: "system", display_name: "Otomatik eşitleme", role: "admin" }, module: "payment", op: "assign", prev: moves.map(({ from, to }) => ({ from, to })), write: run });
      else run();
    }
    // Ayarlardaki işaretler: "Ödendi say" (dues.settled: due|sekme|anahtar|kolon|gün), "Sorun yok" (dataset.unflagged), zilden kaldırılanlar (kişi başına).
    const map = new Map(moves.map(({ from, to }) => [from, to]));
    const rekeyDue = id => {
      if (!String(id).startsWith("due|")) return null;
      const parts = String(id).split("|");
      const to = map.get(parts[2]);
      if (!to) return null;
      parts[2] = to;
      return parts.join("|");
    };
    const rewrite = (key, rename) => {
      const value = json(key);
      let changed = 0;
      const next = {};
      for (const [id, item] of Object.entries(value)) {
        const renamed = rename(id);
        if (renamed && !(renamed in value) && !(renamed in next)) {
          next[renamed] = item;
          changed += 1;
        } else next[id] = item;
      }
      if (changed) store.setSetting(key, JSON.stringify(next), user?.id ?? null);
      return changed;
    };
    const settled = rewrite(setting("dues.settled"), rekeyDue);
    if (settled) moved.settled = settled;
    const unflagged = rewrite(setting("dataset.unflagged"), id => map.get(id) || null);
    if (unflagged) moved.unflagged = unflagged;
    for (const { key } of store.all("SELECT key FROM settings WHERE key LIKE 'alerts.dismissed.%'")) rewrite(key, rekeyDue);
    return { moved, kept };
  }
  return { counts, move };
}
