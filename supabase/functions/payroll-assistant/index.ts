import { createClient } from "npm:@supabase/supabase-js@2";
import { createOpenAI } from "npm:@ai-sdk/openai";
import { streamText } from "npm:ai";
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId } from "../_shared/run-id.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-lovable-aig-run-id",
  "Access-Control-Expose-Headers": "x-lovable-aig-run-id",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const INSTRUCTIONS = `You are a payroll assistant for a fuel station in Liberia. Answer the dealer's question using ONLY the payroll records provided as JSON.
Explain how pay totals and deductions are computed: gross salary is prorated by days worked; income tax is computed on annualised LRD pay using tax brackets, then converted to a monthly USD figure; NASCORP employee social security is deducted from pay, NASCORP employer is paid by the employer on top; "other deductions" are lateness, advances and shortages; net pay is rounded to whole USD before other deductions are subtracted.
Show the figures you use, in USD unless asked otherwise. If the data does not contain the answer, say so. Be concise; use short bullet points.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Please sign in again." }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(auth.slice(7));
    if (userErr || !userData.user) return json({ error: "Please sign in again." }, 401);
    const { data: role } = await supabase.rpc("get_user_role", { _user_id: userData.user.id });
    if (role !== "dealer" && role !== "admin") return json({ error: "Only dealers and admins can use the payroll assistant." }, 403);

    const body = await req.json().catch(() => ({}));
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const branchId = typeof body.branchId === "string" ? body.branchId : "";
    const year = Number(body.year);
    const month = body.month ? Number(body.month) : null;
    if (!question || question.length > 1000) return json({ error: "Question must be 1–1000 characters." }, 400);
    if (!/^[0-9a-f-]{36}$/i.test(branchId) || !Number.isInteger(year)) return json({ error: "Invalid station or period." }, 400);

    // RLS limits dealers to their own station.
    let q = supabase.from("payroll")
      .select("month, year, gross_salary, days_worked, other_deductions, deductions, net_salary, status, details, employees!inner(full_name, position, branch_id)")
      .eq("employees.branch_id", branchId).eq("year", year);
    if (month) q = q.eq("month", month);
    const { data: rows, error } = await q.limit(300);
    if (error) return json({ error: error.message }, 400);
    if (!rows?.length) return json({ answer: "There are no saved payroll records for this station and period yet." });

    const records = rows.map((r: any) => {
      const d = r.details ?? {};
      return {
        employee: r.employees?.full_name, position: r.employees?.position, month: r.month, year: r.year,
        gross_usd: r.gross_salary, days_worked: r.days_worked, prorated_gross_usd: d.grossPr,
        income_tax_usd: d.incomeTaxUSDPr, nascorp_employee_usd: d.nasEmployee, nascorp_employer_usd: d.nasEmployer,
        other_deductions_usd: r.other_deductions, total_deductions_usd: r.deductions,
        net_pay_usd: r.net_salary, net_pay_lrd: d.roundedNetLRD, exchange_rate: d.exchange_rate,
      };
    });

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI is not configured." }, 500);
    const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(req));
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });
    let failure: any = null;
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      system: INSTRUCTIONS,
      messages: [{ role: "user", content: `Payroll records (JSON):\n${JSON.stringify(records)}\n\nQuestion: ${question}` }],
      abortSignal: req.signal,
      onError: ({ error }) => { failure = error; },
      providerOptions: {
        openai: {
          forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto",
          store: false, include: ["reasoning.encrypted_content"],
        },
      },
    });
    let answer = "";
    try { answer = await result.text; } catch (e) { failure ??= e; }
    if (failure || !answer.trim()) {
      const status = Number(failure?.statusCode) || 502;
      const msg = status === 429 ? "The AI is busy. Please try again in a minute."
        : status === 402 ? "AI credits have run out. Ask the workspace owner to add credits."
        : status === 403 ? "AI access is blocked for this workspace."
        : "The AI could not answer this question.";
      console.error("payroll-assistant failure", status, failure?.message);
      return json({ error: msg }, status);
    }
    const runId = runIdFetch.getRunId();
    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", ...(runId ? { "X-Lovable-AIG-Run-ID": runId } : {}) },
    });
  } catch (e) {
    console.error(e);
    return json({ error: "Something went wrong." }, 500);
  }
});
