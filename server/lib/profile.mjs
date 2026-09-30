// Ofis profili (v1.6.0): seçili sektör ve onun kelime dağarcığı, rol adları, modüller, yöneticinin kalemle değiştirdiği
// başlıklar ve verinin önbellekli analizi.
//
// Öncelik: yöneticinin elle verdiği başlık > sektörün başlığı > arayüzün varsayılanı.
// Sektör yalnızca yönetici onayıyla değişir. Analizin önerisi hiçbir zaman kendiliğinden uygulanmaz.
// 1.6.0 öncesinden gelen kurulum (verisi olan) "Hukuk bürosu" profiliyle açılır: arayüzü güncellemeden önceki gibi kalır;
// yöneticiye bir kez analiz sonucu gösterilir.
import { FORCED_ROLES } from "./insight/columns.mjs";
import { DATASET_KEY } from "./dataset.mjs";
import { HttpError, parseJson } from "./http.mjs";
import { ROLE_LABELS } from "./permissions.mjs";
import { analyzeDataset } from "./insight/analyze.mjs";
import { listRecords, RECORD_LISTS } from "./insight/kpi.mjs";
import { recordTitle } from "./insight/quality.mjs";
import { ruleTitle } from "./insight/reasoning.mjs";
import { isEmptyCell } from "./insight/cells.mjs";
import { isFullDate } from "./insight/validators.mjs";
import { formatValue, parseNumberText } from "./formula/values.mjs";
import { GENERAL_ID, LEGACY_ID, sectorById } from "./insight/sectors.mjs";
import { createCustomSectors } from "./custom-sectors.mjs";

// Kalemle düzenlenebilen başlıklar: anahtar → en fazla uzunluk ve yönetici ekranındaki adı.
export const LABEL_SLOTS = Object.freeze({
  "brand.subtitle": { max: 60, name: "Kenar Çubuğu Alt Başlığı" },
  // v2.0.2: "nav.workspace" ve "nav.source" menü başlıkları kaldırıldı; kayıtlı eski değerler yok sayılır.
  "side.title": { max: 40, name: "Operasyon Merkezi Başlığı" },
  // Operasyon merkezi düğmeleri (v2.0.1): kartın köşesindeki kalemle hepsi birlikte değiştirilir.
  "side.tasks": { max: 32, name: "Operasyon Merkezi: Görevler" },
  "side.messages": { max: 32, name: "Operasyon Merkezi: Mesajlar" },
  "side.newTask": { max: 32, name: "Operasyon Merkezi: Görev Ata" },
  "side.newRecord": { max: 32, name: "Operasyon Merkezi: Yeni Kayıt" },
  "side.cash": { max: 32, name: "Operasyon Merkezi: Kasa" },
  "side.plans": { max: 32, name: "Operasyon Merkezi: Taksitler" },
  "side.accounts": { max: 32, name: "Operasyon Merkezi: Cari" },
  "side.stock": { max: 32, name: "Operasyon Merkezi: Stok" },
  "side.cheques": { max: 32, name: "Operasyon Merkezi: Çek / Senet" },
  "side.liens": { max: 32, name: "Operasyon Merkezi: Haciz Uyarıları" },
  "side.reports": { max: 32, name: "Operasyon Merkezi: Personel Raporu" },
  "side.guide": { max: 32, name: "Operasyon Merkezi: Kullanım Kılavuzu" },
  "page.title": { max: 80, name: "Sayfa Başlığı" },
  "summary.title": { max: 60, name: "Özet Başlığı" },
  "summary.subtitle": { max: 200, name: "Özet Açıklaması" },
  "categories.title": { max: 60, name: "Sekmeler Başlığı" },
  "table.title": { max: 80, name: "Tablo Başlığı" },
  "table.subtitle": { max: 160, name: "Tablo Açıklaması" },
});

