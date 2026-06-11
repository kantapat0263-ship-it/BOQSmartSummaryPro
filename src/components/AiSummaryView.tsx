"use client"

import React, { useState, useEffect } from 'react';
import { summarizeBoqAnalysis, SummarizeBoqAnalysisInput } from '@/ai/flows/ai-summarize-boq-analysis-flow';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AiSummaryViewProps {
  input: SummarizeBoqAnalysisInput;
}

export function AiSummaryView({ input }: AiSummaryViewProps) {
  const [aiText, setAiText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function getAiSummary() {
      setLoading(true);
      setError(null);
      try {
        const result = await summarizeBoqAnalysis(input);
        setAiText(result.summary);
      } catch (err) {
        console.error(err);
        setError("ไม่สามารถสร้างบทสรุป AI ได้ในขณะนี้");
      } finally {
        setLoading(false);
      }
    }
    getAiSummary();
  }, [input]);

  if (loading) {
    return (
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-8 flex flex-col items-center justify-center text-primary mt-8 animate-pulse">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p className="font-medium">AI กำลังวิเคราะห์ข้อมูลและสรุปภาพรวมให้คุณ...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mt-8">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>ขออภัย</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!aiText) return null;

  return (
    <div className="bg-white border-2 border-primary/10 rounded-2xl p-6 shadow-sm mt-8 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Sparkles className="w-32 h-32 text-primary" />
      </div>
      
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-primary/10 p-2 rounded-lg">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-primary">บทสรุปอัจฉริยะ (AI Executive Summary)</h3>
      </div>
      
      <div className="prose prose-blue max-w-none">
        <div className="whitespace-pre-wrap text-foreground/80 leading-relaxed space-y-4">
          {aiText.split('\n\n').map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </div>
      
      <div className="mt-6 pt-6 border-t border-border/40 text-xs text-muted-foreground italic">
        * บทสรุปนี้สร้างขึ้นโดย AI เพื่อใช้เป็นแนวทางเบื้องต้นในการพิจารณาต้นทุนโครงการ
      </div>
    </div>
  );
}
