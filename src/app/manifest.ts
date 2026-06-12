import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AC Cost Control — ระบบสรุปวัสดุ BOQ',
    short_name: 'AC Cost',
    description:
      'ถอด/รวมวัสดุจาก BOQ แยกหมวด สรุปต้นทุน เทียบราคา และดาวน์โหลดรายงาน Excel สำหรับงานก่อสร้าง',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0a1830',
    theme_color: '#13294a',
    lang: 'th',
    categories: ['business', 'productivity', 'utilities'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
