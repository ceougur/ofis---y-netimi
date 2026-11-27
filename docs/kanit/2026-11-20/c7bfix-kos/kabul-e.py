import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
old_head = '''//   E) Kartı Kapat (YB-1): kart penceresi açıkken ikinci oturum 300 TL tahsilat girer; "Kalan ₺900,00" onayı sunucuda reddedilir (409), pencere "Kalan ₺600,00" ile yeniden sorar, kart kapanır.'''
new_head = '''//   E) Kartı Kapat (YB-1): kart 900 (3 × 300). E0: kart penceresi açıkken ikinci oturum 100 TL tahsilat girer → pencere canlı olayla KENDİNİ yeniler (Kalan ₺800,00; v2.0.22'den beri
//      — eskimiş onay bu yüzden "pencere açıkken" kurgusuyla OLUŞMAYABİLİR, Ç7b aday düzeltme turu). E: ön koşul ZORLA (ders 20): "Kalan ₺800,00" sorusu EKRANDAYKEN ikinci oturum 300
//      TL tahsilat girer (veri tabanında okunur) → onay sunucuda reddedilir (409 plan-close-stale; yanıt ağdan okunur), pencere "Kalan ₺500,00" ile yeniden sorar, kart kapanır.'''
assert s.count(old_head) == 1
s = s.replace(old_head, new_head)
start = s.index('  await step("E) Kartı Kapat — eskimiş')
end = s.index('  await step("D) Telefon genişliği')
new_step = '''  // Ç7b aday düzeltme turu (ders 20, 38): tur 2f'de 34 / 34 olan adım taban kodda 30 / 2 kaldı — ilk soru ZATEN güncel kalanı (600) gösterdi. Neden: kart penceresi
  // "live:workspace.changed" olayıyla kendini yeniler (hof-plans.js refreshOpen; v2.0.22) — ikinci oturumun tahsilatı tıklamadan önce pencereye ulaşırsa eskimiş onay oluşmaz (yarış;
  // ürün davranışı doğru). Ön koşul artık zorla kurulur: tahsilat SORU EKRANDAYKEN girilir (closePlan kalanı sorudan önce okumuştur); 409'un geldiği ağdan okunur — yeşil yalnız
  // ön koşulun GERÇEKTEN oluştuğu koşuda sayılır.
  await step("E) Kartı Kapat — eskimiş 'Kalan' onayı (YB-1): pencere kendini yeniler (E0); soru ekrandayken tahsilat girilir → onay reddedilir, GÜNCEL kalanla yeniden sorulur, kart kapanır", async () => {
    const api = await server.login();
    const accountId = app.store.get("SELECT id FROM accounts WHERE name = 'Ayşe Kaya'").id;
    const created = await must("kart", api.post("/api/workspace/plans", { accountId, name: "Ayşe Kapanış Kartı", total: "900", registeredOn: "2026-11-01", mode: "auto", count: 3, firstDue: "2026-12-01" }));
    const planId = created.id || created.plan?.id;
    const entries = () => app.store.get("SELECT COUNT(*) AS n FROM plan_entries WHERE plan_id = ?", planId).n;
    const kpi = async () => ((await page.textContent(".hof-plans .hof-plans-kpis .hof-cash-balance strong").catch(() => "")) || "").replace(/\\s+/g, " ");
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
    await page.click('#hof-sidecard [data-action="plans"]');
    await page.waitForSelector(`.hof-plans-table tbody tr[data-plan="${planId}"]`, { timeout: 15000 });
    await human();
    await page.click(`.hof-plans-table tbody tr[data-plan="${planId}"]`);
    await page.waitForSelector('.hof-plans [data-act="close"]', { timeout: 15000 });
    ok(/₺900,00/.test(await kpi()), `kart penceresi Kalan ₺900,00: ${await kpi()}`);
    // E0 — pencere açıkken ikinci oturum 100 TL tahsilat girer: pencere canlı olayla kendini yeniler (iyi davranış).
    await must("tahsilat 100 (ikinci oturum)", api.post(`/api/workspace/plans/${planId}/entries`, { kind: "in", amount: "100", date: "2026-12-10", method: "cash" }));
    const refreshed = await page.waitForFunction(() => /₺800,00/.test(document.querySelector(".hof-plans .hof-plans-kpis .hof-cash-balance strong")?.textContent || ""), null, { timeout: 15000 }).then(() => true, () => false);
    ok(refreshed, `E0: pencere ikinci oturumun tahsilatından sonra kendini yeniler (Kalan ₺800,00): ${await kpi()}`);
    await human();
    const puts = [];
    const onResponse = res => {
      if (res.request().method() === "PUT" && res.url().includes(`/api/workspace/plans/${encodeURIComponent(planId)}`)) puts.push(res.status());
    };
    page.on("response", onResponse);
    try {
      await page.click('.hof-plans [data-act="close"]');
      await page.waitForSelector(`${topSel} [data-answer="yes"]`, { timeout: 10000 });
      const first = ((await page.textContent(topSel)) || "").replace(/\\s+/g, " ");
      ok(/Kalan ₺800,00/.test(first), `ilk soru penceredeki kalanla: ${first.slice(0, 140)}`);
      // Ön koşul ZORLA: soru ekrandayken ikinci oturum 300 TL tahsilat girer — sorunun kalanı (800) eskir. Veri tabanında okunur (ders 3).
      const n0 = entries();
      await must("tahsilat 300 (ikinci oturum, soru ekrandayken)", api.post(`/api/workspace/plans/${planId}/entries`, { kind: "in", amount: "300", date: "2026-12-10", method: "cash" }));
      ok(entries() === n0 + 1, "ön koşul: tahsilat soru ekrandayken yazıldı (veri tabanı)");
      await human();
      console.log("    [soru] \\"Kartı Kapat\\" → Kartı Kapat (eskimiş kalanla — sunucu reddetmeli; ders 34)");
      await page.click(`${topSel} [data-answer="yes"]`);
      await page.waitForFunction(sel => /Kalan ₺500,00/.test(document.querySelector(sel)?.textContent || ""), topSel, { timeout: 15000 });
      const second = ((await page.textContent(topSel)) || "").replace(/\\s+/g, " ");
      ok(/Kalan ₺500,00/.test(second), `yeniden soru GÜNCEL kalanla: ${second.slice(0, 140)}`);
      ok(puts.length === 1 && puts[0] === 409, `ilk onay sunucuda reddedildi (409; gelen ${JSON.stringify(puts)}) — ön koşul oluştu`);
      ok(app.store.get("SELECT status FROM plans WHERE id = ?", planId).status === "active", "reddedilen ilk onay kartı kapatmadı (veri tabanı)");
      await shot("kart-kapat-yeniden-soru");
      console.log("    [soru] \\"Kartı Kapat\\" → Kartı Kapat (güncel kalan 500 — beklenen soru)");
      await page.click(`${topSel} [data-answer="yes"]`);
      await page.waitForSelector('.hof-plans [data-act="reopen"]', { timeout: 15000 });
      ok(app.store.get("SELECT status FROM plans WHERE id = ?", planId).status === "closed", "kart kapandı (veri tabanı)");
      ok(puts.length === 2 && puts[1] === 200, `ikinci onay 200 (gelen ${JSON.stringify(puts)})`);
    } finally {
      page.off("response", onResponse);
    }
    await page.keyboard.press("Escape");
  });

'''
s = s[:start] + new_step + s[end:]
open(p, 'w', encoding='utf-8').write(s)
print("tamam")
