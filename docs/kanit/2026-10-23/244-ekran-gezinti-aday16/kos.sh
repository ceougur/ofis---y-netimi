#!/usr/bin/env bash
# 2.4.4 ekran gezintisi (dört yeni ekran öğesi): kos.sh <worktree> <etiket>
# Çıktı: bu klasörün altında <etiket>/ (ekran görüntüleri, sonuc.json, gunluk.txt). Çıkış kodu: 0 = bütün denetimler geçti, 1 = en az bir denetim kaldı,
# 2 = betik yarıda kaldı. Tarayıcı koşusu paylaşılan kilit altında (flock). Ürün koduna dokunmaz; yalnız worktree'den okur.
WT="${1:?worktree yolu}"
TAG="${2:?etiket}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$HERE/$TAG"
LOCK="$(dirname "$HERE")/kos.lock"
[ -d "$WT/node_modules/playwright" ] || { echo "worktree'de node_modules/playwright yok (önce npm ci): $WT"; exit 2; }
mkdir -p "$OUT" || exit 2
echo "worktree=$WT commit=$(git -C "$WT" rev-parse HEAD 2>/dev/null) etiket=$TAG başlangıç=$(date -u +%FT%TZ)" > "$OUT/gunluk.txt"
HUKUK_LICENSE_URL=http://127.0.0.1:9 PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}" \
  flock "$LOCK" node --disable-warning=ExperimentalWarning "$HERE/gezinti.mjs" "$WT" "$OUT" >> "$OUT/gunluk.txt" 2>&1
RC=$?
echo "bitiş=$(date -u +%FT%TZ) rc=$RC" >> "$OUT/gunluk.txt"
tail -n 40 "$OUT/gunluk.txt"
exit $RC
