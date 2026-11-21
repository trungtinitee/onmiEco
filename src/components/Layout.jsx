import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import Header from './Header';
import PrintHeader from './PrintHeader';
import PrintSignatureFooter from './PrintSignatureFooter';
import PrintCustomizationModal from './PrintCustomizationModal';
import Sidebar, { NAV_ITEMS } from './Sidebar';
import FloatingToolMenu from './FloatingToolMenu';
import EngineeringWidget from './EngineeringWidget';
import { useAppActions, useAppContext } from '../context/AppContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { STORAGE_QUOTA_EVENT, STORAGE_QUOTA_MESSAGE } from '../utils/storage';

/**
 * Cô lập toàn bộ state của Trạm tiện ích nổi (FloatingToolMenu & EngineeringWidget).
 * Khi người dùng bấm mở Speed Dial, gõ máy tính hoặc đổi đơn vị,
 * chỉ EngineeringToolbox re-render — các form tính toán trong <main> không bị ảnh hưởng.
 */
const EngineeringToolbox = memo(function EngineeringToolbox({
  onPrintPdf,
  onResetData,
}) {
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [widgetTab, setWidgetTab] = useState('calc');

  const handleOpenCalcWidget = useCallback(() => {
    setWidgetTab('calc');
    setWidgetOpen(true);
  }, []);

  const handleCloseWidget = useCallback(() => {
    setWidgetOpen(false);
  }, []);

  return (
    <>
      <FloatingToolMenu
        onPrintPdf={onPrintPdf}
        onOpenWidget={handleOpenCalcWidget}
        onResetData={onResetData}
      />

      <EngineeringWidget
        isOpen={widgetOpen}
        onClose={handleCloseWidget}
        initialTab={widgetTab}
      />
    </>
  );
});

const MainViewport = memo(function MainViewport({
  showPrintHeader,
  routeLabel,
  children,
}) {
  const { printOptions } = useAppContext();
  const hideNotesClass = printOptions?.showDetailedNotes ? '' : 'print-hide-notes';

  return (
    <main
      className={`flex-1 w-full px-4 pt-5 pb-24 md:px-8 md:py-8 md:pb-24 print:bg-white print:text-black print:p-0 print:m-0 ${hideNotesClass}`}
    >
      <div className="mx-auto w-full max-w-6xl print:max-w-none print:bg-white print:text-black print:p-0 print:m-0">
        {showPrintHeader && <PrintHeader routeLabel={routeLabel} />}
        {children}
        <PrintSignatureFooter />
      </div>
    </main>
  );
});

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null); // { ok, message }
  const toastTimerRef = useRef(null);

  const { resetDefaults, openPrintModal } = useAppActions();
  const location = useLocation();

  const currentRoute = useMemo(
    () => NAV_ITEMS.find((item) => item.to === location.pathname) || NAV_ITEMS[0],
    [location.pathname]
  );

  const showPrintHeader = location.pathname !== '/nhat-ky-van-hanh';

  useBodyScrollLock(sidebarOpen);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showNotice = useCallback((ok, message) => {
    setToast({ ok, message });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  }, []);

  useEffect(() => {
    const handleStorageQuotaExceeded = (event) => {
      const message = event?.detail?.message || STORAGE_QUOTA_MESSAGE;
      showNotice(false, message);
    };
    window.addEventListener(STORAGE_QUOTA_EVENT, handleStorageQuotaExceeded);
    return () => {
      window.removeEventListener(
        STORAGE_QUOTA_EVENT,
        handleStorageQuotaExceeded
      );
    };
  }, [showNotice]);

  const handlePrintPdf = useCallback(() => {
    openPrintModal(currentRoute?.label || 'Báo cáo Kỹ thuật');
  }, [openPrintModal, currentRoute?.label]);

  const handleResetData = useCallback(() => {
    resetDefaults();
    showNotice(true, 'Đã khôi phục thông số mặc định (Q = 1.000 m³/ngày).');
  }, [resetDefaults, showNotice]);

  const handleOpenSidebar = useCallback(() => setSidebarOpen(true), []);
  const handleCloseSidebar = useCallback(() => setSidebarOpen(false), []);
  const handleDismissToast = useCallback(() => setToast(null), []);

  return (
    <div className="min-h-screen flex bg-slate-900 text-slate-200 overflow-x-clip print:block print:min-h-0 print:overflow-visible print:bg-white print:text-black print:p-0 print:m-0">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={handleCloseSidebar}
        onNotify={showNotice}
      />

      <div className="flex-1 flex flex-col min-w-0 w-full print:block print:bg-white print:text-black">
        <Header
          currentRoute={currentRoute}
          sidebarOpen={sidebarOpen}
          onOpenSidebar={handleOpenSidebar}
        />

        {/* Inline Toast Banner (No window.alert) */}
        {toast && (
          <div className="no-print print:hidden px-4 md:px-8 pt-4">
            <div
              role="status"
              className={`mx-auto max-w-6xl rounded-lg border px-4 py-2.5 flex items-center justify-between gap-3 text-xs font-medium ${
                toast.ok
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                  : 'bg-red-500/15 border-red-500/40 text-red-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {toast.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                )}
                <span>{toast.message}</span>
              </div>
              <button
                type="button"
                onClick={handleDismissToast}
                aria-label="Đóng thông báo"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded hover:bg-slate-800/60 shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Main Content Viewport — memoized against sidebar/toast/toolbox state */}
        <MainViewport
          showPrintHeader={showPrintHeader}
          routeLabel={currentRoute.label}
        >
          {children}
        </MainViewport>
      </div>

      {/* Trạm tiện ích nổi & Modal Kỹ sư (Cô lập state hoàn toàn) */}
      <EngineeringToolbox
        onPrintPdf={handlePrintPdf}
        onResetData={handleResetData}
      />

      {/* Modal Cấu hình Tùy chọn In ấn */}
      <PrintCustomizationModal />
    </div>
  );
}
