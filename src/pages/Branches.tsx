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
import { Building2, Plus, Edit2, Power, MapPin } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Constants } from "@/integrations/supabase/types";

export default function Branches() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [filterCounty, setFilterCounty] = useState("all");

  // Form
  const [formName, setFormName] = useState("");
  const [formCounty, setFormCounty] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formFranchise, setFormFranchise] = useState<string>("");
  const [formActive, setFormActive] = useState(true);

  const { data: branches, isLoading } = useQuery({
    queryKey: ["branches-mgmt"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const counties = [...new Set(branches?.map(b => b.county) || [])].sort();

  const saveMutation = useMutation({
    mutationFn: async (branch: any) => {
      if (branch.id) {
        const { error } = await supabase.from("branches").update({
          name: branch.name,
          county: branch.county,
          location: branch.location || null,
          franchise_type: branch.franchise_type,
          is_active: branch.is_active,
        }).eq("id", branch.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("branches").insert({
          name: branch.name,
          county: branch.county,
          location: branch.location || null,
          franchise_type: branch.franchise_type,
          is_active: branch.is_active,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Branch updated" : "Branch created");
      queryClient.invalidateQueries({ queryKey: ["branches-mgmt"] });
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("branches").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Branch status updated");
      queryClient.invalidateQueries({ queryKey: ["branches-mgmt"] });
      queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetForm = () => {
    setFormName("");
    setFormCounty("");
    setFormLocation("");
    setFormFranchise("");
    setFormActive(true);
    setEditing(null);
  };

  const openAdd = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (branch: any) => {
    setEditing(branch);
    setFormName(branch.name);
    setFormCounty(branch.county);
    setFormLocation(branch.location || "");
    setFormFranchise(branch.franchise_type);
    setFormActive(branch.is_active);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formName || !formCounty || !formFranchise) {
      toast.error("Name, county, and franchise type are required");
      return;
    }
    saveMutation.mutate({
      id: editing?.id,
      name: formName,
      county: formCounty,
      location: formLocation,
      franchise_type: formFranchise,
      is_active: formActive,
    });
  };

  const filtered = filterCounty === "all"
    ? branches
    : branches?.filter(b => b.county === filterCounty);

  const activeCount = branches?.filter(b => b.is_active).length || 0;

  const franchiseColors: Record<string, string> = {
    "Financial Dealer": "bg-primary/15 text-primary border-primary/30",
    "Young Dealer": "bg-accent/15 text-accent-foreground border-accent/30",
    "COCO Dealer": "bg-destructive/15 text-destructive border-destructive/30",
  };

  return (
    <AppLayout title="Branches" subtitle="Manage fuel station branches">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="pt-4 text-center"><p className="text-sm text-muted-foreground">Total Branches</p><p className="text-2xl font-bold">{branches?.length || 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-sm text-muted-foreground">Active</p><p className="text-2xl font-bold text-success">{activeCount}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-sm text-muted-foreground">Inactive</p><p className="text-2xl font-bold text-destructive">{(branches?.length || 0) - activeCount}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-sm text-muted-foreground">Counties</p><p className="text-2xl font-bold text-primary">{counties.length}</p></CardContent></Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5 text-primary" /> All Branches
            </CardTitle>
            <div className="flex items-center gap-3">
              <Select value={filterCounty} onValueChange={setFilterCounty}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Filter by county" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Counties</SelectItem>
                  {counties.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> Add Branch</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>County</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Franchise Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No branches found</TableCell></TableRow>
              ) : (
                filtered?.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>{b.county}</TableCell>
                    <TableCell className="text-muted-foreground">{b.location || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={franchiseColors[b.franchise_type] || ""}>
                        {b.franchise_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={b.is_active ? "default" : "secondary"}>
                        {b.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(b)} title="Edit">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleActiveMutation.mutate({ id: b.id, is_active: !b.is_active })}
                          title={b.is_active ? "Deactivate" : "Activate"}
                        >
                          <Power className={`h-4 w-4 ${b.is_active ? "text-destructive" : "text-success"}`} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Branch" : "Add Branch"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Branch Name *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Total Sinkor" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>County *</Label>
                <Input value={formCounty} onChange={e => setFormCounty(e.target.value)} placeholder="e.g. Montserrado" />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={formLocation} onChange={e => setFormLocation(e.target.value)} placeholder="e.g. Tubman Blvd" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Franchise Type *</Label>
              <Select value={formFranchise} onValueChange={setFormFranchise}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {Constants.public.Enums.franchise_type.map(ft => (
                    <SelectItem key={ft} value={ft}>{ft}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>
            <Button onClick={handleSave} className="w-full" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save Branch"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
