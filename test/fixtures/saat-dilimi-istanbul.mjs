// Testin saat dilimi Türkiye (Europe/Istanbul): ilk içe aktarılan modül olarak öbür modüllerden önce çalışır. Yerel gün ile UTC gününün ayrıldığı
// durumları (yerel 00:25 = UTC dünkü gün) Linux koşucusunda da (UTC) üretmek için. Node TZ değişikliğini çalışırken uygular; uygulanmayan platformda
// yerel gün = UTC günüdür, testler beklenen günü yine yerel saatten hesaplar.
process.env.TZ = "Europe/Istanbul";
