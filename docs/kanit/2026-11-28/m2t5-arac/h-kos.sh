#!/bin/bash
# M2T5 ORTA-B gösterge ölçümü: yeni (tur 5) ve taban (t251-m2t5-taban) kök × silme anı (Değersiz'den önce / sonra) × GEREKLI (0 / 1); Silinenler 5.000 fatura, 10 cari.
# Paylaşımlı kilitle koşar (ajan kuralı) — KABUL ölçümü değildir; ana oturum özel kilitle yineler. Çıktıda /proc/loadavg.
A=/home/user/ofis---y-netimi/.claude/worktrees/agent-a9a57b6814460a732/docs/kanit/2026-11-28/m2t5-arac
L=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock
for R in /home/user/ofis---y-netimi/.claude/worktrees/agent-a9a57b6814460a732 /dev/shm/m2t5-eski/eski; do
  for G in 0 1; do
    for S in 2026-08-01T10:00:00.000Z 2026-11-01T10:00:00.000Z; do
      echo "== ${R##*/} GEREKLI=$G SILME_ANI=$S"
      GEREKLI=$G SILME_ANI=$S HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=UTC flock -s -w 3600 "$L" timeout -k 5 600 node "$A/h-olcum.mjs" "$R" "${TRASH:-5000}" 10 2>&1 | grep -v -e ExperimentalWarning -e trace-warnings
    done
  done
done
