// Seed a default supervisor account for every zone that doesn't have one yet.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ZONES = ["central", "north", "east", "west", "south"] as const;
const DEFAULT_PASSWORD = "suprse@231";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Missing auth" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(url, serviceKey);
    const asUser = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } });

    const { data: userRes } = await asUser.auth.getUser();
    const caller = userRes?.user;
    if (!caller) return json({ error: "Not signed in" }, 401);

    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", caller.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Admin only" }, 403);

    const { data: supRoles } = await admin.from("user_roles").select("user_id").eq("role", "supervisor");
    const supIds = (supRoles ?? []).map((r) => r.user_id);
    const { data: attRows } = supIds.length
      ? await admin.from("attendants").select("user_id, supervisor_zone").in("user_id", supIds)
      : { data: [] as any[] };
    const zonesWithSup = new Set((attRows ?? []).filter((a) => a.supervisor_zone).map((a) => a.supervisor_zone));

    let created = 0;
    const results: Array<{ zone: string; email: string; status: string }> = [];

    for (const zone of ZONES) {
      if (zonesWithSup.has(zone)) {
        results.push({ zone, email: "", status: "already has a supervisor" });
        continue;
      }
      const email = `sup.${zone}@forecourtms.local`;
      const { data: existing } = await admin.auth.admin.listUsers();
      const found = existing?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

      let userId: string;
      if (found) {
        userId = found.id;
      } else {
        const { data: created2, error: cErr } = await admin.auth.admin.createUser({
          email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: `Supervisor — ${zone}` },
        });
        if (cErr) {
          results.push({ zone, email, status: `error: ${cErr.message}` });
          continue;
        }
        userId = created2!.user!.id;
      }

      await admin.from("user_roles").upsert({ user_id: userId, role: "supervisor" }, { onConflict: "user_id,role" });
      await admin.from("attendants").upsert({
        user_id: userId,
        supervisor_zone: zone as any,
        full_name: `Supervisor — ${zone}`,
        is_active: true,
      }, { onConflict: "user_id" });

      created += 1;
      results.push({ zone, email, status: "created" });
    }

    return json({ message: `${created} supervisor account(s) created`, results });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}