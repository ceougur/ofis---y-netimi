// BİRLEŞİK TUR 4 mutasyon koşucusu: bt4-mut kopyasında (ccbf7812 + tur 4 dosyaları) her mutantı uygular, ilgili testi koşar, dosyayı bt4-mut-orijinal'den geri yükler.
// Kullanım: node mutasyon.mjs <birim|e2e|hepsi|<kimlik öneki>>
// Tur 3'ün 18 mutantı (M1–M9 birim, C1–C8 + M-yinele e2e; docs/kanit/2026-11-06/bir-tur3-ham/mutasyon.mjs) aynen + dar kontrolün N6'sı + tur 4'ün yenileri (K1–K12).
import { readFileSync, writeFileSync, copyFileSync, appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const S = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad";
const ROOT = path.join(S, "bt4-mut");
const ORIG = path.join(S, "bt4-mut-orijinal");
const OUT = path.join(S, "bt4-kanit", "mutasyon.out");
const which = process.argv[2] || "hepsi";
const UNIT = ["node", ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", "test/birlesik-tur3-yaris-250.test.mjs", "test/birlesik-tur4-degisiklik-yok-250.test.mjs"]];
const E2E3 = ["node", ["--disable-warning=ExperimentalWarning", "test/e2e/senaryo-duzeltme-kilidi-tur3-250.mjs"]];
const E2E2 = ["node", ["--disable-warning=ExperimentalWarning", "test/e2e/senaryo-duzeltme-kilidi-250.mjs"]];
const ITEM_CUT = '      if (sameFields(previous, input, { texts: ["dueDate", "note"], numbers: ["amount"] })) return false;\n      assertRowVersion(body, rowVersion(store, "plan_items", previous.id), ITEM_STALE);\n';
const PLAN_CUT_LINE = 'if (sameAccount && status === previous.status && sameFields(previous, input, { texts: ["name", "phone", "note", "refNo", "registeredOn", "caseKey", "caseSource", "caseTitle", "groupId", "subgroupId"], numbers: ["total"] })) return detail(previous.id, user);';
const STOCK_CUT_LINE = 'if (sameFields(previous, input, { texts: ["kind", "code", "name", "unit", "category", "vatRate", "note"], numbers: ["minQty", "unitPrice", "salePrice"] })) return detail(previous.id, user);';
const M = [
  // ---- tur 3 (aynen) ----
  { id: "M1 açılış: güncelleme yolunda erken sürüm denetimi yok", kind: "birim", file: "server/routes/cash.mjs", from: "    assertOpeningVersion(body, existing);\n", to: "\n" },
  { id: "M2 açılış: güncelleme yolunda işlem içi (prepare) sürüm denetimi yok", kind: "birim", file: "server/routes/cash.mjs", from: "        assertOpeningVersion(body, cashOpenings(store)[0] || null);\n        assertOpening(user, entry, existing.id);", to: "        assertOpening(user, entry, existing.id);" },
  { id: "M3 açılış: openingId (kimlik) denetimi yok", kind: "birim", file: "server/routes/cash.mjs", from: 'if (Object.hasOwn(body, "openingId") && body.openingId', to: 'if (false && Object.hasOwn(body, "openingId") && body.openingId' },
  { id: "M4 kart: sürüm isteğin başında okunan kartla (işlem içi değil)", kind: "birim", file: "server/routes/plans.mjs", from: "assertRowVersion(body, previous, PLAN_STALE);", to: "assertRowVersion(body, opened, PLAN_STALE);" },
  { id: "M5 kart: sürüm denetimi yok", kind: "birim", file: "server/routes/plans.mjs", from: "assertRowVersion(body, previous, PLAN_STALE);", to: "" },
  { id: "M6 taksit: sürüm denetimi yok", kind: "birim", file: "server/routes/plans.mjs", from: 'assertRowVersion(body, rowVersion(store, "plan_items", previous.id), ITEM_STALE);', to: "" },
  { id: "M7 taksit: kart yanıtında taksit sürümü yok", kind: "birim", file: "server/routes/plans.mjs", from: "note, updated_at AS updatedAt FROM plan_items WHERE plan_id = ? ORDER BY due_date, seq", to: "note FROM plan_items WHERE plan_id = ? ORDER BY due_date, seq" },
  { id: "M8 stok kartı: sürüm denetimi yok", kind: "birim", file: "server/routes/stock.mjs", from: "assertRowVersion(body, previous, ITEM_STALE);", to: "" },
  { id: "M9 stok kartı: sürüm isteğin başında okunan kartla", kind: "birim", file: "server/routes/stock.mjs", from: "assertRowVersion(body, previous, ITEM_STALE);", to: "assertRowVersion(body, opened, ITEM_STALE);" },
  { id: "C1 Açılış formu sürüm göndermez", kind: "e2e3", file: "client/assets/hof-workspace.js", from: 'const body = { ...data, openingId: current?.id || "", updatedAt: current ? current.updatedAt || "" : "" };', to: "const body = { ...data };" },
  { id: "C2 Açılış formu 409'da Kasa listesini yenilemez", kind: "e2e3", file: "client/assets/hof-workspace.js", from: 'if (error?.status === 409 && error?.data?.code === "cash-opening-stale") after?.();', to: "" },
  { id: "C3 taksit formu sürüm göndermez", kind: "e2e3", file: "client/assets/hof-plans.js", from: 'body: item ? { ...data, updatedAt: item.updatedAt || "" } : data', to: "body: data" },
  { id: "C4 taksit formu 409'da kartı yenilemez", kind: "e2e3", file: "client/assets/hof-plans.js", from: 'if (item && ((error?.status === 409 && error?.data?.code === "plan-item-stale") || error?.status === 404) && modal) loadPlan(plan.id, { quiet: true }).catch(() => null);', to: "" },
  { id: "C5 kart formu sürüm göndermez", kind: "e2e3", file: "client/assets/hof-plans.js", from: 'if (plan) payload.updatedAt = plan.updatedAt || "";', to: "" },
  { id: "C6 stok kartı formu sürüm göndermez", kind: "e2e3", file: "client/assets/hof-stock.js", from: 'body: { ...data, updatedAt: item.updatedAt || "" } }', to: "body: data }" },
  { id: "C7 stok kartı formu 409'dan sonra kendiliğinden bir kez yeniden gönderir", kind: "e2e3", file: "client/assets/hof-stock.js", from: 'loadItem(item.id, { quiet: true }).catch(() => null);\n          throw error;\n        }\n        if (!item && data.openingPay === "cash")', to: 'loadItem(item.id, { quiet: true }).catch(() => null);\n          if (item && error?.data?.code === "stock-item-stale") await HOF.api(`/api/workspace/stock/${encodeURIComponent(item.id)}`, { method: "PUT", body: { ...data, updatedAt: item.updatedAt || "" } }).catch(() => null);\n          throw error;\n        }\n        if (!item && data.openingPay === "cash")' },
  { id: "C8 eksi stok onayından sonraki 409'da kart yenilenmez (3b eski hâl)", kind: "e2e3", file: "client/assets/hof-stock.js", from: "            if (staleOrGone(again)) refreshCard();\n", to: "" },
  { id: "M-yinele cari formu 409'dan sonra kendiliğinden bir kez yeniden gönderir", kind: "e2e2", file: "client/assets/hof-accounts.js", from: 'if (entry && ((error?.status === 409 && error?.data?.code === "account-entry-stale") || error?.status === 404) && modal && view.mode === "card" && view.id === account.id) loadAccount(account.id, { quiet: true }).catch(() => null);\n', to: 'if (entry && ((error?.status === 409 && error?.data?.code === "account-entry-stale") || error?.status === 404) && modal && view.mode === "card" && view.id === account.id) loadAccount(account.id, { quiet: true }).catch(() => null);\n          if (entry && error?.status === 409 && error?.data?.code === "account-entry-stale") await send({}).catch(() => null);\n' },
  // ---- tur 3 dar kontrolü N6 ----
  { id: "N6 istemci: Kasa 'Yine de Kaydet' yeniden gönderimi sürümü düşürür (hof-core)", kind: "e2e3", file: "client/assets/hof-core.js", from: "body: { ...body, cashForce: true, negativeOk: body.negativeOk === true }", to: "body: { ...body, updatedAt: undefined, openingId: undefined, cashForce: true, negativeOk: body.negativeOk === true }" },
  { id: "N6b istemci: yeniden gönderim yalnız updatedAt'i düşürür (openingId kalır)", kind: "e2e3", file: "client/assets/hof-core.js", from: "body: { ...body, cashForce: true, negativeOk: body.negativeOk === true }", to: "body: { ...body, updatedAt: undefined, cashForce: true, negativeOk: body.negativeOk === true }" },
  // ---- tur 4 yenileri ----
  { id: "K1 taksit: kısa yol sürüm denetiminden SONRA", kind: "birim", file: "server/routes/plans.mjs", from: ITEM_CUT, to: '      assertRowVersion(body, rowVersion(store, "plan_items", previous.id), ITEM_STALE);\n      if (sameFields(previous, input, { texts: ["dueDate", "note"], numbers: ["amount"] })) return false;\n' },
  { id: "K2 kart: kısa yol sürüm denetiminden SONRA", kind: "birim", file: "server/routes/plans.mjs", from: `${PLAN_CUT_LINE}\n      assertRowVersion(body, previous, PLAN_STALE);`, to: `assertRowVersion(body, previous, PLAN_STALE);\n      ${PLAN_CUT_LINE}` },
  { id: "K3 stok: kısa yol sürüm denetiminden SONRA", kind: "birim", file: "server/routes/stock.mjs", from: `${STOCK_CUT_LINE}\n      assertRowVersion(body, previous, ITEM_STALE);`, to: `assertRowVersion(body, previous, ITEM_STALE);\n      ${STOCK_CUT_LINE}` },
  { id: "K4 taksit: kısa yol işlemin dışında okunan taksitle (isteğin başı + erken girdi)", kind: "birim", file: "server/routes/plans.mjs", from: 'if (sameFields(previous, input, { texts: ["dueDate", "note"]', to: 'if (sameFields(opened, early, { texts: ["dueDate", "note"]' },
  { id: "K5 kart: kısa yol isteğin başında (işlem dışında) okunan kartla", kind: "birim", file: "server/routes/plans.mjs", from: 'sameFields(previous, input, { texts: ["name", "phone"', to: 'sameFields(opened, input, { texts: ["name", "phone"' },
  { id: "K6 stok: kısa yol isteğin başında (işlem dışında) okunan kartla", kind: "birim", file: "server/routes/stock.mjs", from: 'sameFields(previous, input, { texts: ["kind"', to: 'sameFields(opened, input, { texts: ["kind"' },
  { id: "K7 taksit: kısa yol açıklamayı karşılaştırmaz (farklı içeriği 200 sayar)", kind: "birim", file: "server/routes/plans.mjs", from: 'texts: ["dueDate", "note"]', to: 'texts: ["dueDate"]' },
  { id: "K8 kart: kısa yol telefonu karşılaştırmaz", kind: "birim", file: "server/routes/plans.mjs", from: 'texts: ["name", "phone", "note"', to: 'texts: ["name", "note"' },
  { id: "K8b kart: kısa yol notu karşılaştırmaz", kind: "birim", file: "server/routes/plans.mjs", from: 'texts: ["name", "phone", "note", "refNo"', to: 'texts: ["name", "phone", "refNo"' },
  { id: "K9 stok: kısa yol KDV oranını karşılaştırmaz", kind: "birim", file: "server/routes/stock.mjs", from: '"category", "vatRate", "note"]', to: '"category", "note"]' },
  { id: "K9b stok: kısa yol Alış Fiyatı'nı karşılaştırmaz", kind: "birim", file: "server/routes/stock.mjs", from: 'numbers: ["minQty", "unitPrice", "salePrice"]', to: 'numbers: ["minQty", "salePrice"]' },
  { id: "K10 sameFields: sayıları hiç karşılaştırmaz", kind: "birim", file: "server/lib/row-version.mjs", from: "for (const key of numbers)", to: "for (const key of [])" },
  { id: "K11 kart: carisiz eski kart da kısa yola girer", kind: "birim", file: "server/routes/plans.mjs", from: "const sameAccount = Boolean(previous.accountId) && (input.accountId || previous.accountId) === previous.accountId;", to: "const sameAccount = (input.accountId || previous.accountId) === previous.accountId;" },
  { id: "K12 kart: kısa yol durumu (Kartı Kapat) karşılaştırmaz", kind: "birim", file: "server/routes/plans.mjs", from: "if (sameAccount && status === previous.status && sameFields", to: "if (sameAccount && sameFields" },
];
const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: path.join(S, "pw-1194"), TZ: "UTC", HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
const log = line => {
  console.log(line);
  appendFileSync(OUT, `${line}\n`);
};
log(`--- mutasyon ${new Date().toISOString()} (${which})`);
let dead = 0;
let alive = 0;
for (const m of M) {
  if (which === "birim" ? m.kind !== "birim" : which === "e2e" ? !m.kind.startsWith("e2e") : which !== "hepsi" && !m.id.startsWith(which)) continue;
  const file = path.join(ROOT, m.file);
  const original = path.join(ORIG, m.file);
  const source = readFileSync(original, "utf8");
  const count = source.split(m.from).length - 1;
  if (count !== 1) {
    log(`${m.id}: UYGULANAMADI (desen ${count} kez)`);
    alive += 1;
    continue;
  }
  writeFileSync(file, source.replace(m.from, m.to));
  const [cmd, args] = m.kind === "birim" ? UNIT : m.kind === "e2e3" ? E2E3 : E2E2;
  const run = spawnSync(cmd, args, { cwd: ROOT, env, encoding: "utf8", timeout: 1200000, maxBuffer: 64 * 1024 * 1024 });
  copyFileSync(original, file);
  const text = `${run.stdout}\n${run.stderr}`;
  const fails = m.kind === "birim" ? (/# fail (\d+)/.exec(text)?.[1] ?? "?") : (/(\d+) geçti, (\d+) kaldı/.exec(text)?.[2] ?? "?");
  const first = m.kind === "birim" ? text.split("\n").filter(l => /^\s+not ok \d+ - /.test(l)).slice(0, 3).map(l => l.trim().slice(0, 150)) : text.split("\n").filter(l => l.includes("✗")).slice(0, 4).map(l => l.trim().slice(0, 170));
  if (run.status === 0) alive += 1;
  else dead += 1;
  log(`${m.id}: ${run.status === 0 ? "YAŞADI" : "ÖLDÜ"} (çıkış ${run.status}; kırmızı ${fails}) ${JSON.stringify(first)}`);
}
log(`=== ${which}: ÖLDÜ ${dead}, YAŞADI / UYGULANAMADI ${alive}`);
