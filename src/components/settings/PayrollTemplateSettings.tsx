import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FileSpreadsheet, Plus, Trash2 } from "lucide-react";
import { usePayrollTemplate } from "@/hooks/usePayrollTemplate";
import { PayrollTemplate, DEFAULT_PAYROLL_TEMPLATE } from "@/lib/payroll";

export function PayrollTemplateSettings() {
  const qc = useQueryClient();
  const { data } = usePayrollTemplate();
  const [t, setT] = useState<PayrollTemplate>(DEFAULT_PAYROLL_TEMPLATE);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setT(data); }, [data]);

  const num = (k: keyof PayrollTemplate, pct = false) => (
    <Input type="number" step="any" value={pct ? +(Number(t[k]) * 100).toFixed(4) : (t[k] as number)}
      onChange={(e) => setT({ ...t, [k]: pct ? Number(e.target.value) / 100 : Number(e.target.value) })} />
  );

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("system_settings").upsert(
      { key: "payroll_template", value: t as any, description: "Payroll template formula and rates" }, { onConflict: "key" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Payroll template saved");
    qc.invalidateQueries({ queryKey: ["payroll-template"] });
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><FileSpreadsheet className="h-5 w-5 text-primary" /> Payroll Template</CardTitle>
        <CardDescription>Rates and income-tax formula used when dealers generate payroll and payslips</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1"><Label>Exchange rate (LRD/USD)</Label>{num("exchange_rate")}</div>
          <div className="space-y-1"><Label>Employee social security %</Label>{num("employee_ss_rate", true)}</div>
          <div className="space-y-1"><Label>Employer social security %</Label>{num("employer_ss_rate", true)}</div>
          <div className="space-y-1"><Label>Days in month (proration)</Label>{num("days_in_month")}</div>
          <div className="space-y-1"><Label>Lateness penalty per late (USD)</Label>{num("lateness_penalty_usd")}</div>
        </div>
        <div>
          <Label>Annual income tax brackets (LRD) — tax = (income − from) × rate + base</Label>
          <div className="space-y-2 mt-2">
            {t.brackets.map((b, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center">
                {(["from", "upTo", "rate", "base"] as const).map((f) => (
                  <Input key={f} type="number" step="any" placeholder={f === "upTo" ? "no limit" : f}
                    value={f === "rate" ? +(b.rate * 100).toFixed(4) : (b[f] ?? "")}
                    onChange={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      const nb = [...t.brackets];
                      nb[i] = { ...b, [f]: f === "rate" ? (v ?? 0) / 100 : f === "upTo" ? v : (v ?? 0) };
                      setT({ ...t, brackets: nb });
                    }} />
                ))}
                <Button size="icon" variant="ghost" onClick={() => setT({ ...t, brackets: t.brackets.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Columns: From · Up to · Rate % · Base amount</p>
            <Button size="sm" variant="outline" onClick={() => setT({ ...t, brackets: [...t.brackets, { from: 0, upTo: null, rate: 0, base: 0 }] })}><Plus className="h-4 w-4 mr-1" /> Add bracket</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(["prepared_by_label", "checked_by_label", "approved_by_label"] as const).map((k) => (
            <div key={k} className="space-y-1"><Label>{k.replace(/_label$/, "").replace(/_/g, " ")} title</Label>
              <Input value={t[k]} onChange={(e) => setT({ ...t, [k]: e.target.value })} /></div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>Save template</Button>
          <Button variant="outline" onClick={() => setT(DEFAULT_PAYROLL_TEMPLATE)}>Reset to default</Button>
        </div>
      </CardContent>
    </Card>
  );
}
