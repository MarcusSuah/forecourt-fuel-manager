// Admin-only: creates 5 demo stations (one per zone) with dealer logins and
// 30 days of realistic operational data (dips, meter readings, deliveries,
// cash deposits) plus employees and 2 months of payroll. Idempotent per station name.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const PASSWORD = "dealer@fms001#";
const RATE = 192;
const PRICE = { PMS: 4.95, AGO: 5.25 };
const STATIONS = [
  { name: "Paynesville Station", county: "Montserrado", zone: "central", type: "COCO Dealer" },
  { name: "Voinjama Station", county: "Lofa", zone: "north", type: "Young Dealer" },
  { name: "Ganta Station", county: "Nimba", zone: "east", type: "Financial Dealer" },
  { name: "Robertsport Station", county: "Grand Cape Mount", zone: "west", type: "Young Dealer" },
  { name: "Greenville Station", county: "Sinoe", zone: "south", type: "COCO Dealer" },
];
const FIRST = ["James", "Mary", "Joseph", "Fatu", "Emmanuel", "Grace", "Moses", "Comfort", "Samuel", "Musu", "Prince", "Hawa"];
const LAST = ["Kollie", "Doe", "Flomo", "Sirleaf", "Kamara", "Togba", "Weah", "Johnson", "Massaquoi", "Gbah"];

