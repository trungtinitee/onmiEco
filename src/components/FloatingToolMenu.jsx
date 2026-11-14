import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Calculator, Printer, RotateCcw, Wrench, X } from 'lucide-react';

const FloatingToolMenu = memo(function FloatingToolMenu({
  onPrintPdf,
  onOpenWidget,
  onResetData,
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleClose = useCallback(() => setIsOpen(false), []);
  const handleToggle = useCallback(() => setIsOpen((prev) => !prev), []);

  // Đóng menu khi bấm phím Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const actions = useMemo(
    () => [
      {
        id: 'print',
        label: 'In báo cáo PDF',
        icon: Printer,
        delayClass: 'delay-[60ms]',
        onClick: () => {
          setIsOpen(false);
          onPrintPdf?.();
        },
        tone: 'hover:bg-emerald-600 hover:border-emerald-500 hover:text-white text-emerald-400',
      },
      {
        id: 'widget',
        label: 'Máy tính & Đơn vị',
        icon: Calculator,
        delayClass: 'delay-[30ms]',
        onClick: () => {
          setIsOpen(false);
          onOpenWidget?.();
        },
        tone: 'hover:bg-emerald-600 hover:border-emerald-500 hover:text-white text-sky-400',
      },
      {
        id: 'reset',
        label: 'Xóa dữ liệu',
        icon: RotateCcw,
        delayClass: 'delay-0',
        onClick: () => {
          setIsOpen(false);
          onResetData?.();
        },
        tone: 'hover:bg-red-600 hover:border-red-500 hover:text-white text-amber-400',
      },
    ],
    [onPrintPdf, onOpenWidget, onResetData]
  );

  return (
    <>
      {/* Nền click-outside nhẹ khi menu đang mở */}
      {isOpen && (
        <div
          onClick={handleClose}
          aria-hidden="true"
          className="no-print print:hidden fixed inset-0 z-[85] bg-slate-950/30 backdrop-blur-[1px]"
        />
      )}

      <div className="no-print print:hidden fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-[90] flex flex-col items-end gap-3 max-w-[calc(100vw-2rem)]">
        {/* Speed Dial Action Buttons */}
        <div
          aria-hidden={!isOpen}
          className={`flex flex-col items-end gap-2.5 max-w-full transition-all duration-200 ${
            isOpen
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <div
                key={action.id}
                className={`flex items-center justify-end gap-2.5 sm:gap-3 max-w-full transition-all duration-200 ${action.delayClass} ${
                  isOpen
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-3'
                }`}
              >
                {/* Tooltip chú thích bên trái */}
                <span className="max-w-[calc(100vw-6rem)] truncate px-3 py-1.5 rounded-lg bg-slate-800/95 border border-slate-700 text-slate-200 text-xs font-medium shadow-lg select-none">
                  {action.label}
                </span>

                {/* Nút tròn công cụ */}
                <button
                  type="button"
                  tabIndex={isOpen ? 0 : -1}
                  onClick={action.onClick}
                  aria-label={action.label}
                  title={action.label}
                  className={`flex items-center justify-center h-11 w-11 rounded-full bg-slate-800 border border-slate-700 shadow-lg transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 shrink-0 ${action.tone}`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Main AssistiveTouch / Speed Dial Trigger Button */}
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Đóng trạm tiện ích' : 'Mở trạm tiện ích kỹ sư'}
          title={isOpen ? 'Đóng menu tiện ích' : 'Trạm tiện ích nổi omniEco'}
          className="flex items-center justify-center h-14 w-14 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-xl shadow-emerald-950/60 border border-emerald-400/30 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        >
          <span
            className={`transition-transform duration-200 ${
              isOpen ? 'rotate-90' : 'rotate-0'
            }`}
          >
            {isOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Wrench className="h-6 w-6" />
            )}
          </span>
        </button>
      </div>
    </>
  );
});

export default FloatingToolMenu;
