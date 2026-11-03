# 2.4.9 W mutasyonları: kod commit'inin AYRI kopyasında (git archive; ders 23, 25) her mutasyon tek tek uygulanır, ilgili test dosyası kanit.mjs kos ile koşulur,
# dosya geri yüklenir. Beklenen: her mutasyonda en az bir test KIRMIZI (yakalanmayan mutasyon = eksik test).
import json, os, subprocess, sys

COPY = sys.argv[1]
WT = "/home/user/ofis---y-netimi/.claude/worktrees/agent-ac7daa9bc89dacc8b"
ENV = dict(os.environ, HUKUK_LICENSE_URL="http://127.0.0.1:9", KANIT_DIR=f"{WT}/docs/kanit")

MUTS = [
    ("M01-acmada-ttl-gider", "server/lib/whatsapp/meta-graph.mjs",
     '{ body: { name, language, category, components }, op: "template-create" }',
     '{ body: { name, language, category, components, message_send_ttl_seconds: 259200 }, op: "template-create" }',
     ["test/whatsapp-wt-ttl-249.test.mjs"]),
    ("M02-ttlHours-kabul", "server/lib/whatsapp/queue.mjs",
     'if (Object.hasOwn(body, "ttlHours")) fail(400,',
     'if (false) fail(400,',
     ["test/whatsapp-wt-ttl-249.test.mjs"]),
    ("M03-eski-yansitilan-ttl-okunur", "server/lib/whatsapp/templates.mjs",
     "  return Number.isInteger(listed) && listed > 0 ? listed : META_DEFAULT_TTL_SECONDS;\n}",
     "  if (Number.isInteger(listed) && listed > 0) return listed;\n  const old = meta?.id ? raw.ttl?.[meta.id] : null;\n  return old && !old.rejected && old.echoed > 0 ? old.echoed : META_DEFAULT_TTL_SECONDS;\n}",
     ["test/whatsapp-wt-ttl-249.test.mjs"]),
    ("M04-eski-ttl-islemi-kartta", "server/lib/whatsapp/templates.mjs",
     ".filter(action => action && !action.ttl)",
     ".filter(action => action)",
     ["test/whatsapp-wt-ttl-249.test.mjs"]),
    ("M05-forget-silmez", "server/lib/whatsapp/queue.mjs",
     "      templateCache.delete(key);\n      forgotten += 1;",
     "      forgotten += 1;",
     ["test/whatsapp-w2-onbellek-249.test.mjs"]),
    ("M06-scheduler-tek-kuyruk", "server/lib/whatsapp/scheduler.mjs",
     "          forgotten += Number(queue.forgetTemplates?.(wabaId)) || 0;",
     "          forgotten += Number(queue.forgetTemplates?.(wabaId)) || 0;\n          break;",
     ["test/whatsapp-w2-onbellek-249.test.mjs"]),
    ("M07-forget-yalniz-basarida", "server/lib/whatsapp/templates.mjs",
     "      try {\n        onChecked?.(record.wabaId);\n      } catch {",
     "      try {\n        if (false) onChecked?.(record.wabaId);\n      } catch {",
     None),  # özel: başarı yoluna ayrıca eklenir (aşağıda)
    ("M08-donem-korumasi-yok", "server/lib/whatsapp/queue.mjs",
     "    if ((templateEpoch.get(record.wabaId) || 0) !== epoch) return result;\n",
     "",
     ["test/whatsapp-w2-onbellek-249.test.mjs"]),
    ("M09-noteListing-eski-okuma-yazar", "server/lib/whatsapp/templates.mjs",
     "if (!Number.isFinite(readMs) || newest > readMs) return false;",
     "if (!Number.isFinite(readMs)) return false;",
     ["test/whatsapp-w2-onbellek-249.test.mjs"]),
    ("M10-onizleme-kayda-yazmaz", "server/lib/whatsapp/queue.mjs",
     "      template = await checkTemplate(record, TEMPLATE_NAMES[kind], { force: true, note: true });\n      limitInfo = await dailyLimit(graph, record, { force: true });",
     "      template = await checkTemplate(record, TEMPLATE_NAMES[kind], { force: true });\n      limitInfo = await dailyLimit(graph, record, { force: true });",
     ["test/whatsapp-w2-onbellek-249.test.mjs"]),
    ("M11-baslik-islemi-yok-sayar", "server/lib/whatsapp/meta-graph.mjs",
     "  return META_100_BY_OP[op] || known.title;",
     "  return known.title;",
     ["test/whatsapp-w4-hata100-249.test.mjs"]),
    ("M12-alt-kod-33-islemden-sonra", "server/lib/whatsapp/meta-graph.mjs",
     "  if (Number(subcode) === 33) return META_100_IDS;\n",
     "  if (META_100_BY_OP[op]) return META_100_BY_OP[op];\n  if (Number(subcode) === 33) return META_100_IDS;\n",
     ["test/whatsapp-w4-hata100-249.test.mjs"]),
    ("M13-abonelikte-sinif-degisir", "server/lib/whatsapp/meta-graph.mjs",
     "        retry: known.retry,\n        kind: known.kind,\n        reason: \"meta\",\n      });\n    }\n    if (status < 200 || status >= 300 || !json || typeof json !== \"object\") {",
     "        retry: known.retry,\n        kind: op === \"subscribe\" ? \"config\" : known.kind,\n        reason: \"meta\",\n      });\n    }\n    if (status < 200 || status >= 300 || !json || typeof json !== \"object\") {",
     ["test/whatsapp-w4-hata100-249.test.mjs"]),
    ("M14-abonelik-kalibi-bozuk", "server/lib/whatsapp/meta-graph.mjs",
     "/must be subscribed|subscribed to receive/i",
     "/xx-hic-eslesmez/i",
     ["test/whatsapp-w4-hata100-249.test.mjs"]),
    ("M15-eski-ttlHours-okunur", "server/lib/whatsapp/queue.mjs",
     "    return { dailyCap: Number.isInteger(cap) && cap > 0 ? cap : null };",
     "    return { ...(raw.ttlHours ? { ttlHours: raw.ttlHours } : {}), dailyCap: Number.isInteger(cap) && cap > 0 ? cap : null };",
     ["test/whatsapp-wt-ttl-249.test.mjs"]),
    ("M16-onaylida-ttl-duzenlenir", "server/lib/whatsapp/templates.mjs",
     "      // Açma olduysa liste yeniden okunur (Meta'nın kayıtlı teslim süresi dahil — D0-W5-9).\n",
     "      for (const def of TEMPLATE_DEFS) { const f = findExact(listing.items, def); if (f?.id && upper(f.status) === \"APPROVED\") { try { await createMetaTemplates(connection.metaOptions(record)).details(record.wabaId); } catch {} } }\n      // Açma olduysa liste yeniden okunur (Meta'nın kayıtlı teslim süresi dahil — D0-W5-9).\n",
     None),  # yer tutucu — kullanılmaz
]
MUTS = [m for m in MUTS if m[0] != "M16-onaylida-ttl-duzenlenir"]

