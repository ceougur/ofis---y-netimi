// Boş veride ve kullanılmış veride Açılış Eşleştirme'nin izinli hedefleri (alt defter kümesi = expected every anahtarları).
import { loginAdmin, removeTestDir, startTestServer } from "/home/user/ofis---y-netimi/.claude/worktrees/agent-abcc7bb2b583ce32f/test/helpers.mjs";
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const server = await startTestServer({ now: { time: "2026-11-23T12:00:00+03:00", fixed: true } });
const admin = await loginAdmin(server);
const v = await admin.get("/api/admin/ledger/opening-match");
console.log("bos", JSON.stringify((v.data?.data ?? v.data).targets.map(t => t.code)));
await admin.post("/api/workspace/stock", { name: "Un", unit: "Kg", unitPrice: "20", salePrice: "30", openingQty: "10", openingDate: "2026-02-01" });
const w = await admin.get("/api/admin/ledger/opening-match");
console.log("stoklu", JSON.stringify((w.data?.data ?? w.data).targets.map(t => t.code)));
await server.app.close();
removeTestDir(server.root);
