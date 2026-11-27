#!/usr/bin/env python3
# M2 mutantları (DEĞERLE): python3 -I mutant.py <kök> <ad> uygula | geri  — dosyanın özgün hâli <kök>/.m2-mutant-<dosya>.orig'ta tutulur.
import os, shutil, sys

ROOT, NAME, ACTION = sys.argv[1], sys.argv[2], sys.argv[3]
SRV = 'server/lib/bank/doubtful.mjs'
CLI = 'client/assets/hof-accounts.js'
MUTANTS = {
    'M1-sonradan-bagsiz': (SRV, 'const credits = ctx.credits.filter(credit => !(ctx.bound.has(credit.key) && credit.date >= date));',
                           'const credits = ctx.credits.filter(credit => !(credit.date > date && !credit.target) && !(ctx.bound.has(credit.key) && credit.date >= date));'),
    'M2-sonraki-degersiz': (SRV, 'const credits = ctx.credits.filter(credit => !(ctx.bound.has(credit.key) && credit.date >= date));',
                            'const credits = ctx.credits.filter(credit => !(credit.target && credit.date > date) && !(ctx.bound.has(credit.key) && credit.date >= date));'),
    'M3-onceki-gun-payi': (SRV, 'const credits = ctx.credits.filter(credit => !(ctx.bound.has(credit.key) && credit.date >= date));',
                           'const credits = ctx.credits.filter(credit => !ctx.bound.has(credit.key));'),
    'M4-o-gun-payi-once': (SRV, 'const credits = ctx.credits.filter(credit => !(ctx.bound.has(credit.key) && credit.date >= date));',
                           'const credits = ctx.credits.filter(credit => !(ctx.bound.has(credit.key) && credit.date > date));'),
    'M5a-yazim-denetimi-yok': (SRV, "return { fits: Boolean(hit) && !((hit.outsideMinor || 0) > 0) && !grows, openMinor };", "return { fits: true, openMinor };"),
    'M5b-mutabakat-degismezi-yok': (SRV, '  for (const item of writeOffInvariantProblems(store, { parties })) out.push(item);\n', '\n'),
    'M6-oneri-bakiye-kurali-yok': (SRV, '  const offerMinor = largestPassing(limitMinor, minor => {', '  const offerMinor = limitMinor || largestPassing(limitMinor, minor => {'),
    'M6b-bakiye-siniri-yok': (SRV, '  const cap = Math.max(0, Math.min(room, balance));', '  const cap = Math.max(0, room);'),
    'M7-geri-yukleme-siniri-yok': (SRV, '      assertWriteOffLimit(record, payload.date, Number(payload.amountMinor), { at: payload.entry?.created_at || undefined, restoring: true });\n', '\n'),
    'M8-form-eski-kalan': (CLI, '    let suggested = first ? (first.offerMinor > 0 ? amountText(first.offerMinor) : "") : amountText(record.remainingMinor);',
                           '    let suggested = amountText(record.remainingMinor);'),
    'M8b-form-ipucu-eski': (CLI, '      extraHtml: `<p class="hof-modal-text" data-dbt-wo-hint aria-live="polite">${esc(first ? writeOffHint(first, best) : `En çok ${minorMoney(record.remainingMinor)} (kalan şüpheli).`)}</p>`,',
                            '      extraHtml: `<p class="hof-modal-text" data-dbt-wo-hint aria-live="polite">${esc(`En çok ${minorMoney(record.remainingMinor)} (kalan şüpheli).`)}</p>`,'),
}
path, old, new = MUTANTS[NAME]
full = os.path.join(ROOT, path)
orig = os.path.join(ROOT, '.m2-mutant-' + os.path.basename(path) + '.orig')
if ACTION == 'uygula':
    s = open(full, encoding='utf-8').read()
    assert s.count(old) == 1, f'{NAME}: desen {s.count(old)} kez'
    if not os.path.exists(orig):
        shutil.copyfile(full, orig)
    open(full, 'w', encoding='utf-8').write(s.replace(old, new, 1))
    print(f'{NAME}: uygulandı ({path})')
else:
    shutil.copyfile(orig, full)
    os.remove(orig)
    print(f'{NAME}: geri alındı')
