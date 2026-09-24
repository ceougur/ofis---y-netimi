// Ofis profili (v1.6.0): seçili sektör ve onun kelime dağarcığı, rol adları, modüller, yöneticinin kalemle değiştirdiği
// başlıklar ve verinin önbellekli analizi.
//
// Öncelik: yöneticinin elle verdiği başlık > sektörün başlığı > arayüzün varsayılanı.
// Sektör yalnızca yönetici onayıyla değişir. Analizin önerisi hiçbir zaman kendiliğinden uygulanmaz.
// 1.6.0 öncesinden gelen kurulum (verisi olan) "Hukuk bürosu" profiliyle açılır: arayüzü güncellemeden önceki gibi kalır;
// yöneticiye bir kez analiz sonucu gösterilir.
import { DATASET_KEY } from "./dataset.mjs";
import { HttpError, parseJson } from "./http.mjs";
import { ROLE_LABELS } from "./permissions.mjs";
import { analyzeDataset } from "./insight/analyze.mjs";
import { GENERAL_ID, LEGACY_ID, sectorById } from "./insight/sectors.mjs";

// Kalemle düzenlenebilen başlıklar: anahtar → en fazla uzunluk ve yönetici ekranındaki adı.
export const LABEL_SLOTS = Object.freeze({
  "brand.subtitle": { max: 60, name: "Kenar çubuğu alt başlığı" },
  "nav.workspace": { max: 40, name: "Menü başlığı: Çalışma alanı" },
  "nav.source": { max: 40, name: "Menü başlığı: Veri kaynağı" },
  "side.title": { max: 40, name: "Operasyon merkezi başlığı" },
  "page.title": { max: 80, name: "Sayfa başlığı" },
  "summary.title": { max: 60, name: "Özet başlığı" },
  "summary.subtitle": { max: 200, name: "Özet açıklaması" },
  "categories.title": { max: 60, name: "Sekmeler başlığı" },
  "table.title": { max: 80, name: "Tablo başlığı" },
  "table.subtitle": { max: 160, name: "Tablo açıklaması" },
});

const K = { sector: "insight.sector", labels: "ui.labels", intro: "insight.intro", initialized: "insight.initialized" };
const SOURCES = new Set(["confirmed", "manual"]);

