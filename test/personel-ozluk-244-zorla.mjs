// Ders 20 — zorla üretme: CI #898 be78831 Windows Node 24'te personel-ozluk-244 KVKK testi "işlem geçmişinde değer var: 0532" dedi.
// Ürün işlem geçmişine yalnız alan ADLARI yazar; ama test kayıt kimliğini (staff-<rastgele UUID>) de aradığı metne katıyordu ve rastgele UUID'de
// "0532" / "45000" gibi bir parça ara sıra çıkar. Bu ön yükleme randomUUID'yi içinde "0532" geçen sayaçlı kimliklere çevirir; ön koşul her koşuda oluşur.
// Kullanım: node --import ./test/personel-ozluk-244-zorla.mjs --test test/personel-ozluk-244.test.mjs
import crypto from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
let n = 0;
crypto.randomUUID = () => `00000000-0000-4000-8000-0532${String(++n).padStart(8, "0")}`;
syncBuiltinESMExports();
