"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

interface BoqData {
  cat: string;
  tot: number;
  pct: number;
}

interface BoqChartsProps {
  data: BoqData[];
}

export function BoqCharts({ data }: BoqChartsProps) {
  const sortedData = [...data].sort((a, b) => b.tot - a.tot);
  
  const chartConfig = {
    tot: {
      label: "มูลค่ารวม (บาท)",
      color: "hsl(var(--primary))",
    },
    pct: {
      label: "สัดส่วน (%)",
      color: "hsl(var(--secondary))",
    },
  } satisfies ChartConfig

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
      <div className="bg-card p-6 rounded-2xl border border-border/60 shadow-sm">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-primary rounded-full"></span>
          วิเคราะห์มูลค่ารายหมวดงาน (บาท)
        </h3>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sortedData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis 
                type="number" 
                tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`}
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                dataKey="cat" 
                type="category" 
                width={120} 
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                formatter={(value: number) => value.toLocaleString('th-TH') + ' บาท'}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="tot" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card p-6 rounded-2xl border border-border/60 shadow-sm">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-secondary rounded-full"></span>
          สัดส่วนงบประมาณ (%)
        </h3>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sortedData}
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={120}
                paddingAngle={5}
                dataKey="tot"
                nameKey="cat"
              >
                {sortedData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={`hsl(var(--chart-${(index % 5) + 1}))`} 
                  />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number, name: string) => [
                  `${value.toLocaleString('th-TH')} บาท`,
                  name
                ]}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
