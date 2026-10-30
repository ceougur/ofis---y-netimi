#!/usr/bin/env python3
# Kullanım: git archive <commit> | tar -x -C <kopya>; ln -s <depo>/node_modules <kopya>/node_modules; python3 -I test/tunel-247-mutasyon.py <kopya> [M1 M2 …]
# (kopyada uygular, ilgili testi koşar, geri alır — çalışma ağacına dokunmaz; ders 23). Kanıt: docs/kanit/2026-10-29/m4-247-mutasyon-2.*
# M4 mutasyon denemesi: her mutasyon kopyada uygulanır, ilgili test koşulur, geri alınır. Yakalandı = test kırmızı.
import subprocess, sys, pathlib

M = pathlib.Path(sys.argv[1])
MUTS = [
    ("M1 ana port denetimi kalktı", "server/lib/tunnel/config.mjs",
     'if (forbiddenPorts.filter(Number.isInteger).includes(remotePort)) throw new TunnelError("config", "Tünel ofis ağının ana portuna bağlanamaz.");', '', ["test/tunel-yapilandirma-247.test.mjs"]),
    ("M2 özet karşılaştırması kalktı", "server/lib/tunnel/download.mjs",
     'if (got !== asset.sha256) throw', 'if (false) throw', ["test/tunel-indirici-247.test.mjs"]),
    ("M3 süreç grubu yok (detached false)", "server/lib/tunnel/process.mjs",
     'detached: platform !== "win32",', 'detached: false,', ["test/tunel-surec-247.test.mjs"]),
    ("M4 ofis imzası denetimi kalktı", "bulut/kapi/tunel.mjs",
     'request.headers.get("x-do-imza") || ""))) at("kapi-imza");', 'request.headers.get("x-do-imza") || "")) && false) at("kapi-imza");', ["test/kapi-tunel-247.test.mjs"]),
    ("M5 gövdedeki ofis = yoldaki ofis denetimi kalktı", "bulut/kapi/tunel.mjs",
     'if (govde?.v !== 1 || govde.ofis !== ofis || meta.ofis !== ofis) at("kapi-istek");', 'if (govde?.v !== 1) at("kapi-istek");', ["test/kapi-tunel-247.test.mjs"]),
    ("M6 kapıcı lisans denetimi kalktı", "bulut/kapi/tunel.mjs",
     'if (gorunum?.durum !== "gecerli") at("kapi-lisans");', '', ["test/kapi-tunel-247.test.mjs"]),
    ("M6b kapıcı zaman payı denetimi kalktı", "bulut/kapi/tunel.mjs",
     'if (!Number.isSafeInteger(ms) || Math.abs(now() - ms) > K.zamanPayiMs) at("kapi-zaman", { zaman: now() });', '', ["test/kapi-tunel-247.test.mjs"]),
    ("M7 eşli cihaz yokken de tünel açık", "server/lib/tunnel/manager.mjs",
     'const wanted = d.devices > 0 || d.codes > 0;', 'const wanted = true;', ["test/tunel-yonetici-247.test.mjs"]),
    ("M8 lisans denetimi kalktı", "server/lib/tunnel/manager.mjs",
     'if (!licenseOk()) {', 'if (false) {', ["test/tunel-yonetici-247.test.mjs"]),
    ("M9 Host başlığı (httpHostHeader) kalktı", "server/lib/tunnel/config.mjs",
     'originRequest: { httpHostHeader: host, connectTimeout: "10s", noHappyEyeballs: true }', 'originRequest: { connectTimeout: "10s", noHappyEyeballs: true }', ["test/tunel-yonetici-247.test.mjs", "test/tunel-yapilandirma-247.test.mjs"]),
    ("M10 yetim denetimi kimlik sormuyor", "server/lib/tunnel/process.mjs",
     'return platform === "win32" ? a.toLowerCase().includes(b.toLowerCase()) : a.includes(b);', 'return true;', ["test/tunel-surec-247.test.mjs"]),
    ("M11 kapanışta tünel durmuyor", "server/lib/tunnel/manager.mjs",
     '      await stopProcess();\n      set("off", TUNNEL_REASONS.disabled, { connections: 0 });', '      set("off", TUNNEL_REASONS.disabled, { connections: 0 });', ["test/tunel-yonetici-247.test.mjs"]),
    ("M12 belirteç komut satırına", "server/lib/tunnel/manager.mjs",
     'args: () => [...argsPrefix, ...cloudflaredArgs({ configFile: configFile() })],', 'args: () => [...argsPrefix, ...cloudflaredArgs({ configFile: configFile() }), "--token", token || ""],', ["test/tunel-yonetici-247.test.mjs"]),
]
ONLY = sys.argv[2:]
if ONLY:
    MUTS = [m for m in MUTS if m[0].split()[0] in ONLY]
caught = 0
for name, rel, old, new, tests in MUTS:
    f = M / rel
    src = f.read_text(encoding="utf-8")
    assert src.count(old) == 1, (name, src.count(old))
    f.write_text(src.replace(old, new), encoding="utf-8")
    try:
        r = subprocess.run(["node", "--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", *[str(M / t) for t in tests]], capture_output=True, text=True, timeout=300)
        fail = [l for l in r.stdout.splitlines() if l.startswith("# fail")]
        red = r.returncode != 0
        caught += red
        print(f"{'YAKALANDI' if red else 'KAÇTI    '} {name} — çıkış {r.returncode} {fail}", flush=True)
    finally:
        f.write_text(src, encoding="utf-8")
print(f"\n{caught}/{len(MUTS)} mutasyon yakalandı")
sys.exit(0 if caught == len(MUTS) else 1)
