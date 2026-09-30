import type React from 'react';

export interface ReportDefinition {
  id: string;
  label: string;
  keywords: string;
  icon: React.ReactNode;
}

export const reports: ReportDefinition[] = [
  {
    id: 'daily',
    label: 'Laporan Harian',
    keywords: 'harian daily tanggal penjualan shift pembayaran ringkasan',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008z" />
      </svg>
    ),
  },
  {
    id: 'sales',
    label: 'Laporan Penjualan',
    keywords: 'penjualan sales order periode transaksi',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
  },
  {
    id: 'finance',
    label: 'Laporan Keuangan',
    keywords: 'keuangan finance pajak ppn service charge diskon dpp nett',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'profit-loss',
    label: 'Laba Rugi',
    keywords: 'laba rugi profit loss profit hpp cogs margin untung modal',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    id: 'sales-per-product',
    label: 'Penjualan per Produk',
    keywords: 'produk product qty per item terlaris',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7.5A1.5 1.5 0 006 6.5v11A1.5 1.5 0 007.5 19h9a1.5 1.5 0 001.5-1.5v-11A1.5 1.5 0 0016.5 5H15m-6 0a1.5 1.5 0 001.5 1.5H12A1.5 1.5 0 0013.5 5m-6 0A1.5 1.5 0 016 3.5h3M10.5 9h6m-6 3h6m-6 3h3" />
      </svg>
    ),
  },
  {
    id: 'cashier-receipts',
    label: 'Penerimaan per Kasir',
    keywords: 'penerimaan kasir cashier pembayaran metode tunai qris transfer',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5a1.5 1.5 0 011.5-1.5h15a1.5 1.5 0 011.5 1.5v7.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18v-7.5zM6.75 9.75V6a2.25 2.25 0 012.25-2.25h6A2.25 2.25 0 0117.25 6v3.75M8.25 14.25h.008v.008H8.25v-.008zm3 0h.008v.008H11.25v-.008zm3 0h.008v.008H14.25v-.008zm-6 3h.008v.008H8.25v-.008zm3 0h.008v.008H11.25v-.008zm3 0h.008v.008H14.25v-.008z" />
      </svg>
    ),
  },
  {
    id: 'sales-per-cashier',
    label: 'Penjualan per Kasir',
    keywords: 'penjualan kasir cashier order transaksi item rata-rata',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'inventory-summary',
    label: 'Ringkasan Stok',
    keywords: 'stok inventory persediaan stock gudang menipis reserved nilai opname',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
  },
  {
    id: 'payment-reconciliation',
    label: 'Rekonsiliasi Pembayaran',
    keywords: 'rekonsiliasi reconciliation bank metode pembayaran selisih cocok pending transfer sesuai',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l3 3 6-6M7.5 3h9a1.5 1.5 0 011.5 1.5v15a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 016 19.5v-15A1.5 1.5 0 017.5 3zm3 15h.008v.008H10.5V18zm3 0h.008v.008H13.5V18zm3 0h.008v.008H16.5V18z" />
      </svg>
    ),
  },
  {
    id: 'refunds',
    label: 'Laporan Refund',
    keywords: 'refund pengembalian return uang kembali kompensasi pembatalan',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 12.75h3.75a2.25 2.25 0 100-4.5H7.5m3.75 4.5v-1.5m0 1.5h1.5m-1.5-3H9.75m-3 0H6M12 3v18m-7.5-6h15a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0019.5 3h-15A1.5 1.5 0 003 4.5v9a1.5 1.5 0 001.5 1.5z" />
      </svg>
    ),
  },
];
