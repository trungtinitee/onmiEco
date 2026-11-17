import { memo } from 'react';
import { useAppContext } from '../context/AppContext';

const PrintSignatureFooter = memo(function PrintSignatureFooter() {
  const { printOptions, currentProject } = useAppContext();

  if (!printOptions?.showSignatures) return null;

  return (
    <footer className="hidden print:block print:mt-8 print:pt-5 print:border-t print:border-gray-300 print:break-inside-avoid text-black">
      <div className="text-right text-xs italic text-gray-800 mb-3">
        ......, ngày ...... tháng ...... năm 20......
      </div>

      <div className="grid grid-cols-2 gap-8 text-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-black">
            KỸ SƯ LẬP
          </p>
          <p className="text-[11px] italic text-gray-700 mt-0.5">
            (Ký và ghi rõ họ tên)
          </p>
          <div className="h-20" />
          <p className="text-xs font-medium text-gray-800">
            ................................................
          </p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-black">
            ĐẠI DIỆN CHỦ ĐẦU TƯ
          </p>
          <p className="text-[11px] italic text-gray-700 mt-0.5">
            (Ký, ghi rõ họ tên và đóng dấu)
          </p>
          <div className="h-20" />
          <p className="text-xs font-medium text-gray-800">
            {printOptions?.showProjectInfo && currentProject?.investor
              ? currentProject.investor
              : '................................................'}
          </p>
        </div>
      </div>
    </footer>
  );
});

export default PrintSignatureFooter;
