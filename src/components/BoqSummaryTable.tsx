"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface BoqItem {
  cat: string;
  count: number;
  mat: number;
  lab: number;
  tot: number;
  pct: number;
}

interface BoqSummaryTableProps {
  summary: BoqItem[];
  grandTotal: number;
}

export function BoqSummaryTable({ summary, grandTotal }: BoqSummaryTableProps) {
  const formatNum = (num: number) => num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatInt = (num: number) => num.toLocaleString('th-TH');

  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden mt-8">
      <div className="p-6 border-b border-border/60">
        <h3 className="text-lg font-semibold">รายละเอียดแยกตามหมวดงาน</h3>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[300px] font-semibold text-foreground">หมวดงาน</TableHead>
              <TableHead className="text-right font-semibold text-foreground">จำนวนรายการ</TableHead>
              <TableHead className="text-right font-semibold text-foreground">ค่าวัสดุ (บาท)</TableHead>
              <TableHead className="text-right font-semibold text-foreground">ค่าแรง (บาท)</TableHead>
              <TableHead className="text-right font-semibold text-foreground">รวมเป็นเงิน (บาท)</TableHead>
              <TableHead className="text-right font-semibold text-foreground">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.map((item, idx) => (
              <TableRow key={idx} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-medium">{item.cat}</TableCell>
                <TableCell className="text-right">{formatInt(item.count)}</TableCell>
                <TableCell className="text-right">{formatNum(item.mat)}</TableCell>
                <TableCell className="text-right">{formatNum(item.lab)}</TableCell>
                <TableCell className="text-right font-semibold">{formatNum(item.tot)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{item.pct.toFixed(2)}%</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-primary/5 hover:bg-primary/5 font-bold text-primary">
              <TableCell>รวมทั้งโครงการ</TableCell>
              <TableCell className="text-right">
                {formatInt(summary.reduce((acc, curr) => acc + curr.count, 0))}
              </TableCell>
              <TableCell className="text-right">
                {formatNum(summary.reduce((acc, curr) => acc + curr.mat, 0))}
              </TableCell>
              <TableCell className="text-right">
                {formatNum(summary.reduce((acc, curr) => acc + curr.lab, 0))}
              </TableCell>
              <TableCell className="text-right text-lg underline underline-offset-4 decoration-primary/30">
                {formatNum(grandTotal)}
              </TableCell>
              <TableCell className="text-right">100.00%</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
