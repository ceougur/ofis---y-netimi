import sys
p = sys.argv[1] + '/server/lib/integrity-scope.mjs'
s = open(p, encoding='utf-8').read()
old = '''      for (const rowid of new Set([...posts.keys(), ...pres.keys()])) list.push({ pre: pres.get(rowid) || null, post: posts.get(rowid) || null });
      s.rows.set(table, list);
      for (const { pre, post } of list) if (pre && post && String(pre.id ?? "") !== String(post.id ?? "")) s.reason ||= `${table}: kimlik değişti`;'''
assert s.count(old) == 1
new = '''      // ÖNERİ (izt2 prototipi — dosya sınırı dışı, KOD DEĞİL): aynı rowid'e silinip başka kimlikle yeniden yazılan satır (SQLite rowid yeniden kullanımı) iki ayrı satırdır — silinen (pre) ve
      // eklenen (post). Önceden "kimlik değişti" tam kapıya düşüyordu (yeni yazılmış faturanın Düzenle'si: 100 bin satırda ~7 sn).
      for (const rowid of new Set([...posts.keys(), ...pres.keys()])) {
        const pre = pres.get(rowid) || null;
        const post = posts.get(rowid) || null;
        if (pre && post && String(pre.id ?? "") !== String(post.id ?? "")) list.push({ pre, post: null }, { pre: null, post });
        else list.push({ pre, post });
      }
      s.rows.set(table, list);'''
s = s.replace(old, new)
open(p, 'w', encoding='utf-8').write(s)
print('tamam')
