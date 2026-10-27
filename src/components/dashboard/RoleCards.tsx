import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Building2, ClipboardX, Droplets, Fuel } from "lucide-react";

const today = () => format(new Date(), "yyyy-MM-dd");
const usd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const usg = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} USG`;

type SaleRow = { branch_id: string; sales_usg: number | null; total_sales_usd: number | null; pumps: { product_type: string } | null };
type TankRow = { id: string; name: string; branch_id: string; product_type: string; current_level_usg: number; capacity_usg: number; status: string };

function useTodaySales(branchId?: string | null) {
  return useQuery({
    queryKey: ["role-sales", today(), branchId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("shift_sales_reports").select("branch_id, sales_usg, total_sales_usd, pumps(product_type)").eq("date", today());
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as SaleRow[];
    },
  });
}

function useTanks(branchId?: string | null) {
  return useQuery({
    queryKey: ["role-tanks", branchId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("tanks").select("id, name, branch_id, product_type, current_level_usg, capacity_usg, status").eq("is_active", true);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as TankRow[];
    },
  });
}

function useBranches() {
  return useQuery({
    queryKey: ["role-branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name, zone").eq("is_active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

const pct = (t: TankRow) => (t.capacity_usg > 0 ? Math.min(100, (t.current_level_usg / t.capacity_usg) * 100) : 0);

/** Admin: multi-station performance from real data (today). */
export function NetworkPerformanceCard() {
  const { data: branches, isLoading: lb } = useBranches();
  const { data: sales, isLoading: ls } = useTodaySales();
  const { data: tanks, isLoading: lt } = useTanks();

  if (lb || ls || lt) return <Skeleton className="h-64 w-full" />;

  const rows = (branches ?? []).map((b) => {
    const s = (sales ?? []).filter((r) => r.branch_id === b.id);
    const t = (tanks ?? []).filter((r) => r.branch_id === b.id);
    const stock = (p: string) => {
      const x = t.filter((k) => k.product_type === p);
      const cap = x.reduce((a, k) => a + Number(k.capacity_usg), 0);
      return cap ? (x.reduce((a, k) => a + Number(k.current_level_usg), 0) / cap) * 100 : null;
    };
    return {
      ...b,
      usd: s.reduce((a, r) => a + Number(r.total_sales_usd ?? 0), 0),
      gal: s.reduce((a, r) => a + Number(r.sales_usg ?? 0), 0),
      pms: stock("PMS"),
      ago: stock("AGO"),
      low: t.filter((k) => k.status === "Low" || k.status === "Critical").length,
    };
  }).sort((a, b) => b.usd - a.usd);

  const total = rows.reduce((a, r) => a + r.usd, 0);
  const reporting = rows.filter((r) => r.gal > 0).length;

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" />Multi-Station Performance (Today)</CardTitle>
        <div className="flex gap-2 text-sm">
          <Badge variant="secondary">{usd(total)} total</Badge>
          <Badge variant="outline">{reporting}/{rows.length} reporting</Badge>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground">
            <tr className="border-b text-left">
              <th className="py-2">Station</th><th>Zone</th><th className="text-right">Sales (USD)</th><th className="text-right">Volume</th>
              <th className="text-right">PMS stock</th><th className="text-right">AGO stock</th><th className="text-right">Low tanks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="py-2 font-medium">{r.name}</td>
                <td className="capitalize text-muted-foreground">{r.zone ?? "—"}</td>
                <td className="text-right">{usd(r.usd)}</td>
                <td className="text-right">{usg(r.gal)}</td>
                <td className="text-right">{r.pms == null ? "—" : `${r.pms.toFixed(0)}%`}</td>
                <td className="text-right">{r.ago == null ? "—" : `${r.ago.toFixed(0)}%`}</td>
                <td className="text-right">{r.low ? <Badge variant="destructive">{r.low}</Badge> : "0"}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No stations yet</td></tr>}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/** Dealer: own station sales and stock (today). */
export function StationSalesStockCard({ branchId }: { branchId: string | null }) {
  const { data: sales, isLoading: ls } = useTodaySales(branchId);
  const { data: tanks, isLoading: lt } = useTanks(branchId);
  if (!branchId) return null;
  if (ls || lt) return <Skeleton className="h-64 w-full mt-6" />;

  const byProduct = (p: string) => {
    const s = (sales ?? []).filter((r) => r.pumps?.product_type === p);
    return { gal: s.reduce((a, r) => a + Number(r.sales_usg ?? 0), 0), usd: s.reduce((a, r) => a + Number(r.total_sales_usd ?? 0), 0) };
  };
  const pms = byProduct("PMS");
  const ago = byProduct("AGO");

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Fuel className="h-5 w-5 text-primary" />Station Sales (Today)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {[{ k: "PMS", v: pms }, { k: "AGO", v: ago }].map(({ k, v }) => (
            <div key={k} className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">{k}</p>
              <p className="text-2xl font-bold">{usd(v.usd)}</p>
              <p className="text-sm text-muted-foreground">{usg(v.gal)}</p>
            </div>
          ))}
          <div className="col-span-2 rounded-lg bg-muted p-3 text-sm">
            Total: <span className="font-semibold">{usd(pms.usd + ago.usd)}</span> · {usg(pms.gal + ago.gal)} · {(sales ?? []).length} pump reports
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Droplets className="h-5 w-5 text-primary" />Station Stock</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {(tanks ?? []).map((t) => (
            <div key={t.id}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium">{t.name} <span className="text-muted-foreground">({t.product_type})</span></span>
                <span>{usg(Number(t.current_level_usg))} / {usg(Number(t.capacity_usg))}</span>
              </div>
              <Progress value={pct(t)} />
            </div>
          ))}
          {!tanks?.length && <p className="text-sm text-muted-foreground">No active tanks.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

/** Supervisor: zone-level shift and stock alerts. RLS limits data to the supervisor's zone. */
export function ZoneAlertsCard() {
  const d = today();
  const { data: branches } = useBranches();
  const { data: tanks } = useTanks();
  const { data: sales } = useTodaySales();
  const { data: dips } = useQuery({
    queryKey: ["zone-dips", d],
    queryFn: async () => (await supabase.from("stock_readings").select("branch_id").eq("date", d)).data ?? [],
  });
  const { data: recon } = useQuery({
    queryKey: ["zone-recon"],
    queryFn: async () =>
      (await supabase.from("reconciliation_alerts").select("id, branch_id, loss_usg, severity, tanks(name)").is("resolved_at", null).order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  const name = (id: string) => branches?.find((b) => b.id === id)?.name ?? "Unknown";
  const lowTanks = (tanks ?? []).filter((t) => t.status === "Low" || t.status === "Critical");
  const noDip = (branches ?? []).filter((b) => !dips?.some((x) => x.branch_id === b.id));
  const noSales = (branches ?? []).filter((b) => !sales?.some((x) => x.branch_id === b.id));

  return (
    <Card className="mt-6">
      <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Zone Shift &amp; Stock Alerts</CardTitle></CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-3">
        <section>
          <h4 className="mb-2 text-sm font-semibold">Low / critical tanks ({lowTanks.length})</h4>
          <ul className="space-y-1 text-sm">
            {lowTanks.map((t) => (
              <li key={t.id} className="flex justify-between gap-2">
                <span>{name(t.branch_id)} · {t.name}</span>
                <Badge variant={t.status === "Critical" ? "destructive" : "secondary"}>{pct(t).toFixed(0)}%</Badge>
              </li>
            ))}
            {!lowTanks.length && <li className="text-muted-foreground">All tanks healthy</li>}
          </ul>
        </section>
        <section>
          <h4 className="mb-2 text-sm font-semibold">Unresolved variance alerts ({recon?.length ?? 0})</h4>
          <ul className="space-y-1 text-sm">
            {(recon ?? []).map((r: any) => (
              <li key={r.id} className="flex justify-between gap-2">
                <span>{name(r.branch_id)} · {r.tanks?.name ?? "Tank"}</span>
                <Badge variant="destructive">{usg(Number(r.loss_usg))}</Badge>
              </li>
            ))}
            {!recon?.length && <li className="text-muted-foreground">No open alerts</li>}
          </ul>
        </section>
        <section>
          <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold"><ClipboardX className="h-4 w-4" />Missing shift data today</h4>
          <ul className="space-y-1 text-sm">
            {(branches ?? []).filter((b) => noDip.includes(b) || noSales.includes(b)).map((b) => (
              <li key={b.id} className="flex flex-wrap justify-between gap-1">
                <span>{b.name}</span>
                <span className="flex gap-1">
                  {noDip.includes(b) && <Badge variant="outline">No dip</Badge>}
                  {noSales.includes(b) && <Badge variant="outline">No meter</Badge>}
                </span>
              </li>
            ))}
            {!noDip.length && !noSales.length && <li className="text-muted-foreground">All stations reported</li>}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}
