import * as O from "./tiger_old"; import * as OA from "./analytics_old";
import * as N from "@/lib/tiger.server"; import * as NA from "@/lib/analytics.server";
import { isDeepStrictEqual } from "node:util";
const users = ["a5ef593a-7934-4972-af54-fe25094b5b3a","07f6126a-2e8f-45c7-b014-0e1b5d29061c","3ac8b495-e23e-4d1c-8dce-8fdb6c0c6375","b685de43-d0a4-4cf6-a3f9-f76b50b1ea47","00000000-0000-0000-0000-0000000000ff"];
const norm = (x: any) => JSON.parse(JSON.stringify(x, (k, v) => (k === "generatedAt" ? 0 : v)));
const t = async <T>(f: () => Promise<T>): Promise<[T, number]> => { const s = performance.now(); const r = await f(); return [r, Math.round(performance.now() - s)]; };
for (const u of users) {
  const [os, ot] = await t(() => O.withOwner(u, (tx) => O.readState(tx, u)));
  const [ns, nt] = await t(() => N.readOwnerState(u));
  const [oa, oat] = await t(() => OA.getAnalytics(u));
  const [na, nat] = await t(() => NA.getAnalytics(u));
  console.log(u.slice(0, 8), "state equal:", isDeepStrictEqual(norm(os), norm(ns)), `load ${ot}→${nt}ms`, "| analytics equal:", isDeepStrictEqual(norm(oa), norm(na)), `${oat}→${nat}ms`, "txns", os?.transactions.length ?? "none");
  if (!isDeepStrictEqual(norm(os), norm(ns))) { const a = norm(os), b = norm(ns); for (const k of Object.keys(a ?? {})) if (!isDeepStrictEqual(a[k], b?.[k])) console.log("  diff", k, JSON.stringify(a[k]).slice(0, 200), "||", JSON.stringify(b?.[k]).slice(0, 200)); }
  if (!isDeepStrictEqual(norm(oa), norm(na))) { const a = norm(oa), b = norm(na); for (const k of Object.keys(a)) if (!isDeepStrictEqual(a[k], b[k])) console.log("  adiff", k, JSON.stringify(a[k]).slice(0, 200), "||", JSON.stringify(b[k]).slice(0, 200)); }
}
