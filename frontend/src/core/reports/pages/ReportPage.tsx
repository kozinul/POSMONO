import { useState, useMemo, useEffect } from 'react';
import { reports } from '../reportCatalog';
import ReportShell from '../components/ReportShell';
import { RefundReceiptModal } from '../components/RefundReceiptModal';
import { type RefundRow } from '../../payments/hooks/useRefund';
import DailySection from '../sections/DailySection';
import SalesSection from '../sections/SalesSection';
import FinanceSection from '../sections/FinanceSection';
import ProfitLossSection from '../sections/ProfitLossSection';
import SalesPerProductSection from '../sections/SalesPerProductSection';
import CashierReceiptsSection from '../sections/CashierReceiptsSection';
import SalesPerCashierSection from '../sections/SalesPerCashierSection';
import InventorySummarySection from '../sections/InventorySummarySection';
import PaymentReconciliationSection from '../sections/PaymentReconciliationSection';
import RefundsSection from '../sections/RefundsSection';

export default function ReportPage() {
  const today = new Date().toISOString().split('T')[0];
  const [search, setSearch] = useState('');
  const [activeReport, setActiveReport] = useState('daily');

  const [selectedDate, setSelectedDate] = useState(today);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [financeFrom, setFinanceFrom] = useState(today);
  const [financeTo, setFinanceTo] = useState(today);
  const [plFrom, setPlFrom] = useState(today);
  const [plTo, setPlTo] = useState(today);
  const [sppFrom, setSppFrom] = useState(today);
  const [sppTo, setSppTo] = useState(today);
  const [cashierReceiptsFrom, setCashierReceiptsFrom] = useState(today);
  const [cashierReceiptsTo, setCashierReceiptsTo] = useState(today);
  const [spcFrom, setSpcFrom] = useState(today);
  const [spcTo, setSpcTo] = useState(today);
  const [invFrom, setInvFrom] = useState(today);
  const [invTo, setInvTo] = useState(today);
  const [recFrom, setRecFrom] = useState(today);
  const [recTo, setRecTo] = useState(today);
  const [refundFrom, setRefundFrom] = useState(today);
  const [refundTo, setRefundTo] = useState(today);
  const [selectedRefund, setSelectedRefund] = useState<RefundRow | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  const filteredReports = useMemo(() => {
    if (!search.trim()) return reports;
    const q = search.toLowerCase();
    return reports.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.keywords.toLowerCase().includes(q),
    );
  }, [search]);

  useEffect(() => {
    if (filteredReports.length > 0 && !filteredReports.find((r) => r.id === activeReport)) {
      setActiveReport(filteredReports[0].id);
    }
  }, [filteredReports, activeReport]);

  return (
    <ReportShell
      search={search}
      onSearchChange={setSearch}
      reports={filteredReports}
      activeReport={activeReport}
      onSelectReport={setActiveReport}
      overlay={
        <RefundReceiptModal
          open={!!selectedRefund}
          refund={selectedRefund}
          onClose={() => setSelectedRefund(null)}
        />
      }
    >
      {activeReport === 'daily' && (
        <DailySection
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
        />
      )}
      {activeReport === 'sales' && (
        <SalesSection
          today={today}
          dateFrom={dateFrom}
          dateTo={dateTo}
          setDateFrom={setDateFrom}
          setDateTo={setDateTo}
        />
      )}
      {activeReport === 'finance' && (
        <FinanceSection
          today={today}
          financeFrom={financeFrom}
          financeTo={financeTo}
          setFinanceFrom={setFinanceFrom}
          setFinanceTo={setFinanceTo}
        />
      )}
      {activeReport === 'profit-loss' && (
        <ProfitLossSection
          today={today}
          plFrom={plFrom}
          plTo={plTo}
          setPlFrom={setPlFrom}
          setPlTo={setPlTo}
        />
      )}
      {activeReport === 'sales-per-product' && (
        <SalesPerProductSection
          today={today}
          sppFrom={sppFrom}
          sppTo={sppTo}
          setSppFrom={setSppFrom}
          setSppTo={setSppTo}
          expandedProduct={expandedProduct}
          setExpandedProduct={setExpandedProduct}
        />
      )}
      {activeReport === 'cashier-receipts' && (
        <CashierReceiptsSection
          today={today}
          cashierReceiptsFrom={cashierReceiptsFrom}
          cashierReceiptsTo={cashierReceiptsTo}
          setCashierReceiptsFrom={setCashierReceiptsFrom}
          setCashierReceiptsTo={setCashierReceiptsTo}
        />
      )}
      {activeReport === 'sales-per-cashier' && (
        <SalesPerCashierSection
          today={today}
          spcFrom={spcFrom}
          spcTo={spcTo}
          setSpcFrom={setSpcFrom}
          setSpcTo={setSpcTo}
        />
      )}
      {activeReport === 'inventory-summary' && (
        <InventorySummarySection
          today={today}
          invFrom={invFrom}
          invTo={invTo}
          setInvFrom={setInvFrom}
          setInvTo={setInvTo}
        />
      )}
      {activeReport === 'payment-reconciliation' && (
        <PaymentReconciliationSection
          today={today}
          recFrom={recFrom}
          recTo={recTo}
          setRecFrom={setRecFrom}
          setRecTo={setRecTo}
        />
      )}
      {activeReport === 'refunds' && (
        <RefundsSection
          today={today}
          refundFrom={refundFrom}
          refundTo={refundTo}
          setRefundFrom={setRefundFrom}
          setRefundTo={setRefundTo}
          setSelectedRefund={setSelectedRefund}
        />
      )}
    </ReportShell>
  );
}
