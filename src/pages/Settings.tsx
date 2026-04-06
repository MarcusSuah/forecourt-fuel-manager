import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Settings as SettingsIcon, DollarSign, Droplets, Clock, Building2, Save, RefreshCw, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingRow {
  id: string;
  key: string;
  value: any;
  description: string | null;
  updated_at: string;
}

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";

  const { data: settings, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .order("key");
      if (error) throw error;
      return data as SettingRow[];
    },
  });

  const { data: shifts } = useQuery({
    queryKey: ["shifts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shifts").select("*").order("start_time");
      if (error) throw error;
      return data;
    },
  });

  // Exchange Rate State
  const exchangeSetting = settings?.find(s => s.key === "exchange_rate");
  const [exchangeRate, setExchangeRate] = useState("");

  // Tank Threshold State
  const thresholdSetting = settings?.find(s => s.key === "tank_thresholds");
  const [criticalPct, setCriticalPct] = useState("");
  const [lowPct, setLowPct] = useState("");
  const [mediumPct, setMediumPct] = useState("");

  // System Preferences State
  const prefSetting = settings?.find(s => s.key === "system_preferences");
  const [companyName, setCompanyName] = useState("");
  const [primaryCurrency, setPrimaryCurrency] = useState("USD");
  const [secondaryCurrency, setSecondaryCurrency] = useState("LRD");
  const [dateFormat, setDateFormat] = useState("yyyy-MM-dd");

  // Populate form when data loads
  useEffect(() => {
    if (exchangeSetting) {
      setExchangeRate(String(exchangeSetting.value?.lrd_to_usd || ""));
    }
  }, [exchangeSetting]);

  useEffect(() => {
    if (thresholdSetting) {
      setCriticalPct(String(thresholdSetting.value?.critical_pct || ""));
      setLowPct(String(thresholdSetting.value?.low_pct || ""));
      setMediumPct(String(thresholdSetting.value?.medium_pct || ""));
    }
  }, [thresholdSetting]);

  useEffect(() => {
    if (prefSetting) {
      setCompanyName(prefSetting.value?.company_name || "");
      setPrimaryCurrency(prefSetting.value?.currency_primary || "USD");
      setSecondaryCurrency(prefSetting.value?.currency_secondary || "LRD");
      setDateFormat(prefSetting.value?.date_format || "yyyy-MM-dd");
    }
  }, [prefSetting]);

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { error } = await supabase
        .from("system_settings")
        .update({ value, updated_at: new Date().toISOString(), updated_by: user?.id })
        .eq("key", key);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(`${variables.key.replace(/_/g, " ")} updated`);
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveExchangeRate = () => {
    const rate = parseFloat(exchangeRate);
    if (isNaN(rate) || rate <= 0) { toast.error("Enter a valid exchange rate"); return; }
    updateSettingMutation.mutate({
      key: "exchange_rate",
      value: { lrd_to_usd: rate, last_updated: new Date().toISOString() },
    });
  };

  const saveThresholds = () => {
    const c = parseInt(criticalPct), l = parseInt(lowPct), m = parseInt(mediumPct);
    if ([c, l, m].some(v => isNaN(v) || v < 0 || v > 100)) { toast.error("Enter valid percentages (0–100)"); return; }
    if (c >= l || l >= m) { toast.error("Critical < Low < Medium required"); return; }
    updateSettingMutation.mutate({
      key: "tank_thresholds",
      value: { critical_pct: c, low_pct: l, medium_pct: m },
    });
  };

  const savePreferences = () => {
    if (!companyName.trim()) { toast.error("Company name required"); return; }
    updateSettingMutation.mutate({
      key: "system_preferences",
      value: { company_name: companyName, currency_primary: primaryCurrency, currency_secondary: secondaryCurrency, date_format: dateFormat },
    });
  };

  if (!isAdmin) {
    return (
      <AppLayout title="Settings" subtitle="System Configuration">
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Only administrators can manage system settings.</p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Settings" subtitle="Configure exchange rates, thresholds, and system preferences">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Exchange Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-5 w-5 text-primary" /> Exchange Rate
            </CardTitle>
            <CardDescription>Configure the LRD to USD conversion rate used across all financial modules</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>1 USD = how many LRD?</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  placeholder="e.g. 192"
                />
                <Button onClick={saveExchangeRate} disabled={updateSettingMutation.isPending}>
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
              </div>
            </div>
            {exchangeSetting?.value?.last_updated && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                Last updated: {new Date(exchangeSetting.value.last_updated).toLocaleString()}
              </p>
            )}
            <Separator />
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium mb-1">Quick Reference</p>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <span>$1 USD =</span>
                <span className="font-medium text-foreground">{exchangeRate || "—"} LRD</span>
                <span>1,000 LRD =</span>
                <span className="font-medium text-foreground">${exchangeRate ? (1000 / parseFloat(exchangeRate)).toFixed(2) : "—"} USD</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tank Thresholds */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Droplets className="h-5 w-5 text-primary" /> Tank Alert Thresholds
            </CardTitle>
            <CardDescription>Set percentage levels that trigger tank status alerts on the dashboard</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <Label className="flex-1">Critical Level (%)</Label>
                <Input type="number" className="w-24" value={criticalPct} onChange={(e) => setCriticalPct(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-warning" />
                <Label className="flex-1">Low Level (%)</Label>
                <Input type="number" className="w-24" value={lowPct} onChange={(e) => setLowPct(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-success" />
                <Label className="flex-1">Medium Level (%)</Label>
                <Input type="number" className="w-24" value={mediumPct} onChange={(e) => setMediumPct(e.target.value)} />
              </div>
            </div>
            <Button onClick={saveThresholds} className="w-full" disabled={updateSettingMutation.isPending}>
              <Save className="h-4 w-4 mr-1" /> Save Thresholds
            </Button>
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
              <p>Tanks below <strong>Critical</strong> trigger urgent alerts. Tanks below <strong>Low</strong> show warnings. Above <strong>Medium</strong> is considered healthy.</p>
            </div>
          </CardContent>
        </Card>

        {/* Shift Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5 text-primary" /> Shift Schedule
            </CardTitle>
            <CardDescription>Current shift configuration (read-only — contact support to modify)</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shift</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>End Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts?.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        s.name === "Morning" && "border-warning/50 text-warning bg-warning/10",
                        s.name === "Afternoon" && "border-info/50 text-info bg-info/10",
                        s.name === "Night" && "border-primary/50 text-primary bg-primary/10",
                      )}>{s.name}</Badge>
                    </TableCell>
                    <TableCell>{s.start_time}</TableCell>
                    <TableCell>{s.end_time}</TableCell>
                  </TableRow>
                )) || (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6">No shifts configured</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* System Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5 text-primary" /> System Preferences
            </CardTitle>
            <CardDescription>General company and display settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Forecourt Management System" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Primary Currency</Label>
                <Select value={primaryCurrency} onValueChange={setPrimaryCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="LRD">LRD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Secondary Currency</Label>
                <Select value={secondaryCurrency} onValueChange={setSecondaryCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="LRD">LRD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Date Format</Label>
              <Select value={dateFormat} onValueChange={setDateFormat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yyyy-MM-dd">YYYY-MM-DD</SelectItem>
                  <SelectItem value="MM/dd/yyyy">MM/DD/YYYY</SelectItem>
                  <SelectItem value="dd/MM/yyyy">DD/MM/YYYY</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={savePreferences} className="w-full" disabled={updateSettingMutation.isPending}>
              <Save className="h-4 w-4 mr-1" /> Save Preferences
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
