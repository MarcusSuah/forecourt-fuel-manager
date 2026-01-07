import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const data = [
  { time: "6AM", pms: 120, ago: 80 },
  { time: "8AM", pms: 280, ago: 150 },
  { time: "10AM", pms: 420, ago: 220 },
  { time: "12PM", pms: 380, ago: 280 },
  { time: "2PM", pms: 520, ago: 320 },
  { time: "4PM", pms: 480, ago: 360 },
  { time: "6PM", pms: 620, ago: 420 },
  { time: "8PM", pms: 540, ago: 380 },
  { time: "10PM", pms: 320, ago: 240 },
];

export function SalesChart() {
  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-foreground">Sales Overview</h3>
          <p className="text-sm text-muted-foreground">Hourly fuel sales (USG)</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-fuel-pms" />
            <span className="text-sm text-muted-foreground">PMS</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-fuel-ago" />
            <span className="text-sm text-muted-foreground">AGO</span>
          </div>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPms" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(32, 95%, 44%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(32, 95%, 44%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorAgo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(217, 91%, 40%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(217, 91%, 40%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" vertical={false} />
            <XAxis
              dataKey="time"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(220, 9%, 46%)", fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(220, 9%, 46%)", fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(0, 0%, 100%)",
                border: "1px solid hsl(214, 32%, 91%)",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
              labelStyle={{ color: "hsl(222, 47%, 11%)", fontWeight: 600 }}
            />
            <Area
              type="monotone"
              dataKey="pms"
              stroke="hsl(32, 95%, 44%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorPms)"
              name="PMS"
            />
            <Area
              type="monotone"
              dataKey="ago"
              stroke="hsl(217, 91%, 40%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorAgo)"
              name="AGO"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
