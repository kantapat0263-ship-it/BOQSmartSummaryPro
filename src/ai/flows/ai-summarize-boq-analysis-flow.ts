'use server';
/**
 * @fileOverview This file provides an AI-powered tool to analyze BOQ budget distributions
 * and provide an executive text summary of potential cost-saving opportunities or work-package heavy areas.
 *
 * - summarizeBoqAnalysis - A function that generates an executive summary from BOQ analysis data.
 * - SummarizeBoqAnalysisInput - The input type for the summarizeBoqAnalysis function.
 * - SummarizeBoqAnalysisOutput - The return type for the summarizeBoqAnalysis function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeBoqAnalysisInputSchema = z.object({
  grand: z.number().describe('Total project cost in baht.'),
  items: z.number().describe('Unique line-item count.'),
  sheets: z.number().describe('Number of work sheets read.'),
  summary: z.array(
    z.object({
      cat: z.string().describe('Work category name.'),
      count: z.number().describe('Number of items in this category.'),
      mat: z.number().describe('Material cost for this category.'),
      lab: z.number().describe('Labor cost for this category.'),
      tot: z.number().describe('Total cost for this category (material + labor).'),
      pct: z.number().describe('Percentage of total project cost for this category.'),
    })
  ).describe('Detailed breakdown of costs by work category.'),
});
export type SummarizeBoqAnalysisInput = z.infer<typeof SummarizeBoqAnalysisInputSchema>;

const SummarizeBoqAnalysisOutputSchema = z.object({
  summary: z.string().describe('An AI-generated executive summary of the BOQ analysis.'),
});
export type SummarizeBoqAnalysisOutput = z.infer<typeof SummarizeBoqAnalysisOutputSchema>;

export async function summarizeBoqAnalysis(input: SummarizeBoqAnalysisInput): Promise<SummarizeBoqAnalysisOutput> {
  return summarizeBoqAnalysisFlow(input);
}

const summarizeBoqAnalysisPrompt = ai.definePrompt({
  name: 'summarizeBoqAnalysisPrompt',
  input: {schema: SummarizeBoqAnalysisInputSchema},
  output: {schema: SummarizeBoqAnalysisOutputSchema},
  prompt: `คุณคือผู้เชี่ยวชาญด้านการวิเคราะห์ทางการเงินสำหรับบริษัทก่อสร้าง โดยเชี่ยวชาญด้านการวิเคราะห์ BOQ (Bill of Quantities) อย่างละเอียด หน้าที่ของคุณคือการให้บทสรุปผู้บริหารจากข้อมูล BOQ ที่ได้รับมา โดยเน้นที่การระบุปัจจัยขับเคลื่อนต้นทุนหลัก โอกาสในการประหยัดต้นทุนที่เป็นไปได้ และข้อมูลเชิงลึกระดับสูงของโครงการ บทสรุปควรมีความกระชับ เป็นมืออาชีพ และเหมาะสมสำหรับผู้จัดการโครงการ.\n\nข้อมูลการวิเคราะห์ BOQ:\nมูลค่ารวมทั้งโครงการ: {{{grand}}} บาท\nจำนวนรายการวัสดุ/บริการที่ไม่ซ้ำกัน: {{{items}}} รายการ\nจำนวนชีตงานที่อ่านได้: {{{sheets}}} ชีต\n\nรายละเอียดค่าใช้จ่ายตามหมวดงาน:\n{{#each summary}}\n- หมวดงาน: {{{cat}}}, รวม: {{{tot}}} บาท (คิดเป็น {{{pct}}}% ของมูลค่าโครงการทั้งหมด) [ค่าวัสดุ: {{{mat}}} บาท, ค่าแรง: {{{lab}}} บาท]\n{{/each}}\n\nโปรดสร้างบทสรุปสำหรับผู้บริหารที่ครอบคลุมประเด็นต่อไปนี้:\n1.  **ปัจจัยขับเคลื่อนต้นทุนหลัก (Major Cost Drivers)**: ระบุหมวดงานที่มีค่าใช้จ่ายสูงที่สุดพร้อมระบุตัวเลขและเปอร์เซ็นต์จากมูลค่าโครงการทั้งหมด\n2.  **โอกาสในการประหยัดต้นทุน (Potential Cost-Saving Opportunities)**: เสนอแนะแนวทางที่เป็นไปได้ในการประหยัดต้นทุนโดยอิงจากข้อมูลที่ให้มา เช่น การจัดการสัดส่วนวัสดุ/ค่าแรง หรือการรวมหมวดงานที่มีต้นทุนสูง\n3.  **ข้อมูลเชิงลึกระดับสูงของโครงการ (High-Level Project Insights)**: ให้ข้อสังเกตเกี่ยวกับภาพรวมโครงการ เช่น ความสมดุลของต้นทุนวัสดุเทียบกับค่าแรง ความซับซ้อนของโครงการจากจำนวนรายการ หรือข้อสังเกตอื่น ๆ ที่สำคัญสำหรับผู้บริหาร.\n`,
});

const summarizeBoqAnalysisFlow = ai.defineFlow(
  {
    name: 'summarizeBoqAnalysisFlow',
    inputSchema: SummarizeBoqAnalysisInputSchema,
    outputSchema: SummarizeBoqAnalysisOutputSchema,
  },
  async (input) => {
    const {output} = await summarizeBoqAnalysisPrompt(input);
    return output!;
  }
);
