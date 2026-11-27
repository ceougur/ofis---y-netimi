# HIZ önerisi için kendi kopyalarımda yama: sayac | fix1 | fix2 (birikimli seçilebilir). Kullanım: hiz-yama.py <kod kökü> <sayac|fix1|fix2>...
import sys
root = sys.argv[1]
p = root + '/server/lib/obligation-queue.mjs'
s = open(p, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a))
    s = s.replace(a, b)
for what in sys.argv[2:]:
    if what == 'sayac':
        rep('function queueOnce(input, mode, lockCaps, {', 'const DK = (globalThis.__dk ||= { queueOnce: 0, coverEvent: 0, coverSetScan: 0, coverSetItems: 0, coverSetNeeded: 0, arrive: 0, arriveSide2: 0, arriveSide2Needed: 0, arriveCopied: 0, nettings: 0, unnet: 0, prepaidPass: 0, lockProbe: 0, build: 0, withCover: 0, s110Scan: 0 });\nfunction queueOnce(input, mode, lockCaps, {')
        rep('  const { lines = [], invoices = [], links = new Map(), chequeEvents = new Map()', '  DK.queueOnce += 1;\n  const { lines = [], invoices = [], links = new Map(), chequeEvents = new Map()')
        rep('  const coverEvent = card => {\n', '  const coverEvent = card => {\n    DK.coverEvent += 1;\n')
        rep('    card.measure = { preA, overhang, preDebt, set: advanceSet || items.filter(', '    if (!advanceSet) { DK.coverSetScan += 1; DK.coverSetItems += items.length; }\n    if (preA + leftover > 0) DK.coverSetNeeded += 1;\n    card.measure = { preA, overhang, preDebt, set: advanceSet || items.filter(')
        rep('    const lists = againstOf(item);\n', '    const lists = againstOf(item);\n    DK.arrive += 1;\n    if (lists.length > 1) { DK.arriveSide2 += 1; DK.arriveCopied += lists[0].length; if (lists[1].some(other => freeMoney(other))) DK.arriveSide2Needed += 1; }\n')
        rep('nettings.push({ debit: target', '(DK.nettings += 1, nettings).push({ debit: target')
        rep('  const unnet = item => {\n', '  const unnet = item => {\n    DK.unnet += 1;\n')
        rep('    state = queueOnce(input, mode, null, { pieces, forced, prepaid });\n    const next = prepaidOf(state, prepaid);', '    DK.prepaidPass += 1;\n    state = queueOnce(input, mode, null, { pieces, forced, prepaid });\n    const next = prepaidOf(state, prepaid);')
        rep('    const probe = queueOnce(input, mode, new Map(state.lockLinks.map(link => [link.id, null])), { pieces, forced, prepaid });', '    DK.lockProbe += 1;\n    const probe = queueOnce(input, mode, new Map(state.lockLinks.map(link => [link.id, null])), { pieces, forced, prepaid });')
        rep('export function buildObligations(input) {\n', 'export function buildObligations(input) {\n  DK.build += 1;\n  if ((input.lines || []).some(line => line.origin === "plan" && line.kind === "plan" && line.covers)) DK.withCover += 1;\n')
        rep('      const own = ownSaleOf(card);', '      DK.s110Scan += 1;\n      const own = ownSaleOf(card);')
    elif what == 'fix1':
        rep('    card.measure = { preA, overhang, preDebt, set: advanceSet || items.filter(item => item.sign > 0 && DEBT_KINDS.has(item.kind) && !item.ownCard && eligible(item)) };', '    card.measure = { preA, overhang, preDebt, set: advanceSet, eligible };')
        rep('    const { preA, overhang, preDebt, set } = card.measure;\n    let claim = preA + card.leftover;\n    if (!(claim > 0)) continue;\n', '    const { preA, overhang, preDebt } = card.measure;\n    let claim = preA + card.leftover;\n    if (!(claim > 0)) continue;\n    const set = card.measure.set || items.filter(item => item.sign > 0 && DEBT_KINDS.has(item.kind) && !item.ownCard && card.measure.eligible(item));\n')
    elif what == 'fixA':  # fix1'den SONRA: S110 / S120 kolunda "kartın taşıdığı borç" kümesi (debts / advanceSet) tembel — yalnız ölçüm ya da ön geçiş isterse kurulur
        rep("        const debts = items.filter(item => item.sign > 0 && DEBT_KINDS.has(item.kind) && !item.ownCard && eligible(item));\n        advanceSet = equal.length === 1 ? equal : [...debts.filter(isElle), ...debts.filter(item => !isElle(item))];",
            "        advanceSet = equal.length === 1 ? equal : () => { const debts = items.filter(item => item.sign > 0 && DEBT_KINDS.has(item.kind) && !item.ownCard && eligible(item)); return [...debts.filter(isElle), ...debts.filter(item => !isElle(item))]; };")
        rep("advanceKeys: (card?.advanceSet || []).map(target => target.key) });", "advanceKeys: ((typeof card?.advanceSet === \"function\" ? card.advanceSet() : card?.advanceSet) || []).map(target => target.key) });")
        rep("    const set = card.measure.set || items.filter(", "    const rawSet = typeof card.measure.set === \"function\" ? card.measure.set() : card.measure.set;\n    const set = rawSet || items.filter(")
    elif what == 'fix2':
        rep('    const against = lists.length === 1 ? lists[0] : [...lists[0], ...lists[1].filter(other => freeMoney(other))];', '    const extra = lists.length === 1 ? null : lists[1].filter(other => freeMoney(other));\n    const against = extra && extra.length ? [...lists[0], ...extra] : lists[0];')
    else:
        raise SystemExit('bilinmeyen: ' + what)
open(p, 'w', encoding='utf-8').write(s)
print('yama tamam:', root.split('/')[-1], sys.argv[2:])
