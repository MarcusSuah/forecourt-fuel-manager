import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2 } from "lucide-react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SUGGESTIONS = ["Why is total net pay lower than total gross?", "Who had the largest deductions and why?", "Explain how income tax was calculated."];

export function PayrollAssistant({ branchId, branchName, month, year }: { branchId: string; branchName?: string; month: number; year: number }) {
  const [question, setQuestion] = useState("");
  const [wholeYear, setWholeYear] = useState(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const ask = async (q = question) => {
    const text = q.trim();
    if (!text || loading) return;
    setQuestion(text); setLoading(true); setError(""); setAnswer("");
    const { data, error } = await supabase.functions.invoke("payroll-assistant", {
      body: { question: text, branchId, year, month: wholeYear ? null : month },
    });
    setLoading(false);
    if (error) {
      let msg = "The assistant could not answer right now.";
      try { msg = (await (error as any).context?.json())?.error ?? msg; } catch { /* keep default */ }
      return setError(msg);
    }
    if (data?.error) return setError(data.error);
    setAnswer(data?.answer ?? "");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Ask about payroll</CardTitle>
        <CardDescription>
          AI-powered answers about saved payroll for {branchName ?? "this station"} — {wholeYear ? `all of ${year}` : `${MONTHS[month - 1]} ${year}`}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => <Button key={s} size="sm" variant="outline" onClick={() => ask(s)} disabled={loading}>{s}</Button>)}
        </div>
        <Textarea value={question} maxLength={1000} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Why did John's net pay drop this month?" rows={2} />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch id="whole-year" checked={wholeYear} onCheckedChange={setWholeYear} />
            <Label htmlFor="whole-year" className="text-sm">Include the whole year</Label>
          </div>
          <Button onClick={() => ask()} disabled={loading || !question.trim()}>
            {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />} Ask
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {answer && <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">{answer}</div>}
      </CardContent>
    </Card>
  );
}
