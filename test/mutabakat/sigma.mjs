// Mutabakat motorunun "Σ açık kalem = bakiye" denetimi için okuma (2.5.0 Ç5-B kapanış düzeltmesi, DÜŞÜK-3): programın TEK YÜKÜMLÜLÜK KUYRUĞUNDAN her carinin açık
// kalemlerinin imzalı toplamı (alacak yönü +, borç yönü −; kuruş). Sunucu koşucuyla aynı süreçte çalışır (startTestServer) — kuyruk programın kendi servisinden okunur;
// HTTP ekranları karşı yönlü avansı kalem saymadığı için toplam oradan kurulamaz. Dönüş: () => Map(cari kimliği → kuruş).
export const sigmaReader = server => () => {
  const out = new Map();
  const all = server.app.context?.invoices?.allObligations?.();
  if (!all) return out;
  for (const [accountId, queue] of all) {
    let minor = 0;
    for (const item of queue?.items || []) minor += (item.side === "receivable" ? 1 : -1) * Math.round(item.remaining * 100);
    out.set(accountId, minor);
  }
  return out;
};
