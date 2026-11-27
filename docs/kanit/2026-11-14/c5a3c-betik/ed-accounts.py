import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
start = s.index('  // Normal cari hesaba işlenen tahsilat (işaret ya da Kapatılacak Fatura bağı) carinin şüpheli dışı borç bakiyesini')
end = s.index('  // v2.0.17: tahsilat/ödeme "Kapatılacak Fatura" ile bağlanabilir')
new = '''  // Normal cari hesaba işlenen tahsilat (işaret ya da Kapatılacak Fatura bağı) carinin şüpheli dışı borç bakiyesini (120 = kart − açık şüpheli)
  // aşamaz: aşan kısım şüpheli alacaktan düşmek zorundadır (tam kapı doubtful:balance aynı kuralı sonradan "ledger-integrity" ile reddederdi;
  // burada açık 409 doubtful-normal-exceeds). Düzeltmede yalnız eklenen fark sayılır.
  // 2.5.0 Ç5-A tur 3c (S168 = B; C5-ACILIS-TASARIM §19.1 SINIR): sınır YALNIZ 120'ye düşecek kısma uygulanır. "Normal Cari Hesaba İşle" işaretli tahsilatın tamamı 120'dir (bugünkü
  // gibi; yazımdan önce). Yalnız Kapatılacak Fatura bağlı tahsilatta faturanın kuyrukta şüpheli sayılan kısmı önce 128'den düşer (lib/doubtful-gl.mjs `linked`) — 120'ye düşecek kısım
  // = tutar − ayırıcının bu satıra verdiği 128 payı; pay yazımın AYNI işleminde, satır yerindeyken okunur (ayırıcının aynı gün sırası satırın kimliğine bağlı — yazımdan önce bilinemez).
  // Dönüş: bağlı tahsilatta yazımdan SONRA çağrılacak denetim (satır kimliğiyle; aşarsa 409, işlem geri alınır), öbür durumda null.
  const assertNormalRoom = (account, input, previous = null) => {
    if (input.kind !== "in" || account.type !== "customer" || !doubtful()?.headroom) return null;
    const flagged = doubtfulSkipOf({ kind: "in", doubtfulSkip: input.doubtfulSkip });
    if (!flagged && !input.invoiceId) return null;
    const room = doubtful().headroom(account.id);
    if (!(room.openMinor > 0)) return null;
    // Önceki satırın ZATEN 120'de olan kısmı sayılmaz (işaretliyse tamamı; değilse ayırma kuralının şüpheliye düşürmediği kısmı — ör. kayıt
    // tarihinden önceki tahsilat, Ç5-A tur 3c'den beri bağlı tahsilatın 120 payı; kontrol turu 2 K3: önceden tamamı yeni sayılıp defter değişmediği hâlde 409).
    const previousMinor = previous && previous.kind === "in"
      ? (doubtfulSkipOf({ kind: "in", source: previous.source, invoiceId: previous.invoiceId, doubtfulSkip: previous.doubtfulSkip })
        ? Math.round(Number(previous.amount) * 100)
        : Math.round(Number(previous.amount) * 100) - (doubtful().allocatedMinor?.(account.id, previous.id) ?? 0))
      : 0;
    const amountMinor = Math.round(input.amount * 100);
    const why = flagged ? "“Normal Cari Hesaba İşle” işaretini kaldırın" : "Kapatılacak Fatura bağını kaldırın";
    // 2.5.0 Ç5-B (K10-3, S85): düzeltmede tarih de değişirse sınır kaydın YENİ gününde — o güne kadarki bakiye (kayıt hariç) − açık şüpheli; bugünkü sınırla küçüğü.
    let roomDay = null;
    if (previous && input.date && input.date !== previous.date) {
      const system = { id: "integrity", role: "admin", permissions: [] };
      const ledger = accountLedger(entriesOf(account.id).filter(entry => entry.id !== previous.id), plans()?.forAccount ? plans().forAccount(account.id, system) : []);
      const dayMinor = ledger.lines.filter(line => line.date <= input.date).reduce((sum, line) => sum + Math.round((Number(line.debit) || 0) * 100) - Math.round((Number(line.credit) || 0) * 100), 0);
      roomDay = dayMinor - room.openMinor;
      if (roomDay < room.roomMinor) room.roomMinor = roomDay;
    }
    // İletinin ilk yarısı: bağlı tahsilatta 120'ye düşecek KISIM ve faturanın şüpheli payı; işaretlide tahsilatın tamamı (bugünkü metin).
    const what = (normalMinor, shareMinor) => (shareMinor > 0
      ? `Normal cari hesaba işlenecek kısım (${tl(roundMoney(normalMinor / 100))}; ${tl(input.amount)} tahsilatın ${tl(roundMoney(shareMinor / 100))}'si faturanın şüpheli alacaktaki payından düşüyor)`
      : `Normal cari hesaba işlenecek tahsilat (${tl(roundMoney(normalMinor / 100))})`);
    // Kayıt hariç ölçüldüğü için önceki payı düşülmez: yeni hâlin 120'ye yazacağı tutarın tamamı sayılır.
    const dayCheck = (normalMinor, shareMinor) => {
      if (roomDay === null || normalMinor <= roomDay) return;
      const roomTl = roundMoney(Math.max(0, roomDay) / 100);
      throw new HttpError(409, `${what(normalMinor, shareMinor)} ${dayText(input.date)} tarihinde carinin şüpheli dışı borç bakiyesini (${tl(roomTl)}) aşıyor; fazlası şüpheli alacaktan düşmek zorunda. Tutarı ya da tarihi değiştirin veya ${why}.`, { code: "doubtful-normal-exceeds", field: "date", roomMinor: roomDay, openMinor: room.openMinor, normalMinor, shareMinor });
    };
    const amountCheck = (normalMinor, shareMinor) => {
      if (normalMinor - previousMinor <= room.roomMinor) return;
      const roomTl = roundMoney(Math.max(0, room.roomMinor) / 100);
      const most = roundMoney(Math.max(0, room.roomMinor + previousMinor + shareMinor) / 100);
      throw new HttpError(409, `${what(normalMinor, shareMinor)} carinin şüpheli dışı borç bakiyesini (${tl(roomTl)}) aşıyor; fazlası şüpheli alacaktan düşmek zorunda. Tutarı ${tl(most)}'ye indirin ya da ${why}.`, { code: "doubtful-normal-exceeds", field: "amount", roomMinor: room.roomMinor, openMinor: room.openMinor, normalMinor, shareMinor });
    };
    if (flagged) {
      dayCheck(amountMinor, 0);
      amountCheck(amountMinor, 0);
      return null;
    }
    return entryId => {
      const shareMinor = Math.min(amountMinor, doubtful().allocatedMinor?.(account.id, entryId) ?? 0);
      dayCheck(amountMinor - shareMinor, shareMinor);
      amountCheck(amountMinor - shareMinor, shareMinor);
    };
  };
'''
s = s[:start] + new + s[end:]
reps = [
    ('''    assertNormalRoom(account, input);
    assertCardRefundRoom(account, input, body);''', '''    const normalAfter = assertNormalRoom(account, input);
    assertCardRefundRoom(account, input, body);'''),
    ('''        const entry = addEntry(user, account.id, { ...input, finRef, pos: finRef && !corporateOf(input, body) ? posMetaOf(body) : null });
        audit(user, `account.entry.${input.kind}`''', '''        const entry = addEntry(user, account.id, { ...input, finRef, pos: finRef && !corporateOf(input, body) ? posMetaOf(body) : null });
        normalAfter?.(entry.id); // Ç5-A tur 3c: bağlı tahsilatın 120 payı yazımdan sonra (aşarsa 409, işlem geri alınır)
        audit(user, `account.entry.${input.kind}`'''),
    ('''        assertNormalRoom(party, input, cariChange ? null : previous);''', '''        const normalAfter = assertNormalRoom(party, input, cariChange ? null : previous);'''),
    ('''        step = { previous, input, finRef, k7 };''', '''        step = { previous, input, finRef, k7, normalAfter };'''),
    ('''        const { previous, input, finRef, k7 } = step;''', '''        const { previous, input, finRef, k7, normalAfter } = step;'''),
    ('''        if (cariChange) store.run("UPDATE account_entries SET account_id = ? WHERE id = ?", targetId, previous.id);
''', '''        if (cariChange) store.run("UPDATE account_entries SET account_id = ? WHERE id = ?", targetId, previous.id);
        normalAfter?.(previous.id); // Ç5-A tur 3c: bağlı tahsilatın 120 payı yazımdan sonra (aşarsa 409, işlem geri alınır)
'''),
]
for a, b in reps:
    assert s.count(a) == 1, a[:60]
    s = s.replace(a, b)
open(p, 'w', encoding='utf-8').write(s)
print('ok')
