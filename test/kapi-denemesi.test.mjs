// KAPI DENEMESİ (10.10.2026) — BİLEREK: bu test yalnız Windows'ta atlanır. CI'nin olağan test işleri bunu YEŞİL gösterir (atlanan
// test başarısız sayılmaz); "Doğrulama Kapısı" ise Windows'ta atlanan test yüzünden KIRMIZI olmalı (o platformda doğrulanmadı).
// Bir sonraki commit bu dosyayı siler.
import { it } from "node:test";

it("kapı denemesi: Windows'ta atlanır", { skip: process.platform === "win32" && "bilerek atlandı (kapı denemesi)" }, () => {});
