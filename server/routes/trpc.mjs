// Arayüz paketinin beklediği tRPC uyumlu uç: /api/trpc/sheets.getRows
// Sunucu kaynak satırlarına ofisin düzeltmelerini uygulayıp birleşik görünümü döndürür.
import { SECURITY_HEADERS, parseJson, send } from "../lib/http.mjs";

const parseInput = raw => {
  if (!raw) return {};
  const direct = parseJson(raw, null);
  if (direct) return direct;
  try {
    return parseJson(decodeURIComponent(raw), {});
  } catch {
    return {};
  }
};

export function registerTrpcRoutes(router, { auth, sources }) {
  router.get("/api/trpc/sheets.getRows", async ({ req, res, url }) => {
    const batch = url.searchParams.get("batch") === "1";
    const wrap = payload => send(res, 200, batch ? [payload] : payload);
    const user = auth.currentUser(req);
    if (!user || user.must_change_password) {
      const error = { error: { json: { message: "Oturum gerekli.", code: -32001, data: { code: "UNAUTHORIZED", httpStatus: 401 } } } };
      return send(res, 401, batch ? [error] : error, SECURITY_HEADERS);
    }
    const input = parseInput(url.searchParams.get("input"));
    const batchInput = input?.json || input?.["0"]?.json || input?.[0]?.json || input?.["0"] || input?.[0] || {};
    const sheetUrl = String(batchInput.sheetUrl || input?.sheetUrl || "").trim();
    const result = await sources.view(sheetUrl);
    return wrap({ result: { data: { json: result } } });
  });
}
