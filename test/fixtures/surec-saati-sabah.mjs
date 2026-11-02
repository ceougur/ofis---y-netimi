// Ders 13 / 22: içe aktarılınca sürecin saatini YEREL bugün 06:00'a alır ve akıtır (motorNow kuralı; en uzun koşu da gece yarısına ulaşmaz).
// config.now'u olmayan eski sürüm kodunu (ör. v2.0.26) aynı süreçte açan testler için: "bugün"ü başta bir kez okuyan test (TODAY) ile sonradan
// okuyan sunucular ve mutabakat motoru (ledger/lock today) koşu gece yarısına rastlasa da aynı günü görür. Testin İLK içe aktarımı olmalıdır.
// (31.10.2026 CI #941 df238b99 Windows Node 24: banka-210-altin 23:58 UTC'de yüklendi, motor 00:00'dan sonra başladı → fatura kronoloji reddi.)
import { dayStart06, installProcessClock } from "./surec-saati.mjs";

export const processClock = installProcessClock(dayStart06());