const cleanLabel = (value, max) =>
  String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export function createProfileService({ store, dataset, audit, events, log, clock = () => new Date() }) {
  let cache = null; // { fingerprint, analysis }
  let computing = null;

  const iso = () => clock().toISOString();
  const readLabels = () => {
    const parsed = parseJson(store.setting(K.labels, ""), {});
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  };
  const readSector = () => parseJson(store.setting(K.sector, ""), null);

  // İlk açılış: 1.6.0 öncesinden gelen ve kullanılmış kurulum (verisi, kaydı, notu, görevi… olan) hukuk profiliyle
  // devam eder; görünüm güncellemeden önceki gibi kalır. 1.6.0 öncesi ürün yalnızca hukuk ofisleri içindi.
  const usedBefore = () =>
    dataset.hasData() ||
    store.get("SELECT (SELECT COUNT(*) FROM records) + (SELECT COUNT(*) FROM case_notes) + (SELECT COUNT(*) FROM notes) + (SELECT COUNT(*) FROM tasks) + (SELECT COUNT(*) FROM liens) + (SELECT COUNT(*) FROM payments) AS count").count > 0;
  function init() {
    if (store.setting(K.initialized)) return;
    store.tx(() => {
      if (!readSector() && usedBefore()) {
        store.setSetting(K.sector, JSON.stringify({ id: LEGACY_ID, source: "legacy", at: iso() }));
        store.setSetting(K.intro, "pending");
      }
      store.setSetting(K.initialized, "1");
    });
  }

  function profile() {
    const stored = readSector();
    const sector = sectorById(stored?.id) || sectorById(GENERAL_ID);
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
        source: stored?.source || "default",
        at: stored?.at || null,
        byName: stored?.byName || "",
      },
      vocab: { ...sector.vocab },
      roleLabels: { ...ROLE_LABELS, avukat: sector.vocab.expert },
      modules: { tahsilat: Boolean(sector.modules.tahsilat || payments > 0), haciz: Boolean(sector.modules.haciz || liens > 0) },
      labels,
      tagline: labels["brand.subtitle"] || sector.vocab.subtitle,
      introPending: store.setting(K.intro) === "pending",
      slots: LABEL_SLOTS,
    };
  }

  // Giriş ekranı için (oturumsuz): yalnızca alt başlık.
  const tagline = () => profile().tagline;

  const publish = (user, detail = {}) => events?.publish("workspace.changed", { kind: "profile", actorId: user.id, actorName: user.display_name, ...detail });

  function setSector(user, id, source = "manual") {
    const sector = sectorById(id);
    if (!sector) throw new HttpError(400, "Bilinmeyen sektör.");
    const value = { id: sector.id, source: SOURCES.has(source) ? source : "manual", at: iso(), by: user.id, byName: user.display_name };
    store.tx(() => {
      store.setSetting(K.sector, JSON.stringify(value), user.id);
      store.setSetting(K.intro, "done", user.id);
      audit(user, "profile.sector", sector.id, { sector: sector.id, name: sector.name, source: value.source });
    });
    publish(user);
    return profile();
  }

  function dismissIntro(user) {
    store.setSetting(K.intro, "done", user.id);
    return profile();
  }

  function setLabel(user, key, value) {
    const slot = LABEL_SLOTS[String(key || "")];
    if (!slot) throw new HttpError(400, "Bu başlık değiştirilemez.");
    const text = cleanLabel(value, slot.max);
    const labels = readLabels();
    const previous = labels[key] || "";
    if (text) labels[key] = text;
    else delete labels[key];
    if (previous === (labels[key] || "")) return profile();
    store.tx(() => {
      store.setSetting(K.labels, JSON.stringify(labels), user.id);
      audit(user, "profile.label", key, { key, name: slot.name, value: text, previous });
    });
    publish(user, { key });
    return profile();
  }

  function resetLabels(user) {
    const labels = readLabels();
    if (!Object.keys(labels).length) return profile();
    store.tx(() => {
      store.setSetting(K.labels, "{}", user.id);
      audit(user, "profile.labels.reset", "labels", { count: Object.keys(labels).length });
    });
    publish(user);
    return profile();
  }

  // ---------- Analiz (önbellekli) ----------
  // Veri, düzeltmeler, yeni kayıtlar, silmeler veya takvim günü değişince yeniden hesaplanır.
  function fingerprint() {
    const row = store.get(
      `SELECT
        (SELECT COUNT(*) FROM dataset_rows WHERE dataset_key = ?) AS rowsCount,
        (SELECT COUNT(*) || '/' || COALESCE(MAX(updated_at), '') FROM overrides WHERE source_name = ?) AS overridesState,
        (SELECT COUNT(*) || '/' || COALESCE(MAX(updated_at), '') FROM records WHERE source_name = ?) AS recordsState,
        (SELECT COUNT(*) FROM deleted_records WHERE source_name = ?) AS deletedCount`,
      DATASET_KEY, DATASET_KEY, DATASET_KEY, DATASET_KEY,
    );
    const day = clock();
    return [row.rowsCount, row.overridesState, row.recordsState, row.deletedCount, store.setting("dataset.changedAt", ""), store.setting("dataset.label", ""), `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`].join("|");
  }

  async function analysis() {
    const key = fingerprint();
    if (cache && cache.fingerprint === key) return cache.analysis;
    if (computing && computing.fingerprint === key) return computing.promise;
    const promise = (async () => {
      const view = await dataset.view();
      // Görünüm okunurken veri değiştiyse (ör. ilk Sheet eşitlemesi ya da aynı anda yapılan bir düzeltme) sonuç bu
      // istek için döner ama önbelleğe alınmaz: bir sonraki istek durulmuş veriyle yeniden hesaplar. Böylece eski
      // veriden hesaplanmış bir analiz yeni verinin anahtarıyla saklanamaz. (Analiz eşzamanlıdır; araya iş giremez.)
      const settled = fingerprint() === key;
      const result = analyzeDataset({ rows: view.rows || [], label: store.setting("dataset.label", ""), tabs: (view.tabs || []).map(tab => tab.title).filter(Boolean), now: clock() });
      if (settled) cache = { fingerprint: key, analysis: result };
      if (result.ms > 1500) log?.info?.(`Veri analizi ${result.ms} ms sürdü (${result.rowCount} kayıt)`);
      return result;
    })().finally(() => {
      computing = null;
    });
    computing = { fingerprint: key, promise };
    return promise;
  }

  const invalidate = () => {
    cache = null;
  };

  return { init, profile, tagline, setSector, dismissIntro, setLabel, resetLabels, analysis, invalidate };
}
