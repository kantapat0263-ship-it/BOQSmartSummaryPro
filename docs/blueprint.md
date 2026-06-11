# **App Name**: ระบบสรุปวัสดุ BOQ (Smart Summary Pro)

## Core Features:

- การอัปโหลดไฟล์ BOQ หลายไฟล์พร้อมกัน: User-friendly drag-and-drop zone that supports multiple .xlsx files up to 4.5MB with immediate validation.
- การประมวลผลข้อมูลผ่าน API ภายนอก: Integration with existing backend services to process binary data and receive categorized summaries via the POST /api/process endpoint.
- แดชบอร์ดสรุปสถิติโครงการ: Real-time metrics display including animated total value, unique items, and sheet counts per project.
- กราฟวิเคราะห์ข้อมูลด้วย Recharts: Interactive horizontal bar charts for work categories and donut charts for cost distribution share.
- ตารางรายละเอียดแยกวัสดุและค่าแรง: Detailed tables with right-aligned numeric data, thousand separators, and sticky headers for high-density information review.
- เครื่องมือเขียนบทสรุปด้วย AI: An AI-powered tool to analyze budget distributions and provide an executive text summary of potential cost-saving opportunities or work-package heavy areas.
- ระบบถอดรหัสและดาวน์โหลดไฟล์ Excel: A feature to decode base64 results back into .xlsx blobs for offline distribution and archival purposes.

## Style Guidelines:

- Primary: Professional Deep Blue (#1F4E78). Secondary: Success Emerald (#10B981) for budget totals. Background: Soft Neutral Grey (#F6F8FB).
- Primary Thai Font: 'IBM Plex Sans Thai' (Google Font). Secondary: 'Noto Sans Thai'. Ensure a strong typographic hierarchy for professional dashboard utility.
- Use Lucide-React for interface actions, emphasizing material icons and report symbols to denote BOQ categories.
- A SaaS-style dashboard layout using grid-based white cards with a 16px border-radius and subtle box-shadows.
- Use Framer Motion for count-up numeric animations in statistics cards and smooth entrance transitions for newly processed file cards.