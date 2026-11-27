"""Motorun (server/lib) değiştirilmiş kopyasını kurar. Kullanım: mutant-kopya.py <ad> ; ad: K1 | K3 | K35 | K8
Çıktı: <scratchpad>/c5bkd-mk-<ad>/server/lib/…"""
import os, shutil, sys

S = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad"
W = "/home/user/ofis---y-netimi/.claude/worktrees/agent-a511c161b54069067"
M = {
    "K1": ("if (advance > 0 || (trim > 0 && (card.payments.length || previous?.has(card.planId)))) out.set", "if (advance > 0 || (trim > 0 && card.payments.length)) out.set"),
    "K3": ("const take = Math.min(money - (target.advClaimed || 0), claim);", "const take = Math.min(money, claim);"),
    "K35": ('((target.kind === "note" && kindOf(target.line) === "purchase_return") || (target.kind === "stock" && target.line?.stockReason === "preturn"))', '(target.kind === "stock" && target.line?.stockReason === "preturn")'),
    "K8": (' + pool.filter(target => (target.kind === "installment" || target.kind === "plan-rest") && target.planId !== card.planId).reduce((sum, target) => sum + target.left, 0);', ";"),
}
ad = sys.argv[1]
d = f"{S}/c5bkd-mk-{ad}"
if os.path.isdir(d):
    shutil.rmtree(d)
os.makedirs(f"{d}/server")
shutil.copytree(f"{W}/server/lib", f"{d}/server/lib")
p = f"{d}/server/lib/obligation-queue.mjs"
s = open(p, encoding="utf-8").read()
a, b = M[ad]
assert s.count(a) == 1, (ad, s.count(a))
open(p, "w", encoding="utf-8").write(s.replace(a, b))
print("mutant kopyası:", d)
