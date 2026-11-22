// izt2 yoklama 1: SK-42 (a) / S241, kapsam seçimi ayrışması, iade Düzenle'si, faturasız stok iadesi silme. ROOT=<kod> node p1.mjs [ad...]
import { world, W } from "./h.mjs";
const only = new Set(process.argv.slice(2));
const run = (name, fn) => (only.size && !only.has(name) ? null : fn().then(out => console.log(`${name}: ${out}`)).catch(e => console.log(`${name}: HATA ${e.message}`)));
const j = x => JSON.stringify(x);

await run("S241", () => world("2026-09-02", async h => {
  const out = [];
  const A = await h.acc();
  const f = await h.goods(A, "2026-09-01", 3);
  const k = await h.cover(A, 900, "2026-10-05", "2026-09-02");
  h.at("2026-09-03");
  await h.pay(k, 600);
  h.at("2026-09-10");
  out.push(`edit ${j(await h.edit(f, 1))}`);
  out.push(`kart(pencere) ${j(await h.card(k))}`, `kart(kendi) ${j(h.own(k))}`, `cari ${j(await h.account(A))}`, `fatura ${j(await h.invoice(f))}`, `defter ${j(h.settle(f))}`, `mut ${await h.ok()}`);
  const pj = JSON.parse(h.ctx.store.get("SELECT payment_json AS j FROM invoices WHERE id = ?", f).j);
  out.push(`payment ${j(pj)}`);
  return out.join(" | ");
}));

for (const which of ["A", "B", "iadeA", "iadeB"]) {
  await run(`AYR-${which}`, () => world("2026-09-03", async h => {
    const out = [];
    const acc = await h.acc();
    const A = await h.goods(acc, "2026-09-01", 2);
    const B = await h.goods(acc, "2026-09-02", 2);
    const k = await h.cover(acc, 600, "2026-10-05", "2026-09-03", 2);
    out.push(`önce kuyruk A ${j(await h.invoice(A))} B ${j(await h.invoice(B))}; defter A ${j(h.settle(A).coveredBy)} B ${j(h.settle(B).coveredBy)}`);
    if (which === "A") await h.cancel(A);
    if (which === "B") await h.cancel(B);
    if (which === "iadeA") await h.giveBack(A, acc, 1);
    if (which === "iadeB") await h.giveBack(B, acc, 1);
    out.push(`sonra kart ${j(await h.card(k))} cari ${j(await h.account(acc))} A ${j(await h.invoice(A))} B ${j(await h.invoice(B))}`);
    h.at("2026-09-20");
    out.push(`20.09 cari ${j(await h.account(acc))} mut ${await h.ok()}`);
    return out.join(" | ");
  }));
}

await run("IADE-DUZENLE", () => world("2026-09-02", async h => {
  const out = [];
  const A = await h.acc();
  const f = await h.goods(A, "2026-09-01", 3);
  const k = await h.cover(A, 900, "2026-10-05", "2026-09-02");
  h.at("2026-09-03");
  await h.pay(k, 300);
  const before = h.rows(k).map(r => `${r.dueDate}:${r.amount}`);
  h.at("2026-11-10");
  const r = await h.giveBack(f, A, 2);
  out.push(`önce ${j(before)} iade sonrası ${j(h.rows(k).map(x => `${x.dueDate}:${x.amount}`))}`);
  h.at("2026-11-12");
  out.push(`iade düzenle 2→1 ${j(await h.editReturn(r, 1))} → ${j(h.rows(k).map(x => `${x.dueDate}:${x.amount}`))}`);
  out.push(`kart ${j(await h.card(k))} cari ${j(await h.account(A))} mut ${await h.ok()}`);
  h.at("2026-11-20");
  out.push(`20.11 cari ${j(await h.account(A))}`);
  return out.join(" | ");
}));

