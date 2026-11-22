Mutabakat eski True yeni True
| Sınıf | Fark (eski → yeni) |
|---|---|
| C0 kartsız + bağlı 600 | FARK YOK |
| C0b kartsız + bağlı 1200 (fazla) | FARK YOK |
| C0c kartsız + bağsız 600 | FARK YOK |
| C0d taksitli fatura + kart tahsilatı 300 | FARK YOK |
| C1 kart + bağlı 1200 | cards[0].cari[0]: 0 → 600; cards[0].cari[1]: 600 → 0; cards[0].left: 600 → 0; cards[0].liste[0]: 0 → 600; cards[0].liste[1]: 600 → 0; cards[0].paid: 0 → 600; docs[0].defter.covered: 0 → 600; docs[0].defter.open: 0 → 600; planRemaining: 600 → 0 |
| C1 kart + bağlı 300 | FARK YOK |
| C1 kart + bağlı 600 | cards[0].cari[0]: 0 → 300; cards[0].cari[1]: 600 → 300; cards[0].items[0]: 200 → 0; cards[0].items[2]: 0 → 200; cards[0].left: 600 → 300; cards[0].liste[0]: 0 → 300; cards[0].liste[1]: 600 → 300; cards[0].paid: 0 → 300; docs[0].defter.covered: 300 → 600; docs[0].defter.open: 300 → 600; overdueDebt: 200 → 0; planRemaining: 600 → 300 |
| C1 kart + bağlı 900 | cards[0].cari[0]: 0 → 600; cards[0].cari[1]: 600 → 0; cards[0].left: 600 → 0; cards[0].liste[0]: 0 → 600; cards[0].liste[1]: 600 → 0; cards[0].paid: 0 → 600; docs[0].defter.covered: 0 → 600; docs[0].defter.open: 0 → 600; planRemaining: 600 → 0 |
| C2 kart + bağsız 900 | FARK YOK |
| C3 bağlı 600 → kart 300 | FARK YOK |
| C4 kart + iade 300 → bağlı 600 | cards[0].cari[0]: 0 → 600; cards[0].cari[1]: 600 → 0; cards[0].left: 600 → 0; cards[0].liste[0]: 0 → 600; cards[0].liste[1]: 600 → 0; cards[0].paid: 0 → 600; docs[0].defter.covered: 0 → 600; docs[0].defter.open: 0 → 600; planRemaining: 600 → 0 |
| C5 kart + bağlı 600 → iade 300 | docs[0].defter.covered: 0 → 300; docs[0].defter.open: 0 → 300 |
| C6 kart tamamı + bağlı 600 | cards[0].cari[0]: 0 → 600; cards[0].cari[1]: 600 → 0; cards[0].left: 600 → 0; cards[0].liste[0]: 0 → 600; cards[0].liste[1]: 600 → 0; cards[0].paid: 0 → 600; docs[0].defter.covered: 0 → 600; docs[0].defter.open: 0 → 600; planRemaining: 600 → 0 |
| C7 kart + çek F'ye bağlı 600 | cards[0].cari[0]: 0 → 300; cards[0].cari[1]: 600 → 300; cards[0].items[0]: 200 → 0; cards[0].items[2]: 0 → 200; cards[0].left: 600 → 300; cards[0].liste[0]: 0 → 300; cards[0].liste[1]: 600 → 300; cards[0].paid: 0 → 300; docs[0].defter.covered: 300 → 600; docs[0].defter.open: 300 → 600; overdueDebt: 200 → 0; planRemaining: 600 → 300 |
