// Arayüz paketinin beklediği tRPC uyumlu uç: /api/trpc/sheets.getRows
// Arayüz hangi kaynak adresini gönderirse göndersin ofisin kalıcı çalışma verisi döner (v1.5.0): içeri alınan
// satırlara ofisin düzeltmeleri uygulanmış, silinenler çıkarılmış, yeni kayıtlar eklenmiş birleşik görünüm.
import { SECURITY_HEADERS, send } from "../lib/http.mjs";

export function registerTrpcRoutes(router, { auth, dataset }) {
  router.get("/api/trpc/sheets.getRows", async ({ req, res, url }) => {
    const batch = url.searchParams.get("batch") === "1";
    const wrap = payload => send(res, 200, batch ? [payload] : payload);
    const user = auth.currentUser(req);
    if (!user || user.must_change_password) {
      const error = { error: { json: { message: "Oturum gerekli.", code: -32001, data: { code: "UNAUTHORIZED", httpStatus: 401 } } } };
      return send(res, 401, batch ? [error] : error, SECURITY_HEADERS);
    }
    const result = await dataset.view();
    return wrap({ result: { data: { json: result } } });
  });
}
