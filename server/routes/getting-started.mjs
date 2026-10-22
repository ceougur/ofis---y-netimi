// Başlarken (2.4.4, iş listesi 16 / KÖ3): yöneticinin ilk adımlar listesi. Şirket kapsamlı (HUB_ONLY değil): her şirket (001/002) kendi
// veri dosyasındaki durumu ve kişinin "Gizle" tercihini taşır. Yalnız boole döner; firma, banka, cari ya da entegratör bilgisi dönmez.
import { ensureBaseline, gettingStarted, hiddenKey } from "../lib/getting-started.mjs";
import { ok, readJson } from "../lib/http.mjs";
import { canUser } from "../lib/permissions.mjs";

// Liste yalnız yöneticiye (Sistem, yedek ve güncelleme yetkisi; yerleşik rollerde yalnız Yönetici) gösterilir.
export const GETTING_STARTED_PERMISSION = "system.manage";

export function registerGettingStartedRoutes(router, { auth, store, company = () => null, log }) {
  // Taban, şirketin veri dosyası bu sürümle açılırken bir kez (iş verisi varsa "zaten kurulu").
  try {
    ensureBaseline(store);
  } catch (error) {
    log?.warn?.(`Başlarken tabanı yazılamadı: ${error.message}`);
  }
  const companyName = () => {
    try {
      return company()?.name || "";
    } catch {
      return "";
    }
  };
  router.get("/api/workspace/getting-started", async ({ req, res }) => {
    const user = auth.requireUser(req);
    // Yetkisiz kişi listeyi ve adımlarını hiç görmez (403 yerine boş yanıt: açılışta her kullanıcı için hata bildirimi çıkmasın).
    if (!canUser(user, GETTING_STARTED_PERMISSION)) return ok(res, { allowed: false, show: false, steps: [], done: 0, total: 0, hidden: false, established: false, complete: false });
    ok(res, gettingStarted(store, { userId: user.id, companyName: companyName() }));
  });
  // Gizle / yeniden göster: kişi + şirket başına (yalnız bu kişinin bu şirketteki listesi). Görünüm tercihidir (tanıtım kartını
  // kapatmak gibi); veri değiştirmez, Değişiklik Geçmişi'ne yazılmaz ve salt okunur lisansta da yapılabilir (license.mjs READ_ONLY_ALLOWED).
  router.post("/api/workspace/getting-started", async ({ req, res }) => {
    const user = auth.requirePermission(req, GETTING_STARTED_PERMISSION);
    const body = await readJson(req);
    const hidden = body.hidden === true;
    store.setSetting(hiddenKey(user.id), hidden ? "1" : "0", user.id);
    ok(res, gettingStarted(store, { userId: user.id, companyName: companyName() }));
  });
}
