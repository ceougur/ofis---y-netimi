# Kullanım: bash kos.sh <etiket> <kod kökü> <test...> — her test iki TZ'de, kanit.mjs ile; özet satırları <etiket>.ozet
NB=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2e-k3
tag=$1; root=$2; shift 2
cd "$root" || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$NB/kanit
: > $NB/$tag.ozet
for t in "$@"; do
  b=$(basename $t .mjs); b=${b%.test}
  for tz in UTC Europe/Istanbul; do
    z=${tz//\//_}
    TZ=$tz timeout -k 5 1800 node tools/kanit.mjs kos c5a2e-$tag-$b-$z -- node --disable-warning=ExperimentalWarning --test --test-reporter=spec $t > $NB/out-$tag-$b-$z.txt 2>&1
    echo "$? $(grep '^\[kanit\] c5a2e' $NB/out-$tag-$b-$z.txt | tail -1 | cut -c1-200)" >> $NB/$tag.ozet
  done
done
echo BITTI >> $NB/$tag.ozet
