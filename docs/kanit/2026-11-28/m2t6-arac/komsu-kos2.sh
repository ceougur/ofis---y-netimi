#!/bin/bash
# m2t6 (2. koşu — ilk koşu 30 dk arka plan sınırına takıldı; komşu UTC GEÇTİ, kalanlar): komşular (tur 5 listesi + git grep; 294 dosya) iki TZ, kâhin cari + defter iki TZ, iki ekran senaryosu iki TZ. Paylaşımlı kilit (ders 52), her adım kendi sınırıyla.
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a961aa7259bce4276
K=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t6-kanit
L=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR="$K" PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194
cd "$W" || exit 1
LIST=$(tr '\n' ' ' < "$K/komsu.txt")
for TZV in Europe/Istanbul; do
  T=$(echo "$TZV" | tr -d '/')
  cat /proc/loadavg
  TZ=$TZV flock -s -w 3600 "$L" timeout -k 5 2400 node tools/kanit.mjs kos "m2t6-komsular-$T" -- node --test --test-concurrency=2 $LIST > "$K/komsu-$T.txt" 2>&1; echo "komşu $TZV çıkış $?"
done
for KK in cari defter; do
  for TZV in UTC Europe/Istanbul; do
    T=$(echo "$TZV" | tr -d '/')
    cat /proc/loadavg
    TZ=$TZV flock -s -w 3600 "$L" timeout -k 5 1800 node tools/kanit.mjs kos "m2t6-kahin-$KK-$T" -- npm run "test:kahin-$KK" > "$K/kahin-$KK-$T.txt" 2>&1; echo "kâhin $KK $TZV çıkış $?"
  done
done
for S in senaryo-degersiz-iptal-m2t2-251 senaryo-degersiz-siniri-m2-251; do
  for TZV in UTC Europe/Istanbul; do
    T=$(echo "$TZV" | tr -d '/')
    mkdir -p "$K/ekran-$S-$T"
    TZ=$TZV EKRAN_DIR="$K/ekran-$S-$T" flock -s -w 3600 "$L" timeout -k 5 900 node tools/kanit.mjs kos "m2t6-e2e-$S-$T" -- node --disable-warning=ExperimentalWarning "test/e2e/$S.mjs" > "$K/e2e-$S-$T.txt" 2>&1; echo "e2e $S $TZV çıkış $?"
  done
done
