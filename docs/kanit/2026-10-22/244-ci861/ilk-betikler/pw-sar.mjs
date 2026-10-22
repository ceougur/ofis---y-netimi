// Ortak: testin kullandığı AYNI playwright örneğini (çalışma dizinindeki node_modules) yükler ve her yeni tarayıcı bağlamına init betiği + konsol
// süzgeci ekler. Ön yükleme dosyaları bunu kullanır; ürün koduna dokunulmaz.
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function sar(initScript, arg, prefix) {
  const { chromium } = await import(pathToFileURL(path.join(process.cwd(), "node_modules", "playwright", "index.mjs")).href);
  const launch = chromium.launch.bind(chromium);
  chromium.launch = async (...args) => {
    const browser = await launch(...args);
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async (...options) => {
      const context = await newContext(...options);
      await context.addInitScript(initScript, arg);
      context.on("page", page => page.on("console", msg => { const t = msg.text(); if (t.startsWith(prefix)) console.log(t); }));
      return context;
    };
    return browser;
  };
}
