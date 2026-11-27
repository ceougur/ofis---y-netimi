#!/usr/bin/env bash
# Ç2 tur 3 kanıt koşuları (sıralı; makine yüklü — paralel koşu yok, ders 15). Her koşu tools/kanit.mjs kos ile; eski kod koşularının kırmızısı BEKLENİR (zincir durmaz,
# çıkış kodu özet dosyasına yazılır). Commit / push YOK.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
WT=/home/user/ofis---y-netimi/.claude/worktrees/agent-a7280bb16b4491d5b
OLD=$S/c2t3-eski-bc495a1c
V249=$S/c2t3-v249
MUT=$S/c2t3-mut-3f662426
GD=/home/user/ofis---y-netimi/.git
export HUKUK_LICENSE_URL=http://127.0.0.1:9
export PLAYWRIGHT_BROWSERS_PATH=$S/pw-1194
export KANIT_DIR=$S/c2t3-kanit
OZET=$S/c2t3-calisma/kos-ozet.txt
NT="node --disable-warning=ExperimentalWarning --test --test-concurrency=1"
FAMILY="test/fis-defteri-kayit-250.test.mjs test/banka-onarim-kayit-250.test.mjs test/fis-defteri-250.test.mjs test/fis-defteri-yasam-250.test.mjs test/fis-defteri-koruma-250.test.mjs"
cd "$WT" || exit 1
k() { local name=$1; shift; local t0=$(date -u +%H:%M:%S); node "$WT/tools/kanit.mjs" kos "$name" -- "$@" > "$S/c2t3-calisma/$name.kos.txt" 2>&1; local code=$?; echo "$t0 → $(date -u +%H:%M:%S) $name çıkış $code" >> "$OZET"; }
echo "başlangıç $(date -u +%FT%TZ) HEAD $(git -C "$WT" rev-parse --short HEAD)" >> "$OZET"
df -h / | tail -1 >> "$OZET"
# 1-2) yeni kod, Ç2 test ailesi (yeni iki dosya + tur 1-2 dosyaları), iki saat dilimi
TZ=UTC k c2t3-yeni-utc $NT $FAMILY
TZ=Europe/Istanbul k c2t3-yeni-ist $NT $FAMILY
# 3) eski kod bc495a1c (ayrı kopya; yeni test dosyaları kopyada), iki saat dilimi — BEKLENEN KIRMIZI (nedenler okunur)
TZ=UTC k c2t3-eski-bc495a1c-utc env GIT_DIR=$GD $NT $OLD/test/fis-defteri-kayit-250.test.mjs $OLD/test/banka-onarim-kayit-250.test.mjs
TZ=Europe/Istanbul k c2t3-eski-bc495a1c-ist env GIT_DIR=$GD $NT $OLD/test/fis-defteri-kayit-250.test.mjs $OLD/test/banka-onarim-kayit-250.test.mjs
# 4) v2.4.9 üretim kodu (ayrı kopya), banka onarımı testi — BEKLENEN KIRMIZI
TZ=UTC k c2t3-v249-banka-utc env GIT_DIR=$GD $NT $V249/test/banka-onarim-kayit-250.test.mjs
TZ=Europe/Istanbul k c2t3-v249-banka-ist env GIT_DIR=$GD $NT $V249/test/banka-onarim-kayit-250.test.mjs
# 5) G6: v2.4.9 gerçek kodu zinciri
TZ=UTC k c2t3-g6-fis-eski-surum-utc node --disable-warning=ExperimentalWarning test/fis-defteri-eski-surum-250.mjs --eski $V249
TZ=Europe/Istanbul k c2t3-g6-fis-eski-surum-ist node --disable-warning=ExperimentalWarning test/fis-defteri-eski-surum-250.mjs --eski $V249
TZ=UTC k c2t3-g6-donmus-eski-surum-utc node --disable-warning=ExperimentalWarning test/donmus-defter-eski-surum-250.mjs --eski $V249
TZ=Europe/Istanbul k c2t3-g6-donmus-eski-surum-ist node --disable-warning=ExperimentalWarning test/donmus-defter-eski-surum-250.mjs --eski $V249
# 6) e2e (değişen davranışa dokunan: BS-7 şema kapısı + Defter / Mutabakat ekranı)
k c2t3-e2e-sema-kapisi-bs7 npm run test:sema-kapisi-bs7
k c2t3-e2e-senaryo-defter-243 npm run test:senaryo-defter-243
# 7) G2 komşular (test/ taranarak: 117 dosya; scratchpad/c2t3-calisma/g2-liste.txt), iki saat dilimi
df -h / | tail -1 >> "$OZET"
TZ=UTC k c2t3-g2-utc $NT $(cat "$S/c2t3-calisma/g2-liste.txt")
TZ=Europe/Istanbul k c2t3-g2-ist $NT $(cat "$S/c2t3-calisma/g2-liste.txt")
# 8) mutasyon (kopya 3f662426): bütün 55 UTC; yeni 36–55 İstanbul
TZ=UTC k c2t3-mutasyon-utc node --disable-warning=ExperimentalWarning test/fis-defteri-250-mutasyon.mjs --kopya $MUT
TZ=Europe/Istanbul k c2t3-mutasyon-yeni-ist node --disable-warning=ExperimentalWarning test/fis-defteri-250-mutasyon.mjs --kopya $MUT --yalniz 36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55
echo "bitiş $(date -u +%FT%TZ)" >> "$OZET"
df -h / | tail -1 >> "$OZET"
