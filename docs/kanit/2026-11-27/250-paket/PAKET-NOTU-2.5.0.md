# DestekOfis 2.5.0 — Paket Kanıtı (27.11.2026)

Paketlenen ağaç: master **b135438e** (PR #41 birleşimi; ağacı PR ucu 5f4a6eb6 ile birebir). `tools/release.mjs` kapısı:
"b135438 CI YEŞİL, çalışma ağacı temiz, YAPIM AŞAMASI listesi boş" — CI #1107 (push, master) bütün işler YEŞİL (ci-master-b135438.txt);
PR CI #1106 + push #1105 (5f4a6eb6) YEŞİL (ci-pr41-5f4a6eb.txt).

## GitHub yayınına yüklenecek 5 dosya — A-SHA256SUMS.txt
| Dosya | Boyut | SHA-256 |
|---|---|---|
| destekofis-guncelleme-2.5.0.zip (367 dosya) | 8.244.106 B | 80a591214ba11c4bae4eabfe655cf46973b3dfcc77e5ada2eb7e9ddcf3a1f9a6 |
| destekofis-guncelleme.json (imzalı, destekofis-2026-1) | 1.718 B | f5ce092e9e1f0aecb951f7fb75cf7e0132639bc82aab054af4fa9865f19de983 |
| DestekOfis-Kullanim-Kilavuzu.pdf | 5.152.520 B | 0f3d6e8dc8b54fcd191c4f08de4449d21436e527cd40239d7b04a7a86b5c4e0b |
| DestekOfis-Kurulum.exe (2.5.0.0, simgeli) | 37.909.998 B | 75b936faf10c4d64e46220792b82f411f0e25d0b3a9113846e4a0ac93782efff |
| DestekOfis-Kurulum.exe.sha256 | 89 B | 1d6d5f2d6e85970daa61610a0ab7ec8789f5d2a15e02ba95373a75af8bd4c565 |
Kurulum 50 MB'ın altında → parçalanmadı.

## Denetimler (ham çıktılar bu klasörde)
- imza-dogrulama-250.out: verifyEnvelope GEÇERLİ (destekofis-2026-1, 2.5.0, stable); zip sha256 bildirgede; payload'u değiştirilmiş bildirge SIGNATURE_INVALID.
- pe-kaynak-250.out: DestekOfis.exe ve kurulum ICON / GROUP_ICON / VERSION VAR, FileVersion 2.5.0 / 2.5.0.0.
- zip-denetim-250.out: zip içi kılavuz özeti = yayın PDF'i, package.json 2.5.0, yasak dosya YOK, gizli desen YOK.
- guncelleyici-250.out: v2.4.9 ve v2.4.8'in GERÇEK güncelleyicisi (git worktree kopyası; betik 2026-11-05/249-paket/guncelleyici-denetle.mjs) → available 2.5.0,
  indirildi + özet doğrulandı, API ve API 403 yedek yolu; 2.5.0 → up-to-date.
- birlestir-sina-250.out: arşiv kaynak paketi BIRLESTIR.bat Wine altında (32 bit certutil taklidi, 2026-11-05/249-paket/certutil-taklit.go): sağlam → TAMAM, bozuk parça → TUTMUYOR.
- build-windows.log: Windows kurulum derlemesi. Not: bu kapsayıcıda Ubuntu Wine 9 wineserver'ı /run/user/0 yokken çöküyordu (CLAUDE.md'ye eklendi).

## Arşiv (GitHub'a YÜKLENMEZ) — B-ARSIV-SHA256SUMS.txt
DestekOfis-2.5.0-Arsiv-Belgeler-Kaynak-Denetim.zip (belgeler, son aday kanıtı, denetim çıktıları, OKU-BENI, SHA256SUMS) + kaynak paketi
DestekOfis-2.5.0-Arsiv-Kaynak.bundle 7 parça (322.094.191 B, sha256 f6e6a34364d75928cd5286ca1a26531870c1a216c422e5619b5e2d97f5212628; HEAD b135438e,
tam geçmiş 2361 commit, sığ değil, klon ağacı master'la birebir) + BIRLESTIR.bat + BIRLESTIR.md.
