#!/bin/bash
# Tur 2f HIZ (kaba; ana oturumun kabul ölçümünden ayrı): `flock -x …/olcum.lock` İÇİNDE çağrılır. Taban (c5a2f-taban 807c70f6) ↔ yeni (tur 2f ucu), AYNI veri kopyası, iki tur.
#  Hazırlık (yeni kodla, bir kez): temiz-100k + kilit 31.12.2026 + Kural Farkı Düzeltme Fişi 01.01.2027 (yılı 2027) + eşleştirme fişi; bugün 10.01.2027.
#  (G) kilit 30.11.2026'ya GERİ — fişin yılı > eşleme yılı (tur 2f'nin yeni yolu): ön izleme, Mutabakat Testi, Defter Mutabakatı
#  (K) kilit 31.12.2026 — fişin yılı = eşleme yılı (değişmeyen yol; denetim)
H=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2f-k1/hiz
V=/dev/shm/c5a2f-k1/hiz
SRC=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-kabul/temiz-100k
YENI=/home/user/ofis---y-netimi/.claude/worktrees/agent-a46c87e85c8b28c2f
TABAN=/dev/shm/c5a2f-k1/taban
unset GIT_DIR GIT_WORK_TREE
export HUKUK_LICENSE_URL=http://127.0.0.1:9 ESD_PASS=Kapi-Olcum-2026! TZ=Europe/Istanbul
mkdir -p $V || exit 1
echo "başta $(cat /proc/loadavg) · nproc $(nproc) · $(date -u +%H:%M:%S)"; free -g | sed -n 2p; df -h / | tail -1
rm -rf $V/src && cp -a $SRC $V/src || exit 1
timeout -k 5 1800 node --disable-warning=ExperimentalWarning $H/fis-kur.mjs $YENI $V/src 2027-01-10 2026-12-31 2>&1 | grep -v "Experimental\|trace-warn"
for tur in 1 2; do
  for side in taban yeni; do
    if [ $side = taban ]; then R=$TABAN; else R=$YENI; fi
    rm -rf $V/g && cp -a $V/src $V/g || exit 1
    echo "== tur $tur $side (G) kilit 30.11.2026'ya geri"; KILIT=2026-11-30 timeout -k 5 1800 node --disable-warning=ExperimentalWarning $H/hz-kf.mjs $R $V/g 2027-01-10 2>&1 | grep -v "Experimental\|trace-warn"
    rm -rf $V/k && cp -a $V/src $V/k || exit 1
    echo "== tur $tur $side (K) kilit 31.12.2026"; timeout -k 5 1800 node --disable-warning=ExperimentalWarning $H/hz-kf.mjs $R $V/k 2027-01-10 2>&1 | grep -v "Experimental\|trace-warn"
  done
done
rm -rf $V/g $V/k $V/src
echo "sonda $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
