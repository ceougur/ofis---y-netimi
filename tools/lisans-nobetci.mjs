#!/usr/bin/env node
// Lisans nöbetçisi (2.4.4 E9, ders 30). GitHub'ın Windows koşucusunda GERÇEK kurulum paketi Windows servisi olarak kurulur
// (.github/workflows/windows.yml install-test); servisin ortamı nssm'den gelir (packaging/windows/bin/servis-kur.cmd
// AppEnvironmentExtra), adımın `env:`'i servise GEÇMEZ → HUKUK_LICENSE_URL verilemez ve program açılıştan 3 sn sonra gerçek
// lisans servisine kendiliğinden deneme kaydı atar (Operatör Merkezi'nde Azure adresli "2.4.5" = test/guncelleme-gercek/windows-kurulum.mjs
// kurulu sürüm + 2). Ürün kodu ve kurulum betiği DEĞİŞMEZ; engel koşucu makinesinde kurulur:
//   engelle  lisans servisinin adlarını (server/lib/license.mjs DEFAULT_LICENSE_SERVICES'ten; elle liste kaymasın) hosts dosyasında yerel
//            adrese yönlendirir, DNS önbelleğini boşaltır ve adların programın kullandığı çözümleyiciyle (getaddrinfo) yalnız yerel adrese
//            çözüldüğünü doğrular; doğrulanamazsa çıkış 1 (kurulum adımı hiç başlamaz).
//   dogrula  yalnız çözümleme denetimi (iş sonunda engelin yerinde kaldığını gösterir).
//   denetle  kurulu programa yönetici olarak sorar (GET /api/license): kendiliğinden deneme EN AZ BİR KEZ denendi ve AĞ hatasıyla düştü,
//            durum "none" (deneme/lisans yok). Program servise ulaştıysa (durum trial/licensed ya da beklenmeyen yanıt) çıkış 1.
//   gunluk   programın günlüklerinde servise ulaşan deneme (başladı / durum → trial|licensed) satırı yok ve en az bir "başlatılamadı" satırı var
//            (günlüklerin gerçekten okunduğunun kanıtı); hiçbir günlük okunamazsa "okunamadı" → çıkış 1 (ders 4).
// Bu araç ağa yalnız --adres ile verilen yerel programa ve çözümleme denetimine çıkar; lisans servisine istek ATMAZ.
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { lookup } from "node:dns/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_LICENSE_SERVICES } from "../server/lib/license.mjs";

export const MARKER = "# DestekOfis CI lisans engeli (ders 30; tools/lisans-nobetci.mjs)";
const LOOPBACK = new Set(["127.0.0.1", "::1"]);
// server/lib/license.mjs networkMessage: ağ hatasının program tarafından yazılan metinleri. "beklenmeyen yanıt" ya da imza hatası
// burada YOK: o metinler bir sunucuya ulaşıldığını gösterir.
export const NETWORK_ERROR = /Lisans servisine ulaşılamadı|lisans servisinin adı çözülemedi|Lisans servisi zamanında yanıt vermedi|Güvenli bağlantı doğrulanamadı/;
// Günlük satırları (server/lib/license.mjs log.info/warn). Türkçe harfler nssm/kod sayfası yüzünden bozulsa da eşleşsin diye harf yerine .{1,4}.
export const REACHED_LINES = [/deneme kendili.{1,4}inden ba.{1,4}lad/, /Lisans durumu: \S+ \S{1,4} (?:trial|licensed)\b/];
export const BLOCKED_LINE = /deneme ba.{1,4}lat.{1,4}lamad/;

export const defaultHostsFile = () => path.join(process.env.SystemRoot || "C:\\Windows", "System32", "drivers", "etc", "hosts");
export const licenseHostnames = (services = DEFAULT_LICENSE_SERVICES) => [...new Set(services.map(url => new URL(url).hostname))];
export const hostsLines = names => names.flatMap(name => [`127.0.0.1 ${name}`, `::1 ${name}`]);

// hosts dosyasına eksik satırları ekler (yinelenmez); eklenen satırları döner.
export function writeHostsBlock(file, names) {
  const existing = existsSync(file) ? readFileSync(file, "utf8") : "";
  const present = new Set(existing.split(/\r?\n/).map(line => line.trim().replace(/\s+/g, " ")));
  const missing = hostsLines(names).filter(line => !present.has(line));
  if (!missing.length) return [];
  const lead = existing && !/\r?\n$/.test(existing) ? "\r\n" : "";
  appendFileSync(file, `${lead}${present.has(MARKER) ? "" : `${MARKER}\r\n`}${missing.join("\r\n")}\r\n`);
  return missing;
}

