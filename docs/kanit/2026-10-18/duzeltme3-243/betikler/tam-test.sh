#!/bin/bash
S=/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad
cd $S/duzeltme3-243
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$S/d3-kanit-tam
flock $S/e2e-243.lock node tools/kanit.mjs kos npm-test-duzeltme3 -- npm test
echo "çıkış=$?"
echo BITTI
