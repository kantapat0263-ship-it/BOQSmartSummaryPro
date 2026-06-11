
"use client"

import React, { useState } from 'react';
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
  Trash2,
  FileSpreadsheet,
  HardHat,
  Construction,
  ChevronRight,
  TrendingUp,
  Activity
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
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

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
  warnings?: string[];
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

  const heroImage = PlaceHolderImages.find(img => img.id === 'hero-construction');

  const processFile = async (id: string, file: File) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'processing', progress: 30 } : f));

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

      toast({
        title: "ประมวลผลสำเร็จ",
        description: `ถอดข้อมูลจาก ${file.name} เรียบร้อยแล้ว`,
      });

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

  const handleFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(file => {
      const isXlsx = file.name.toLowerCase().endsWith('.xlsx');
      const isUnderLimit = file.size <= 4.5 * 1024 * 1024;
      return isXlsx && isUnderLimit;
    });

    if (validFiles.length < newFiles.length) {
      toast({ 
        variant: "destructive", 
        title: "ไฟล์บางรายการไม่รองรับ", 
        description: "กรุณาใช้ไฟล์ .xlsx ขนาดไม่เกิน 4.5MB" 
      });
    }

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
    const base = result.filename.replace(/\.xlsx$/i, '');
    a.download = `[สรุปวัสดุ] ${base}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen construction-pattern pb-20">
      {/* Hero Section */}
      <div className="hero-gradient text-white overflow-hidden relative">
        <div className="absolute inset-0 opacity-20">
          {heroImage && (
            <Image 
              src={heroImage.imageUrl} 
              alt="Construction site" 
              fill 
              priority
              className="object-cover"
              data-ai-hint="construction site"
            />
          )}
        </div>
        <div className="max-w-7xl mx-auto px-6 py-24 relative z-10 flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-secondary text-white px-5 py-2 rounded-full text-xs font-bold uppercase tracking-[0.2em] shadow-lg shadow-secondary/20">
              <Activity className="w-4 h-4" />
              Smart Construction Dashboard
            </div>
            <h1 className="text-5xl md:text-7xl font-black font-headline leading-[1.1] tracking-tight">
              ยกระดับการวิเคราะห์ <br />
              <span className="text-secondary italic">งบประมาณ BOQ</span>
            </h1>
            <p className="text-blue-100/80 text-xl max-w-xl leading-relaxed font-medium">
              เทคโนโลยี AI ที่จะช่วยให้การสรุปค่าวัสดุและค่าแรงเป็นเรื่องง่าย แม่นยำ และรวดเร็ว เพื่อการตัดสินใจที่มีประสิทธิภาพ
            </p>
            <div className="flex flex-wrap justify-center lg:justify-start gap-5 pt-4">
              <div className="flex items-center gap-3 bg-white/10 px-6 py-3 rounded-2xl backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors">
                <div className="p-2 bg-secondary rounded-lg">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-bold">วิเคราะห์แนวโน้มต้นทุน</span>
              </div>
              <div className="flex items-center gap-3 bg-white/10 px-6 py-3 rounded-2xl backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors">
                <div className="p-2 bg-primary rounded-lg border border-white/20">
                  <HardHat className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-bold">มาตรฐานวิศวกรรม</span>
              </div>
            </div>
          </div>

          <Card className="w-full max-w-lg p-10 glass-card border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] animate-in zoom-in duration-700">
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(Array.from(e.dataTransfer.files)); }}
              className={`relative group cursor-pointer transition-all duration-500 rounded-[2.5rem] border-2 border-dashed h-72 flex flex-col items-center justify-center p-8 text-center
                ${isDragging ? 'border-secondary bg-secondary/10 scale-95' : 'border-primary/20 bg-muted/40 hover:border-secondary/50 hover:bg-muted/60'}`}
            >
              <input
                type="file"
                multiple
                accept=".xlsx"
                onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className={`p-6 rounded-3xl mb-6 transition-all duration-500 shadow-xl ${isDragging ? 'bg-secondary text-white rotate-12' : 'bg-primary text-white group-hover:-rotate-6'}`}>
                <FileUp className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-primary mb-2">อัปโหลดไฟล์ BOQ ของคุณ</h3>
              <p className="text-sm text-muted-foreground font-medium">ลากและวางไฟล์ .xlsx หรือคลิกเพื่อเลือกไฟล์ (สูงสุด 4.5MB)</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 -mt-12 relative z-20">
        <div className="space-y-16">
          {files.length === 0 ? (
            <div className="bg-white/70 backdrop-blur-xl border border-white border-b-primary/5 rounded-[3.5rem] py-32 text-center space-y-6 shadow-2xl">
              <div className="bg-primary/5 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto border border-primary/10 rotate-3">
                <LayoutDashboard className="w-12 h-12 text-primary/30" />
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-black text-primary/30">เริ่มต้นการวิเคราะห์ใหม่</p>
                <p className="text-muted-foreground font-medium max-w-sm mx-auto">ยังไม่มีประวัติการประมวลผล กรุณาอัปโหลดไฟล์ Excel เพื่อสร้างรายงานฉบับสมบูรณ์</p>
              </div>
            </div>
          ) : (
            <div className="space-y-12">
              {files.map((file) => (
                <Card key={file.id} className="border-none shadow-[0_24px_48px_-12px_rgba(0,0,0,0.15)] rounded-[3rem] overflow-hidden bg-white/90 backdrop-blur-md">
                  <div className="p-8 md:p-14 space-y-12">
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-8 pb-10 border-b border-primary/5">
                      <div className="flex items-center gap-6">
                        <div className="p-5 bg-primary text-white rounded-[1.75rem] shadow-2xl shadow-primary/30 transform transition-transform hover:scale-110">
                          <FileSpreadsheet className="w-10 h-10" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-3xl font-black text-primary tracking-tight">
                            {file.file.name}
                          </h3>
                          <div className="flex items-center gap-4">
                            <Badge variant="secondary" className="bg-primary/5 text-primary hover:bg-primary/10 border-none font-bold px-3 py-1">
                              {(file.file.size / (1024 * 1024)).toFixed(2)} MB
                            </Badge>
                            {file.status === 'success' ? (
                              <Badge className="bg-emerald-500 text-white border-none font-bold px-3 py-1 animate-in zoom-in">
                                วิเคราะห์เรียบร้อย
                              </Badge>
                            ) : file.status === 'processing' ? (
                              <div className="flex items-center gap-3 text-secondary font-black text-sm">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>กำลังถอดแบบและคำนวณ...</span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {file.status === 'success' && file.result && (
                          <Button 
                            onClick={() => handleDownload(file.result!)}
                            className="bg-secondary hover:bg-secondary/90 text-white rounded-[1.5rem] px-8 h-16 text-lg font-black shadow-xl shadow-secondary/30 transition-all hover:translate-y-[-2px] hover:shadow-2xl"
                          >
                            <Download className="w-6 h-6 mr-3" />
                            รายงานผลวิเคราะห์
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setFiles(prev => prev.filter(f => f.id !== file.id))} 
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-[1.25rem] w-16 h-16 transition-all"
                        >
                          <Trash2 className="w-7 h-7" />
                        </Button>
                      </div>
                    </div>

                    {/* Result Content */}
                    {file.status === 'success' && file.result && (
                      <div className="space-y-16 animate-in fade-in slide-in-from-bottom-10 duration-1000">
                        {/* Warnings */}
                        {file.result.warnings && file.result.warnings.length > 0 && (
                          <div className="bg-amber-50 border border-amber-300 rounded-[2rem] p-8 flex items-start gap-6">
                            <div className="p-4 bg-amber-100 rounded-2xl shrink-0">
                              <AlertCircle className="w-8 h-8 text-amber-600" />
                            </div>
                            <div className="space-y-2">
                              <h4 className="font-black text-xl text-amber-800 tracking-tight">โปรดตรวจสอบ</h4>
                              <ul className="space-y-1.5 text-amber-800/90 font-medium list-disc list-inside">
                                {file.result.warnings.map((w, i) => (
                                  <li key={i}>{w}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}

                        {/* Summary Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                          {[
                            { label: 'มูลค่ารวมโครงการ', value: file.result.grand, icon: <Box className="w-8 h-8" />, unit: '฿', color: 'primary' },
                            { label: 'รายการประเมิน', value: file.result.items, icon: <Layers className="w-8 h-8" />, unit: 'รายการ', color: 'secondary' },
                            { label: 'ชีตงานที่วิเคราะห์', value: file.result.sheets, icon: <FileText className="w-8 h-8" />, unit: 'ชีต', color: 'primary' }
                          ].map((stat, i) => (
                            <div key={i} className={`p-10 rounded-[2.5rem] border border-${stat.color}/10 bg-${stat.color}/5 relative overflow-hidden group hover:shadow-2xl transition-all duration-500`}>
                              <div className={`absolute -right-8 -bottom-8 opacity-[0.03] group-hover:opacity-[0.07] group-hover:scale-125 group-hover:rotate-12 transition-all duration-700 text-${stat.color}`}>
                                {stat.icon}
                                <Box className="w-48 h-48" />
                              </div>
                              <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                                <span className={`w-3 h-3 rounded-full bg-${stat.color} shadow-lg shadow-${stat.color}/50`}></span>
                                {stat.label}
                              </p>
                              <div className={`text-5xl font-black text-${stat.color} tracking-tighter`}>
                                {stat.unit === '฿' && <span className="text-2xl mr-1 font-bold">฿</span>}
                                <AnimatedNumber value={stat.value} />
                                {stat.unit !== '฿' && <span className="text-xl font-bold ml-2 text-muted-foreground">{stat.unit}</span>}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* AI Section */}
                        <div className="relative">
                          <AiSummaryView 
                            input={{
                              grand: file.result.grand,
                              items: file.result.items,
                              sheets: file.result.sheets,
                              summary: file.result.summary
                            }} 
                          />
                        </div>

                        {/* Charts Section */}
                        <div className="space-y-8">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-secondary/10 rounded-2xl">
                              <Construction className="w-7 h-7 text-secondary" />
                            </div>
                            <h4 className="text-3xl font-black text-primary tracking-tight">วิเคราะห์สัดส่วนต้นทุน</h4>
                          </div>
                          <BoqCharts data={file.result.summary} />
                        </div>

                        {/* Table Section */}
                        <BoqSummaryTable summary={file.result.summary} grandTotal={file.result.grand} />
                      </div>
                    )}

                    {file.status === 'error' && (
                      <div className="bg-destructive/5 border border-destructive/20 p-12 rounded-[2.5rem] flex items-center gap-8 animate-in slide-in-from-top-4">
                        <div className="p-6 bg-destructive/10 rounded-3xl">
                          <AlertCircle className="w-14 h-14 text-destructive" />
                        </div>
                        <div>
                          <h4 className="font-black text-3xl text-destructive mb-2 tracking-tight">ไม่สามารถประมวลผลไฟล์ได้</h4>
                          <p className="text-destructive/70 text-lg font-medium">{file.errorMessage}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 pt-24 text-center">
        <div className="bg-primary/5 py-16 rounded-[4rem] border border-primary/5 shadow-inner">
          <div className="flex items-center justify-center gap-3 mb-4">
            <HardHat className="w-8 h-8 text-secondary" />
            <p className="text-2xl font-black text-primary tracking-tight">Smart Summary Pro</p>
          </div>
          <p className="text-muted-foreground font-medium mb-2">เทคโนโลยีวิศวกรรมข้อมูลเพื่อการก่อสร้างที่โปร่งใส</p>
          <p className="text-muted-foreground/50 text-xs font-bold uppercase tracking-widest">© {new Date().getFullYear()} Construction Data Intelligence System</p>
        </div>
      </footer>
    </div>
  );
}