// Adların programın çözümleyicisiyle (dns.lookup → getaddrinfo, hosts dosyasına uyar) yalnız yerel adrese çözüldüğünü denetler.
export async function verifyBlocked(names, resolve = name => lookup(name, { all: true, verbatim: true })) {
  const results = [];
  for (const name of names) {
    let addresses;
    try {
      addresses = (await resolve(name)).map(item => item.address);
    } catch (error) {
      // Çözülemeyen ad da servise ulaşamaz; yine de hosts engeli tutmamış demektir → bildirilir, başarısızlık sayılır (engel kanıtlanmadı).
      results.push({ name, ok: false, reason: `çözülemedi (${error.code || error.message}); hosts engeli doğrulanamadı` });
      continue;
    }
    const outside = addresses.filter(address => !LOOPBACK.has(address));
    results.push({ name, addresses, ok: addresses.length > 0 && outside.length === 0, reason: outside.length ? `yerel olmayan adres: ${outside.join(", ")}` : null });
  }
  return results;
}

// GET /api/license (yönetici) yanıtının hükmü: "pending" (deneme henüz yapılmadı) | "ok" | "fail".
export function judgeLicenseSummary(data) {
  if (!data || typeof data !== "object") return { verdict: "fail", reason: "lisans özeti okunamadı" };
  if (data.state !== "none") return { verdict: "fail", reason: `lisans durumu "${data.state}" — program lisans servisine ULAŞTI (gerçek Operatör Merkezi'ne kayıt düşmüş olabilir)` };
  if (data.licenseId) return { verdict: "fail", reason: `lisans kimliği var (${data.licenseId}) — servisten belirteç alınmış` };
  if (data.enforced === false) return { verdict: "fail", reason: "lisans uygulaması kapalı; kurulu program üretim gibi çalışmıyor, nöbetçi bir şey kanıtlamaz" };
  const auto = data.autoTrial;
  if (!auto) return { verdict: "fail", reason: "kendiliğinden deneme bilgisi yok (belirteç ya da geçiş dönemi var)" };
  if (!(auto.attempts >= 1) || !auto.lastError) return { verdict: "pending", reason: `deneme sayısı ${auto.attempts ?? "?"}, son hata ${auto.lastError ?? "yok"}` };
  if (!NETWORK_ERROR.test(auto.lastError)) return { verdict: "fail", reason: `son hata ağ hatası değil (sunucuya ulaşılmış olabilir): ${auto.lastError}` };
  return { verdict: "ok", reason: `${auto.attempts} deneme, son hata: ${auto.lastError}` };
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 300) };
  }
}

