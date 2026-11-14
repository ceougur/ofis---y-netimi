#!/usr/bin/env python3
# Ç5-A tur 2d İş 1 — dar kontrol 1f DÜŞÜK-2'nin yaşayan sekiz mutantı (tanımlar dk-c5a1f-q/mutant.py'den AYNEN). Her mutant KENDİ kopyamda (c5a2d-q/mut) tek tek açılır,
# test listesi koşulur (kos.sh: yük kilidi paylaşımlı -n, süre sınırlı), dosya HEMEN geri yazılır.
# Kullanım: mutant.py <liste dosyası> <çıktı öneki> [Y2,Y3,...]
import subprocess, sys, json
Q = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2d-q"
M = Q + "/mut/"
INT = "server/lib/integrity.mjs"; SC = "server/lib/integrity-scope.mjs"
MUTS = [
 ("Y2", "account_source_lock: source_id sütunu düşer", INT, 'sql: "SELECT id, source, source_id, doubtful_skip FROM account_entries WHERE', 'sql: "SELECT id, source, doubtful_skip FROM account_entries WHERE'),
 ("Y3", "account_source_lock: doubtful_skip sütunu düşer (WHERE kalır)", INT, 'sql: "SELECT id, source, source_id, doubtful_skip FROM account_entries WHERE', 'sql: "SELECT id, source, source_id FROM account_entries WHERE'),
 ("Y5", "cheques_bounce_lock: has_debt düşer", INT, "e.account_id = c.account_id AND e.kind = 'debt') AS has_debt", "e.account_id = c.account_id AND e.kind = 'debt') * 0 AS has_debt"),
 ("Y10", "süzgeç: tahsil kaydı verilme bloğunda event_id düşer", SC, 'differs(pre, post, ["cheque_id", "bank_account_id", "given_date", "event_id"])', 'differs(pre, post, ["cheque_id", "bank_account_id", "given_date"])'),
 ("Y11", "evrak yardımcısı: cari satırı koşulu ters", SC, '    if (table === "account_entries") {\n      if (pre?.source !== "cheque" && post?.source !== "cheque") return "";', '    if (table === "account_entries") {\n      if (pre?.source === "cheque" || post?.source === "cheque") return "";'),
 ("Y12", "evrak yardımcısı: kilitli evrağın carisi dalı düşer", SC, 'if ((inTrace(pre?.issue_date) || inTrace(post?.issue_date)) && differs(pre, post, ["account_id"])) return "kilitli evrağın carisi";', ''),
 ("Y18", "since etiketi: invoices_gl_lock 2.4.2 (eski sürüm iziyle karşılaştırmaya girer)", INT, '    requires: ["invoices.gl_json", "invoices.try_withheld", "invoices.try_stoppage"],\n    since: "2.5.0",', '    requires: ["invoices.gl_json", "invoices.try_withheld", "invoices.try_stoppage"],\n    since: "2.4.2",'),
 ("Y23", "plan_entries_bond_lock: opening sütunu düşer (WHERE kalır)", INT, 'sql: "SELECT id, cheque_id, opening FROM plan_entries WHERE', 'sql: "SELECT id, cheque_id FROM plan_entries WHERE'),
]


def apply(no, root=M):
    """Mutantı uygular; geri yazma için (yol, özgün metin) döndürür."""
    for n, _name, f, a, b in MUTS:
        if n != no:
            continue
        p = root + f
        src = open(p, encoding="utf-8").read()
        if src.count(a) != 1:
            raise SystemExit(f"{no} UYGULANAMADI ({src.count(a)})")
        open(p, "w", encoding="utf-8").write(src.replace(a, b))
        return p, src
    raise SystemExit(f"{no} yok")


if __name__ == "__main__":
    if sys.argv[1] == "--say":
        for no, _n, f, a, _b in MUTS:
            print(no, open(M + f, encoding="utf-8").read().count(a))
        raise SystemExit(0)
    liste, onek = sys.argv[1], sys.argv[2]
    tests = open(liste).read().split()
    only = set(sys.argv[3].split(",")) if len(sys.argv) > 3 and sys.argv[3] else None
    res = []
    for no, name, f, a, b in MUTS:
        if only and no not in only:
            continue
        p, src = apply(no)
        try:
            out = subprocess.run(["bash", Q + "/betik/kos.sh", f"{onek}-{no}"] + tests, capture_output=True, text=True, timeout=3000).stdout
        except subprocess.TimeoutExpired:
            out = "ZAMAN AŞIMI"
        finally:
            open(p, "w", encoding="utf-8").write(src)
        res.append({"no": no, "name": name, "sonuc": out.strip()[:2000]})
        print(no, out.strip(), flush=True)
    json.dump(res, open(f"{Q}/{onek}-sonuc.json", "w"), ensure_ascii=False, indent=1)
