// Maliyet Hesap Kartı API'si (2.4.6 madde 1–3). Stok penceresindeki kart; YALNIZ şirketin sektörü "Duşakabin Üretimi" iken açılır (kullanıcı kararı 25.10.2026:
// "sadece duşakabin sektörü seçilince çıksın"); Pro kilidi YOK. Sektör şirketin kendi veri dosyasındadır (lib/profile.mjs insight.sector; her şirket ayrı).
// Sektör dışında uçlar 403 "maliyet-sector" verir; veri SİLİNMEZ, sektör yeniden seçilince aynen döner.
//
// Yetki (kullanıcı kararı 25.10.2026, Personel Özlük düzeni): görüntüleme maliyet.view, Kaydet maliyet.manage (görüntülemeyle birlikte); varsayılan YALNIZ
// yönetici, kişiye ya da özel role verilir. Yetkisiz kullanıcıda bütün uçlar (durum dahil) 403; Stok penceresindeki giriş görünmez. Hiçbir para / stok / cari / kasa / fatura / defter tablosuna
// dokunmaz (lib/maliyet/depo.mjs; test/maliyet-bagsizlik.test.mjs).
//
// Uçlar:
//   GET  /api/maliyet/durum   → { acik, sektor: { id, ad }, canManage }                         (sektörden bağımsız; ekran düğmeyi buna göre gösterir)
//   GET  /api/maliyet         → { sekmeler: [{ kod, ad, rev, kartlar: [kod] }], kartlar: { kod: görünüm }, canManage }   (ilk açılışta şablon kurulur)
//   POST /api/maliyet/onizle  → { kartlar: { kod: görünüm } }        gövde Kaydet'inkiyle aynı; hiçbir şey yazılmaz (canlı hesap)
//   POST /api/maliyet/pdf     → PDF (2.4.7)   gövde { sekme, kartlar?, sekmeler? } (ekrandaki taslak); bir sekmenin kartları ekrandaki değerlerle; yazılmaz
//   PUT  /api/maliyet         → { degisen: { kartlar, sekmeler }, sekmeler, kartlar }   gövde { sekmeler?: [{ kod, rev, ad }], kartlar: [{ kod, rev, …değişiklik }] }
// Hatalar: 400 maliyet-invalid / maliyet-bolen ("Bölen 0 olamaz."), 403 maliyet-sector, 404 maliyet-missing, 409 maliyet-stale.
import { HttpError, ok, readJson, sendBuffer } from "../lib/http.mjs";
import { sectorById } from "../lib/insight/sectors.mjs";
import { createMaliyetDepo } from "../lib/maliyet/depo.mjs";
import { maliyetPdf } from "../lib/maliyet/pdf.mjs";
import { createReportHeader } from "../lib/report-header.mjs";
import { systemClock } from "../lib/clock.mjs";

const BASE = "/api/maliyet";
export const MALIYET_SEKTOR = "dusakabin";

export function registerMaliyetRoutes(router, { auth, store, audit, events, access, profile, now = systemClock }) {
  const depo = createMaliyetDepo({ store, now: () => (typeof now === "function" ? now() : new Date()) });
  // PDF başlığı rapor PDF'leri gibi Tabela Adı ayarından (2.4.5 madde 6c); yalnız firma adı okunur.
  const header = createReportHeader({ store });
  const sektor = () => {
    const current = profile.profile().sector;
    return { id: current.id, ad: current.name, acik: Boolean(sectorById(current.id)?.modules?.maliyet) };
  };
  const canManage = user => (user.perms instanceof Set ? user.perms.has("maliyet.manage") : Boolean(access?.can(user, "maliyet.manage")));
  const acikOlmali = () => {
    const current = sektor();
    if (!current.acik) throw new HttpError(403, "Maliyet Hesap Kartı yalnız sektörü Duşakabin Üretimi olan şirkette açılır.", { code: "maliyet-sector", sektor: current.id });
    // Şablon ilk açılışta bir kez kurulur; eksik kart (sonraki sürümün eklediği) da eklenir, var olana dokunulmaz.
    depo.kur();
  };
  const viewer = req => {
    const user = auth.requirePermission(req, "maliyet.view");
    acikOlmali();
    return user;
  };
  const editor = req => {
    const user = auth.requirePermission(req, "maliyet.manage");
    auth.requirePermission(req, "maliyet.view");
    acikOlmali();
    return user;
  };

  router.get(`${BASE}/durum`, async ({ req, res }) => {
    const user = auth.requirePermission(req, "maliyet.view");
    const current = sektor();
    ok(res, { acik: current.acik, sektor: { id: current.id, ad: current.ad }, canManage: canManage(user) });
  });

  router.get(BASE, async ({ req, res }) => {
    const user = viewer(req);
    ok(res, { ...depo.hepsi(), canManage: canManage(user) });
  });

  router.post(`${BASE}/onizle`, async ({ req, res }) => {
    viewer(req);
    const body = await readJson(req, { limit: 2_000_000 });
    ok(res, depo.onizle(body));
  });

  router.post(`${BASE}/pdf`, async ({ req, res }) => {
    const user = viewer(req);
    const body = await readJson(req, { limit: 2_000_000 });
    const { ad, kartlar } = depo.pdfVerisi(body, body?.sekme);
    const at = typeof now === "function" ? now() : new Date();
    const pdf = maliyetPdf({ sekme: ad, kartlar, userName: user.display_name || user.username || "", now: at, ...header.pdf({ brand: store.setting("office.name", "") }) });
    // Değer yazılmaz (müşterinin maliyet / fiyat bilgisi işlem geçmişine çıkmaz); yalnız hangi sekme.
    audit(user, "maliyet.pdf", "maliyet", { sekme: String(body?.sekme || "").slice(0, 40) });
    const pad = value => String(value).padStart(2, "0");
    sendBuffer(res, pdf, { type: "application/pdf", name: `${ad} ${pad(at.getDate())}.${pad(at.getMonth() + 1)}.${at.getFullYear()}.pdf` });
  });

  router.put(BASE, async ({ req, res }) => {
    const user = editor(req);
    const body = await readJson(req, { limit: 2_000_000 });
    const result = depo.kaydet(body, user);
    const { kartlar, sekmeler } = result.degisen;
    if (kartlar.length || sekmeler.length) {
      // Değer yazılmaz (müşterinin maliyet / fiyat bilgisi işlem geçmişine çıkmaz); yalnız hangi kart / sekme.
      audit(user, "maliyet.saved", "maliyet", { kartlar, sekmeler });
      events?.publish("workspace.changed", { kind: "maliyet", kartlar, sekmeler, actorId: user.id, actorName: user.display_name }, { except: user.id });
    }
    ok(res, { ...result, canManage: true });
  });
}
