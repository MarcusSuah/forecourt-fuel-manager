import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Users, UserPlus, Edit2, Trash2, Phone, Hash, MapPin } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function Attendants() {
  const queryClient = useQueryClient();
  const [filterBranch, setFilterBranch] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editingAttendant, setEditingAttendant] = useState<any>(null);
  const [assigningAttendant, setAssigningAttendant] = useState<any>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formBranch, setFormBranch] = useState("");
  const [formActive, setFormActive] = useState(true);

  // Assignment form state
  const [assignShift, setAssignShift] = useState("");
  const [assignPump, setAssignPump] = useState("");

  const { data: attendants, isLoading } = useQuery({
    queryKey: ["attendants-mgmt"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendants")
        .select("*, branches(name)")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: shifts } = useQuery({
    queryKey: ["shifts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shifts").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: pumps } = useQuery({
    queryKey: ["pumps-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pumps").select("id, name, branch_id, product_type").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ["attendant-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendant_assignments")
        .select("*, shifts(name), pumps(name, product_type)")
        .eq("date", new Date().toISOString().split("T")[0]);
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (att: any) => {
      if (att.id) {
        const { error } = await supabase.from("attendants").update({
          full_name: att.full_name,
          phone: att.phone,
          employee_id: att.employee_id,
          branch_id: att.branch_id,
          is_active: att.is_active,
        }).eq("id", att.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attendants").insert({
          full_name: att.full_name,
          phone: att.phone,
          employee_id: att.employee_id,
          branch_id: att.branch_id,
          is_active: att.is_active,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingAttendant ? "Attendant updated" : "Attendant added");
      queryClient.invalidateQueries({ queryKey: ["attendants-mgmt"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("attendants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attendant removed");
      queryClient.invalidateQueries({ queryKey: ["attendants-mgmt"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const assignMutation = useMutation({
    mutationFn: async (a: { attendant_id: string; shift_id: string; pump_id: string | null }) => {
      const { error } = await supabase.from("attendant_assignments").insert({
        attendant_id: a.attendant_id,
        shift_id: a.shift_id,
        pump_id: a.pump_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assignment saved");
      queryClient.invalidateQueries({ queryKey: ["attendant-assignments"] });
      setAssignDialogOpen(false);
      setAssignShift("");
      setAssignPump("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetForm = () => {
    setFormName("");
    setFormPhone("");
    setFormEmployeeId("");
    setFormBranch("");
    setFormActive(true);
    setEditingAttendant(null);
  };

  const openAdd = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (att: any) => {
    setEditingAttendant(att);
    setFormName(att.full_name);
    setFormPhone(att.phone || "");
    setFormEmployeeId(att.employee_id || "");
    setFormBranch(att.branch_id);
    setFormActive(att.is_active);
    setDialogOpen(true);
  };

  const openAssign = (att: any) => {
    setAssigningAttendant(att);
    setAssignShift("");
    setAssignPump("");
    setAssignDialogOpen(true);
  };

  const handleSave = () => {
    if (!formName || !formBranch) {
      toast.error("Name and branch are required");
      return;
    }
    saveMutation.mutate({
      id: editingAttendant?.id,
      full_name: formName,
      phone: formPhone || null,
      employee_id: formEmployeeId || null,
      branch_id: formBranch,
      is_active: formActive,
    });
  };

  const handleAssign = () => {
    if (!assignShift || !assigningAttendant) {
      toast.error("Shift is required");
      return;
    }
    assignMutation.mutate({
      attendant_id: assigningAttendant.id,
      shift_id: assignShift,
      pump_id: assignPump || null,
    });
  };

  const filtered = filterBranch === "all"
    ? attendants
    : attendants?.filter(a => a.branch_id === filterBranch);

  const activeCount = attendants?.filter(a => a.is_active).length || 0;
  const todayAssignments = assignments?.length || 0;

  const assignedPumpsForAttendant = (attBranch: string) =>
    pumps?.filter(p => p.branch_id === attBranch) || [];

  return (
    <AppLayout title="Attendants" subtitle="Manage pump attendants and shift assignments">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="pt-4 text-center"><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">{attendants?.length || 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-sm text-muted-foreground">Active</p><p className="text-2xl font-bold text-success">{activeCount}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-sm text-muted-foreground">Inactive</p><p className="text-2xl font-bold text-destructive">{(attendants?.length || 0) - activeCount}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-sm text-muted-foreground">Today's Assignments</p><p className="text-2xl font-bold text-primary">{todayAssignments}</p></CardContent></Card>
      </div>

      {/* List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-primary" /> Attendant List
            </CardTitle>
            <div className="flex items-center gap-3">
              <Select value={filterBranch} onValueChange={setFilterBranch}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Filter by branch" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={openAdd}><UserPlus className="h-4 w-4 mr-2" /> Add Attendant</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Today's Shift</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No attendants found</TableCell></TableRow>
              ) : (
                filtered?.map(att => {
                  const todayAss = assignments?.filter(a => a.attendant_id === att.id) || [];
                  return (
                    <TableRow key={att.id}>
                      <TableCell className="font-medium">{att.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{att.employee_id || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{att.phone || "—"}</TableCell>
                      <TableCell>{(att.branches as any)?.name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={att.is_active ? "default" : "secondary"}>
                          {att.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {todayAss.length > 0 ? (
                          <div className="space-y-1">
                            {todayAss.map(a => (
                              <Badge key={a.id} variant="outline" className="text-xs">
                                {(a.shifts as any)?.name}{(a.pumps as any)?.name ? ` → ${(a.pumps as any).name}` : ""}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not assigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openAssign(att)} title="Assign shift">
                            <MapPin className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(att)} title="Edit">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(att.id)} title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAttendant ? "Edit Attendant" : "Add Attendant"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. John Doe" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Employee ID</Label>
                <Input value={formEmployeeId} onChange={e => setFormEmployeeId(e.target.value)} placeholder="e.g. EMP-001" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="+231..." />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Branch *</Label>
              <Select value={formBranch} onValueChange={setFormBranch}>
                <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  {branches?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>
            <Button onClick={handleSave} className="w-full" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save Attendant"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Shift — {assigningAttendant?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Shift *</Label>
              <Select value={assignShift} onValueChange={setAssignShift}>
                <SelectTrigger><SelectValue placeholder="Select shift" /></SelectTrigger>
                <SelectContent>
                  {shifts?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pump (optional)</Label>
              <Select value={assignPump} onValueChange={setAssignPump}>
                <SelectTrigger><SelectValue placeholder="Select pump" /></SelectTrigger>
                <SelectContent>
                  {assignedPumpsForAttendant(assigningAttendant?.branch_id).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.product_type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAssign} className="w-full" disabled={assignMutation.isPending}>
              {assignMutation.isPending ? "Saving..." : "Save Assignment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
