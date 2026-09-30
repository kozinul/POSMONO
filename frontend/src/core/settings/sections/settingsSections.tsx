import type { ReactNode } from 'react';

export interface SettingsSectionMeta {
  id: string;
  label: string;
  keywords: string;
  icon: ReactNode;
}

export const SETTINGS_SECTIONS: SettingsSectionMeta[] = [
  {
    id: 'profile',
    label: 'Profil Toko',
    keywords: 'nama toko alamat telepon kategori bisnis informasi',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'tax',
    label: 'Pajak & Service',
    keywords: 'pajak service charge biaya pelayanan tarif pricing mode inclusive exclusive',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'discount',
    label: 'Batas Diskon',
    keywords: 'diskon maksimal batas persen nominal potongan',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M9.568 3.563a2.25 2.25 0 014.864 0l.22 1.1a2.25 2.25 0 001.85 1.635l1.118.163a2.25 2.25 0 011.315 3.896l-.778.695a2.25 2.25 0 00-.715 2.121l.183.929a2.25 2.25 0 01-2.263 2.706l-1.076-.088a2.25 2.25 0 00-1.956 1.078l-.556.932a2.25 2.25 0 01-4.008 0l-.556-.932a2.25 2.25 0 00-1.956-1.078l-1.076.088a2.25 2.25 0 01-2.263-2.706l.183-.929a2.25 2.25 0 00-.715-2.121l-.778-.695a2.25 2.25 0 011.315-3.896l1.118-.163a2.25 2.25 0 001.85-1.635l.22-1.1z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 15l6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'tax-rules',
    label: 'Aturan Pajak',
    keywords: 'tax rules compound pajak bertingkat kategori produk bebas pajak exemption multi rule',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'pricing-profiles',
    label: 'Profil Harga',
    keywords: 'pricing profile tax rules group pajak kategori produk aturan harga grouping',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M9.568 3.563a2.25 2.25 0 014.864 0l.22 1.1a2.25 2.25 0 001.85 1.635l1.118.163a2.25 2.25 0 011.315 3.896l-.778.695a2.25 2.25 0 00-.715 2.121l.183.929a2.25 2.25 0 01-2.263 2.706l-1.076-.088a2.25 2.25 0 00-1.956 1.078l-.556.932a2.25 2.25 0 01-4.008 0l-.556-.932a2.25 2.25 0 00-1.956-1.078l-1.076.088a2.25 2.25 0 01-2.263-2.706l.183-.929a2.25 2.25 0 00-.715-2.121l-.778-.695a2.25 2.25 0 011.315-3.896l1.118-.163a2.25 2.25 0 001.85-1.635l.22-1.1z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 9l-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'rounding',
    label: 'Pembulatan',
    keywords: 'pembulatan rounding pembulatan total genap rupiah 500 1000 tunai cash',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM12 21c4.5 0 7.5-2.4 7.5-6.75 0-1.875-1.08-3.135-2.465-4.072A8.25 8.25 0 0012 8.25c-2.32 0-4.5 1.5-4.5 3.6 0 1.656 1.08 3.6 2.51 4.1A4.72 4.72 0 0111.25 18h.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'qris',
    label: 'QRIS Gateway',
    keywords: 'qris gateway qr payment pembayaran dinamis api key merchant dinamis ewallet scan',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
      </svg>
    ),
  },
  {
    id: 'charges',
    label: 'Biaya Tambahan',
    keywords: 'service charge biaya delivery ongkir fee tambahan',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M9.568 3.563a2.25 2.25 0 014.864 0l.22 1.1a2.25 2.25 0 001.85 1.635l1.118.163a2.25 2.25 0 011.315 3.896l-.778.695a2.25 2.25 0 00-.715 2.121l.183.929a2.25 2.25 0 01-2.263 2.706l-1.076-.088a2.25 2.25 0 00-1.956 1.078l-.556.932a2.25 2.25 0 01-4.008 0l-.556-.932a2.25 2.25 0 00-1.956-1.078l-1.076.088a2.25 2.25 0 01-2.263-2.706l.183-.929a2.25 2.25 0 00-.715-2.121l-.778-.695a2.25 2.25 0 011.315-3.896l1.118-.163a2.25 2.25 0 001.85-1.635l.22-1.1z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 6v6m0 0v6m0-6h6m-6 0H6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'receipt',
    label: 'Struk & Cetak',
    keywords: 'footer struk receipt pesan cetak printer',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M6.72 14.25c.416-2.105 2.123-3.75 4.28-3.75s3.864 1.645 4.28 3.75M6.72 14.25H6.5A2.25 2.25 0 004.25 16.5v4.5A2.25 2.25 0 006.5 23.25h11A2.25 2.25 0 0019.75 21v-4.5a2.25 2.25 0 00-2.25-2.25h-.22M6.72 14.25A5.25 5.25 0 1112 9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];
