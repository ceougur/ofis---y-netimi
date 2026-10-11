"""Eski kopyaya YALNIZ sınama girişini (iş parçacığı dosyası değiştirilebilir) ekler; davranış değişmez."""
import sys, os
root = sys.argv[1]
def patch(rel, pairs):
    p = os.path.join(root, rel)
    s = open(p, encoding="utf8").read()
    for old, new in pairs:
        assert old in s, (rel, old)
        s = s.replace(old, new)
    open(p, "w", encoding="utf8").write(s)
patch("server/lib/report-runner.mjs", [
    ("export function createReportRunner({ max = 2, timeoutMs = 5 * 60_000 } = {}) {", "export function createReportRunner({ max = 2, timeoutMs = 5 * 60_000, entry = ENTRY } = {}) {"),
    ("new Worker(ENTRY,", "new Worker(entry,"),
])
patch("server/app.mjs", [("createReportRunner() : null;", "createReportRunner(config.reportWorkerEntry ? { entry: config.reportWorkerEntry } : {}) : null;")])
old = "    reportWorker: overrides.reportWorker !== false,\n"
patch("server/lib/config.mjs", [(old, old + "    reportWorkerEntry: overrides.reportWorkerEntry instanceof URL ? overrides.reportWorkerEntry : null,\n")])
print("yama tamam")
