// Ders 20 zorla üretme ön yüklemesi (`node --import`): GERÇEK saat (Date.now) GERCEK_SAAT_KAT kat hızlı akar (varsayılan 8); programın sahte saati (config.now)
// etkilenmez. Yavaş makinenin (CI Windows) etkisini benzetir: gerçek saatle ölçülen aralıklar (WhatsApp işçisinin 60 sn'lik bakım aralığı, scheduler.mjs turn())
// testin ortasına düşer. Bu bir test değildir; test/whatsapp-b3-buyume-zorla.mjs kullanır. Benzetim gerçek platform değildir (ders 18).
const factor = Math.max(1, Number(process.env.GERCEK_SAAT_KAT || 8));
const realNow = Date.now.bind(Date);
const start = realNow();
Date.now = () => start + Math.floor((realNow() - start) * factor);
