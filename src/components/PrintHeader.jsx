import { memo } from 'react';
import { LOGO_BASE64 } from '../constants/branding';
import { useAppContext } from '../context/AppContext';

const PrintHeader = memo(function PrintHeader({ routeLabel }) {
  const { globalQ } = useAppContext();
  const formattedQ = Number(globalQ || 0).toLocaleString('vi-VN');

  return (
    <header className="hidden print:block print:mb-8">
      <div className="flex items-start justify-between gap-6 pb-4 border-b-2 border-gray-800">
        {/* Cột trái: Logo omniEco + Tác giả */}
        <div className="shrink-0">
          <div className="print-logo-badge inline-flex items-center rounded-lg bg-slate-900 px-3 py-1.5">
            <img
              src={LOGO_BASE64}
              alt="omniEco Logo"
              className="h-9 w-auto object-contain"
            />
          </div>
          <p className="mt-1.5 text-xs font-medium text-gray-700">
            Phát triển bởi Kỹ sư Tín
          </p>
        </div>

        {/* Cột phải: Tiêu đề Báo cáo + Thông tin điền tay */}
        <div className="text-right flex-1 max-w-md">
          <h2 className="text-base font-bold uppercase tracking-wide text-gray-900">
            BÁO CÁO TÍNH TOÁN KỸ THUẬT
          </h2>
          {routeLabel && (
            <p className="mt-0.5 text-xs text-gray-700">
              Hạng mục:{' '}
              <span className="font-semibold text-gray-900">{routeLabel}</span>{' '}
              · Q = {formattedQ} m³/ngày
            </p>
          )}

          <div className="mt-3 space-y-2 text-xs text-gray-800">
            <div className="flex items-end justify-end gap-2">
              <span className="font-medium shrink-0">Tên dự án:</span>
              <span className="inline-block w-56 border-b border-dotted border-gray-500" />
            </div>
            <div className="flex items-end justify-end gap-2">
              <span className="font-medium shrink-0">Ngày lập:</span>
              <span className="inline-block w-56 border-b border-dotted border-gray-500 text-center text-[11px] text-gray-500 pb-0.5">
                ...... / ...... / 20......
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
});

export default PrintHeader;
