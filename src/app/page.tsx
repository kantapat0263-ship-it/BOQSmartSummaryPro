"use client"

import React, { useState, useCallback } from 'react';
import { 
  FileUp, 
  FileText, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  LayoutDashboard,
  Box,
  Layers,
  ChevronDown,
  Trash2,
  FileSpreadsheet
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { BoqCharts } from "@/components/BoqCharts";
import { BoqSummaryTable } from "@/components/BoqSummaryTable";
import { AiSummaryView } from "@/components/AiSummaryView";

interface BoqSummaryItem {
  cat: string;
  count: number;
  mat: number;
  lab: number;
  tot: number;
  pct: number;
}

interface ProcessResult {
  filename: string;
  grand: number;
  items: number;
  sheets: number;
  summary: BoqSummaryItem[];
  xlsx_b64: string;
  error?: string;
}

interface FileState {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'success' | 'error';
  progress: number;
  result?: ProcessResult;
  errorMessage?: string;
}

export default function BoqDashboard() {
  const [files, setFiles] = useState<FileState[]>([]);
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);

  const processFile = async (id: string, file: File) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'processing', progress: 50 } : f));

    try {
      const response = await fetch(`/api/process?name=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: file,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการประมวลผล');
      }

      setFiles(prev => prev.map(f => f.id === id ? { 
        ...f, 
        status: 'success', 
        progress: 100, 
        result: data 
      } : f));

    } catch (err: any) {
      setFiles(prev => prev.map(f => f.id === id ? { 
        ...f, 
        status: 'error', 
        progress: 100, 
        errorMessage: err.message 
      } : f));
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: `${file.name}: ${err.message}`,
      });
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(file => {
      const isXlsx = file.name.endsWith('.xlsx');
      const isUnderLimit = file.size <= 4.5 * 1024 * 1024;
      
      if (!isXlsx) {
        toast({ variant: "destructive", title: "ไฟล์ไม่ถูกต้อง", description: `กรุณาอัปโหลดเฉพาะไฟล์ .xlsx (${file.name})` });
      }
      if (!isUnderLimit) {
        toast({ variant: "destructive", title: "ไฟล์ใหญ่เกินไป", description: `ไฟล์ ${file.name} ต้องไม่เกิน 4.5 MB` });
      }
      
      return isXlsx && isUnderLimit;
    });

    const fileStates: FileState[] = validFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'pending',
      progress: 0,
    }));

    setFiles(prev => [...fileStates, ...prev]);
    fileStates.forEach(fs => processFile(fs.id, fs.file));
  };

  const handleDownload = (result: ProcessResult) => {
    const byteCharacters = atob(result.xlsx_b64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
      {/* Header */}
      <header className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-2">
          <FileSpreadsheet className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold font-headline tracking-tight text-primary">
          📊 ระบบสรุปวัสดุ BOQ
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          อัปโหลดไฟล์ BOQ (.xlsx) ระบบจะแกะวัสดุ รวมของซ้ำข้ามอาคาร และแยกตามหมวดงานให้อัตโนมัติ
        </p>
      </header>

      {/* Upload Zone */}
      <section>
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(Array.from(e.dataTransfer.files)); }}
          className={`relative group cursor-pointer transition-all duration-300 rounded-[2rem] border-2 border-dashed 
            ${isDragging ? 'border-primary bg-primary/5 scale-[0.99]' : 'border-border bg-white hover:border-primary/50 hover:shadow-xl'}`}
        >
          <input
            type="file"
            multiple
            accept=".xlsx"
            onChange={onFileSelect}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className={`p-6 rounded-full mb-6 transition-transform duration-300 ${isDragging ? 'bg-primary text-white scale-110' : 'bg-muted text-muted-foreground group-hover:scale-110'}`}>
              <FileUp className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-bold mb-2">คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวาง</h3>
            <p className="text-muted-foreground mb-4">รองรับไฟล์ Excel (.xlsx) เท่านั้น</p>
            <div className="flex gap-2 text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-full">
              <span>เลือกได้หลายไฟล์</span>
              <span className="opacity-30">•</span>
              <span>ไฟล์ละไม่เกิน 4.5 MB</span>
            </div>
          </div>
        </div>
      </section>

      {/* Results List */}
      <section className="space-y-10">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/60 border-2 border-dashed border-border/40 rounded-[2rem] bg-muted/20">
            <LayoutDashboard className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-xl font-medium">ยังไม่มีข้อมูล โปรดอัปโหลดไฟล์ BOQ เพื่อเริ่ม</p>
          </div>
        ) : (
          files.map((file) => (
            <Card key={file.id} className="p-0 border-none shadow-lg rounded-[2rem] overflow-hidden bg-white/50 backdrop-blur-sm">
              <div className="p-8 space-y-8">
                {/* File Header Info */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/5 rounded-xl">
                      <FileText className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold truncate max-w-[300px] md:max-w-md">
                        {file.file.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={file.status === 'success' ? 'secondary' : 'outline'} className="rounded-md">
                          {(file.file.size / (1024 * 1024)).toFixed(2)} MB
                        </Badge>
                        {file.status === 'processing' && (
                          <div className="flex items-center gap-2 text-primary text-sm font-medium">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>กำลังประมวลผล...</span>
                          </div>
                        )}
                        {file.status === 'success' && (
                          <div className="flex items-center gap-1.5 text-secondary text-sm font-bold">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>สำเร็จ</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {file.status === 'success' && file.result && (
                      <Button 
                        onClick={() => handleDownload(file.result!)}
                        className="bg-primary hover:bg-primary/90 rounded-xl px-6 h-12 text-base font-semibold transition-all hover:scale-105"
                      >
                        <Download className="w-5 h-5 mr-2" />
                        ดาวน์โหลดรายงาน (Excel)
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => removeFile(file.id)} className="text-destructive hover:bg-destructive/10 rounded-xl w-12 h-12">
                      <Trash2 className="w-6 h-6" />
                    </Button>
                  </div>
                </div>

                {/* Status-Based Views */}
                {file.status === 'processing' && (
                  <div className="space-y-6 py-12">
                    <Progress value={file.progress} className="h-3 rounded-full" />
                    <p className="text-center text-muted-foreground animate-pulse">ระบบกำลังอ่านข้อมูลวัสดุและคำนวณสัดส่วนค่าใช้จ่าย...</p>
                  </div>
                )}

                {file.status === 'error' && (
                  <div className="bg-destructive/5 border border-destructive/20 p-8 rounded-2xl flex items-center gap-4 text-destructive">
                    <AlertCircle className="w-10 h-10" />
                    <div>
                      <h4 className="font-bold text-lg">ประมวลผลไม่สำเร็จ</h4>
                      <p>{file.errorMessage}</p>
                    </div>
                  </div>
                )}

                {file.status === 'success' && file.result && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {/* Stat Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10">
                        <div className="flex items-center gap-3 mb-4 text-primary opacity-70">
                          <Box className="w-5 h-5" />
                          <span className="font-semibold">มูลค่ารวมทั้งโครงการ</span>
                        </div>
                        <div className="text-3xl font-extrabold text-primary">
                          ฿ <AnimatedNumber value={file.result.grand} />
                        </div>
                      </div>

                      <div className="bg-secondary/5 p-6 rounded-2xl border border-secondary/10">
                        <div className="flex items-center gap-3 mb-4 text-secondary opacity-70">
                          <Layers className="w-5 h-5" />
                          <span className="font-semibold">รายการวัสดุ (Unique)</span>
                        </div>
                        <div className="text-3xl font-extrabold text-secondary">
                          <AnimatedNumber value={file.result.items} /> รายการ
                        </div>
                      </div>

                      <div className="bg-accent p-6 rounded-2xl border border-accent-foreground/5">
                        <div className="flex items-center gap-3 mb-4 text-accent-foreground opacity-70">
                          <FileText className="w-5 h-5" />
                          <span className="font-semibold">ชีตงานที่อ่านได้</span>
                        </div>
                        <div className="text-3xl font-extrabold text-accent-foreground">
                          <AnimatedNumber value={file.result.sheets} /> ชีต
                        </div>
                      </div>
                    </div>

                    {/* AI Summary Section */}
                    <AiSummaryView 
                      input={{
                        grand: file.result.grand,
                        items: file.result.items,
                        sheets: file.result.sheets,
                        summary: file.result.summary
                      }} 
                    />

                    {/* Charts */}
                    <BoqCharts data={file.result.summary} />

                    {/* Detailed Table */}
                    <BoqSummaryTable summary={file.result.summary} grandTotal={file.result.grand} />
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </section>

      {/* Footer Branding */}
      <footer className="pt-12 border-t border-border/40 text-center text-muted-foreground">
        <p className="text-sm">© {new Date().getFullYear()} ระบบสรุปวัสดุ BOQ — เครื่องมือช่วยควบคุมต้นทุนสำหรับธุรกิจก่อสร้าง</p>
      </footer>
    </div>
  );
}
