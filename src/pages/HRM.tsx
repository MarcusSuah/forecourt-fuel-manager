import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, CalendarDays, Gift, DollarSign } from "lucide-react";
import { format } from "date-fns";

export default function HRM() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [bonusOpen, setBonusOpen] = useState(false);

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, full_name, position, gross_salary").eq("is_active", true).order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: leaveRequests } = useQuery({
    queryKey: ["leave-requests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leave_requests").select("*, employees(full_name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: bonuses } = useQuery({
    queryKey: ["bonuses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bonuses").select("*, employees(full_name)").order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Leave form
  const [leaveForm, setLeaveForm] = useState({ employee_id: "", leave_type: "", start_date: "", end_date: "", reason: "" });
  const addLeaveMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("leave_requests").insert(data);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Leave request added"); queryClient.invalidateQueries({ queryKey: ["leave-requests"] }); setLeaveOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateLeaveStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("leave_requests").update({ status, approved_by: user?.id }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Leave status updated"); queryClient.invalidateQueries({ queryKey: ["leave-requests"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Bonus form
  const [bonusForm, setBonusForm] = useState({ employee_id: "", amount: "", reason: "", date: "" });
  const addBonusMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("bonuses").insert(data);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Bonus recorded"); queryClient.invalidateQueries({ queryKey: ["bonuses"] }); setBonusOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusColor = (s: string) => {
    if (s === "approved") return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
    if (s === "rejected") return "bg-destructive/10 text-destructive border-destructive/30";
    return "bg-warning/10 text-warning border-warning/30";
  };

  return (
    <AppLayout title="Human Resources" subtitle="Manage leave, bonuses, and employee salary records">
      <Tabs defaultValue="salary" className="space-y-4">
        <TabsList>
          <TabsTrigger value="salary"><DollarSign className="h-4 w-4 mr-1" /> Salary Overview</TabsTrigger>
          <TabsTrigger value="leave"><CalendarDays className="h-4 w-4 mr-1" /> Leave Management</TabsTrigger>
          <TabsTrigger value="bonuses"><Gift className="h-4 w-4 mr-1" /> Bonuses</TabsTrigger>
        </TabsList>

        {/* Salary Overview */}
        <TabsContent value="salary">
          <Card>
            <CardHeader><CardTitle className="text-base">Employee Salary Overview</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead className="text-right">Gross Salary (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees?.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.full_name}</TableCell>
                      <TableCell><Badge variant="outline">{e.position}</Badge></TableCell>
                      <TableCell className="text-right font-mono">${Number(e.gross_salary).toLocaleString()}</TableCell>
                    </TableRow>
                  )) || <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No employees</TableCell></TableRow>}
                </TableBody>
              </Table>
              {employees && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm flex justify-between">
                  <span className="text-muted-foreground">Total Monthly Payroll</span>
                  <span className="font-bold">${employees.reduce((s, e) => s + Number(e.gross_salary), 0).toLocaleString()} USD</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leave Management */}
        <TabsContent value="leave" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Request Leave</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Leave Request</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Employee</Label>
                    <Select value={leaveForm.employee_id} onValueChange={v => setLeaveForm(f => ({ ...f, employee_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{employees?.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Leave Type</Label>
                    <Select value={leaveForm.leave_type} onValueChange={v => setLeaveForm(f => ({ ...f, leave_type: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Annual">Annual Leave</SelectItem>
                        <SelectItem value="Sick">Sick Leave</SelectItem>
                        <SelectItem value="Maternity">Maternity Leave</SelectItem>
                        <SelectItem value="Emergency">Emergency Leave</SelectItem>
                        <SelectItem value="Unpaid">Unpaid Leave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Start Date</Label>
                      <Input type="date" value={leaveForm.start_date} onChange={e => setLeaveForm(f => ({ ...f, start_date: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>End Date</Label>
                      <Input type="date" value={leaveForm.end_date} onChange={e => setLeaveForm(f => ({ ...f, end_date: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Reason</Label>
                    <Textarea value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} />
                  </div>
                  <Button className="w-full" onClick={() => {
                    if (!leaveForm.employee_id || !leaveForm.leave_type || !leaveForm.start_date || !leaveForm.end_date) {
                      toast.error("Fill all required fields"); return;
                    }
                    addLeaveMutation.mutate(leaveForm);
                  }}>Submit Leave Request</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveRequests?.map(lr => (
                    <TableRow key={lr.id}>
                      <TableCell className="font-medium">{(lr as any).employees?.full_name}</TableCell>
                      <TableCell>{lr.leave_type}</TableCell>
                      <TableCell>{format(new Date(lr.start_date), "MMM dd")}</TableCell>
                      <TableCell>{format(new Date(lr.end_date), "MMM dd, yyyy")}</TableCell>
                      <TableCell><Badge className={statusColor(lr.status)}>{lr.status}</Badge></TableCell>
                      <TableCell>
                        {lr.status === "pending" && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="text-emerald-600 h-7 text-xs" onClick={() => updateLeaveStatus.mutate({ id: lr.id, status: "approved" })}>Approve</Button>
                            <Button size="sm" variant="outline" className="text-destructive h-7 text-xs" onClick={() => updateLeaveStatus.mutate({ id: lr.id, status: "rejected" })}>Reject</Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )) || <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No leave requests</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bonuses */}
        <TabsContent value="bonuses" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={bonusOpen} onOpenChange={setBonusOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add Bonus</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Record Bonus</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Employee</Label>
                    <Select value={bonusForm.employee_id} onValueChange={v => setBonusForm(f => ({ ...f, employee_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{employees?.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Amount (USD)</Label>
                      <Input type="number" value={bonusForm.amount} onChange={e => setBonusForm(f => ({ ...f, amount: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Date</Label>
                      <Input type="date" value={bonusForm.date} onChange={e => setBonusForm(f => ({ ...f, date: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Reason</Label>
                    <Textarea value={bonusForm.reason} onChange={e => setBonusForm(f => ({ ...f, reason: e.target.value }))} />
                  </div>
                  <Button className="w-full" onClick={() => {
                    if (!bonusForm.employee_id || !bonusForm.amount) { toast.error("Select employee and enter amount"); return; }
                    addBonusMutation.mutate({
                      employee_id: bonusForm.employee_id,
                      amount: parseFloat(bonusForm.amount),
                      reason: bonusForm.reason || null,
                      date: bonusForm.date || new Date().toISOString().split("T")[0],
                      created_by: user?.id,
                    });
                  }}>Record Bonus</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bonuses?.map(b => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{(b as any).employees?.full_name}</TableCell>
                      <TableCell className="font-mono">${Number(b.amount).toLocaleString()}</TableCell>
                      <TableCell>{b.reason || "—"}</TableCell>
                      <TableCell>{format(new Date(b.date), "MMM dd, yyyy")}</TableCell>
                    </TableRow>
                  )) || <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No bonuses recorded</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