// Deterministic pseudo-random so reruns look the same
let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const between = (a: number, b: number) => a + rnd() * (b - a);
const r2 = (n: number) => Math.round(n * 100) / 100;
const iso = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Missing auth" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const { data: u } = await asUser.auth.getUser();
    if (!u?.user) return json({ error: "Not signed in" }, 401);
    const { data: isAdmin } = await admin.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!isAdmin) return json({ error: "Admin only" }, 403);

    const { data: shifts } = await admin.from("shifts").select("id, name");
    const shiftId = (n: string) => shifts!.find((s) => s.name === n)!.id;
    const dayShifts = [shiftId("Morning"), shiftId("Night")];
    const { data: allUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });

    const results: unknown[] = [];
    for (const [si, st] of STATIONS.entries()) {
      seed = 1000 + si * 97;
      const { data: exists } = await admin.from("branches").select("id").eq("name", st.name).maybeSingle();
      if (exists) { results.push({ station: st.name, status: "already exists" }); continue; }

      const { data: branch, error: bErr } = await admin.from("branches")
        .insert({ name: st.name, county: st.county, location: `${st.county} County`, zone: st.zone, franchise_type: st.type, is_active: true })
        .select("id").single();
      if (bErr) throw bErr;
      const branchId = branch.id;

      // Dealer login
      const email = `${st.name.split(" ")[0].toLowerCase()}@forecourt.lr`;
      let userId = allUsers?.users.find((x) => x.email?.toLowerCase() === email)?.id;
      if (!userId) {
        const { data: cu, error: cErr } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Dealer — ${st.name}` } });
        if (cErr) throw cErr;
        userId = cu.user!.id;
      }
      await admin.from("user_roles").upsert({ user_id: userId, role: "dealer" }, { onConflict: "user_id,role" });
      await admin.from("attendants").upsert({ user_id: userId, branch_id: branchId, full_name: `Dealer — ${st.name}`, is_active: true }, { onConflict: "user_id" });

      // Island, tanks, pumps
      const { data: island } = await admin.from("islands").insert({ branch_id: branchId, island_number: 1, is_active: true }).select("id").single();
      const tankDefs = [
        { name: "PMS-TANK-1", product_type: "PMS", capacity_usg: 10000 },
        { name: "PMS-TANK-2", product_type: "PMS", capacity_usg: 8000 },
        { name: "AGO-TANK-1", product_type: "AGO", capacity_usg: 10000 },
      ];
      const { data: tanks, error: tErr } = await admin.from("tanks").insert(tankDefs.map((t) => ({
        ...t, branch_id: branchId, current_level_usg: Math.round(t.capacity_usg * 0.7), threshold_usg: Math.round(t.capacity_usg * 0.2),
        reconciliation_threshold_usg: 50, status: "Medium", is_active: true,
      }))).select("id, name, product_type, capacity_usg");
      if (tErr) throw tErr;
      const pumpDefs = [
        { name: "P1", product_type: "PMS", tank: 0 }, { name: "P2", product_type: "PMS", tank: 0 },
        { name: "P3", product_type: "PMS", tank: 1 }, { name: "P4", product_type: "AGO", tank: 2 }, { name: "P5", product_type: "AGO", tank: 2 },
      ];
      const { data: pumps, error: pErr } = await admin.from("pumps").insert(pumpDefs.map((p) => ({
        branch_id: branchId, island_id: island!.id, name: p.name, product_type: p.product_type, totalizers_count: 1, is_active: true,
      }))).select("id, name");
      if (pErr) throw pErr;
      await admin.from("tank_pump_assignments").insert(pumpDefs.map((p, i) => ({ pump_id: pumps![i].id, tank_id: tanks![p.tank].id })));

      // Attendants
      const { data: atts } = await admin.from("attendants").insert([0, 1, 2, 3].map((i) => ({
        branch_id: branchId, full_name: `${FIRST[(si * 3 + i) % FIRST.length]} ${LAST[(si * 2 + i) % LAST.length]}`, employee_id: `ATT-${si + 1}0${i + 1}`, is_active: true,
      }))).select("id");

      // 30 days of operations
      const level = tanks!.map((t) => Math.round(Number(t.capacity_usg) * 0.7));
      const meter = pumpDefs.map(() => Math.round(between(20000, 90000)));
      const today = new Date();
      for (let d = 29; d >= 0; d--) {
        const day = new Date(today); day.setUTCDate(day.getUTCDate() - d);
        const date = iso(day);

        // Deliveries when a tank drops under 35%
        const dels: any[] = [];
        tanks!.forEach((t, ti) => {
          const cap = Number(t.capacity_usg);
          if (level[ti] < cap * 0.35) {
            const qty = Math.round((cap - level[ti]) * between(0.75, 0.9));
            dels.push({ branch_id: branchId, tank_id: t.id, delivery_date: date, quantity_usg: qty, supplier: rnd() > 0.5 ? "Srimex Oil" : "Aminata & Sons", driver_name: "Driver", vehicle_plate: `LR-${Math.round(between(1000, 9999))}`, receipt_number: `RC-${si}${d}${ti}` });
            level[ti] += qty;
          }
        });
        if (dels.length) { const { error } = await admin.from("fuel_deliveries").insert(dels); if (error) throw error; }

        const dips: any[] = []; const sales: any[] = []; const cash: any[] = [];
        dayShifts.forEach((shift, sIdx) => {
          const opening = [...level];
          const att = atts![(sIdx + d) % atts!.length].id;
          let shiftUsd = 0;
          const tankSold = tanks!.map(() => 0);
          pumpDefs.forEach((p, pi) => {
            const usg = r2(between(p.product_type === "AGO" ? 120 : 160, p.product_type === "AGO" ? 260 : 340));
            const liters = usg * 3.785411784;
            const open = meter[pi]; meter[pi] = r2(open + liters);
            sales.push({ branch_id: branchId, shift_id: shift, date, attendant_id: att, island_id: island!.id, pump_id: pumps![pi].id, opening_meter: open, closing_meter: meter[pi], rtt_usg: 0, unit_price_usd: PRICE[p.product_type as "PMS" | "AGO"] });
            tankSold[p.tank] += usg; shiftUsd += usg * PRICE[p.product_type as "PMS" | "AGO"];
          });
          tanks!.forEach((t, ti) => {
            const loss = between(-4, 12); // evaporation / small variance
            const closing = Math.max(0, Math.round(opening[ti] - tankSold[ti] - loss));
            if (sIdx === 0) dips.push({ tank_id: t.id, branch_id: branchId, date, shift_id: shift, physical_level_usg: opening[ti], theoretical_level_usg: opening[ti], notes: "Opening dip" });
            dips.push({ tank_id: t.id, branch_id: branchId, date, shift_id: shift, physical_level_usg: closing, theoretical_level_usg: Math.max(0, Math.round(opening[ti] - tankSold[ti])), notes: "Closing dip" });
            level[ti] = closing;
          });
          const deposited = shiftUsd * between(0.96, 1.0);
          const lrdPart = deposited * 0.3;
          cash.push({ branch_id: branchId, shift_id: shift, date, attendant_id: att, deposit_type: "USD", amount: r2(deposited - lrdPart), exchange_rate: 1 });
          cash.push({ branch_id: branchId, shift_id: shift, date, attendant_id: att, deposit_type: "LRD", amount: Math.round(lrdPart * RATE), exchange_rate: RATE });
        });
        for (const [table, rows] of [["shift_sales_reports", sales], ["stock_readings", dips], ["cash_deposits", cash]] as const) {
          const { error } = await admin.from(table).insert(rows as any[]);
          if (error) throw new Error(`${table}: ${error.message}`);
        }
      }

      // Employees + payroll for the last 2 months
      const positions = [["Station Manager", 450], ["Cashier", 220], ["Pump Attendant", 160], ["Pump Attendant", 160], ["Security", 140], ["Cleaner", 110]] as const;
      const { data: emps, error: eErr } = await admin.from("employees").insert(positions.map(([pos, sal], i) => ({
        branch_id: branchId, full_name: `${FIRST[(si + i * 5) % FIRST.length]} ${LAST[(si * 3 + i) % LAST.length]}`, position: pos, gross_salary: sal,
        employment_date: "2024-01-15", gender: i % 2 ? "Female" : "Male", phone: `+23177${si}${100000 + i}`, is_active: true, employment_status: "active",
      }))).select("id, gross_salary");
      if (eErr) throw eErr;
      const runs: any[] = [];
      for (const back of [2, 1]) {
        const m = new Date(today.getUTCFullYear(), today.getUTCMonth() - back, 1);
        emps!.forEach((e) => {
          const gross = Number(e.gross_salary); const bonus = rnd() > 0.7 ? 20 : 0; const ss = r2(gross * 0.05);
          runs.push({ employee_id: e.id, month: m.getMonth() + 1, year: m.getFullYear(), gross_salary: gross, bonuses: bonus, deductions: ss, other_deductions: 0, net_salary: r2(gross + bonus - ss), days_worked: 26, status: "paid", details: {} });
        });
      }
      const { error: prErr } = await admin.from("payroll").insert(runs);
      if (prErr) throw prErr;

      results.push({ station: st.name, email, status: "created" });
    }
    return json({ ok: true, password: "(default dealer password)", results });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
