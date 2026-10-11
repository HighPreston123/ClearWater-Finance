import postgres from "postgres";
const sql = postgres(process.env.TIGER_DATABASE_URL!, { ssl: "require", max: 1, prepare: false });
const u = "3ac8b495-e23e-4d1c-8dce-8fdb6c0c6375";
let t = performance.now(); const lap = (l: string) => { const n = performance.now(); console.log(l.padEnd(20), Math.round(n - t)); t = n; };
await sql`select 1`; lap("connect");
await sql.begin(async (tx) => {
  lap("begin");
  await tx`SELECT set_config('role','fin_app',true), set_config('app.user_id',${u},true)`; lap("setup");
  await tx`select count(*) from fin.transactions where user_id=${u}`; lap("simple q");
  await tx`select count(*) from fin.owner_daily_activity('2026-01-01','2026-12-31')`; lap("cagg fn");
  await tx`select count(*) from fin.owner_daily_activity('2026-01-01','2026-12-31')`; lap("cagg fn 2");
});
lap("commit"); await sql.end();
