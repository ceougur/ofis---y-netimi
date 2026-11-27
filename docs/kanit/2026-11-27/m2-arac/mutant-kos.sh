#!/bin/bash
# M2 mutant koşusu: her mutant ayrı kopyada (/dev/shm/m2-kod/mut) uygulanır, yeni testler koşulur, geri alınır. Çıktı: mutant-<ad>.out + özet satırı.
M=/dev/shm/m2-kod/mut
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2-kod
cd "$M" || exit 1
for name in "$@"; do
  python3 -I "$N/mutant.py" "$M" "$name" uygula || exit 1
  if [[ "$name" == M8* ]]; then
    PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194 HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout -k 5 900 node --disable-warning=ExperimentalWarning test/e2e/senaryo-degersiz-siniri-m2-251.mjs > "$N/mutant-$name.out" 2>&1
    code=$?
    summary=$(tail -1 "$N/mutant-$name.out")
  else
    HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout -k 5 900 node --disable-warning=ExperimentalWarning --test --test-concurrency=1 test/supheli-degersiz-siniri-m2-251.test.mjs test/supheli-degersiz-siniri-m2-v249-251.test.mjs > "$N/mutant-$name.out" 2>&1
    code=$?
    summary=$(grep -E "^# (tests|pass|fail)" "$N/mutant-$name.out" | tr '\n' ' ')
  fi
  python3 -I "$N/mutant.py" "$M" "$name" geri || exit 1
  echo "MUTANT $name çıkış $code · $summary"
done
