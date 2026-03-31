import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Shield, UserPlus, Edit2, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Constants } from "@/integrations/supabase/types";

const roleColors: Record<string, string> = {
  admin: "bg-destructive/15 text-destructive border-destructive/30",
  supervisor: "bg-primary/15 text-primary border-primary/30",
  cashier: "bg-success/15 text-success border-success/30",
  attendant: "bg-accent/15 text-accent border-accent/30",
};

export default function AdminUsers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filterRole, setFilterRole] = useState("all");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editBranch, setEditBranch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const isAdmin = user?.role === "admin";

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");
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
      const { data, error } = await supabase.from("attendants").select("user_id, branch_id, branches(name)");
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
    mutationFn: async ({ userId, branchId, fullName }: { userId: string; branchId: string; fullName: string }) => {
      const existing = attendantsData?.find(a => a.user_id === userId);
      if (existing) {
        const { error } = await supabase.from("attendants").update({ branch_id: branchId }).eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attendants").insert({
          user_id: userId,
          branch_id: branchId,
          full_name: fullName,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Branch assignment updated");
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
    setDialogOpen(true);
  };

  const saveEdit = () => {
    if (!editingUserId) return;
    const profile = profiles?.find(p => p.user_id === editingUserId);
    if (editRole) updateRoleMutation.mutate({ userId: editingUserId, role: editRole });
    if (editBranch && profile) updateBranchMutation.mutate({ userId: editingUserId, branchId: editBranch, fullName: profile.full_name });
    setDialogOpen(false);
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
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Constants.public.Enums.app_role.map((role) => {
          const count = userRoles?.filter(r => r.role === role).length || 0;
          return (
            <Card key={role}>
              <CardContent className="pt-4 text-center">
                <Badge variant="outline" className={cn("mb-2", roleColors[role])}>{role}</Badge>
                <p className="text-2xl font-bold">{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filter */}
      <Card className="mb-6">
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
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p.user_id)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          {role && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteRoleMutation.mutate(p.user_id)}>
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
            </div>
            <div className="space-y-2">
              <Label>Branch Assignment</Label>
              <Select value={editBranch} onValueChange={setEditBranch}>
                <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  {branches?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={saveEdit} className="w-full">
              <Save className="h-4 w-4 mr-2" /> Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function Save(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>
      <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/>
      <path d="M7 3v4a1 1 0 0 0 1 1h7"/>
    </svg>
  );
}
