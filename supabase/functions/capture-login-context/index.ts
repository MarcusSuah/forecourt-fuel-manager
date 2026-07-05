import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type GeoInfo = { ip: string | null; country: string | null; city: string | null };

async function lookupGeo(ip: string | null): Promise<GeoInfo> {
  if (!ip || ip === "unknown" || ip.startsWith("127.") || ip.startsWith("::1")) {
    return { ip, country: null, city: null };
  }
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { "User-Agent": "lovable-edge-fn" },
    });
    if (!res.ok) return { ip, country: null, city: null };
    const data = await res.json();
    return {
      ip,
      country: data.country_name ?? data.country ?? null,
      city: data.city ?? null,
    };
  } catch (_e) {
    return { ip, country: null, city: null };
  }
}

function getClientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      mode, // "success" | "failure"
      user_agent,
      device_fingerprint,
      attempted_email,
      failure_reason,
    } = body ?? {};

    const ip = getClientIp(req);
    const geo = await lookupGeo(ip);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (mode === "failure") {
      await admin.from("failed_login_attempts").insert({
        attempted_email: attempted_email ?? null,
        ip_address: geo.ip,
        country: geo.country,
        city: geo.city,
        user_agent: user_agent ?? null,
        failure_reason: failure_reason ?? "invalid_credentials",
      });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // success path — REQUIRE valid JWT; derive identity server-side
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return new Response(JSON.stringify({ ok: false, error: "missing_auth", skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_session", skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const verifiedUserId = userData.user.id;
    const verifiedEmail = userData.user.email ?? null;

    // Fetch role + full name server-side (do not trust client)
    const [{ data: roleRow }, { data: profileRow }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", verifiedUserId).maybeSingle(),
      admin.from("profiles").select("full_name").eq("user_id", verifiedUserId).maybeSingle(),
    ]);

    let isNewDevice = false;
    if (device_fingerprint) {
      const { count } = await admin
        .from("login_activities")
        .select("id", { count: "exact", head: true })
        .eq("user_id", verifiedUserId)
        .eq("device_fingerprint", device_fingerprint);
      isNewDevice = (count ?? 0) === 0;
    }

    await admin.from("login_activities").insert({
      user_id: verifiedUserId,
      user_email: verifiedEmail,
      user_full_name: profileRow?.full_name ?? null,
      role: roleRow?.role ?? null,
      user_agent: user_agent ?? null,
      ip_address: geo.ip,
      country: geo.country,
      city: geo.city,
      device_fingerprint: device_fingerprint ?? null,
      is_new_device: isNewDevice,
    });

    return new Response(JSON.stringify({ ok: true, is_new_device: isNewDevice, geo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[capture-login-context]", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});