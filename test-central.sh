#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:5133}"
export HUKUK_DATA_DIR="${HUKUK_DATA_DIR:-/tmp/hukuk-merkezi-test-data}"
export HUKUK_BACKUP_DIR="${HUKUK_BACKUP_DIR:-/tmp/hukuk-merkezi-test-backups}"
JAR1=/tmp/hof-user1.cookies
JAR2=/tmp/hof-user2.cookies
rm -f "$JAR1" "$JAR2"
json_field() { python3 -c 'import json,sys; d=json.load(sys.stdin); v=d
for k in sys.argv[1:]: v=v[int(k)] if isinstance(v,list) else v[k]
print(v)' "$@"; }
health=$(curl -fsS "$BASE/api/health")
echo "HEALTH $health"
login=$(curl -fsS -c "$JAR1" -H 'content-type: application/json' -d '{"username":"admin","password":"Test-Admin-2026!"}' "$BASE/api/auth/login")
echo "LOGIN $login"
user=$(curl -fsS -b "$JAR1" -H 'content-type: application/json' -d '{"username":"personel1","name":"Test Personel","role":"personel","password":"Personel-2026!"}' "$BASE/api/admin/users")
echo "USER $user"
login2=$(curl -fsS -c "$JAR2" -H 'content-type: application/json' -d '{"username":"personel1","password":"Personel-2026!"}' "$BASE/api/auth/login")
echo "LOGIN2 $login2"
state=$(curl -fsS -b "$JAR2" "$BASE/api/workspace/state")
echo "STATE $(printf '%s' "$state" | json_field data activeUser role)"
record=$(curl -fsS -b "$JAR2" -H 'content-type: application/json' -d '{"sourceName":"test-sheet","caseKey":"2026/TEST-1","values":{"DOSYA NO":"2026/TEST-1","BORÇLU":"Ali Veli","DURUM":"Açık"}}' "$BASE/api/workspace/records")
echo "RECORD $record"
override=$(curl -fsS -b "$JAR2" -H 'content-type: application/json' -d '{"sourceName":"test-sheet","caseKey":"2026/TEST-1","field":"DURUM","value":"Takipte"}' "$BASE/api/workspace/overrides")
echo "OVERRIDE $override"
version=$(printf '%s' "$override" | json_field data version)
conflict=$(curl -sS -o /tmp/hof-conflict.json -w '%{http_code}' -b "$JAR1" -H 'content-type: application/json' -d "{\"sourceName\":\"test-sheet\",\"caseKey\":\"2026/TEST-1\",\"field\":\"DURUM\",\"value\":\"Çakıştı\",\"expectedVersion\":0}" "$BASE/api/workspace/overrides")
test "$conflict" = "409"
echo "CONFLICT HTTP $conflict"
curl -fsS -b "$JAR2" -H 'content-type: application/json' -d '{"note":"İlk merkezi test notu"}' "$BASE/api/workspace/cases/2026%2FTEST-1/notes" >/dev/null
curl -fsS -b "$JAR2" -H 'content-type: application/json' -d '{"title":"Haciz kontrolü","placedAt":"2026-09-23"}' "$BASE/api/workspace/cases/2026%2FTEST-1/liens" >/dev/null
reports=$(curl -fsS -b "$JAR1" "$BASE/api/workspace/reports")
echo "REPORT $(printf '%s' "$reports" | json_field data totals events) EVENTS"
state2=$(curl -fsS -b "$JAR2" "$BASE/api/workspace/state")
echo "STATE2 $(printf '%s' "$state2" | json_field data records 0 caseKey)"
BASE="$BASE" node tools/backup.mjs >/tmp/hof-backup-path.txt
backup=$(cat /tmp/hof-backup-path.txt)
test -s "$backup"
echo "BACKUP $backup"
static=$(curl -fsS "$BASE/" | grep -o 'central-auth.js' | head -1)
test "$static" = "central-auth.js"
echo "STATIC AUTH $static"
echo "ALL CENTRAL TESTS PASSED"
