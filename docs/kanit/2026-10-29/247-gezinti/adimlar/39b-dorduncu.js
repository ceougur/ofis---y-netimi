// 4. CİHAZ: ekranda Karekod Oluştur PASİF, satırda "Cihaz sınırı dolu." (39). Sunucu kuralı: API'den karekod iste → beklenen 4xx. Ayrıca sınırdan ÖNCE alınmış
// geçerli bir karekod gibi: 3 eşli varken eşleme ucuna giden istek de reddedilmeli (kapıcı + program) — kalan geçerli karekod yok, bu yüzden yalnız API karekod reddi.
const row = `[data-mobile-user="${vars.adminId}"]`;
yaz("satır", await desk.$eval(row, e => e.innerText.replace(/\s+/g, " ").trim()));
const direct = await api("/api/admin/mobile/codes", "POST", { userId: vars.adminId });
yaz("API karekod (4. cihaz)", direct.status, JSON.stringify(direct.data).slice(0, 300));
yaz("Yönetim cihaz listesi", await desk.$eval("#adm-mobile-devices, [data-mobile-devices]", e => e.innerText.replace(/\s+/g, " ").trim().slice(0, 600)).catch(() => "?"));
yaz("SON DB cihaz sayısı", hub("SELECT COUNT(*) AS n FROM mobile_devices")[0].n, hub("SELECT name FROM mobile_devices").map(d => d.name), "kapıcı", (kapi.meta(ofisId())?.cihazlar || []).length, "kapıcı sınırı", kapi.meta(ofisId())?.sinir ?? kapi.meta(ofisId())?.limit ?? "?");
await desk.$eval(row, e => e.scrollIntoView({ block: "center" }));
