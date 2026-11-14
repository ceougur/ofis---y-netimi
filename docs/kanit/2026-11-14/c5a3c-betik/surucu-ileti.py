import json
K = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3c-k7/'
for sc in ['s108-s85-normal-cari-tutar-tarih', 's109-s85-geri-yuklenmis-cari-tutar', 's78-s39-kart-iade-supheli']:
    a = json.load(open(K + 'surucu-taban/UTC/' + sc + '.program.json'))
    b = json.load(open(K + 'surucu-yeni3/UTC/' + sc + '.program.json'))
    oa, ob = a.get('olaylar', []), b.get('olaylar', [])
    for i, (x, y) in enumerate(zip(oa, ob)):
        if x.get('ileti') != y.get('ileti') or x.get('durum') != y.get('durum'):
            print(sc, i, x.get('islem') or x.get('id'), '\n   TABAN', x.get('durum'), x.get('ileti'), '\n   YENİ ', y.get('durum'), y.get('ileti'))
