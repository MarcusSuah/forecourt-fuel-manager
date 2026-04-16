import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBranchFilter, useBranchSelect } from "@/hooks/useDealerBranch";
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, Users, Search, Download, FileText, Edit2, Trash2, MoreHorizontal, Eye, Upload } from "lucide-react";
import { downloadCSV } from "@/lib/csv-export";
import { exportTableToPDF } from "@/lib/pdf-export";
import { format, differenceInYears } from "date-fns";
import { cn } from "@/lib/utils";
import { EmployeeIDCard } from "@/components/employees/EmployeeIDCard";

const POSITIONS = [
  "Station Manager", "Supervisor", "Cashier", "Pump Attendant",
  "Mechanic", "Shop Attendant", "Security", "Driver", "Cleaner",
];

const STATUS_OPTIONS = ["active", "suspended", "terminated"] as const;

const statusColors: Record<string, string> = {
  active: "bg-success/15 text-success border-success/30",
  suspended: "bg-warning/15 text-warning border-warning/30",
  terminated: "bg-destructive/15 text-destructive border-destructive/30",
};

type FormState = {
  full_name: string; position: string; date_of_birth: string; employment_date: string;
  gender: string; gross_salary: string; social_security_number: string; phone: string;
  employment_status: string;
};

const emptyForm: FormState = {
  full_name: "", position: "", date_of_birth: "", employment_date: "",
  gender: "", gross_salary: "", social_security_number: "", phone: "",
  employment_status: "active",
};

