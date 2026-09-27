// İstek kapsamı (v2.0.1): her HTTP isteği, isteği yapan kullanıcının seçtiği veri oturumunda çalışır.
// Rotalar değişmeden kalır; veri katmanı (dataset.mjs) ve profil (profile.mjs) oturumu buradan öğrenir.
// Zamanlayıcılar (Sheet eşitlemesi) istek dışında çalıştığından oturumu açıkça verir (runScoped({ datasetKey })).
import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage();

// context: { user?: () => kullanıcı | null (tembel), datasetKey?: string }
export const runScoped = (context, fn) => storage.run(context, fn);
export const currentScope = () => storage.getStore() || null;
