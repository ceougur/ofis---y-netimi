// Küçük, bağımlılıksız yönlendirici: "/api/workspace/cases/:key/notes" gibi kalıpları destekler.
export function createRouter() {
  const routes = [];
  const add = method => (pattern, handler) => {
    const names = [];
    const regex = new RegExp(
      `^${pattern
        .split("/")
        .map(part => {
          if (part.startsWith(":")) {
            names.push(part.slice(1));
            return "([^/]+)";
          }
          return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        })
        .join("/")}$`,
    );
    routes.push({ method, regex, names, handler });
  };
  return {
    get: add("GET"),
    post: add("POST"),
    put: add("PUT"),
    patch: add("PATCH"),
    delete: add("DELETE"),
    match(method, pathname) {
      let pathMatched = false;
      for (const route of routes) {
        const found = route.regex.exec(pathname);
        if (!found) continue;
        pathMatched = true;
        if (route.method !== method && !(method === "HEAD" && route.method === "GET")) continue;
        const params = {};
        route.names.forEach((name, index) => {
          try {
            params[name] = decodeURIComponent(found[index + 1]);
          } catch {
            params[name] = found[index + 1];
          }
        });
        return { handler: route.handler, params };
      }
      return pathMatched ? { methodNotAllowed: true } : null;
    },
  };
}