await run("STOK-IADE", () => world("2026-09-02", async h => {
  const out = [];
  const A = await h.acc();
  const mal = (await h.must("mal", h.api.post(`${W}/stock`, { kind: "goods", code: "IZT2-MAL", name: "İzt2 Malı", unit: "Adet", openingQty: "100", salePrice: "300" }))).id;
  await h.debt(A, "2026-09-01", 900);
  const k = await h.cover(A, 900, "2026-10-05", "2026-09-02");
  h.at("2026-09-03");
  await h.pay(k, 300);
  const before = h.rows(k).map(r => `${r.id.slice(-4)}:${r.dueDate}:${r.amount}`);
  h.at("2026-11-10");
  h.tick();
  const mv = await h.must("stok iadesi", h.api.post(`${W}/stock/${mal}/moves`, { kind: "in", reason: "return", qty: "1", unitPrice: "300", pay: "account", accountId: A, date: "2026-11-10" }));
  out.push(`önce ${j(before)} iade sonrası ${j(h.rows(k).map(r => `${r.id.slice(-4)}:${r.dueDate}:${r.amount}`))} kart ${j(await h.card(k))}`);
  h.at("2026-11-20");
  h.tick();
  const del = await h.api.del(`${W}/stock/${mal}/moves/${mv.moveId}`);
  out.push(`sil ${del.status} → ${j(h.rows(k).map(r => `${r.id.slice(-4)}:${r.dueDate}:${r.amount}`))} kart ${j(await h.card(k))} cari ${j(await h.account(A))} mut ${await h.ok()}`);
  h.tick();
  const trash = await h.must("Silinenler", h.api.get("/api/admin/trash"));
  const t = trash.find(row => row.kind === "stock-move" && row.ref === mv.moveId);
  const back = await h.api.post("/api/admin/trash/restore", { id: t?.id });
  out.push(`geri yükle ${back.status} → ${j(h.rows(k).map(r => `${r.id.slice(-4)}:${r.dueDate}:${r.amount}`))} kart ${j(await h.card(k))} cari ${j(await h.account(A))} mut ${await h.ok()}`);
  h.tick();
  const put = await h.api.put(`${W}/stock/${mal}/moves/${mv.moveId}`, { qty: "2", unitPrice: "300" });
  out.push(`düzelt 1→2 ${put.status} → ${j(h.rows(k).map(r => `${r.id.slice(-4)}:${r.dueDate}:${r.amount}`))} kart ${j(await h.card(k))} cari ${j(await h.account(A))} mut ${await h.ok()}`);
  h.tick();
  const put2 = await h.api.put(`${W}/stock/${mal}/moves/${mv.moveId}`, { qty: "1", unitPrice: "300" });
  out.push(`düzelt 2→1 ${put2.status} → ${j(h.rows(k).map(r => `${r.id.slice(-4)}:${r.dueDate}:${r.amount}`))} kart ${j(await h.card(k))} cari ${j(await h.account(A))} mut ${await h.ok()}`);
  return out.join(" | ");
}));

for (const how of ["tutar", "vade", "sil"]) {
  await run(`ELLE-${how}`, () => world("2026-09-02", async h => {
    const out = [];
    const A = await h.acc();
    const f = await h.goods(A, "2026-09-01", 3);
    const k = await h.cover(A, 900, "2026-10-05", "2026-09-02");
    h.at("2026-09-03");
    await h.pay(k, 300);
    h.at("2026-11-01");
    const r = await h.giveBack(f, A, 0.5);
    const rows = h.rows(k);
    out.push(`iade 150 → ${j(rows.map(x => `${x.dueDate}:${x.amount}`))}`);
    const cutRow = rows.find(x => x.dueDate === "2026-11-05");
    h.tick();
    let res;
    if (how === "tutar") res = await h.api.put(`${W}/plans/${k}/items/${cutRow.id}`, { amount: "100" });
    if (how === "vade") res = await h.api.put(`${W}/plans/${k}/items/${cutRow.id}`, { dueDate: "2026-11-25" });
    if (how === "sil") res = await h.api.del(`${W}/plans/${k}/items/${cutRow.id}`);
    out.push(`elle ${how} ${res.status} → ${j(h.rows(k).map(x => `${x.dueDate}:${x.amount}`))} kart(kendi) ${j(h.own(k))}`);
    h.at("2026-11-20");
    await h.cancel(r);
    out.push(`iade iptal → ${j(h.rows(k).map(x => `${x.dueDate}:${x.amount}`))} kart ${j(await h.card(k))} kendi ${j(h.own(k))} cari ${j(await h.account(A))} mut ${await h.ok()}`);
    return out.join(" | ");
  }));
}
