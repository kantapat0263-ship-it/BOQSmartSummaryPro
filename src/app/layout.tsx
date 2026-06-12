import type {Metadata, Viewport} from 'next';
import './globals.css';
import {PwaRegister} from '@/components/PwaRegister';

export const metadata: Metadata = {
  applicationName: 'AC Cost Control',
  title: 'ระบบสรุปวัสดุ BOQ - Smart Summary Pro',
  description: 'เครื่องมือสรุปค่าวัสดุและค่าแรงจากไฟล์ BOQ อัตโนมัติสำหรับธุรกิจก่อสร้าง',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AC Cost',
  },
  icons: {
    icon: [
      {url: '/icons/favicon.png', sizes: '48x48', type: 'image/png'},
      {url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png'},
    ],
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#13294a',
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
        <PwaRegister />
      </body>
    </html>
  );
}