out = []
for name, rel, old, new, tests in MUTS:
    path = os.path.join(COPY, rel)
    original = open(path, encoding="utf-8").read()
    assert original.count(old) == 1, (name, original.count(old))
    mutated = original.replace(old, new)
    if name == "M07-forget-yalniz-basarida":
        anchor = "      save(record, user, { items, actions, complete: listing.complete !== false, error: null });\n"
        assert mutated.count(anchor) == 1
        mutated = mutated.replace(anchor, anchor + "      onChecked?.(record.wabaId);\n")
        tests = ["test/whatsapp-w2-onbellek-249.test.mjs"]
    open(path, "w", encoding="utf-8").write(mutated)
    try:
        cmd = ["node", f"{WT}/tools/kanit.mjs", "kos", f"w/mutasyon-{name}", "--", "node", "--test", "--test-reporter=tap", *tests]
        res = subprocess.run(cmd, cwd=COPY, env=ENV, capture_output=True, text=True)
        tail = [line for line in res.stdout.splitlines() if line.startswith("[kanit] w/")]
        fails = [line.strip() for line in res.stdout.splitlines() if line.strip().startswith("✖")]
        out.append({"mutasyon": name, "dosya": rel, "cikis": res.returncode, "yakalandi": res.returncode != 0, "ozet": tail[-1] if tail else "", "ilk_kirmizi": fails[:3]})
        print(json.dumps(out[-1], ensure_ascii=False), flush=True)
    finally:
        open(path, "w", encoding="utf-8").write(original)
json.dump(out, open(f"{WT}/docs/kanit/2026-11-03/w/mutasyon-ozet.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("YAKALANMAYAN:", [o["mutasyon"] for o in out if not o["yakalandi"]])
