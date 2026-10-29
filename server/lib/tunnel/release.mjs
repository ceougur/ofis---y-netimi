// 2.4.7 M4 — tünel istemcisinin (cloudflared) SABİT sürümü ve dosya özetleri (docs/mobil/M4-TASARIM.md §3).
//
// cloudflared kuruluma KONMAZ (~20–60 MB; CLAUDE.md KÖR NOKTA): ilk kullanımda Cloudflare'in kendi GitHub yayınından indirilir; indirilen dosyanın SHA-256'sı
// BURADAKİ sabitle aynı değilse dosya silinir ve ÇALIŞTIRILMAZ. Özet kodda olduğu için güven kökü güncelleme imzasıyla (update-keys.mjs) gelen program
// kodudur; indirme adresi, vekil sunucu ya da GitHub ele geçse de başka bir dosya çalışmaz. Sürüm kendiliğinden yükselmez (cloudflared --no-autoupdate);
// yeni sürüm yalnız program güncellemesiyle (bu dosya değişerek) gelir.
//
// ÖZETLER DOLDURULMADAN TÜNEL AÇILMAZ (bilinçli: yanlış/uydurma özet yazılmaz). Doldurma: yayının kendi sayfasındaki SHA-256 listesi + indirilen dosyanın
// `sha256sum` çıktısı İKİSİ aynı olunca buraya yazılır (adımlar docs/mobil/M4-TASARIM.md §8). Boş özet = "Bağlantı bileşeni bu sürümde tanımlı değil".
export const CLOUDFLARED_VERSION = "2025.8.1";
const BASE = `https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}`;

export const CLOUDFLARED_ASSETS = Object.freeze({
  "win32-x64": Object.freeze({ file: "cloudflared.exe", url: `${BASE}/cloudflared-windows-amd64.exe`, sha256: "", maxBytes: 150 * 1024 * 1024 }),
  "linux-x64": Object.freeze({ file: "cloudflared", url: `${BASE}/cloudflared-linux-amd64`, sha256: "", maxBytes: 150 * 1024 * 1024 }),
});

export const SHA256_HEX = /^[0-9a-f]{64}$/;

/** Bu bilgisayar için dosya tanımı; desteklenmeyen platformda ya da özet sabitlenmemişse { asset: null, reason }. */
export function assetFor({ platform = process.platform, arch = process.arch, assets = CLOUDFLARED_ASSETS, version = CLOUDFLARED_VERSION } = {}) {
  const asset = assets[`${platform}-${arch}`];
  if (!asset) return { asset: null, reason: "platform" };
  if (!SHA256_HEX.test(String(asset.sha256 || ""))) return { asset: null, reason: "unpinned" };
  return { asset: { ...asset, version }, reason: null };
}
