import { createRequire } from "node:module";
import path from "node:path";
const { chromium } = createRequire("/home/user/ofis---y-netimi/")("playwright");
const dir = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const name of process.argv.slice(3)) {
  await page.goto(`file://${path.join(dir, name)}.html`, { waitUntil: "networkidle" });
  await page.pdf({ path: path.join(dir, `${name}.pdf`), format: "A4", printBackground: true, margin: { top: "14mm", bottom: "16mm", left: "13mm", right: "13mm" }, displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: `<div style="font-size:8px;color:#8a9a93;width:100%;text-align:center;font-family:sans-serif">DestekOfis · <span class="pageNumber"></span> / <span class="totalPages"></span></div>` });
  console.log("pdf:", name);
}
await browser.close();
