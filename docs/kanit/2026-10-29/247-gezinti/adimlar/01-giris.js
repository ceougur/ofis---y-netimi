// Masaüstü giriş: kullanıcı adı, Tab, parola insan hızında, Enter.
await desk.goto(base() + "/");
await desk.waitForSelector("#hof-auth input[name=username]");
await desk.click("#hof-auth input[name=username]");
await typeSlow(desk, "admin");
await desk.keyboard.press("Tab");
await typeSlow(desk, "Gezinti-Yonetici-2026!");
await Promise.all([desk.waitForEvent("load"), desk.keyboard.press("Enter")]);
await desk.waitForSelector("#hof-sidecard", { timeout: 60000 });
await bekle(1500);
yaz("lisans", app().license.status().state, "yazılabilir", app().license.status().writable);
yaz("başlık", await desk.title());
