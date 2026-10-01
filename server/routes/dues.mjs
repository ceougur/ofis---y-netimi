// Tahsilat takvimi ve son tarihi yaklaşan işler (v2.0.1). Kayan ödeme şeridi ve sağ alt bildirimler bunu kullanır.
// Sonuç; veri, tahsilatlar, elle kapatılan kalemler ve gün değişene kadar oturum başına önbellektedir.
import { HttpError, ok, readJson, text } from "../lib/http.mjs";
import { computeDeadlines, computeDues } from "../lib/insight/dues.mjs";
import { canUser } from "../lib/permissions.mjs";

const SETTLED_KEY = "dues.settled";
const MAX_SETTLED = 5000;

export function registerDueRoutes(router, { auth, store, dataset, profile, events, audit, plans, cheques, invoices }) {
  const cache = new Map(); // oturum → { key, result }
  const settingKey = () => (dataset.settingKey ? dataset.settingKey(SETTLED_KEY) : SETTLED_KEY);
  const readSettled = () => {
    try {
      const value = JSON.parse(store.setting(settingKey(), "{}") || "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  };
  const paymentsState = () => {
    const row = store.get("SELECT COUNT(*) AS count, COALESCE(MAX(COALESCE(updated_at, created_at)), '') AS at FROM payments");
    return `${row.count}/${row.at}`;
  };

  async function compute() {
    const now = new Date();
    const settledRaw = store.setting(settingKey(), "{}") || "{}";
    // Sekme adları ve gizlenen sekmeler (v2.0.2) görünümü değiştirir; anahtara girer.
    const tabState = ["dataset.tabs.alias", "dataset.tabs.hidden"].map(name => store.setting(dataset.settingKey ? dataset.settingKey(name) : name, "") || "").join("|");
    const key = [profile.fingerprint(), paymentsState(), settledRaw.length, settledRaw.slice(-64), tabState, plans?.fingerprint ? plans.fingerprint() : "", cheques?.fingerprint ? cheques.fingerprint() : "", invoices?.fingerprint ? invoices.fingerprint() : "", now.toDateString()].join("|");
    const session = dataset.currentKey();
    const hit = cache.get(session);
    if (hit && hit.key === key) return hit.result;
    const view = await dataset.view();
    const rows = view.rows || [];
    const tabs = (view.tabs || []).map(item => item.title);
    const keys = new Set(rows.map(row => row.__hofKey).filter(Boolean));
    const payments = store.all("SELECT case_key AS caseKey, amount, date, note FROM payments").filter(item => keys.has(item.caseKey));
    const forced = profile.roles ? profile.roles() : null;
    const computed = computeDues({ rows, tabs, payments, settled: readSettled(), now, forced });
    // Taksit kartı olan kişinin (v2.0.8) tablodaki ödeme kalemleri ikinci kez sayılmaz: taksitleri kartından gelir.
    // Ödeme sözü kişiye özel bir taahhüttür, kalır; son tarihi yaklaşan işler (sözleşme, sigorta…) bundan etkilenmez.
    const carded = plans?.linkedCases ? plans.linkedCases(session) : new Set();
    const items = carded.size ? computed.items.filter(item => item.promise || !carded.has(item.caseKey)) : computed.items;
    const dormant = carded.size ? computed.dormant.filter(item => !carded.has(item.caseKey)) : computed.dormant;
    const { sources } = computed;
    const deadlines = computeDeadlines({ rows, tabs, now, exclude: sources, forced });
    const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    // Taksit kartlarının vadesi gelen/geçen taksitleri (v2.0.4) aynı listeye girer: şerit ve bildirimler tek kaynaktan okur.
    // Kart oturumdan bağımsızdır (Kasa gibi); her oturumda görünür.
    const planItems = plans?.dueItems ? plans.dueItems(local) : [];
    // Çek/senet (v2.0.7): vadesi geçen, bugün ve 7 gün içinde tahsil edilecek (alınan) ya da ödenecek (verilen) evrak.
    const chequeItems = cheques?.dueItems ? cheques.dueItems(local) : [];
    // Fatura (v2.0.15): vadesi geçen, bugün ve 7 gün içinde vadesi gelen açık (vadeli) faturalar.
    const invoiceItems = invoices?.dueItems ? invoices.dueItems(local) : [];
    const result = { items: [...items, ...planItems, ...chequeItems, ...invoiceItems], deadlines, sources, dormant, today: local, generatedAt: now.toISOString() };
    cache.set(session, { key, result });
    return result;
  }

  router.get("/api/workspace/dues", async ({ req, res }) => {
    const user = auth.requireUser(req);
    const data = await compute();
    // Çek/senet kalemleri yalnız çekleri görebilenlere (kasa yetkisi olanlar) gider.
    // Fatura kalemleri yalnız faturaları görebilenlere.
    ok(res, { ...data, items: data.items.filter(item => (item.source !== "cheque" || canUser(user, "cheques.view")) && (item.source !== "invoice" || canUser(user, "invoices.view"))) });
  });

  // "Ödendi say" / "İptal": kalem, tahsilat girilmeden kapatılır (veri değişmez; kim, ne zaman kaydedilir).
  router.post("/api/workspace/dues/settle", async ({ req, res }) => {
    const user = auth.requirePermission(req, "records.edit");
    const body = await readJson(req);
    const id = text(body.id).slice(0, 600);
    if (!id.startsWith("due|")) throw new HttpError(400, "Kalem tanınmadı.");
    const reason = body.reason === "cancelled" ? "cancelled" : "paid";
    const map = readSettled();
    if (body.undo) delete map[id];
    else map[id] = { reason, by: user.id, at: new Date().toISOString() };
    let entries = Object.entries(map);
    if (entries.length > MAX_SETTLED) entries = entries.sort((a, b) => String(a[1].at).localeCompare(String(b[1].at))).slice(-MAX_SETTLED);
    store.setSetting(settingKey(), JSON.stringify(Object.fromEntries(entries)), user.id);
    const caseKey = id.split("|")[2] || "";
    audit(user, body.undo ? "dues.reopened" : reason === "paid" ? "dues.settled" : "dues.cancelled", caseKey, { id });
    events?.publish("workspace.changed", { kind: "dues", caseKey, actorId: user.id, actorName: user.display_name, datasetKey: dataset.currentKey() }, { except: user.id });
    ok(res, { ok: true });
  });

  // Zil listesinden kaldırılan bildirimler (v2.0.2): kişiye özeldir, tüm bilgisayarlarda geçerlidir. Kalem kapanmaz
  // (şerit ve diğer kullanıcılar etkilenmez); yalnızca bu kişinin zil listesinde ve sağ alt bildirimlerinde görünmez.
  const dismissedKey = user => `alerts.dismissed.${user.id}`;
  const readDismissed = user => {
    try {
      const value = JSON.parse(store.setting(dismissedKey(user), "{}") || "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  };
  router.get("/api/workspace/alerts/dismissed", async ({ req, res }) => {
    const user = auth.requireUser(req);
    ok(res, { ids: Object.keys(readDismissed(user)) });
  });
  router.post("/api/workspace/alerts/dismiss", async ({ req, res }) => {
    const user = auth.requireUser(req);
    const body = await readJson(req);
    const id = text(body.id).slice(0, 700);
    if (!id) throw new HttpError(400, "Bildirim seçilmedi.");
    const map = readDismissed(user);
    if (body.undo) delete map[id];
    else map[id] = new Date().toISOString();
    // En yeni 3000 kaldırma saklanır; bir yıldan eskiler düşer.
    const cutoff = new Date(Date.now() - 400 * 86_400_000).toISOString();
    const entries = Object.entries(map).filter(([, at]) => at >= cutoff).sort((a, b) => a[1].localeCompare(b[1])).slice(-3000);
    store.setSetting(dismissedKey(user), JSON.stringify(Object.fromEntries(entries)), user.id);
    ok(res, { ids: entries.map(([key]) => key) });
  });
}
