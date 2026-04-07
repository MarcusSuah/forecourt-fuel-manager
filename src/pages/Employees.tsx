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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Users, Search, Download, FileText } from "lucide-react";
import { downloadCSV } from "@/lib/csv-export";
import { exportTableToPDF } from "@/lib/pdf-export";
import { format, differenceInYears } from "date-fns";

export default function Employees() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    full_name: "", position: "", date_of_birth: "", employment_date: "",
    gender: "", gross_salary: "", social_security_number: "", branch_id: "",
  });

  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*, branches(name)")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async (emp: any) => {
      const { error } = await supabase.from("employees").insert(emp);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee added");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setOpen(false);
      setForm({ full_name: "", position: "", date_of_birth: "", employment_date: "", gender: "", gross_salary: "", social_security_number: "", branch_id: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!form.full_name.trim() || !form.position.trim()) {
      toast.error("Full name and position are required");
      return;
    }
    addMutation.mutate({
      full_name: form.full_name,
      position: form.position,
      date_of_birth: form.date_of_birth || null,
      employment_date: form.employment_date || new Date().toISOString().split("T")[0],
      gender: form.gender || null,
      gross_salary: parseFloat(form.gross_salary) || 0,
      social_security_number: form.social_security_number || null,
      branch_id: form.branch_id || null,
    });
  };

  const filtered = employees?.filter(e =>
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.position.toLowerCase().includes(search.toLowerCase())
  );

  const getAge = (dob: string | null) => {
    if (!dob) return "—";
    return differenceInYears(new Date(), new Date(dob));
  };

  const getYearsOfService = (empDate: string) => {
    return differenceInYears(new Date(), new Date(empDate));
  };

  return (
    <AppLayout title="Employees" subtitle="Manage employee records and HR data">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search employees..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Add Employee</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Employee</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Full Name *</Label>
                  <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Current Position *</Label>
                  <Select value={form.position} onValueChange={v => setForm(f => ({ ...f, position: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Station Manager">Station Manager</SelectItem>
                      <SelectItem value="Supervisor">Supervisor</SelectItem>
                      <SelectItem value="Cashier">Cashier</SelectItem>
                      <SelectItem value="Pump Attendant">Pump Attendant</SelectItem>
                      <SelectItem value="Security">Security</SelectItem>
                      <SelectItem value="Driver">Driver</SelectItem>
                      <SelectItem value="Cleaner">Cleaner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Date of Birth</Label>
                    <Input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Gender</Label>
                    <Select value={form.gender} onValueChange={v => setForm(f => ({ ...f, gender: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Employment Date</Label>
                    <Input type="date" value={form.employment_date} onChange={e => setForm(f => ({ ...f, employment_date: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Gross Salary (USD)</Label>
                    <Input type="number" value={form.gross_salary} onChange={e => setForm(f => ({ ...f, gross_salary: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Social Security Number</Label>
                  <Input value={form.social_security_number} onChange={e => setForm(f => ({ ...f, social_security_number: e.target.value }))} placeholder="Unique SSN" />
                </div>
                <div className="space-y-1">
                  <Label>Branch</Label>
                  <Select value={form.branch_id} onValueChange={v => setForm(f => ({ ...f, branch_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>
                      {branches?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleSubmit} className="w-full" disabled={addMutation.isPending}>
                  Add Employee
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-primary" /> Employee Registry ({filtered?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Employment Date</TableHead>
                    <TableHead>Years of Service</TableHead>
                    <TableHead>Gross Salary</TableHead>
                    <TableHead>SSN</TableHead>
                    <TableHead>Branch</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : !filtered?.length ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No employees found</TableCell></TableRow>
                  ) : filtered.map(emp => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.full_name}</TableCell>
                      <TableCell><Badge variant="outline">{emp.position}</Badge></TableCell>
                      <TableCell>{emp.gender || "—"}</TableCell>
                      <TableCell>{getAge(emp.date_of_birth)}</TableCell>
                      <TableCell>{format(new Date(emp.employment_date), "MMM dd, yyyy")}</TableCell>
                      <TableCell>{getYearsOfService(emp.employment_date)} yrs</TableCell>
                      <TableCell>${Number(emp.gross_salary).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-xs">{emp.social_security_number || "—"}</TableCell>
                      <TableCell>{(emp as any).branches?.name || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
