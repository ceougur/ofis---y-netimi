R=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/d3rk
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$R/kanit PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194
k() { d=$1; ad=$2; tz=$3; lim=$4; shift 4; ( cd $d && TZ=$tz timeout -k 5 $lim node /home/user/ofis---y-netimi/tools/kanit.mjs kos $ad -- "$@" > $R/kanit/$ad.out 2>&1; echo "$ad cikis=$? $(date -u +%H:%M) yük $(cut -d' ' -f1-3 /proc/loadavg)" >> $O; tail -1 $R/kanit/$ad.out >> $O ); }