export async function checkInstalledProgram({ base, username, password, timeoutMs = 60_000, intervalMs = 1_000, fetchImpl = globalThis.fetch }) {
  const login = await fetchImpl(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
  const loginBody = await readJson(login);
  if (login.status !== 200) return { verdict: "fail", reason: `yönetici girişi ${login.status} ${JSON.stringify(loginBody).slice(0, 200)}` };
  const cookie = (login.headers.getSetCookie?.() || [login.headers.get("set-cookie")]).filter(Boolean).map(item => item.split(";")[0]).join("; ");
  const deadline = Date.now() + timeoutMs;
  let last = { verdict: "fail", reason: "lisans özeti hiç okunmadı" };
  let summary = null;
  for (;;) {
    const response = await fetchImpl(`${base}/api/license`, { headers: { cookie } });
    const body = await readJson(response);
    summary = body?.data ?? null;
    last = response.status === 200 ? judgeLicenseSummary(summary) : { verdict: "fail", reason: `GET /api/license ${response.status}` };
    if (last.verdict !== "pending" || Date.now() >= deadline) break;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  if (last.verdict === "pending") last = { verdict: "fail", reason: `${Math.round(timeoutMs / 1000)} sn içinde kendiliğinden deneme görülmedi (${last.reason}); engelin tuttuğu kanıtlanamadı` };
  const brief = summary && { state: summary.state, enforced: summary.enforced, licenseId: summary.licenseId ?? null, autoTrial: summary.autoTrial ?? null };
  return { ...last, summary: brief };
}

function walkFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

export function scanLogs(dirs) {
  const unreadable = [];
  const files = [];
  for (const dir of dirs) {
    try {
      files.push(...walkFiles(dir));
    } catch (error) {
      unreadable.push(`${dir}: okunamadı (${error.code || error.message})`);
    }
  }
  const reached = [];
  const blocked = [];
  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch (error) {
      unreadable.push(`${file}: okunamadı (${error.code || error.message})`);
      continue;
    }
    for (const line of text.split(/\r?\n/)) {
      if (REACHED_LINES.some(pattern => pattern.test(line))) reached.push(`${file}: ${line.trim()}`);
      else if (BLOCKED_LINE.test(line)) blocked.push(`${file}: ${line.trim()}`);
    }
  }
  let verdict = "ok";
  let reason = `${files.length} dosya, ${blocked.length} engellenen deneme satırı, servise ulaşan satır yok`;
  if (reached.length) [verdict, reason] = ["fail", `programın günlüğünde lisans servisine ULAŞAN deneme var (${reached.length} satır)`];
  else if (!files.length) [verdict, reason] = ["fail", "hiçbir günlük dosyası okunamadı — sonuç bilinmiyor (boş sayılmaz)"];
  else if (!blocked.length) [verdict, reason] = ["fail", "günlükte engellenen deneme satırı yok — denemenin engellendiği günlükten kanıtlanamadı"];
  return { verdict, reason, files: files.length, reached, blocked, unreadable };
}

function option(args, name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
}

async function main(argv) {
  const [command, ...args] = argv;
  const names = licenseHostnames();
  if (command === "engelle" || command === "dogrula") {
    if (command === "engelle") {
      const file = option(args, "--hosts", defaultHostsFile());
      const added = writeHostsBlock(file, names);
      console.log(`hosts (${file}): ${added.length ? `eklendi → ${added.join(" | ")}` : "satırlar zaten var"}`);
      if (process.platform === "win32") {
        try {
          execFileSync("ipconfig", ["/flushdns"], { stdio: "ignore" });
        } catch (error) {
          console.log(`DNS önbelleği boşaltılamadı: ${error.message}`);
        }
      }
      if (args.includes("--dogrulama-yok")) return 0;
    }
    const results = await verifyBlocked(names);
    for (const item of results) console.log(`${item.ok ? "TAMAM" : "HATA "} ${item.name} → ${item.addresses?.join(", ") || "-"}${item.reason ? ` (${item.reason})` : ""}`);
    if (!results.length || results.some(item => !item.ok)) {
      console.log("SONUÇ: lisans servisi adları yerel adrese yönlendirilemedi; gerçek programı bu makinede açmak gerçek servise kayıt düşürür.");
      return 1;
    }
    console.log(`SONUÇ: ${names.length} lisans servisi adı yalnız yerel adrese çözülüyor.`);
    return 0;
  }
  if (command === "denetle") {
    const result = await checkInstalledProgram({
      base: option(args, "--adres", "http://127.0.0.1:5123"),
      username: option(args, "--kullanici", "admin"),
      password: option(args, "--parola", ""),
      timeoutMs: Number(option(args, "--sure", "60")) * 1000,
    });
    console.log(JSON.stringify(result.summary ?? null));
    console.log(`SONUÇ: ${result.verdict === "ok" ? "TAMAM" : "BAŞARISIZ"} — ${result.reason}`);
    return result.verdict === "ok" ? 0 : 1;
  }
  if (command === "gunluk") {
    const dirs = args.filter(arg => !arg.startsWith("--"));
    const result = scanLogs(dirs);
    for (const line of result.unreadable) console.log(line);
    for (const line of result.reached.slice(0, 20)) console.log(`ULAŞTI: ${line}`);
    for (const line of result.blocked.slice(0, 5)) console.log(`engellendi: ${line}`);
    console.log(`SONUÇ: ${result.verdict === "ok" ? "TAMAM" : "BAŞARISIZ"} — ${result.reason}`);
    return result.verdict === "ok" ? 0 : 1;
  }
  console.log("Kullanım: node tools/lisans-nobetci.mjs engelle [--hosts dosya] | dogrula | denetle --adres URL --kullanici AD --parola P [--sure sn] | gunluk <klasör>…");
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