const K = { sector: "insight.sector", labels: "ui.labels", intro: "insight.intro", initialized: "insight.initialized", columns: "ui.columns", columnsFixed: "ui.columns.fixed", dismissed: "insight.dismissed", roles: "insight.roles", qualityIgnored: "insight.quality.ignored" };
const MAX_DISMISSED = 5000;
const REASONING_LIST = 50;
// Metindeki kolon adlarını ofisin verdiği adlarla değiştirir (yalnızca kelime sınırında; "No" "Notlar"ı bozmaz).
const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function aliasText(text, fields, aliases) {
  let out = String(text || "");
  for (const field of [...new Set(fields)].filter(field => field && aliases[field]).sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(field)}(?![\\p{L}\\p{N}])`, "gu"), aliases[field]);
  }
  return out;
}
// Kolon başlıklarının görünen adları (v2.0.1): Excel/Sheets'teki kolon adı → ofisin verdiği ad. Veri anahtarı değişmez
// (Sheet eşitlemesi, formüller, düzeltmeler ve notlar kolonun asıl adına bağlı kalır); her veri oturumunda ayrıdır.
const COLUMN_ALIAS_MAX = 60;
const MAX_COLUMN_ALIASES = 400;
// Verinin kendisine ait başlıklar (sayfa, özet, tablo) her veri oturumunda ayrıdır (v2.0.1); diğerleri ofis genelidir.
const DATA_LABELS = new Set(["page.title", "summary.title", "summary.subtitle", "categories.title", "table.title", "table.subtitle"]);
const VALUE_CARDS = new Set(["status", "category", "responsible"]);
const SOURCES = new Set(["confirmed", "manual"]);

const cleanLabel = (value, max) =>
  String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export function createProfileService({ store, dataset, audit, events, log, free = null, clock = () => new Date(), runner = null }) {
  const caches = new Map(); // oturum → { fingerprint, analysis }
  const running = new Map(); // oturum → { fingerprint, promise }
  let generation = 0; // her geçersizleştirmede artar
  // Analiz ayrı iş parçacığında koşar (worker.mjs); verilmediyse ana iş parçacığında (testler, küçük veriler).
  const analysisRunner = runner || { run: payload => Promise.resolve(analyzeDataset(payload)), close: async () => {}, stats: () => ({ inlineOnly: true }) };

  const iso = () => clock().toISOString();
  // Oturuma ait ayar adı (ilk oturumda eski ad; diğerlerinde "@<kimlik>" ekli).
  const sessionKey = name => (dataset.settingKey ? dataset.settingKey(name) : name);
  const firstSession = () => !dataset.currentKey || dataset.currentKey() === DATASET_KEY;
  const readObject = name => {
    const parsed = parseJson(store.setting(name, ""), {});
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  };
  // Yalnız tanımlı yuvalar: kaldırılmış bir yuvanın (ör. v2.0.2'de menü başlıkları) kayıtlı değeri yok sayılır.
  const known = labels => Object.fromEntries(Object.entries(labels).filter(([key]) => Object.hasOwn(LABEL_SLOTS, key)));
  const readLabels = () => {
    const office = known(readObject(K.labels));
    if (firstSession()) return office;
    const own = known(readObject(sessionKey(K.labels)));
    const merged = {};
    for (const [key, value] of Object.entries(office)) if (!DATA_LABELS.has(key)) merged[key] = value;
    for (const [key, value] of Object.entries(own)) if (DATA_LABELS.has(key)) merged[key] = value;
    return merged;
  };
  // Başlıkları yazar: ofis geneli olanlar ui.labels'a, oturumun veri başlıkları oturumun kendi kaydına.
  const writeLabels = (labels, userId) => {
    if (firstSession()) return store.setSetting(K.labels, JSON.stringify(labels), userId);
    // ui.labels: ofis geneli başlıklar + ilk oturumun veri başlıkları (onlara dokunulmaz).
    const office = readObject(K.labels);
    const own = {};
    for (const key of Object.keys(office)) if (!DATA_LABELS.has(key)) delete office[key];
    for (const [key, value] of Object.entries(labels)) (DATA_LABELS.has(key) ? own : office)[key] = value;
    store.setSetting(K.labels, JSON.stringify(office), userId);
    store.setSetting(sessionKey(K.labels), JSON.stringify(own), userId);
  };
  // Ofisin kendi sektörleri (v2.0.2): yerleşiklerle aynı biçim; kimlikleri "ozel-" ile başlar.
  const customSectors = createCustomSectors({ store, audit });
  const findSector = id => sectorById(id) || customSectors.get(id);
  const readSector = () => parseJson(store.setting(sessionKey(K.sector), ""), null);
  const readColumns = () => readObject(sessionKey(K.columns));
  // Güncellemede (göç 10) asıl adına döndürülen, tarih yazılmış kolon adları: yöneticiye bir kez gösterilir.
  const readColumnsFixed = () => {
    const list = parseJson(store.setting(sessionKey(K.columnsFixed), ""), []);
    return Array.isArray(list) ? list.filter(item => item && typeof item.column === "string").slice(0, 50) : [];
  };
  // Eşleme ekranında seçilen kolon rolleri ({kolon: rol}); analiz ve takvim otomatik kararın üstüne yazar (v2.0.2).
  const readRoles = () => readObject(sessionKey(K.roles));
  function setRoles(user, values, known = []) {
    if (!values || typeof values !== "object" || Array.isArray(values)) throw new HttpError(400, "Kolon rolleri okunamadı.");
    const columns = new Set(known);
    const roles = readRoles();
    const changes = [];
    for (const [column, value] of Object.entries(values).slice(0, 500)) {
      if (known.length && !columns.has(column)) continue;
      const role = String(value || "").trim();
      const previous = roles[column] || "";
      if (role && role !== "auto" && !FORCED_ROLES[role]) throw new HttpError(400, `“${role}” bilinen bir kolon rolü değil.`);
      const next = role && role !== "auto" ? role : "";
      if (previous === next) continue;
      if (next) roles[column] = next;
      else delete roles[column];
      changes.push({ column, role: next, previous });
    }
    if (!changes.length) return { changed: 0, roles };
    store.setSetting(sessionKey(K.roles), Object.keys(roles).length ? JSON.stringify(roles) : "", user.id);
    audit?.(user, "insight.roles.updated", current(), { changes });
    invalidate();
    return { changed: changes.length, roles };
  }
  const readDismissed = () => readObject(sessionKey(K.dismissed));

  // İlk açılış: 1.6.0 öncesinden gelen ve kullanılmış kurulum (verisi, kaydı, notu, görevi… olan) hukuk profiliyle
  // devam eder; görünüm güncellemeden önceki gibi kalır. 1.6.0 öncesi ürün yalnızca hukuk ofisleri içindi.
  const usedBefore = () =>
    dataset.hasData() ||
    store.get("SELECT (SELECT COUNT(*) FROM records) + (SELECT COUNT(*) FROM case_notes) + (SELECT COUNT(*) FROM notes) + (SELECT COUNT(*) FROM tasks) + (SELECT COUNT(*) FROM liens) + (SELECT COUNT(*) FROM payments) AS count").count > 0;
  function init() {
    if (store.setting(K.initialized)) return;
    if (!firstSession()) return;
    store.tx(() => {
      const used = usedBefore();
      if (used && !readSector()) {
        store.setSetting(sessionKey(K.sector), JSON.stringify({ id: LEGACY_ID, source: "legacy", at: iso() }));
        store.setSetting(sessionKey(K.intro), "pending");
      }
      // Notlar, düzeltmeler ve silmeler dosya numarasına bağlı: kayıt kimliği kuralı eski kurala sabitlenir. Böylece
      // ilk Sheet eşitlemesi ve sonraki içeri almalar kayıtları başka bir kolona göre yeniden anahtarlayamaz.
      if (used) dataset.pinLegacyIdentity?.();
      store.setSetting(K.initialized, "1");
    });
  }

  function profile() {
    const stored = readSector();
    const sector = findSector(stored?.id) || sectorById(GENERAL_ID);
    const labels = readLabels();
    // Modüller veriye bağlıdır: sektör istemese bile ofisin o modülde kaydı varsa gizlenmez.
    const liens = store.get("SELECT COUNT(*) AS count FROM liens").count;
    const payments = store.get("SELECT COUNT(*) AS count FROM payments").count;
    return {
      sector: {
        id: sector.id,
        name: sector.name,
        group: sector.group,
        groupName: sector.groupName,
        custom: Boolean(sector.custom),
        source: stored?.source || "default",
        at: stored?.at || null,
        byName: stored?.byName || "",
      },
      vocab: { ...sector.vocab },
      roleLabels: { ...ROLE_LABELS, avukat: sector.vocab.expert },
      modules: { tahsilat: Boolean(sector.modules.tahsilat || payments > 0), haciz: Boolean(sector.modules.haciz || liens > 0) },
      labels,
      columns: readColumns(),
      columnsFixed: readColumnsFixed(),
      tagline: labels["brand.subtitle"] || sector.vocab.subtitle,
      introPending: store.setting(sessionKey(K.intro)) === "pending",
      slots: LABEL_SLOTS,
    };
  }

  // Giriş ekranı için (oturumsuz): yalnızca alt başlık.
  const tagline = () => profile().tagline;

  const publish = (user, detail = {}) => events?.publish("workspace.changed", { kind: "profile", actorId: user.id, actorName: user.display_name, ...detail });

  function setSector(user, id, source = "manual") {
    const sector = findSector(id);
    if (!sector) throw new HttpError(400, "Bilinmeyen sektör.");
    const value = { id: sector.id, source: SOURCES.has(source) ? source : "manual", at: iso(), by: user.id, byName: user.display_name };
    store.tx(() => {
      store.setSetting(sessionKey(K.sector), JSON.stringify(value), user.id);
      store.setSetting(sessionKey(K.intro), "done", user.id);
      audit(user, "profile.sector", sector.id, { sector: sector.id, name: sector.name, source: value.source });
    });
    publish(user);
    return profile();
  }

  function dismissIntro(user) {
    store.setSetting(sessionKey(K.intro), "done", user.id);
    return profile();
  }

  function setLabel(user, key, value) {
    const name = String(key || "");
    // Yalnızca tanımlı yuvalar: "constructor", "toString" gibi nesnenin kalıtılan adları yuva sayılmaz.
    const slot = Object.hasOwn(LABEL_SLOTS, name) ? LABEL_SLOTS[name] : null;
    if (!slot) throw new HttpError(400, "Bu başlık değiştirilemez.");
    const text = cleanLabel(value, slot.max);
    const labels = readLabels();
    const previous = labels[key] || "";
    if (text) labels[key] = text;
    else delete labels[key];
    if (previous === (labels[key] || "")) return profile();
    store.tx(() => {
      writeLabels(labels, user.id);
      audit(user, "profile.label", key, { key, name: slot.name, value: text, previous });
    });
    publish(user, { key });
    return profile();
  }

  // Birden çok başlığı tek seferde kaydeder (Operasyon merkezi düzenleyicisi). Boş değer varsayılana döndürür.
  function setLabels(user, values) {
    if (!values || typeof values !== "object" || Array.isArray(values)) throw new HttpError(400, "Başlıklar okunamadı.");
    const entries = Object.entries(values).slice(0, 40);
    const labels = readLabels();
    const changes = [];
    for (const [key, value] of entries) {
      const slot = Object.hasOwn(LABEL_SLOTS, key) ? LABEL_SLOTS[key] : null;
      if (!slot) throw new HttpError(400, "Bu başlık değiştirilemez.");
      const text = cleanLabel(value, slot.max);
      const previous = labels[key] || "";
      if (previous === text) continue;
      if (text) labels[key] = text;
      else delete labels[key];
      changes.push({ key, name: slot.name, value: text, previous });
    }
    if (!changes.length) return profile();
    store.tx(() => {
      writeLabels(labels, user.id);
      for (const change of changes) audit(user, "profile.label", change.key, change);
    });
    publish(user, { keys: changes.map(change => change.key) });
    return profile();
  }

  // Kolonların görünen adları. values: { asılAd: yeniAd | "" }; boş değer asıl ada döndürür. known: verideki kolonlar.
  // İki kolon aynı adla görünemez (tabloda ve formlarda karışmasın).
  function setColumns(user, values, known = []) {
    if (!values || typeof values !== "object" || Array.isArray(values)) throw new HttpError(400, "Kolon adları okunamadı.");
    const columns = new Set(known);
    const aliases = readColumns();
    const changes = [];
    for (const [column, value] of Object.entries(values).slice(0, MAX_COLUMN_ALIASES)) {
      if (!columns.has(column)) throw new HttpError(400, `“${column}” kolonu bu veride yok; sayfayı yenileyip tekrar deneyin.`);
      let text = cleanLabel(value, COLUMN_ALIAS_MAX);
      if (text === column) text = "";
      // Detay kartında değer sanılıp başlığa yazılan tarih (v2.0.6): kolon adı olmaz; değer kayda yazılmalıdır.
      if (text && isFullDate(text)) {
        throw new HttpError(400, `“${text}” bir tarih; kolon adı olamaz. Bu pencere kolonun adını değiştirir. Tarihi kayda yazmak için alanın sağındaki ✎ düğmesini ya da Düzenle'yi kullanın.`, { column, value: text });
      }
      const previous = aliases[column] || "";
      if (previous === text) continue;
      if (text) aliases[column] = text;
      else delete aliases[column];
      changes.push({ column, value: text, previous });
    }
    if (!changes.length) return profile();
    // Görünen adlar tekil olmalı: bir kolonun adı başka bir kolonun görünen adıyla ya da asıl adıyla (ör. "Tutar"a
    // "Kalan" demek, gerçek "Kalan" kolonu dururken) çakışmamalı.
    const fold = name => name.toLocaleLowerCase("tr-TR");
    const shown = new Map();
    for (const column of columns) {
      const name = fold(aliases[column] || column);
      if (shown.has(name) && shown.get(name) !== column) throw new HttpError(400, `“${aliases[column] || column}” adı başka bir kolonda da kullanılıyor. Farklı bir ad yazın.`);
      shown.set(name, column);
    }
    for (const column of Object.keys(aliases)) {
      const owner = [...columns].find(other => other !== column && fold(other) === fold(aliases[column]));
      if (owner) throw new HttpError(400, `“${aliases[column]}” verideki başka bir kolonun asıl adı. Farklı bir ad yazın.`);
    }
    for (const column of Object.keys(aliases)) if (!columns.has(column)) delete aliases[column];
    store.tx(() => {
      store.setSetting(sessionKey(K.columns), JSON.stringify(aliases), user.id);
      for (const change of changes) audit(user, "profile.column", change.column, change);
    });
    publish(user, { columns: changes.length });
    return profile();
  }

  // Güncelleme bildirimini (geri alınan tarih adları) kapatır.
  function clearColumnsFixed(user) {
    if (!readColumnsFixed().length) return profile();
    store.setSetting(sessionKey(K.columnsFixed), "[]", user.id);
    return profile();
  }

  function resetLabels(user) {
    const labels = readLabels();
    if (!Object.keys(labels).length) return profile();
    store.tx(() => {
      writeLabels({}, user.id);
      audit(user, "profile.labels.reset", "labels", { count: Object.keys(labels).length });
    });
    publish(user);
    return profile();
  }

  const current = () => (dataset.currentKey ? dataset.currentKey() : DATASET_KEY);

  // ---------- Analiz (önbellekli) ----------
  // Veri, düzeltmeler, yeni kayıtlar, silmeler veya takvim günü değişince yeniden hesaplanır.
  function fingerprint() {
    const row = store.get(
      `SELECT
        (SELECT COUNT(*) FROM dataset_rows WHERE dataset_key = ?) AS rowsCount,
        (SELECT COUNT(*) || '/' || COALESCE(MAX(updated_at), '') FROM overrides WHERE source_name = ?) AS overridesState,
        (SELECT COUNT(*) || '/' || COALESCE(MAX(updated_at), '') FROM records WHERE source_name = ?) AS recordsState,
        (SELECT COUNT(*) FROM deleted_records WHERE source_name = ?) AS deletedCount`,
      current(), current(), current(), current(),
    );
    const day = clock();
    const custom = store.setting("sectors.custom", "") || "";
    const roles = store.setting(sessionKey(K.roles), "") || "";
    const layout = store.setting(sessionKey("dataset.columns.layout"), "") || "";
    return [`${layout.length}:${layout.slice(-64)}`, current(), row.rowsCount, row.overridesState, row.recordsState, row.deletedCount, store.setting(sessionKey("dataset.changedAt"), ""), store.setting(sessionKey("dataset.label"), ""), `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`, free ? free.fingerprint() : "", `${custom.length}:${custom.slice(-48)}`, `${roles.length}:${roles.slice(-64)}`, store.setting(sessionKey("dataset.unflagged"), "").length].join("|");
  }

  async function analysis() {
    const key = fingerprint();
    const session = current();
    const cache = caches.get(session);
    const computing = running.get(session);
    if (cache && cache.fingerprint === key) return cache.analysis;
    if (computing && computing.fingerprint === key) return computing.promise;
    const started = generation;
    const promise = (async () => {
      const view = await dataset.view();
      // Görünüm okunurken ya da analiz iş parçacığında sürerken veri değiştiyse (ör. ilk Sheet eşitlemesi ya da aynı
      // anda yapılan bir düzeltme) sonuç bu istek için döner ama önbelleğe alınmaz: bir sonraki istek durulmuş veriyle
      // yeniden hesaplar. Böylece eski veriden hesaplanmış bir analiz yeni verinin anahtarıyla saklanamaz.
      const result = await analysisRunner.run({ rows: view.rows || [], label: store.setting(sessionKey("dataset.label"), ""), tabs: (view.tabs || []).map(tab => tab.title).filter(Boolean), now: clock(), sectors: customSectors.all(), forced: readRoles() });
      const settled = fingerprint() === key && generation === started;
      if (settled) caches.set(session, { fingerprint: key, analysis: result });
      if (result.ms > 1500) log?.info?.(`Veri analizi ${result.ms} ms sürdü (${result.rowCount} kayıt)`);
      return result;
    })().finally(() => {
      if (running.get(session)?.promise === promise) running.delete(session);
    });
    running.set(session, { fingerprint: key, promise });
    return promise;
  }

  // ---------- Mantık denetimi (v2.0.1) ----------
  // Analizdeki bulgular yoksayılanlar çıkarılarak ve kolonların görünen adlarıyla özetlenir (veri sağlığı raporu,
  // tablodaki işaretler). Tam liste sunucuda kalır; kayda özel liste checks() ile alınır.
  function shapeFinding(finding, aliases) {
    const fields = finding.fields || [];
    return {
      ...finding,
      message: aliasText(finding.message, fields, aliases),
      why: aliasText(finding.why, fields, aliases),
      ruleTitle: ruleTitle(finding.rule),
      suggest: finding.suggest ? { ...finding.suggest, label: aliases[finding.suggest.field] || finding.suggest.field } : undefined,
    };
  }
  function reasoningSummary(reasoning) {
    if (!reasoning) return null;
    const dismissed = readDismissed();
    const aliases = readColumns();
    const live = reasoning.findings.filter(finding => !dismissed[finding.signature]);
    const issues = new Map();
    for (const finding of live) {
      if (!issues.has(finding.rule)) issues.set(finding.rule, { id: finding.rule, severity: "info", title: ruleTitle(finding.rule), count: 0, items: [] });
      const issue = issues.get(finding.rule);
      issue.count += 1;
      if (finding.severity === "warn") issue.severity = "warn";
      if (issue.items.length < REASONING_LIST) issue.items.push({ key: finding.key, title: finding.title, tab: finding.tab, message: aliasText(finding.message, finding.fields || [], aliases) });
    }
    for (const issue of issues.values()) issue.more = Math.max(0, issue.count - issue.items.length);
    return {
      version: reasoning.version,
      relations: reasoning.relations.map(relation => ({ ...relation, text: aliasText(relation.text, [relation.target, relation.base, ...relation.parts], aliases) })),
      issues: [...issues.values()].sort((a, b) => (a.severity === b.severity ? b.count - a.count : a.severity === "warn" ? -1 : 1)),
      count: live.length,
      warn: live.filter(finding => finding.severity === "warn").length,
      warnKeys: [...new Set(live.filter(finding => finding.severity === "warn").map(finding => finding.key))].slice(0, 5000),
      dismissed: reasoning.findings.length - live.length,
    };
  }

  // Kayda özel bulgular: analizden + canlı tahsilat denetimi (tahsilatlar analiz önbelleğini etkilemez).
  async function checks(key, tab = "") {
    const result = await analysis();
    const dismissed = readDismissed();
    const aliases = readColumns();
    const own = (result.reasoning?.findings || []).filter(finding => finding.key === key && (!tab || finding.tab === tab));
    // Kayıttaki hesap tutmuyorsa önce o düzeltilmeli: yanlış Kalan'a dayanan tahsilat önerisi verilmez.
    const live = own.some(finding => finding.rule === "relation" && !dismissed[finding.signature]) ? [] : await paymentChecks(key, tab, result);
    return { findings: [...own, ...live].filter(finding => !dismissed[finding.signature]).map(finding => shapeFinding(finding, aliases)) };
  }

  async function paymentChecks(key, tab, result) {
    const payments = store.all("SELECT amount, date, created_at AS createdAt FROM payments WHERE case_key = ? ORDER BY created_at, rowid", key);
    if (!payments.length) return [];
    const rows = (await dataset.view()).rows || [];
    const row = rows.find(item => item.__hofKey === key && (!tab || item.__sheet === tab)) || rows.find(item => item.__hofKey === key);
    if (!row) return [];
    const relation = (result.reasoning?.relations || []).find(item => item.kind === "difference" && item.tab === String(row.__sheet || ""));
    if (!relation) return [];
    const remaining = parseNumberText(row[relation.target]);
    const total = parseNumberText(row[relation.base]);
    if (!Number.isFinite(remaining) || !Number.isFinite(total)) return [];
    const money = (value, column = relation.target) => formatValue(value, row[column] || row[relation.target]);
    const title = recordTitle(row, result.primary || {});
    const base = { key, tab: String(row.__sheet || ""), title, rule: "payment" };
    const out = [];
    const paid = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    if (paid > total + 0.011) {
      out.push({ ...base, severity: "warn", message: `Bu kayda işlenen tahsilatlar (${money(paid, relation.base)}) ${relation.base} tutarını (${money(total, relation.base)}) aşıyor.`, why: "Tahsilat penceresinden girilen ödemelerin toplamı borcun kendisinden büyük. Tahsilatlardan biri iki kez ya da yanlış kayda girilmiş olabilir.", fields: [relation.base], signature: `payment-over|${key}|${paid}|${total}` });
    }
    // Tahsilattan sonra tabloda kalan değişmediyse: tahsilat tabloya yansıtılmamış olabilir.
    const fields = [relation.target, relation.base, ...relation.parts];
    const marks = fields.map(() => "?").join(",");
    const changedAt = [
      store.get(`SELECT MAX(updated_at) AS at FROM overrides WHERE source_name = ? AND case_key = ? AND field IN (${marks})`, current(), key, ...fields)?.at,
      store.get("SELECT MAX(updated_at) AS at FROM dataset_rows WHERE dataset_key = ? AND case_key = ?", current(), key)?.at,
      store.get("SELECT MAX(updated_at) AS at FROM records WHERE source_name = ? AND case_key = ?", current(), key)?.at,
    ].filter(Boolean).sort().at(-1) || "";
    const recent = payments.filter(item => item.createdAt > changedAt);
    const recentSum = recent.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    if (recentSum > 0.011 && remaining > 0.011) {
      let formulas = null;
      try {
        formulas = row.__hofFx ? JSON.parse(row.__hofFx) : null;
      } catch {
        formulas = null;
      }
      const derived = Boolean(formulas?.[relation.target]) && formulas[relation.target].s !== "manual";
      const emptyPart = relation.parts.find(part => isEmptyCell(row[part]));
      let suggest;
      let hint = "";
      if (emptyPart) {
        suggest = { field: emptyPart, value: money(recentSum, relation.parts[0]) };
        hint = ` Tahsilatı ${emptyPart} alanına yazarsanız ${relation.target} ${derived ? "formülle kendiliğinden" : "kurala göre"} ${money(Math.max(0, remaining - recentSum))} olur.`;
      } else if (!derived) {
        suggest = { field: relation.target, value: money(Math.max(0, remaining - recentSum)) };
        hint = ` ${relation.target} değerini güncellemek isteyebilirsiniz.`;
      }
      const [year, month, day] = String(recent[0].date || recent[0].createdAt).slice(0, 10).split("-");
      out.push({
        ...base,
        severity: "info",
        message: `${day}.${month}.${year} tarihinden beri ${money(recentSum)} tahsilat işlendi; ${relation.target} (${money(remaining)}) o tarihten beri değişmedi.`,
        why: `Bu tabloda ${relation.text} kuralı geçerli. Tahsilat penceresinden girilen ödeme tablodaki değerleri kendiliğinden değiştirmez.${hint}`,
        fields,
        signature: `payment-stale|${key}|${recentSum}|${remaining}`,
        ...(suggest ? { suggest } : {}),
      });
    }
    return out;
  }

  // ---------- Veri Sağlığı: Yok say (v2.0.11) ----------
  // Muhasebe programlarındaki "uyarıyı kabul et / bir daha gösterme": bulgu (grubun tamamı ya da tek kayıt) kalıcı olarak
  // yok sayılır, puandan düşülür (kalan sorun yoksa %100 "İyi"). Karar ofis geneldir ve tüm bilgisayarlarda geçerlidir;
  // kayıtlar içerikten gelen kimlikleriyle saklanır, bu yüzden aynı Excel yeni bir oturuma yüklense de korunur. Grup yok
  // sayılınca o anki kayıtlar saklanır: yeni hatalı kayıt yine uyarır. Analiz önbelleği değişmez; yok saymalar istemciye
  // gitmeden hemen önce uygulanır.
  const MAX_IGNORED_KEYS = 200_000;
  const readIgnored = () => readObject(K.qualityIgnored);
  const signatureOf = (tab, id) => `${tab || ""}|${id}`;
  const levelOf = score => (score >= 95 ? "iyi" : score >= 80 ? "orta" : "zayif");
  // Tek kalite raporuna yok saymaları uygular; tab verilmezse bulgunun kendi sekmesi (birleşik rapor) kullanılır.
  function applyIgnores(quality, tab = null, ignored = readIgnored()) {
    if (!quality) return quality;
    let regained = 0;
    const issues = [];
    const hidden = [];
    for (const issue of quality.issues || []) {
      const { keys = [], template, ...rest } = issue;
      const signature = signatureOf(tab ?? issue.tab ?? "", issue.id);
      const entry = ignored[signature];
      if (!entry) {
        issues.push(rest);
        continue;
      }
      if (entry.whole || !keys.length) {
        regained += issue.failed || 0;
        hidden.push({ signature, title: rest.title, count: rest.count, at: entry.at, byName: entry.byName || "" });
        continue;
      }
      const skip = new Set(entry.keys || []);
      const left = keys.filter(key => !skip.has(key));
      const dropped = keys.length - left.length;
      if (!dropped) {
        issues.push(rest);
        continue;
      }
      regained += Math.min(issue.failed || 0, dropped);
      if (!left.length) {
        hidden.push({ signature, title: rest.title, count: rest.count, at: entry.at, byName: entry.byName || "" });
        continue;
      }
      const count = rest.count - dropped;
      const items = rest.items.filter(item => !skip.has(item.key));
      issues.push({ ...rest, count, failed: Math.max(0, (rest.failed || 0) - dropped), title: template ? template.replace("\u0001", String(count)) : rest.title, items, more: Math.max(0, count - items.length), ignoredCount: dropped });
      hidden.push({ signature, title: template ? template.replace("\u0001", String(dropped)) : rest.title, count: dropped, at: entry.at, byName: entry.byName || "", partial: true });
    }
    const passed = Math.min(quality.checked, (quality.passed || 0) + regained);
    const score = quality.checked ? Math.round((passed / quality.checked) * 100) : 100;
    return { ...quality, passed, score, level: levelOf(score), issues, ignored: hidden };
  }
  // İstemciye giden analiz: her sekmenin ve birleşik raporun kalitesi yok saymalarla (bulgu kayıt listeleri çıkarılmış).
  function withQualityIgnores(analysis) {
    if (!analysis?.quality) return analysis;
    const ignored = readIgnored();
    const scopes = analysis.kpis?.scopes ? Object.fromEntries(Object.entries(analysis.kpis.scopes).map(([key, scope]) => [key, { ...scope, quality: applyIgnores(scope.quality, key, ignored) }])) : undefined;
    // Tek sekmeli veride birleşik rapor o sekmenin raporudur (bulgularda sekme adı yazmaz).
    const order = analysis.kpis?.order || [];
    return { ...analysis, quality: applyIgnores(analysis.quality, order.length === 1 ? order[0] : null, ignored), ...(scopes ? { kpis: { ...analysis.kpis, scopes } } : {}) };
  }
  // tab + id bulguyu gösterir; key verilirse yalnız o kayıt yok sayılır.
  async function ignoreQuality(user, { tab = "", id = "", key = "" } = {}) {
    const result = await analysis();
    const scope = result.kpis?.scopes?.[tab];
    const issue = (scope?.quality?.issues || []).find(item => item.id === id);
    if (!issue) throw new HttpError(409, "Bu bulgu artık yok (veri değişmiş olabilir). Pencereyi kapatıp yeniden açın.");
    const signature = signatureOf(tab, id);
    const map = readIgnored();
    const previous = map[signature] || { keys: [] };
    const entry = { at: iso(), by: user.id, byName: user.display_name || "", column: issue.column || "", title: issue.title };
    if (key) {
      if (!(issue.keys || []).includes(key)) throw new HttpError(409, "Bu kayıt artık bu bulguda değil.");
      map[signature] = { ...entry, whole: false, keys: [...new Set([...(previous.keys || []), key])].slice(-MAX_IGNORED_KEYS) };
    } else if (!(issue.keys || []).length) map[signature] = { ...entry, whole: true, keys: [] };
    else map[signature] = { ...entry, whole: false, keys: [...new Set([...(previous.keys || []), ...issue.keys])].slice(-MAX_IGNORED_KEYS) };
    store.setSetting(K.qualityIgnored, JSON.stringify(map), user.id);
    audit(user, "insight.quality.ignored", current(), { tab, issue: id, title: issue.title, record: key || null, count: key ? 1 : issue.count });
    publish(user, { quality: true });
    return { ok: true };
  }
  function restoreQuality(user, signature) {
    const map = readIgnored();
    const entry = map[String(signature || "")];
    if (!entry) throw new HttpError(404, "Yok sayılan bulgu bulunamadı.");
    delete map[String(signature)];
    store.setSetting(K.qualityIgnored, Object.keys(map).length ? JSON.stringify(map) : "", user.id);
    audit(user, "insight.quality.restored", current(), { signature, title: entry.title });
    publish(user, { quality: true });
    return { ok: true };
  }

  // "Yoksay": bulgu (aynı değerlerle) bir daha gösterilmez; değer değişirse yeniden değerlendirilir.
  function dismiss(user, signature) {
    const key = String(signature || "").slice(0, 400);
    if (!key) throw new HttpError(400, "Bulgu tanınmadı.");
    const map = readDismissed();
    map[key] = { by: user.id, at: iso() };
    const entries = Object.entries(map);
    const trimmed = entries.length > MAX_DISMISSED ? Object.fromEntries(entries.sort((a, b) => String(a[1].at).localeCompare(String(b[1].at))).slice(-MAX_DISMISSED)) : map;
    store.setSetting(sessionKey(K.dismissed), JSON.stringify(trimmed), user.id);
    audit(user, "insight.finding.dismissed", key.split("|")[1] || "", { signature: key });
    publish(user, { dismissed: true });
    return { ok: true };
  }

  // Kart penceresindeki kayıt listesi: güncel görünümden, kartla aynı kapsamda (sekme) ve aynı kuralla.
  async function records(list, tab = "", limit = 500, { card = "", value = "" } = {}) {
    if (!RECORD_LISTS.includes(list)) throw new HttpError(400, "Bilinmeyen liste.");
    if (list === "value" && !VALUE_CARDS.has(card)) throw new HttpError(400, "Bilinmeyen kart.");
    const result = await analysis();
    const view = await dataset.view();
    return listRecords(view.rows || [], result.kpis, { list, tab: String(tab || "").slice(0, 300), card, value: String(value || "").slice(0, 300), now: clock(), limit });
  }

  // Veri değişince (içeri alma, eşitleme, düzeltme, silme, geri alma, yeni kayıt) çağrılır. Parmak izi her değişikliği
  // yakalayamaz (ör. bir kayıt silinip başka biri geri alınınca sayılar aynı kalır); açık geçersizleştirme bunu kapatır.
  const invalidate = () => {
    generation += 1;
    caches.clear();
    running.clear();
  };

  return { init, profile, tagline, setSector, findSector, customSectors, dismissIntro, setLabel, setLabels, setColumns, clearColumnsFixed, resetLabels, setRoles, roles: readRoles, analysis, records, invalidate, usedBefore, reasoningSummary, checks, dismiss, withQualityIgnores, ignoreQuality, restoreQuality, fingerprint, close: () => analysisRunner.close(), runnerStats: () => analysisRunner.stats() };
}