export default function Employees() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewEmployee, setViewEmployee] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const { branchFilter, setBranchFilter, isBranchDisabled } = useBranchFilter();
  const { selectedBranch: formBranch, setSelectedBranch: setFormBranch, isBranchDisabled: formBranchDisabled } = useBranchSelect();
  const [form, setForm] = useState<FormState>({ ...emptyForm });

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

  const uploadPhoto = async (employeeId: string): Promise<string | null> => {
    if (!photoFile) return null;
    const ext = photoFile.name.split('.').pop();
    const path = `${employeeId}.${ext}`;
    const { error } = await supabase.storage.from("employee-photos").upload(path, photoFile, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("employee-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim() || !form.position.trim()) throw new Error("Full name and position are required");
      const payload: any = {
        full_name: form.full_name, position: form.position,
        date_of_birth: form.date_of_birth || null,
        employment_date: form.employment_date || new Date().toISOString().split("T")[0],
        gender: form.gender || null, gross_salary: parseFloat(form.gross_salary) || 0,
        social_security_number: form.social_security_number || null,
        phone: form.phone || null, branch_id: formBranch || null,
        employment_status: form.employment_status || "active",
      };

      if (editingId) {
        if (photoFile) {
          payload.photo_url = await uploadPhoto(editingId);
        }
        const { error } = await supabase.from("employees").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("employees").insert(payload).select("id").single();
        if (error) throw error;
        if (photoFile && data) {
          const url = await uploadPhoto(data.id);
          if (url) await supabase.from("employees").update({ photo_url: url }).eq("id", data.id);
        }
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Employee updated" : "Employee added");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee deleted");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("employees").update({ employment_status: status } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeDialog = () => {
    setOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setPhotoFile(null);
  };

  const openEdit = (emp: any) => {
    setEditingId(emp.id);
    setForm({
      full_name: emp.full_name, position: emp.position,
      date_of_birth: emp.date_of_birth || "", employment_date: emp.employment_date || "",
      gender: emp.gender || "", gross_salary: String(emp.gross_salary || ""),
      social_security_number: emp.social_security_number || "", phone: emp.phone || "",
      employment_status: (emp as any).employment_status || "active",
    });
    if (emp.branch_id) setFormBranch(emp.branch_id);
    setOpen(true);
  };

  const filteredByBranch = branchFilter === "all" ? employees : employees?.filter(e => e.branch_id === branchFilter);
  const filteredByStatus = statusFilter === "all" ? filteredByBranch : filteredByBranch?.filter(e => (e as any).employment_status === statusFilter);
  const filtered = filteredByStatus?.filter(e =>
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.position.toLowerCase().includes(search.toLowerCase())
  );

  const getAge = (dob: string | null) => dob ? differenceInYears(new Date(), new Date(dob)) : "—";
  const getYearsOfService = (empDate: string) => differenceInYears(new Date(), new Date(empDate));

  return (
    <AppLayout title="Employees" subtitle="Manage employee records and HR data">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search employees..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={branchFilter} onValueChange={setBranchFilter} disabled={isBranchDisabled}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All Branches" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              if (!filtered?.length) return toast.error("No data to export");
              downloadCSV("employees.csv", ["Full Name","Position","Status","Phone","Gender","Age","Employment Date","Years of Service","Gross Salary","SSN","Branch"],
                filtered.map(e => [e.full_name, e.position, (e as any).employment_status || "active", e.phone || "", e.gender || "", String(getAge(e.date_of_birth)), e.employment_date, String(getYearsOfService(e.employment_date)), String(e.gross_salary), e.social_security_number || "", (e as any).branches?.name || ""]));
            }}><Download className="h-4 w-4 mr-1" /> CSV</Button>
            <Button variant="outline" size="sm" onClick={() => {
              if (!filtered?.length) return toast.error("No data to export");
              exportTableToPDF("Employee Registry", `${filtered.length} employees`, ["Full Name","Position","Status","Phone","Salary","Branch"],
                filtered.map(e => [e.full_name, e.position, (e as any).employment_status || "active", e.phone || "—", `$${Number(e.gross_salary).toLocaleString()}`, (e as any).branches?.name || "—"]));
            }}><FileText className="h-4 w-4 mr-1" /> PDF</Button>
            <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-1" /> Add Employee</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingId ? "Edit Employee" : "Add New Employee"}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  {/* Photo Upload */}
                  <div className="space-y-1">
                    <Label>Profile Photo</Label>
                    <div className="flex items-center gap-3">
                      {(editingId && employees?.find(e => e.id === editingId)?.photo_url) ? (
                        <img src={employees?.find(e => e.id === editingId)?.photo_url!} className="w-14 h-14 rounded-full object-cover border-2 border-primary/30" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center border-2 border-dashed">
                          <Upload className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <Input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] || null)} className="flex-1" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Full Name *</Label>
                    <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Position *</Label>
                      <Select value={form.position} onValueChange={v => setForm(f => ({ ...f, position: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger>
                        <SelectContent>
                          {POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Status</Label>
                      <Select value={form.employment_status} onValueChange={v => setForm(f => ({ ...f, employment_status: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
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
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Social Security Number</Label>
                      <Input value={form.social_security_number} onChange={e => setForm(f => ({ ...f, social_security_number: e.target.value }))} placeholder="Unique SSN" />
                    </div>
                    <div className="space-y-1">
                      <Label>Phone</Label>
                      <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone number" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Branch</Label>
                    <Select value={formBranch} onValueChange={setFormBranch} disabled={formBranchDisabled}>
                      <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                      <SelectContent>
                        {branches?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => saveMutation.mutate()} className="w-full" disabled={saveMutation.isPending}>
                    {editingId ? "Save Changes" : "Add Employee"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* View Employee Dialog */}
        <Dialog open={!!viewEmployee} onOpenChange={v => { if (!v) setViewEmployee(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Employee Details</DialogTitle></DialogHeader>
            {viewEmployee && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {viewEmployee.photo_url ? (
                    <img src={viewEmployee.photo_url} className="w-20 h-20 rounded-full object-cover border-2 border-primary/30" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-3xl">👤</div>
                  )}
                  <div>
                    <h3 className="text-lg font-semibold">{viewEmployee.full_name}</h3>
                    <Badge variant="outline" className="capitalize">{viewEmployee.position}</Badge>
                    <Badge variant="outline" className={cn("ml-2 capitalize", statusColors[(viewEmployee as any).employment_status || "active"])}>
                      {(viewEmployee as any).employment_status || "active"}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Phone:</span> {viewEmployee.phone || "—"}</div>
                  <div><span className="text-muted-foreground">Gender:</span> {viewEmployee.gender || "—"}</div>
                  <div><span className="text-muted-foreground">DOB:</span> {viewEmployee.date_of_birth ? format(new Date(viewEmployee.date_of_birth), "MMM dd, yyyy") : "—"}</div>
                  <div><span className="text-muted-foreground">Age:</span> {getAge(viewEmployee.date_of_birth)}</div>
                  <div><span className="text-muted-foreground">Employed:</span> {format(new Date(viewEmployee.employment_date), "MMM dd, yyyy")}</div>
                  <div><span className="text-muted-foreground">Service:</span> {getYearsOfService(viewEmployee.employment_date)} yrs</div>
                  <div><span className="text-muted-foreground">Salary:</span> ${Number(viewEmployee.gross_salary).toLocaleString()}</div>
                  <div><span className="text-muted-foreground">SSN:</span> {viewEmployee.social_security_number || "—"}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">Branch:</span> {(viewEmployee as any).branches?.name || "—"}</div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

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
                    <TableHead>Photo</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Phone</TableHead>
                    <TableHead className="hidden lg:table-cell">Age</TableHead>
                    <TableHead>Salary</TableHead>
                    <TableHead className="hidden md:table-cell">Branch</TableHead>
                    <TableHead className="w-28">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : !filtered?.length ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No employees found</TableCell></TableRow>
                  ) : filtered.map(emp => {
                    const empStatus = (emp as any).employment_status || "active";
                    return (
                      <TableRow key={emp.id} className={empStatus !== "active" ? "opacity-60" : ""}>
                        <TableCell>
                          {emp.photo_url ? (
                            <img src={emp.photo_url} className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm">👤</div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{emp.full_name}</TableCell>
                        <TableCell><Badge variant="outline">{emp.position}</Badge></TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("capitalize text-xs", statusColors[empStatus])}>
                            {empStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{emp.phone || "—"}</TableCell>
                        <TableCell className="hidden lg:table-cell">{getAge(emp.date_of_birth)}</TableCell>
                        <TableCell>${Number(emp.gross_salary).toLocaleString()}</TableCell>
                        <TableCell className="hidden md:table-cell">{(emp as any).branches?.name || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-0.5">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewEmployee(emp)} title="View">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <EmployeeIDCard
                              employee={{ ...emp, employment_status: empStatus, employee_id: (emp as any).employee_id }}
                              branchName={(emp as any).branches?.name || "Station"}
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEdit(emp)}>
                                  <Edit2 className="h-4 w-4 mr-2" /> Edit
                                </DropdownMenuItem>
                                {STATUS_OPTIONS.filter(s => s !== empStatus).map(s => (
                                  <DropdownMenuItem key={s} onClick={() => statusMutation.mutate({ id: emp.id, status: s })} className="capitalize">
                                    Set {s}
                                  </DropdownMenuItem>
                                ))}
                                {isAdmin && (
                                  <DropdownMenuItem className="text-destructive" onClick={() => {
                                    if (confirm("Delete this employee permanently?")) deleteMutation.mutate(emp.id);
                                  }}>
                                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
