// Ajanın eşdeğerlik testindeki "eski yol" (oldPath) Alt Hesap Mizanı ve Banka Masraf Raporu'nda YENİ moneyLines'ı mı kullanıyor?
// Yeni moneyLines'ın uçları geçici olarak bozulur (yalnız bu süreçte, bellekte); eski rapor merkezi yine de bozulan uca giderse kâhin karışıktır.
import { adminOf, oldPath } from "./ortak.mjs";
const R = "/home/user/ofis---y-netimi";
const { bootBank, must, openAccount } = await import(`${R}/test/banka-210-hesap-ortak.mjs`);
const ctx = await bootBank({ bankPickLegacy: true });
try {
  const api = ctx.api;
  await openAccount(api, { bankName: "A", name: "A", kind: "demand", opening: { date: "2026-10-01", amount: "1.000", confirmed: true } });
  const app = ctx.app;
  const user = adminOf(app);
  const old = oldPath(app);
  const fresh = app.context.money;
  const calls = { periodGroups: 0, refTotal: 0, unassignedWays: 0, lines: 0 };
  for (const name of Object.keys(calls)) {
    const original = fresh[name];
    fresh[name] = (...args) => { calls[name] += 1; return original(...args); };
  }
  for (const id of ["alt-hesap-mizani", "banka-masraf", "banka-bakiye", "banka-hareket"]) {
    for (const k of Object.keys(calls)) calls[k] = 0;
    await old.center.run(user, id, new URLSearchParams({ preset: "all" }));
    console.log(`ESKİ yol ${id}: YENİ moneyLines çağrıları`, JSON.stringify(calls));
  }
} finally {
  await ctx.server.close();
}
