import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Admin-only edge function to replay or discard queued sync entries.
 *
 * Body:
 *   { action: "retry" | "discard", ids: string[] }
 *
 * - "retry":   re-insert the stored payload into the target table using the
 *              service role, then delete the queue row on success or mark it
 *              as failed with the new error.
 * - "discard": delete the queue rows.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return json({ error: "Missing authorization" }, 401);
    }

    // Verify caller is an admin via their JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return json({ error: "Invalid session" }, 401);
    }

    const { data: roleRow } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return json({ error: "Admin only" }, 403);
    }

    const body = await req.json().catch(() => null);
    const action = body?.action;
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
    if (!["retry", "discard"].includes(action) || ids.length === 0) {
      return json({ error: "Invalid request" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    if (action === "discard") {
      const { error } = await admin.from("sync_queue").delete().in("id", ids);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, processed: ids.length });
    }

    // RETRY: fetch entries, re-insert payloads, then resolve
    const { data: entries, error: fetchErr } = await admin
      .from("sync_queue")
      .select("id, target_table, payload")
      .in("id", ids);
    if (fetchErr) return json({ error: fetchErr.message }, 500);

    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const e of entries ?? []) {
      const rows = Array.isArray(e.payload) ? e.payload : [];
      const { error: insertErr } = await admin
        .from(e.target_table as any)
        .insert(rows as any);
      if (insertErr) {
        await admin
          .from("sync_queue")
          .update({
            status: "failed",
            last_error: insertErr.message,
            attempts: 99, // mark as exhausted by admin replay failure
          })
          .eq("id", e.id);
        results.push({ id: e.id, ok: false, error: insertErr.message });
      } else {
        await admin.from("sync_queue").delete().eq("id", e.id);
        results.push({ id: e.id, ok: true });
      }
    }

    return json({ ok: true, results });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}