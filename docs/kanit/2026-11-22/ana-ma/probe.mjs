// Ana oturum: MA ORTA-1 (KDV Özeti devreden KDV'yi görmüyor) yeniden üretimi. Kullanıcıya açık uçlar; ROOT kodu.
import path from 'node:path'; import fs from 'node:fs'; import { pathToFileURL } from 'node:url';
const ROOT = process.env.ROOT, N = process.env.N, PORT = Number(process.env.PORT);
fs.rmSync(N, { recursive: true, force: true }); fs.mkdirSync(N, { recursive: true });
process.env.HUKUK_LICENSE_URL = 'http://127.0.0.1:9';
const { createApp } = await import(pathToFileURL(path.join(ROOT, 'server/app.mjs')).href);
const PW = 'AnaMa-2026xyz';
const app = createApp({ dataDir: path.join(N, 'veri'), backupDir: path.join(N, 'yedek'), logLevel: 'warn', scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: PW, HUKUK_DATASET_AUTOSYNC: '0', HUKUK_LICENSE_URL: 'http://127.0.0.1:9' },
  license: { enforce: false, machineId: 'a0a0c0ffeea0a0c0ffeea0a0c0ffee01' } });
await app.listen(PORT, '127.0.0.1');
const B = `http://127.0.0.1:${PORT}`; let cookie = '';
async function q(m, u, b) {
  const r = await fetch(B + u + (u.includes('?') ? '&' : '?') + 'hofCompany=sirket-001', { method: m, headers: { 'content-type': 'application/json', cookie, 'x-requested-with': 'fetch', origin: B }, body: b ? JSON.stringify(b) : undefined });
  const sc = r.headers.getSetCookie?.() || []; if (sc.length) cookie = sc.map(c => c.split(';')[0]).join('; ');
  const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = t; }
  if (r.status !== 200) throw new Error(`${m} ${u} ${r.status} ${t.slice(0, 400)}`);
  return d && d.ok !== undefined ? d.data : d;
}
await q('POST', '/api/auth/login', { username: 'admin', password: PW });
const sup = (await q('POST', '/api/workspace/accounts', { name: 'Tedarikçi T', type: 'supplier', registeredOn: '2026-01-01' }));
const cus = (await q('POST', '/api/workspace/accounts', { name: 'Müşteri M', type: 'customer', registeredOn: '2026-01-01' }));
const idOf = x => x?.id || x?.account?.id;
const st = await q('POST', '/api/workspace/stock', { name: 'Ürün X', code: 'URN-X', unit: 'Adet', unitPrice: '100', salePrice: '100', vatRate: '20' });
const stockId = st?.id || st?.item?.id || st?.stock?.id;
const inv = (kind, scenario, cari, date, qty, no = '') => q('POST', '/api/workspace/invoices', { kind, scenario, accountId: cari, originalId: '', issueDate: date, issueTime: '10:00', profile: '', currency: 'TRY', rate: '',
  pricesIncludeVat: false, discountRate: '0', number: no, paperNo: '', orderNo: '', orderDate: '', despatchNo: '', despatchDate: '', vatPeriod: '', note: '', stoppageRate: '',
  lines: [{ itemId: stockId, name: 'Ürün X', code: '', description: '', serialNo: '', lotNo: '', unit: 'Adet', qty: String(qty), unitPrice: '100', discountRate: '0', vatRate: '20', withholdingCode: '', expenseType: '', originLineId: '' }],
  payments: [], dueDate: '', action: 'save' });
await inv('purchase', 'goods_purchase', idOf(sup), '2026-01-10', 100, 'TT-0001');   // Ocak indirilecek KDV 2.000
await inv('sale', 'goods_sale', idOf(cus), '2026-02-15', 60);            // Şubat hesaplanan KDV 1.200
const ozet = async (from, to) => { const r = await q('GET', `/api/workspace/report-center/kdv-ozeti?from=${from}&to=${to}`); return (r.summary || []).map(s => s.join(' = ')).join(' | '); };
const out = {};
out.ozetSubatOnce = await ozet('2026-02-01', '2026-02-28');
out.mahsupOcak = await q('POST', '/api/workspace/tax/vat-offset', { month: '2026-01' }).then(r => ({ out: r.offset.outMinor, in: r.offset.inMinor, carryIn: r.offset.carryInMinor, carryOut: r.offset.carryOutMinor, payable: r.offset.payableMinor }));
const pv = (await q('GET', '/api/workspace/tax/vat-offset?month=2026-02')).preview;
out.mahsupSubatOnizleme = { out: pv.outMinor, in: pv.inMinor, carryIn: pv.carryInMinor, carryOut: pv.carryOutMinor, payable: pv.payableMinor, result: pv.result };
out.ozetSubatSonra = await ozet('2026-02-01', '2026-02-28');
out.ozetYil = await ozet('2026-01-01', '2026-12-31');
console.log(JSON.stringify({ TZ: process.env.TZ, ...out }, null, 1));
fs.rmSync(N, { recursive: true, force: true });
process.exit(0);
