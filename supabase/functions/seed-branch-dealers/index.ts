// Seed a default dealer account for every branch that doesn't have one yet.
// Admin-only: verifies caller has role 'admin' before proceeding.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const DEFAULT_PASSWORD = "dealer@123";

const slug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "branch";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return json({ error: "Missing auth" }, 401);
    }

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

    const { data: branches, error: bErr } = await admin.from("branches").select("id, name").eq("is_active", true);
    if (bErr) throw bErr;

    // Existing dealer user_ids
    const { data: dealerRoles } = await admin.from("user_roles").select("user_id").eq("role", "dealer");
    const dealerUserIds = new Set((dealerRoles ?? []).map((r) => r.user_id));
    const { data: attList } = await admin.from("attendants").select("user_id, branch_id").in("user_id", Array.from(dealerUserIds).length ? Array.from(dealerUserIds) : ["00000000-0000-0000-0000-000000000000"]);
    const branchesWithDealer = new Set((attList ?? []).map((a) => a.branch_id));

    let created = 0;
    const results: Array<{ branch: string; email: string; status: string }> = [];

    for (const b of branches ?? []) {
      if (branchesWithDealer.has(b.id)) {
        results.push({ branch: b.name, email: "", status: "already has a dealer" });
        continue;
      }
      const email = `dealer.${slug(b.name)}@forecourtms.local`;

      // Skip if the email already exists in auth
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
          user_metadata: { full_name: `Dealer — ${b.name}` },
        });
        if (cErr) {
          results.push({ branch: b.name, email, status: `error: ${cErr.message}` });
          continue;
        }
        userId = created2!.user!.id;
      }

      // Assign role + attendant record (branch link)
      await admin.from("user_roles").upsert({ user_id: userId, role: "dealer" }, { onConflict: "user_id,role" });
      await admin.from("attendants").upsert({
        user_id: userId,
        branch_id: b.id,
        full_name: `Dealer — ${b.name}`,
        is_active: true,
      }, { onConflict: "user_id" });

      // Force credential change on first login
      await admin.from("profiles").update({ must_change_credentials: true }).eq("user_id", userId);

      created += 1;
      results.push({ branch: b.name, email, status: "created" });
    }

    return json({ message: `${created} dealer account(s) created`, results });
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