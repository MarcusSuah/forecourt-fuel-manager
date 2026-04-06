import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { FileText, Play, Printer } from "lucide-react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function Payroll() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  const { data: employees } = useQuery({
    queryKey: ["employees-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, full_name, position, gross_salary").eq("is_active", true).order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: payrollRecords, isLoading } = useQuery({
    queryKey: ["payroll", month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll")
        .select("*, employees(full_name, position)")
        .eq("month", parseInt(month))
        .eq("year", parseInt(year))
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: bonusesForMonth } = useQuery({
    queryKey: ["bonuses-month", month, year],
    queryFn: async () => {
      const startDate = `${year}-${month.padStart(2, "0")}-01`;
      const endMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
      const endYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
      const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
      const { data, error } = await supabase.from("bonuses").select("employee_id, amount").gte("date", startDate).lt("date", endDate);
      if (error) throw error;
      return data;
    },
  });

  const generatePayroll = useMutation({
    mutationFn: async () => {
      if (!employees?.length) throw new Error("No active employees");
      const bonusByEmployee: Record<string, number> = {};
      bonusesForMonth?.forEach(b => {
        bonusByEmployee[b.employee_id] = (bonusByEmployee[b.employee_id] || 0) + Number(b.amount);
      });

      const records = employees.map(emp => {
        const bonus = bonusByEmployee[emp.id] || 0;
        const deductions = Number(emp.gross_salary) * 0.05; // 5% social security
        const net = Number(emp.gross_salary) + bonus - deductions;
        return {
          employee_id: emp.id,
          month: parseInt(month),
          year: parseInt(year),
          gross_salary: Number(emp.gross_salary),
          bonuses: bonus,
          deductions,
          net_salary: net,
          status: "processed",
          created_by: user?.id,
        };
      });

      const { error } = await supabase.from("payroll").upsert(records, { onConflict: "employee_id,month,year" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Payroll generated for ${MONTHS[parseInt(month) - 1]} ${year}`);
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const printPayslip = (record: any) => {
    const emp = (record as any).employees;
    const w = window.open("", "_blank");
    if (!w) { toast.error("Please allow popups"); return; }
    w.document.write(`<!DOCTYPE html><html><head><title>Payslip - ${emp?.full_name}</title>
      <style>body{font-family:-apple-system,sans-serif;padding:40px;max-width:600px;margin:auto}
      .header{text-align:center;border-bottom:2px solid #1e40af;padding-bottom:16px;margin-bottom:20px}
      .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0}
      .total{font-weight:700;font-size:18px;color:#1e40af;border-top:2px solid #1e40af;padding-top:12px;margin-top:8px}
      @media print{.no-print{display:none}}</style></head><body>
      <div class="header">
        <h1 style="margin:0;font-size:20px">PAYSLIP</h1>
        <p style="margin:4px 0 0;color:#64748b">${MONTHS[record.month - 1]} ${record.year}</p>
      </div>
      <div class="row"><span>Employee</span><strong>${emp?.full_name}</strong></div>
      <div class="row"><span>Position</span><span>${emp?.position}</span></div>
      <div class="row"><span>Gross Salary</span><span>$${Number(record.gross_salary).toLocaleString()}</span></div>
      <div class="row"><span>Bonuses</span><span>+$${Number(record.bonuses).toLocaleString()}</span></div>
      <div class="row"><span>Deductions (Social Security 5%)</span><span>-$${Number(record.deductions).toLocaleString()}</span></div>
      <div class="row total"><span>Net Salary</span><span>$${Number(record.net_salary).toLocaleString()}</span></div>
      <div class="no-print" style="text-align:center;margin-top:24px">
        <button onclick="window.print()" style="padding:10px 24px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px">Print Payslip</button>
      </div></body></html>`);
    w.document.close();
  };

  const totalNet = payrollRecords?.reduce((s, r) => s + Number(r.net_salary), 0) || 0;

  return (
    <AppLayout title="Payroll" subtitle="Process monthly payroll and generate payslips">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Payroll Period
            </CardTitle>
            <CardDescription>Select the month/year and generate payroll for all active employees</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <Label>Month</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => generatePayroll.mutate()} disabled={generatePayroll.isPending}>
                <Play className="h-4 w-4 mr-1" /> Generate Payroll
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Payroll — {MONTHS[parseInt(month) - 1]} {year}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Bonuses</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net Salary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payslip</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : !payrollRecords?.length ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No payroll records. Click "Generate Payroll" to create.</TableCell></TableRow>
                  ) : payrollRecords.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{(r as any).employees?.full_name}</TableCell>
                      <TableCell><Badge variant="outline">{(r as any).employees?.position}</Badge></TableCell>
                      <TableCell className="text-right font-mono">${Number(r.gross_salary).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-600">+${Number(r.bonuses).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-destructive">-${Number(r.deductions).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono font-bold">${Number(r.net_salary).toLocaleString()}</TableCell>
                      <TableCell><Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">{r.status}</Badge></TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => printPayslip(r)}>
                          <Printer className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {payrollRecords && payrollRecords.length > 0 && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm flex justify-between">
                <span className="text-muted-foreground">Total Net Payroll</span>
                <span className="font-bold text-lg">${totalNet.toLocaleString()} USD</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
