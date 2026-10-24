// Tahsilat takvimi ve son tarihi yaklaşan işler (v2.0.1). Kayan ödeme şeridi ve sağ alt bildirimler bunu kullanır.
// Sonuç; veri, tahsilatlar, elle kapatılan kalemler ve gün değişene kadar oturum başına önbellektedir.
import { createHash } from "node:crypto";
import { HttpError, ok, readJson, text } from "../lib/http.mjs";
import { caseCollections, caseCollectionsState } from "../lib/insight/case-collections.mjs";
import { computeDeadlines, computeDues, DUE_WINDOW } from "../lib/insight/dues.mjs";
import { canUser } from "../lib/permissions.mjs";
import { tableNotes } from "../lib/reports.mjs";
import { systemClock } from "../lib/clock.mjs";

const SETTLED_KEY = "dues.settled";
const MAX_SETTLED = 5000;

// calendar (v2.0.17): raporların tüm sayfalar takvimi (routes/reports.mjs allCalendar; tembel, çünkü raporlar sonra kaydolur).
// Sayfa düzeninde şirketin BÜTÜN sayfalarının tarih uyarıları zile/takvime girer: öbür sayfaların kalemleri "foreign"
// işaretiyle ve sayfa adıyla eklenir (madde 13: "tarih uyarısı vermiyor" şikâyeti kökten kapanır).
export function registerDueRoutes(router, { auth, store, dataset, profile, events, audit, plans, cheques, invoices, bankAccounts = null, calendar = null, now: clock = systemClock }) {
  // 2.3.0 İz 3.3 (plan §8.9 "Vade Takip / Zil / Takvim: … planlı ödemeler … bank.view ile"; eşleme 301): planlı banka işlemleri (lib/bank/vouchers.mjs).
  const bankPlans = () => (typeof bankAccounts === "function" ? bankAccounts() : bankAccounts)?.plans || null;
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

  // v2.0.22 (yük ölçümü): tablo kayıtlarından hesaplanan kısım (ödeme kalemleri, son tarihler) para kaydından etkilenmez;
  // ayrı saklanır. Personel sürekli tahsilat/fatura girerken her kayıtta yalnız taksit, çek/senet ve fatura kalemleri
  // yeniden hesaplanır (önceden binlerce satırlık tablo her kayıtta baştan işleniyordu). Sonuç aynıdır.
  const tableCache = new Map(); // oturum → { key, value: { computed, deadlines } }
  async function compute() {
    const now = clock();
    const settledRaw = store.setting(settingKey(), "{}") || "{}";
    // Sekme adları ve gizlenen sekmeler (v2.0.2) görünümü değiştirir; anahtara girer.
    const tabState = ["dataset.tabs.alias", "dataset.tabs.hidden"].map(name => store.setting(dataset.settingKey ? dataset.settingKey(name) : name, "") || "").join("|");
    const pages = dataset.sessions ? dataset.sessions() : [];
    const pagesState = pages.length > 1 ? pages.map(page => `${page.key}:${page.rowCount}:${page.recordCount}:${page.changedAt || ""}`).join("|") : "";
    // 2.4.4 (E8): kalemleri kapatan tahsilatlar kayda bağlı carinin ve taksit kartlarının tahsilatlarını da kapsar (lib/insight/case-collections.mjs);
    // carilerin kayıt bağı, cari tahsilatları ve taksit hareketleri değişince tablo kısmı da yeniden hesaplanır.
    const planState = plans?.fingerprint ? plans.fingerprint() : "";
    const tableKey = [pagesState, profile.fingerprint(), paymentsState(), caseCollectionsState(store), planState, settledRaw.length, settledRaw.slice(-64), tabState, now.toDateString()].join("|");
    const key = [tableKey, cheques?.fingerprint ? cheques.fingerprint() : "", invoices?.fingerprint ? invoices.fingerprint() : "", bankPlans()?.fingerprint ? bankPlans().fingerprint() : ""].join("|");
    const session = dataset.currentKey();
    const hit = cache.get(session);
    if (hit && hit.key === key) return hit.result;
    let table = tableCache.get(session);
    if (!table || table.key !== tableKey) {
      const view = await dataset.view();
      const rows = view.rows || [];
      const tabs = (view.tabs || []).map(item => item.title);
      const keys = new Set(rows.map(row => row.__hofKey).filter(Boolean));
      // Kaydın tahsilatları: kayıt tahsilatı (eski), kayda bağlı carinin tahsilatı ve kayda bağlı / carisinin taksit kartının tahsilatı (2.4.4 E8: zil ve
      // Tahsilat Takvimi'ndeki "Tahsilat Gir" cariye yazar; söz ve kalem carinin ya da taksitin tahsilatıyla kapanır).
      const payments = caseCollections(store, session, { plans: true }).filter(item => keys.has(item.caseKey));
      const forced = profile.roles ? profile.roles() : null;
      const computed = computeDues({ rows, tabs, payments, settled: readSettled(), now, forced });
      const deadlines = computeDeadlines({ rows, tabs, now, exclude: computed.sources, forced });
      table = { key: tableKey, value: { computed, deadlines } };
      tableCache.set(session, table);
    }
    const { computed, deadlines } = table.value;
    // Taksit kartı olan kişinin (v2.0.8) tablodaki ödeme kalemleri ikinci kez sayılmaz: taksitleri kartından gelir.
    // Ödeme sözü kişiye özel bir taahhüttür, kalır; son tarihi yaklaşan işler (sözleşme, sigorta…) bundan etkilenmez.
    const carded = plans?.linkedCases ? plans.linkedCases(session) : new Set();
    const items = carded.size ? computed.items.filter(item => item.promise || !carded.has(item.caseKey)) : computed.items;
    const dormant = carded.size ? computed.dormant.filter(item => !carded.has(item.caseKey)) : computed.dormant;
    const { sources } = computed;
    const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    // Taksit kartlarının vadesi gelen/geçen taksitleri (v2.0.4) aynı listeye girer: şerit ve bildirimler tek kaynaktan okur.
    // Kart oturumdan bağımsızdır (Kasa gibi); her oturumda görünür.
    const planItems = plans?.dueItems ? plans.dueItems(local) : [];
    // Çek/senet (v2.0.7): vadesi geçen, bugün ve 7 gün içinde tahsil edilecek (alınan) ya da ödenecek (verilen) evrak.
    const chequeItems = cheques?.dueItems ? cheques.dueItems(local) : [];
    // Fatura (v2.0.15): vadesi geçen, bugün ve 7 gün içinde vadesi gelen açık (vadeli) faturalar.
    const invoiceItems = invoices?.dueItems ? invoices.dueItems(local) : [];
    // Planlı banka işlemleri (2.3.0 İz 3.3): planlı tarihi geçen, bugün ve 7 gün içindekiler; deftere girmez, Banka → Hareketler → Planlı İşlemler'den
    // gerçekleştirilir. Yalnız banka rakamını görebilene gider (aşağıdaki süzgeç).
    const bankItems = bankPlans()?.dueItems ? bankPlans().dueItems(local) : [];
    // Öbür sayfaların kalemleri (v2.0.17): aynı motor (reports.calendar), sayfa adıyla; tıklanınca o sayfaya geçilir.
    const foreignItems = [];
    const foreignDeadlines = [];
    const calendarFn = typeof calendar === "function" ? calendar() : null;
    if (pages.length > 1 && typeof calendarFn === "function") {
      try {
        const all = await calendarFn(now);
        for (const item of all.items || []) {
          if (!item.session || item.session === session) continue;
          const tagged = { ...item, foreign: true, pageName: item.sessionName || "" };
          // Kullanıcı kararı "A" (11.10.2026): uyarı ufku bütün sayfalarda aynı. Raporların takvimi ileriye bir yıl bakar
          // (routes/reports.mjs AHEAD); öbür sayfanın son tarihi de açık sayfanınki gibi (computeDeadlines) yalnız son 7 gün kala
          // uyarır. Geçmiş taraf aynı (30 gün); Vade Takip raporu değişmez.
          if (item.deadline) {
            if (item.days <= DUE_WINDOW.aheadDays) foreignDeadlines.push(tagged);
          } else if (!item.carded) foreignItems.push(tagged);
        }
      } catch (error) {
        // öbür sayfalar okunamazsa açık sayfanın takvimi yine verilir
      }
    }
    // 31e A1: borcu birden çok sekmede olan dosya no her sekmede ayrı borç ve ayrı kalemdir (2.4.3 gibi); Tahsilat Takvimi bunu raporlarla aynı notla söyler
    // (zil söylemez). Taksit kartı olan kaydın tablo kalemleri zaten listede yok; notta da sayılmaz.
    const notes = tableNotes({ split: (computed.debtSplit || []).filter(item => !carded.has(item.key)), unresolved: computed.debtUnresolved || [] });
    const result = { items: [...items, ...planItems, ...chequeItems, ...invoiceItems, ...bankItems, ...foreignItems], deadlines: [...deadlines, ...foreignDeadlines], sources, dormant, notes, today: local, generatedAt: now.toISOString() };
    // 2.4.3 H2: içeriğin sürümü (üretim anı hariç her alan). Ekran elindeki sürümü gönderir; içerik değişmediyse büyük yanıt (10.000
    // faturalı veride 2,8 MB) yeniden gönderilmez. Başka personelin her kaydında anahtar değişir ama takvimin içeriği çoğu kez değişmez.
    const { generatedAt: _, ...content } = result;
    result.version = createHash("sha256").update(JSON.stringify(content)).digest("base64url").slice(0, 22);
    cache.set(session, { key, result });
    return result;
  }

  router.get("/api/workspace/dues", async ({ req, res, url }) => {
    const user = auth.requireUser(req);
    const data = await compute();
    // Çek/senet kalemleri yalnız çekleri görebilenlere (kasa yetkisi olanlar) gider.
    // Fatura kalemleri yalnız faturaları görebilenlere.
    // Planlı banka işlemleri yalnız banka rakamını görebilene (bank.view ∨ overview.view; routes/overview.mjs canSeeBank ile aynı kural).
    const see = { cheque: canUser(user, "cheques.view"), invoice: canUser(user, "invoices.view"), bank: canUser(user, "bank.view") || canUser(user, "overview.view") };
    // 2.4.3 H2: sürüm, kişinin görebildiği kalem türlerini de taşır (yetkisi değişen kişi takvimi yeniden alır).
    const version = `${data.version}.${Number(see.cheque)}${Number(see.invoice)}${Number(see.bank)}`;
    if (url.searchParams.get("since") === version) return ok(res, { unchanged: true, version, today: data.today });
    ok(res, { ...data, items: data.items.filter(item => (item.source !== "cheque" || see.cheque) && (item.source !== "invoice" || see.invoice) && (item.source !== "bank" || see.bank)), version });
  });

  // "Ödendi say" / "İptal": kalem, tahsilat girilmeden kapatılır (veri değişmez; kim, ne zaman kaydedilir).
  router.post("/api/workspace/dues/settle", async ({ req, res }) => {
    const user = auth.requirePermission(req, "records.edit");
    const body = await readJson(req);
    const id = text(body.id).slice(0, 600);
    if (!id.startsWith("due|")) throw new HttpError(400, "Kalem tanınmadı.");
    const reason = body.reason === "cancelled" ? "cancelled" : "paid";
    // Öbür sayfanın kalemi (v2.0.17, body.session) o sayfanın kendi "kapatılanlar" ayarına yazılır.
    const pageKey = text(body.session);
    const write = () => {
      const map = readSettled();
      if (body.undo) delete map[id];
      else map[id] = { reason, by: user.id, at: clock().toISOString() };
      let entries = Object.entries(map);
      if (entries.length > MAX_SETTLED) entries = entries.sort((a, b) => String(a[1].at).localeCompare(String(b[1].at))).slice(-MAX_SETTLED);
      store.setSetting(settingKey(), JSON.stringify(Object.fromEntries(entries)), user.id);
    };
    if (pageKey && pageKey !== dataset.currentKey() && dataset.withKey) dataset.withKey(pageKey, write);
    else write();
    cache.clear();
    tableCache.clear();
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
    else map[id] = clock().toISOString();
    // En yeni 3000 kaldırma saklanır; bir yıldan eskiler düşer.
    const cutoff = new Date(clock().getTime() - 400 * 86_400_000).toISOString();
    const entries = Object.entries(map).filter(([, at]) => at >= cutoff).sort((a, b) => a[1].localeCompare(b[1])).slice(-3000);
    store.setSetting(dismissedKey(user), JSON.stringify(Object.fromEntries(entries)), user.id);
    ok(res, { ids: entries.map(([key]) => key) });
  });
}
