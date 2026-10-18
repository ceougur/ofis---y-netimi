#!/usr/bin/env python3
# 2.4.3 hız düzeltmesi: mutasyon turu (bilerek hata enjekte → yeni testler yakalamalı). Ayrı kopyada (hiz243-mutasyon), her mutasyon tek tek.
import subprocess, sys, os, json
K = "/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad/hiz243-mutasyon"
MUT = [
    ("M1 takvim sürümü sabit (içerik değişse de aynı)", "server/routes/dues.mjs",
     'result.version = createHash("sha256").update(JSON.stringify(content)).digest("base64url").slice(0, 22);',
     'result.version = "sabit-surum-000000000";', "test/hiz-243-arka-plan.test.mjs"),
    ("M2 takvim sürümünde yetki bayrakları yok", "server/routes/dues.mjs",
     'const version = `${data.version}.${Number(see.cheque)}${Number(see.invoice)}${Number(see.bank)}`;',
     'const version = `${data.version}`;', "test/hiz-243-arka-plan.test.mjs"),
    ("M3 kritik stok önbelleği yazmada geçersizleşmez (anahtar sabit)", "server/routes/stock.mjs",
     'const key = `${store.get("SELECT total_changes() AS n").n}|${store.get("PRAGMA data_version").data_version}`;',
     'const key = "sabit";', "test/hiz-243-arka-plan.test.mjs"),
    ("M4 kritik stok önbelleği ortak nesneyi döndürür (kopya yok)", "server/routes/stock.mjs",
     'return alertsCache.value.map(item => ({ ...item }));',
     'return alertsCache.value;', "test/hiz-243-arka-plan.test.mjs"),
    ("M5 liste: hafif satırda açık tutar 0", "server/routes/invoices.mjs",
     '    open: state?.open ?? 0,\n  });',
     '    open: 0,\n  });', "test/fatura-liste-243-fark.test.mjs"),
    ("M6 liste: hafif satırda ödeme durumu yalnız durumdan (taslak/iptal ayrımı yok)", "server/routes/invoices.mjs",
     '    tryPayable: row.tryPayable,\n    payState: state?.state || (row.status === "draft" ? "draft" : row.status === "cancelled" ? "cancelled" : ""),',
     '    tryPayable: row.tryPayable,\n    payState: state?.state || "",', "test/fatura-liste-243-fark.test.mjs"),
    ("M7 liste: cari sıralamasında alıcı adı yerine cari kartı adı", "server/routes/invoices.mjs",
     '    accountName: party ? parseJson(row.partyJson, {}).name || row.accountName : "",',
     '    accountName: party ? row.accountName : "",', "test/fatura-liste-243-fark.test.mjs"),
    ("M8 liste: sayfa bir satır kayık", "server/routes/invoices.mjs",
     'const chosen = shaped.slice(page.offset, page.offset + page.limit);',
     'const chosen = shaped.slice(page.offset, page.offset + page.limit + 1);', "test/fatura-liste-243-fark.test.mjs"),
    ("M9 liste: POS bayrağı sayfada okunmaz", "server/routes/invoices.mjs",
     'const posCash = posCashSet(chosen.filter(item => item.status === "issued").map(item => item.id));',
     'const posCash = new Set();', "test/fatura-liste-243-fark.test.mjs"),
    ("M10 liste: toplam belge sayısı sayfadan", "server/routes/invoices.mjs",
     'if (page) out.total = shaped.length;',
     'if (page) out.total = invoices.length;', "test/fatura-liste-243-fark.test.mjs"),
    ("M11 liste: hafif sorguda alıcı JSON'u yok (arama alıcı adını bulamaz)", "server/routes/invoices.mjs",
     'i.account_id AS accountId, i.party_json AS partyJson,\n      i.try_net AS tryNet',
     "i.account_id AS accountId, '{}' AS partyJson,\n      i.try_net AS tryNet", "test/fatura-liste-243-fark.test.mjs"),
    ("M12 liste: sayfalı istekte de bütün satırlar ağır okunur (eski davranış)", "server/routes/invoices.mjs",
     'let rows = store.all(`${page ? LIST_SQL : INVOICE_SQL}',
     'let rows = store.all(`${page ? INVOICE_SQL : INVOICE_SQL}', "test/fatura-liste-243-fark.test.mjs"),
]
only = set(sys.argv[1:])
results = []
for name, path, old, new, test in MUT:
    if only and name.split()[0] not in only:
        continue
    f = os.path.join(K, path)
    src = open(f, encoding="utf-8").read()
    assert src.count(old) == 1, (name, src.count(old))
    open(f, "w", encoding="utf-8").write(src.replace(old, new))
    try:
        env = dict(os.environ, HUKUK_LICENSE_URL="http://127.0.0.1:9")
        p = subprocess.run(["node", "--disable-warning=ExperimentalWarning", "--test", test], cwd=K, env=env, capture_output=True, text=True, timeout=900)
        out = p.stdout + p.stderr
        fail = [l for l in out.splitlines() if l.startswith("# fail")]
        failing = [l.strip() for l in out.splitlines() if l.strip().startswith("not ok") and " - " in l][:4]
        caught = p.returncode != 0
        results.append({"mutasyon": name, "test": test, "cikis": p.returncode, "yakalandi": caught, "ozet": fail, "kirmizi": failing})
        print(("YAKALANDI " if caught else "KAÇTI     ") + name, fail, flush=True)
    finally:
        open(f, "w", encoding="utf-8").write(src)
print(json.dumps(results, ensure_ascii=False, indent=1))
