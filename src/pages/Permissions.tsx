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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Shield, Plus, Trash2, Save, Lock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Constants } from "@/integrations/supabase/types";

const ROLES = Constants.public.Enums.app_role;

export default function Permissions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newPerm, setNewPerm] = useState({ name: "", description: "", module: "" });
  const [selectedRole, setSelectedRole] = useState<string>("dealer");

  const { data: permissions } = useQuery({
    queryKey: ["all-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("permissions").select("*").order("module").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: rolePerms } = useQuery({
    queryKey: ["all-role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_permissions").select("*");
      if (error) throw error;
      return data;
    },
  });

  const modules = [...new Set(permissions?.map((p) => p.module) ?? [])];

  const hasRolePerm = (role: string, permId: string) =>
    rolePerms?.some((rp) => rp.role === role && rp.permission_id === permId) ?? false;

  const togglePermMutation = useMutation({
    mutationFn: async ({ role, permissionId, grant }: { role: string; permissionId: string; grant: boolean }) => {
      if (grant) {
        const { error } = await supabase.from("role_permissions").insert({ role, permission_id: permissionId });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("role_permissions").delete().eq("role", role).eq("permission_id", permissionId);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-role-permissions"] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const addPermMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("permissions").insert(newPerm);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Permission added");
      queryClient.invalidateQueries({ queryKey: ["all-permissions"] });
      setAddDialogOpen(false);
      setNewPerm({ name: "", description: "", module: "" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deletePermMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("permissions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Permission deleted");
      queryClient.invalidateQueries({ queryKey: ["all-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["all-role-permissions"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!isAdmin) {
    return (
      <AppLayout title="Permissions" subtitle="Role & Permission Management">
        <Card><CardContent className="py-12 text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Only administrators can manage permissions.</p>
        </CardContent></Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Permissions & Roles" subtitle="Manage module access per role (Spatie-style)">
      <Tabs defaultValue="matrix" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList>
            <TabsTrigger value="matrix"><Lock className="h-4 w-4 mr-1" /> Permission Matrix</TabsTrigger>
            <TabsTrigger value="permissions"><Shield className="h-4 w-4 mr-1" /> All Permissions</TabsTrigger>
          </TabsList>
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Permission
          </Button>
        </div>

        <TabsContent value="matrix">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" /> Role Permission Matrix
                </CardTitle>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <CardDescription>Toggle permissions for the <strong className="capitalize">{selectedRole}</strong> role</CardDescription>
            </CardHeader>
            <CardContent>
              {modules.map((mod) => {
                const modPerms = permissions?.filter((p) => p.module === mod) ?? [];
                return (
                  <div key={mod} className="mb-6">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-2">{mod}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {modPerms.map((perm) => {
                        const granted = hasRolePerm(selectedRole, perm.id);
                        return (
                          <label
                            key={perm.id}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                              granted ? "bg-primary/5 border-primary/30" : "bg-card border-border hover:border-muted-foreground/30"
                            )}
                          >
                            <Checkbox
                              checked={granted}
                              disabled={selectedRole === "admin"}
                              onCheckedChange={(checked) =>
                                togglePermMutation.mutate({ role: selectedRole, permissionId: perm.id, grant: !!checked })
                              }
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{perm.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{perm.description}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">All Permissions</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center">Roles Assigned</TableHead>
                    <TableHead className="w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissions?.map((p) => {
                    const assignedCount = rolePerms?.filter((rp) => rp.permission_id === p.id).length ?? 0;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-sm">{p.name}</TableCell>
                        <TableCell><Badge variant="outline">{p.module}</Badge></TableCell>
                        <TableCell className="text-muted-foreground text-sm">{p.description}</TableCell>
                        <TableCell className="text-center">{assignedCount}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deletePermMutation.mutate(p.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Permission</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Name (e.g. module.action)</Label>
              <Input value={newPerm.name} onChange={(e) => setNewPerm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. reports.export" />
            </div>
            <div className="space-y-2">
              <Label>Module</Label>
              <Input value={newPerm.module} onChange={(e) => setNewPerm((p) => ({ ...p, module: e.target.value }))} placeholder="e.g. Reports" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={newPerm.description} onChange={(e) => setNewPerm((p) => ({ ...p, description: e.target.value }))} placeholder="What this permission controls" />
            </div>
            <Button onClick={() => addPermMutation.mutate()} className="w-full" disabled={!newPerm.name || !newPerm.module}>
              <Save className="h-4 w-4 mr-2" /> Create Permission
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
