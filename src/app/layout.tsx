import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ระบบสรุปวัสดุ BOQ - Smart Summary Pro',
  description: 'เครื่องมือสรุปค่าวัสดุและค่าแรงจากไฟล์ BOQ อัตโนมัติสำหรับธุรกิจก่อสร้าง',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background min-h-screen">
        {children}
      </body>
    </html>
  );
}
