// Ders 20 — CI #842 (b68aafe, 19.10.2026): gg243-dar-kontrol-gonderim "D2" ara sıra kırmızı ("ön koşul: bir istek öbürünün gönderdiği belgeye
// denk geldi" kurulamadı). Ön koşulu ZORLA kuran betik; ürün kodunu ve test dosyasını DEĞİŞTİRMEZ.
// Mekanizma (koddan, server/routes/invoices.mjs send-pending): ikinci oturum (B) birincinin (A) arkasından releasedWithin'in 100 ms'lik
// yoklamasıyla yürür. A'nın belge başı süresi 100 ms'yi geçince B her belgede A'yı gönderimin ORTASINDA yakalar → B'nin sonuç kodu hep
// "einvoice-sending" (bekle → "başka oturumda gönderildi"; ürün doğru) olur; 2.4.3 testinin ön koşul saydığı "einvoice-already-sent" yolu hiç
// oluşmaz. Yavaş/yüklü koşucuda kendiliğinden olan budur. Betik sahte EDM'ye giden HER SendInvoice isteğini GG243_D2_ZORLA_YAVAS_MS (varsayılan
// 150) ms geciktirir → A'nın belge başı süresi > 100 ms.
//
// İki kullanım:
//   1) Ön yükleme (node --import): yalnız gecikmeyi kurar; süreç çıkışında kaç isteğin geciktirildiğini yazar.
//        GG243_D2_ZORLA_YAVAS_MS=150 node --disable-warning=ExperimentalWarning --import ./test/gg243-d2-yaris.mjs --test --test-name-pattern "^D2 \(" \
//          test/gg243-dar-kontrol-gonderim.test.mjs
//   2) Deneme koşucusu (doğrudan): D2 testlerini TRIALS kez (varsayılan 10) ayrı süreçte koşar; her denemede gecikmenin GERÇEKTEN uygulandığını
//      (ön koşul oluştu) sayar ve node:test biçiminde toplam yazar (tools/kanit.mjs kos okur). Test dosyası çalışma klasörüne göredir.
//        GG243_D2_ZORLA_YAVAS_MS=150 TRIALS=10 node test/gg243-d2-yaris.mjs [test/gg243-dar-kontrol-gonderim.test.mjs]
//      GG243_D2_ZORLA_YAVAS_MS=0: gecikme yok (doğal koşu).
// Beklenen: 2.4.3 testi (163dd5d) zorlamayla her denemede kırmızı (ön koşul iddiası); 2.4.4 testi (olay sırasına bağlı) her denemede yeşil.
// Ders 20: yeşil yalnız ön koşulun oluştuğu (gecikmenin her SendInvoice'a uygulandığı) denemede sayılır; oluşmayan deneme GEÇERSİZ yazılır.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SELF = fileURLToPath(import.meta.url);
const delayMs = Number(process.env.GG243_D2_ZORLA_YAVAS_MS ?? 150);
const direct = process.argv[1] && path.resolve(process.argv[1]) === SELF;
const REPORT = /\[gg243-d2-yaris\] pid \d+: SendInvoice gecikmesi (\d+) ms, geciktirilen istek (\d+)/g;

if (!direct) {
  const realFetch = globalThis.fetch;
  let delayed = 0;
  globalThis.fetch = async (input, init) => {
    if (delayMs > 0 && /SendInvoiceRequest/.test(String(init?.body || ""))) {
      delayed += 1;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return realFetch(input, init);
  };
  process.on("exit", () => {
    process.stderr.write(`[gg243-d2-yaris] pid ${process.pid}: SendInvoice gecikmesi ${delayMs} ms, geciktirilen istek ${delayed}\n`);
  });
} else {
  const file = process.argv[2] || "test/gg243-dar-kontrol-gonderim.test.mjs";
  const trials = Math.max(1, Number(process.env.TRIALS || 10));
  const count = (text, key) => Number(text.match(new RegExp(`^# ${key} (\\d+)\\r?$`, "m"))?.[1] ?? NaN);
  const totals = { tests: 0, pass: 0, fail: 0, cancelled: 0, skipped: 0, todo: 0 };
  let formed = 0;
  let invalid = 0;
  console.log(`# gg243 D2 yarış denemesi: ${trials} deneme, SendInvoice gecikmesi ${delayMs} ms, dosya ${file}, çalışma klasörü ${process.cwd()}`);
  for (let i = 1; i <= trials; i += 1) {
    const run = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--import", SELF, "--test", "--test-name-pattern", "^D2 \\(", file], {
      encoding: "utf8",
      env: { ...process.env, GG243_D2_ZORLA_YAVAS_MS: String(delayMs), HUKUK_LICENSE_URL: "http://127.0.0.1:9" },
      maxBuffer: 64 * 1024 * 1024,
    });
    const out = `${run.stdout || ""}${run.stderr || ""}`;
    const tests = count(out, "tests");
    const pass = count(out, "pass");
    const fail = count(out, "fail");
    // Test süreci (node:test alt süreci) kaç SendInvoice'u geciktirdi: her D2 testinde en az 6 gönderim var (iki test → ≥ 12).
    const delayed = Math.max(0, ...[...out.matchAll(REPORT)].map(m => Number(m[2])));
    const ok = Number.isFinite(tests) && tests === 2 && run.status !== null;
    const condition = delayMs === 0 ? "doğal koşu" : delayed >= 12 ? "ön koşul OLUŞTU" : "ön koşul OLUŞMADI";
    const valid = ok && (delayMs === 0 || delayed >= 12);
    const names = [...out.matchAll(/^\s*(ok|not ok) \d+ - (D2 \((?:all|ids)\))/gm)].map(m => `${m[2]} ${m[1] === "ok" ? "GEÇTİ" : "KALDI"}`);
    console.log(`deneme ${i}/${trials}: çıkış ${run.status}, geciktirilen SendInvoice ${delayed} → ${condition}${valid ? "" : " — GEÇERSİZ (sayılmaz)"}; ${names.join(", ") || "test sonucu okunamadı"}`);
    // Başarısız testin nedeni (node:test YAML'ı; çok satırlı ileti "error: |-" altındaki ilk satırdır) — düşen iddia ve sonucun kimin olduğu okunur.
    const lines = out.split(/\r?\n/);
    lines.forEach((line, at) => {
      const m = line.match(/^\s+error: (.*)$/);
      if (!m) return;
      const reason = /^[|>]-?$/.test(m[1].trim()) ? lines.slice(at + 1).find(next => next.trim()) || "" : m[1];
      console.log(`    error: ${reason.trim().slice(0, 600)}`);
    });
    if (!valid) {
      invalid += 1;
      continue;
    }
    if (delayMs > 0) formed += 1;
    for (const key of Object.keys(totals)) totals[key] += count(out, key) || 0;
    if (pass + fail !== tests) totals.fail += 1;
  }
  if (delayMs > 0) console.log(`# ön koşul oluşan deneme ${formed}/${trials}`);
  console.log(`# geçersiz deneme ${invalid}`);
  for (const [key, value] of Object.entries(totals)) console.log(`# ${key} ${value}`);
  process.exit(totals.fail || invalid || totals.cancelled || !totals.tests ? 1 : 0);
}
