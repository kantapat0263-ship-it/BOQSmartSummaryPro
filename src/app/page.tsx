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
  ChevronRight
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
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'processing', progress: 50 } : f));

    try {
      // Simulate API or actual processing logic
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

  const handleFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(file => {
      const isXlsx = file.name.endsWith('.xlsx');
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
    a.download = result.filename;
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
              alt="Construction" 
              fill 
              className="object-cover"
              data-ai-hint={heroImage.imageHint}
            />
          )}
        </div>
        <div className="max-w-7xl mx-auto px-6 py-20 relative z-10 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 space-y-6 text-center md:text-left">
            <Badge className="bg-secondary text-white hover:bg-secondary/90 px-4 py-1 rounded-full text-sm font-bold uppercase tracking-wider">
              Smart Construction Solutions
            </Badge>
            <h1 className="text-5xl md:text-6xl font-extrabold font-headline leading-tight">
              ระบบวิเคราะห์ <br />
              <span className="text-secondary">งบประมาณ BOQ</span> อัจฉริยะ
            </h1>
            <p className="text-blue-100 text-xl max-w-xl leading-relaxed">
              เครื่องมือสำหรับผู้รับเหมามืออาชีพ แกะวัสดุ รวมยอด และสรุปต้นทุนแยกตามหมวดงานด้วยเทคโนโลยี AI
            </p>
            <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-4">
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/20">
                <HardHat className="w-5 h-5 text-secondary" />
                <span className="text-sm font-medium">คุมต้นทุนแม่นยำ</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/20">
                <Construction className="w-5 h-5 text-secondary" />
                <span className="text-sm font-medium">ลดงานเอกสาร</span>
              </div>
            </div>
          </div>

          <Card className="w-full max-w-md p-8 glass-card border-none shadow-2xl animate-in zoom-in duration-500">
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(Array.from(e.dataTransfer.files)); }}
              className={`relative group cursor-pointer transition-all duration-300 rounded-3xl border-2 border-dashed h-64 flex flex-col items-center justify-center p-6 text-center
                ${isDragging ? 'border-secondary bg-secondary/5' : 'border-primary/20 bg-muted/30 hover:border-secondary/50'}`}
            >
              <input
                type="file"
                multiple
                accept=".xlsx"
                onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className={`p-4 rounded-full mb-4 transition-transform duration-300 ${isDragging ? 'bg-secondary text-white scale-110' : 'bg-primary text-white group-hover:scale-110'}`}>
                <FileUp className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-primary mb-1">ลากไฟล์ BOQ วางที่นี่</h3>
              <p className="text-sm text-muted-foreground">รองรับ Excel (.xlsx) สูงสุด 4.5MB</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 -mt-10">
        <div className="space-y-12">
          {files.length === 0 ? (
            <div className="bg-white/50 backdrop-blur-sm border border-dashed border-primary/20 rounded-[2.5rem] py-24 text-center space-y-4">
              <div className="bg-primary/5 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                <LayoutDashboard className="w-10 h-10 text-primary/30" />
              </div>
              <div className="space-y-1">
                <p className="text-xl font-bold text-primary/40">ยังไม่มีประวัติการวิเคราะห์</p>
                <p className="text-muted-foreground">อัปโหลดไฟล์ BOQ เพื่อดู Dashboard สรุปงบประมาณ</p>
              </div>
            </div>
          ) : (
            <div className="space-y-10">
              {files.map((file) => (
                <Card key={file.id} className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white/80 backdrop-blur-md">
                  <div className="p-8 md:p-12 space-y-10">
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-6 pb-8 border-b border-primary/5">
                      <div className="flex items-center gap-5">
                        <div className="p-4 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20">
                          <FileSpreadsheet className="w-8 h-8" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-primary leading-none mb-2">
                            {file.file.name}
                          </h3>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="border-primary/20 text-primary/60">
                              {(file.file.size / (1024 * 1024)).toFixed(2)} MB
                            </Badge>
                            {file.status === 'success' ? (
                              <Badge className="bg-secondary/10 text-secondary border-none font-bold">
                                วิเคราะห์สำเร็จ
                              </Badge>
                            ) : file.status === 'processing' ? (
                              <div className="flex items-center gap-2 text-primary font-bold text-sm animate-pulse">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>กำลังถอดแบบวัสดุ...</span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {file.status === 'success' && file.result && (
                          <Button 
                            onClick={() => handleDownload(file.result!)}
                            className="bg-secondary hover:bg-secondary/90 text-white rounded-2xl px-8 h-14 text-lg font-bold shadow-lg shadow-secondary/20 transition-all hover:scale-105"
                          >
                            <Download className="w-5 h-5 mr-3" />
                            ดาวน์โหลด Excel
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setFiles(prev => prev.filter(f => f.id !== file.id))} 
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-2xl w-14 h-14"
                        >
                          <Trash2 className="w-6 h-6" />
                        </Button>
                      </div>
                    </div>

                    {/* Result Content */}
                    {file.status === 'success' && file.result && (
                      <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
                        {/* Summary Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          {[
                            { label: 'มูลค่ารวมโครงการ', value: file.result.grand, icon: <Box className="w-6 h-6" />, unit: '฿', color: 'primary' },
                            { label: 'รายการวัสดุ', value: file.result.items, icon: <Layers className="w-6 h-6" />, unit: 'รายการ', color: 'secondary' },
                            { label: 'ข้อมูลชีตงาน', value: file.result.sheets, icon: <FileText className="w-6 h-6" />, unit: 'ชีต', color: 'primary' }
                          ].map((stat, i) => (
                            <div key={i} className={`p-8 rounded-[2rem] border border-${stat.color}/10 bg-${stat.color}/5 relative overflow-hidden group hover:shadow-lg transition-all`}>
                              <div className={`absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500 text-${stat.color}`}>
                                {stat.icon}
                                <Box className="w-32 h-32" />
                              </div>
                              <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full bg-${stat.color}`}></span>
                                {stat.label}
                              </p>
                              <div className={`text-4xl font-black text-${stat.color}`}>
                                {stat.unit === '฿' && '฿ '}
                                <AnimatedNumber value={stat.value} />
                                {stat.unit !== '฿' && <span className="text-lg font-bold ml-2">{stat.unit}</span>}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* AI Section */}
                        <AiSummaryView 
                          input={{
                            grand: file.result.grand,
                            items: file.result.items,
                            sheets: file.result.sheets,
                            summary: file.result.summary
                          }} 
                        />

                        {/* Charts Section */}
                        <div className="space-y-6">
                          <div className="flex items-center gap-3">
                            <Construction className="w-6 h-6 text-secondary" />
                            <h4 className="text-2xl font-bold text-primary">การวิเคราะห์ต้นทุนเชิงกราฟ</h4>
                          </div>
                          <BoqCharts data={file.result.summary} />
                        </div>

                        {/* Table Section */}
                        <BoqSummaryTable summary={file.result.summary} grandTotal={file.result.grand} />
                      </div>
                    )}

                    {file.status === 'error' && (
                      <div className="bg-destructive/5 border border-destructive/20 p-10 rounded-[2rem] flex items-center gap-6">
                        <AlertCircle className="w-12 h-12 text-destructive" />
                        <div>
                          <h4 className="font-black text-2xl text-destructive mb-1">ไม่สามารถประมวลผลได้</h4>
                          <p className="text-destructive/80 font-medium">{file.errorMessage}</p>
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
      <footer className="max-w-7xl mx-auto px-6 pt-20 text-center">
        <div className="bg-primary/5 py-12 rounded-[3rem] border border-primary/10">
          <p className="text-primary font-bold mb-2">Smart Summary Pro — ระบบวิศวกรรมข้อมูล BOQ</p>
          <p className="text-muted-foreground text-sm">© {new Date().getFullYear()} บริษัทรับเหมาก่อสร้างยุคใหม่ มุ่งมั่นเพื่อความโปร่งใสและแม่นยำ</p>
        </div>
      </footer>
    </div>
  );
}
