import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Shield, Edit2, Trash2, Users, Save, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Constants } from "@/integrations/supabase/types";
import { ZONE_OPTIONS } from "@/hooks/useSupervisorZone";

const roleColors: Record<string, string> = {
  admin: "bg-destructive/15 text-destructive border-destructive/30",
  supervisor: "bg-primary/15 text-primary border-primary/30",
  dealer: "bg-info/15 text-info border-info/30",
  cashier: "bg-success/15 text-success border-success/30",
  attendant: "bg-accent/15 text-accent-foreground border-accent/30",
};

const roleDescriptions: Record<string, string> = {
  admin: "Full access to all modules, user management, and settings",
  supervisor: "Manage branches, attendants, sales, cash, and stock",
  dealer: "Full access to own station — tanks, sales, staff, reports",
  cashier: "Record cash deposits and view sales reports",
  attendant: "Enter shift sales and view own assignments",
};

export default function AdminUsers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filterRole, setFilterRole] = useState("all");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editBranch, setEditBranch] = useState("");
  const [editZone, setEditZone] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Auto-assign admin role if current user has no role (uses bootstrap_admin which only works when no admins exist)
  useEffect(() => {
    if (user && !user.role) {
      const assignAdmin = async () => {
        const { data: existing } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!existing) {
          // Use bootstrap_admin RPC which bypasses RLS for the first admin
          const { data, error } = await supabase.rpc("bootstrap_admin", { _user_id: user.id });
          if (!error && data) {
            toast.success("You have been assigned the Admin role");
            queryClient.invalidateQueries({ queryKey: ["all-user-roles"] });
            window.location.reload();
          } else if (!data) {
            toast.info("An admin already exists. Ask an admin to assign your role.");
          }
        }
      };
      assignAdmin();
    }
  }, [user]);

  const isAdmin = user?.role === "admin";

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: userRoles } = useQuery({
    queryKey: ["all-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: attendantsData } = useQuery({
    queryKey: ["all-attendants-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("attendants").select("user_id, branch_id, supervisor_zone, branches(name)");
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

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const existing = userRoles?.find(r => r.user_id === userId);
      if (existing) {
        const { error } = await supabase.from("user_roles").update({ role: role as any }).eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["all-user-roles"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateBranchMutation = useMutation({
    mutationFn: async ({ userId, branchId, zone, fullName }: { userId: string; branchId: string | null; zone: string | null; fullName: string }) => {
      const existing = attendantsData?.find(a => a.user_id === userId);
      if (existing) {
        const { error } = await supabase.from("attendants").update({ branch_id: branchId as any, supervisor_zone: zone as any }).eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attendants").insert({ user_id: userId, branch_id: branchId as any, supervisor_zone: zone as any, full_name: fullName });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Assignment updated");
      queryClient.invalidateQueries({ queryKey: ["all-attendants-admin"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role removed");
      queryClient.invalidateQueries({ queryKey: ["all-user-roles"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const getRoleForUser = (userId: string) => userRoles?.find(r => r.user_id === userId)?.role;
  const getBranchForUser = (userId: string) => attendantsData?.find(a => a.user_id === userId);

  const filteredProfiles = filterRole === "all"
    ? profiles
    : profiles?.filter(p => getRoleForUser(p.user_id) === filterRole);

  const openEdit = (userId: string) => {
    setEditingUserId(userId);
    setEditRole(getRoleForUser(userId) || "");
    const branchInfo = getBranchForUser(userId);
    setEditBranch(branchInfo?.branch_id || "");
    setEditZone((branchInfo as any)?.supervisor_zone || "");
    setDialogOpen(true);
  };

  const saveEdit = () => {
    if (!editingUserId) return;
    const profile = profiles?.find(p => p.user_id === editingUserId);
    if (editRole) updateRoleMutation.mutate({ userId: editingUserId, role: editRole });
    if (profile && (editBranch || editZone)) {
      updateBranchMutation.mutate({
        userId: editingUserId,
        branchId: editBranch || null,
        zone: editZone || null,
        fullName: profile.full_name,
      });
    }
    setDialogOpen(false);
  };

  const [seeding, setSeeding] = useState(false);
  const runSeed = async (fn: "seed-branch-dealers" | "seed-zone-supervisors" | "seed-demo-stations") => {
    setSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke(fn);
      if (error) throw error;
      toast.success((data as any)?.message || "Seed complete");
      queryClient.invalidateQueries({ queryKey: ["all-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["all-user-roles"] });
      queryClient.invalidateQueries({ queryKey: ["all-attendants-admin"] });
    } catch (e: any) {
      toast.error(e.message ?? "Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  if (!isAdmin) {
    return (
      <AppLayout title="Admin" subtitle="User Management">
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Only administrators can manage users and roles.</p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="User Management" subtitle="Manage roles and branch assignments">
      {/* Seed default accounts */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Default accounts
          </CardTitle>
          <CardDescription>
            Auto-create a dealer per branch and a supervisor per zone. Defaults: dealer password
            <code className="mx-1 px-1 rounded bg-muted text-xs">dealer@123</code>
            supervisor password
            <code className="mx-1 px-1 rounded bg-muted text-xs">suprse@231</code>.
            Users change these under Settings after first login.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3 flex-wrap">
          <Button variant="outline" onClick={() => runSeed("seed-branch-dealers")} disabled={seeding}>
            Seed missing dealers
          </Button>
          <Button variant="outline" onClick={() => runSeed("seed-zone-supervisors")} disabled={seeding}>
            Seed missing supervisors
          </Button>
          <Button variant="outline" onClick={() => runSeed("seed-demo-stations")} disabled={seeding}>
            {seeding ? "Seeding…" : "Add 5 demo stations with data"}
          </Button>
        </CardContent>
      </Card>

      {/* Role Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Constants.public.Enums.app_role.map((role) => {
          const count = userRoles?.filter(r => r.role === role).length || 0;
          const isSelected = filterRole === role;
          return (
            <Card
              key={role}
              className={cn(
                "cursor-pointer hover:shadow-md transition-all",
                isSelected && "ring-2 ring-primary"
              )}
              onClick={() => setFilterRole(isSelected ? "all" : role)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={cn("capitalize", roleColors[role])}>{role}</Badge>
                  <span className="text-2xl font-bold">{count}</span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="text-xs leading-relaxed">
                  {roleDescriptions[role]}
                </CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* User Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-primary" /> All Users
            </CardTitle>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {Constants.public.Enums.app_role.map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filteredProfiles?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No users found</TableCell></TableRow>
              ) : (
                filteredProfiles?.map((p) => {
                  const role = getRoleForUser(p.user_id);
                  const branch = getBranchForUser(p.user_id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.email}</TableCell>
                      <TableCell>
                        {role ? (
                          <Badge variant="outline" className={cn("capitalize", roleColors[role])}>{role}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">No role</span>
                        )}
                      </TableCell>
                      <TableCell>{(branch?.branches as any)?.name || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p.user_id)} title="Edit role">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          {role && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteRoleMutation.mutate(p.user_id)} title="Remove role">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
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

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Role & Branch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {Constants.public.Enums.app_role.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editRole && (
                <p className="text-xs text-muted-foreground">{roleDescriptions[editRole]}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Branch Assignment</Label>
              <Select value={editBranch} onValueChange={setEditBranch}>
                <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  {branches?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Used for dealers, cashiers, and attendants.</p>
            </div>
            {editRole === "supervisor" && (
              <div className="space-y-2">
                <Label>Supervisor Zone</Label>
                <Select value={editZone} onValueChange={setEditZone}>
                  <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
                  <SelectContent>
                    {ZONE_OPTIONS.map((z) => (
                      <SelectItem key={z} value={z} className="capitalize">{z}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Supervisor sees every station in this zone.</p>
              </div>
            )}
            <Button onClick={saveEdit} className="w-full">
              <Save className="h-4 w-4 mr-2" /> Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
