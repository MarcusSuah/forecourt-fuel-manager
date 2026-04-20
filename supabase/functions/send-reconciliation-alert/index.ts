// Send Critical reconciliation alerts via Email (Lovable Emails) and SMS (Twilio).
// Designed to no-op gracefully if a channel is not configured.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

interface AlertPayload {
  tank_id: string;
  branch_id: string;
  tank_name: string;
  branch_name: string;
  product_type: string;
  loss_usg: number;
  threshold_usg: number;
  stock_reading_id?: string;
  dip_date?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = (await req.json()) as AlertPayload;
    if (!body?.tank_id || !body?.branch_id || typeof body.loss_usg !== "number") {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: skip if same alert was logged in last 6 hours
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("reconciliation_alerts")
      .select("id")
      .eq("tank_id", body.tank_id)
      .eq("loss_usg", body.loss_usg)
      .gte("created_at", sixHoursAgo)
      .limit(1);
    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ ok: true, deduped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find recipients: admins, supervisors (any branch) + dealers of this branch
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "supervisor", "dealer"]);

    const adminSupIds = (roleRows ?? []).filter((r) => r.role !== "dealer").map((r) => r.user_id);
    const dealerIds = (roleRows ?? []).filter((r) => r.role === "dealer").map((r) => r.user_id);

    // Filter dealers to only those in the affected branch via attendants table
    let branchDealerIds: string[] = [];
    if (dealerIds.length > 0) {
      const { data: attRows } = await supabase
        .from("attendants")
        .select("user_id")
        .in("user_id", dealerIds)
        .eq("branch_id", body.branch_id);
      branchDealerIds = (attRows ?? []).map((a) => a.user_id).filter(Boolean) as string[];
    }

    const recipientIds = Array.from(new Set([...adminSupIds, ...branchDealerIds]));

    let emails: string[] = [];
    let phones: string[] = [];
    if (recipientIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("email, phone")
        .in("user_id", recipientIds);
      emails = (profiles ?? []).map((p) => p.email).filter(Boolean) as string[];
      phones = (profiles ?? []).map((p) => p.phone).filter(Boolean) as string[];
    }

    const subject = `🚨 CRITICAL Loss Alert — ${body.tank_name} at ${body.branch_name}`;
    const message = `Critical reconciliation event detected.
Branch: ${body.branch_name}
Tank: ${body.tank_name} (${body.product_type})
Loss: ${Math.abs(body.loss_usg).toFixed(1)} USG (threshold: ${body.threshold_usg} USG)${body.dip_date ? `\nDip date: ${body.dip_date}` : ""}
Please investigate immediately.`;

    const sentEmails: string[] = [];
    const sentPhones: string[] = [];
    let lastError: string | null = null;

    // ---- EMAIL via Lovable Emails (if scaffolded) ----
    if (emails.length > 0) {
      try {
        for (const to of emails) {
          const { error } = await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "reconciliation-critical-alert",
              recipientEmail: to,
              idempotencyKey: `recon-${body.tank_id}-${Math.round(body.loss_usg)}-${Date.now()}`,
              templateData: {
                tankName: body.tank_name,
                branchName: body.branch_name,
                productType: body.product_type,
                lossUsg: Math.abs(body.loss_usg).toFixed(1),
                thresholdUsg: body.threshold_usg,
                dipDate: body.dip_date ?? "",
              },
            },
          });
          if (error) {
            lastError = `Email: ${error.message}`;
          } else {
            sentEmails.push(to);
          }
        }
      } catch (e) {
        lastError = `Email channel unavailable: ${(e as Error).message}`;
      }
    }

    // ---- SMS via Twilio gateway (if connected) ----
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER");
    if (phones.length > 0 && LOVABLE_API_KEY && TWILIO_API_KEY && TWILIO_FROM) {
      for (const phone of phones) {
        try {
          const res = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": TWILIO_API_KEY,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: phone,
              From: TWILIO_FROM,
              Body: message.slice(0, 1500),
            }),
          });
          if (res.ok) {
            sentPhones.push(phone);
          } else {
            lastError = `SMS [${res.status}]: ${(await res.text()).slice(0, 200)}`;
          }
        } catch (e) {
          lastError = `SMS error: ${(e as Error).message}`;
        }
      }
    }

    // Log the alert
    await supabase.from("reconciliation_alerts").insert({
      tank_id: body.tank_id,
      branch_id: body.branch_id,
      stock_reading_id: body.stock_reading_id ?? null,
      loss_usg: body.loss_usg,
      threshold_usg: body.threshold_usg,
      severity: "critical",
      notified_emails: sentEmails,
      notified_phones: sentPhones,
      notification_status:
        sentEmails.length + sentPhones.length > 0 ? "sent" : "no_channel",
      notification_error: lastError,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        emails_sent: sentEmails.length,
        sms_sent: sentPhones.length,
        last_error: lastError,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-reconciliation-alert error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
