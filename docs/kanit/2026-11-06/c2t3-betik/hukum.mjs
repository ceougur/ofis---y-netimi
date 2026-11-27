// Kanıt klasöründeki c2t3-*.json kayıtlarının hükmünü ve sayılarını yazar.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const dir = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c2t3-kanit/2026-11-06";
for (const name of readdirSync(dir).filter(n => n.endsWith(".json")).sort()) {
  const j = JSON.parse(readFileSync(path.join(dir, name), "utf8"));
  const o = j.ozet || {};
  console.log(`${j.ad}: ${j.hukum} çıkış ${j.cikis_kodu} · toplam ${o.toplam} geçen ${o.gecen} başarısız ${o.basarisiz} iptal ${o.iptal} atlanan ${o.atlanan} · ${j.sure_sn} sn${j.neden ? ` · ${j.neden}` : ""}${j.basarisiz_testler?.length ? ` · düşen: ${j.basarisiz_testler.slice(0, 8).join(" | ").slice(0, 400)}` : ""}`);
}
