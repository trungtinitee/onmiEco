import { memo } from 'react';
import { LOGO_BASE64 } from '../constants/branding';
import { useAppContext } from '../context/AppContext';

const PrintHeader = memo(function PrintHeader({ routeLabel }) {
  const { globalQ, currentProject, printOptions } = useAppContext();
  const formattedQ = Number(globalQ || 0).toLocaleString('vi-VN');

  const showCompany = Boolean(printOptions?.showCompanyHeader);
  const showProject = Boolean(printOptions?.showProjectInfo);
  const showNotes = Boolean(printOptions?.showDetailedNotes);

  return (
    <header className="hidden print:block print:mb-6 print:text-black">
      <div className="space-y-3 pb-3.5 border-b-2 border-gray-800">
        <div className="flex items-start justify-between gap-6">
          {/* Cột trái: Logo & Tên Công ty TNHH Tư vấn - Đầu tư Môi trường D-V-N */}
          {showCompany ? (
            <div className="flex items-start gap-3 min-w-0">
              <div className="print-logo-badge inline-flex items-center rounded-lg bg-slate-900 px-2.5 py-1.5 shrink-0">
                <img
                  src={LOGO_BASE64}
                  alt="omniEco Logo"
                  className="h-8 w-auto object-contain"
                />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-wide text-black leading-snug">
                  CÔNG TY TNHH TƯ VẤN - ĐẦU TƯ MÔI TRƯỜNG D-V-N
                </div>
                <p className="text-[11px] text-gray-700 mt-0.5">
                  Hệ thống Kỹ thuật Môi trường &amp; Cơ điện omniEco
                </p>
              </div>
            </div>
          ) : (
            <div />
          )}

          {/* Cột phải: Tiêu đề Báo cáo */}
          <div className={`${showCompany ? 'text-right' : 'text-left'} shrink-0`}>
            <h2 className="text-base font-bold uppercase tracking-wide text-black">
              BÁO CÁO KỸ THUẬT &amp; DANH MỤC HỆ THỐNG
            </h2>
            {routeLabel && (
              <p className="mt-0.5 text-xs text-gray-800">
                Hạng mục:{' '}
                <span className="font-semibold text-black">{routeLabel}</span>
              </p>
            )}
          </div>
        </div>

        {/* Khối Thông tin Dự án (theo cấu hình checkbox) */}
        {showProject && (
          <div className="rounded border border-gray-400 bg-gray-50 px-3.5 py-2.5 text-xs text-black">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              <div>
                <span className="font-semibold">Dự án: </span>
                <span>{currentProject?.name || 'Dự án mặc định'}</span>
              </div>
              <div>
                <span className="font-semibold">Công suất thiết kế: </span>
                <span>{currentProject?.capacity || `${formattedQ} m³/ngày`}</span>
              </div>
              {currentProject?.investor && (
                <div>
                  <span className="font-semibold">Chủ đầu tư: </span>
                  <span>{currentProject.investor}</span>
                </div>
              )}
              {currentProject?.location && (
                <div>
                  <span className="font-semibold">Địa điểm: </span>
                  <span>{currentProject.location}</span>
                </div>
              )}
              <div>
                <span className="font-semibold">Ngày in: </span>
                <span>{new Date().toLocaleDateString('vi-VN')}</span>
              </div>
            </div>

            {showNotes && currentProject?.notes && (
              <div className="mt-1.5 pt-1.5 border-t border-gray-300 text-[11px] text-gray-800">
                <span className="font-semibold text-black">Ghi chú dự án: </span>
                <span>{currentProject.notes}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
});

export default PrintHeader;
