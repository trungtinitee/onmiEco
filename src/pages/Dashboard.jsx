import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpenCheck,
  ClipboardList,
  CloudCog,
  Droplets,
  Trash2,
  Waves,
  Wrench,
  Zap,
} from 'lucide-react';

const DOMAIN_CARDS = [
  {
    to: '/thong-so-dau-vao',
    title: '💧 Xử lý Nước thải',
    description:
      'Thiết lập thông số đầu vào (Q, Kₕ, BOD₅, COD...), tính toán tiền xử lý, hóa lý (DAF), sinh học & lắng 2, hoàn thiện khử trùng và quản lý bùn cặn.',
    scope: 'Đầu vào · Tiền XL · Hóa lý · Sinh học · Bậc 3 · Bùn',
    icon: Droplets,
  },
  {
    to: '/cap-nuoc',
    title: '🚰 Xử lý Nước cấp',
    description:
      'Tính toán dây chuyền xử lý nước cấp sinh hoạt, công nghiệp, làm mềm, lọc màng RO/UF và nước cấp y tế.',
    scope: 'Khử Fe/Mn · Lắng Lamen · Lọc nhanh · RO & Y tế',
    icon: Waves,
  },
  {
    to: '/khi-thai',
    title: '♻️ Xử lý Khí thải',
    description:
      'Tính toán thông số thủy lực & kích thước Xyclon tách bụi, lọc túi vải, tháp hấp thụ Scrubber và than hoạt tính.',
    scope: 'Xyclon · Túi vải · Tháp hấp thụ · Hấp phụ than',
    icon: CloudCog,
  },
  {
    to: '/chat-thai-ran',
    title: '🗑️ Chất thải rắn & Lò đốt',
    description:
      'Tính toán dung tích ô chôn lấp hợp vệ sinh, bể ủ phân Compost và kiểm tra thời gian lưu buồng đốt chất thải.',
    scope: 'Ô chôn lấp · Ủ Compost · Lò đốt ≥ 2 giây',
    icon: Trash2,
  },
  {
    to: '/nhat-ky-van-hanh',
    title: '📋 Nhật ký Vận hành',
    description:
      'Ghi nhận số liệu vận hành hằng ngày (pH, DO, SV30, hóa chất), lưu trữ ngoại tuyến và đồng bộ lên Google Sheets.',
    scope: 'Số liệu trạm · Hóa chất · Đồng bộ Google Sheets',
    icon: BookOpenCheck,
  },
];

const SUPPORT_LINKS = [
  {
    to: '/mep-thuy-luc',
    label: 'Cơ điện MEP & Thủy lực đường ống',
    icon: Wrench,
  },
  {
    to: '/dien-may-thoi-khi',
    label: 'Điện động lực & Máy thổi khí',
    icon: Zap,
  },
  {
    to: '/van-hanh',
    label: 'Sổ tay Vận hành & Pha chế hóa chất',
    icon: ClipboardList,
  },
];

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      {/* Welcome Hero Header */}
      <section className="space-y-3 pb-4 border-b border-slate-800 print:border-gray-300">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-100 text-balance max-w-4xl">
            OmniEco - Hệ thống Tính toán &amp; Quản lý Kỹ thuật Môi trường
          </h1>
          <p className="text-sm sm:text-base font-medium text-emerald-400">
            Phát triển bởi Kỹ sư Tín
          </p>
        </div>
        <p className="text-sm sm:text-base text-slate-400 max-w-3xl leading-relaxed">
          Bộ công cụ tính toán thiết kế đa lĩnh vực dành cho công việc kỹ thuật
          môi trường: xử lý nước thải, nước cấp, khí thải, chất thải rắn, cơ
          điện MEP và theo dõi nhật ký vận hành trạm xử lý hằng ngày.
        </p>
      </section>

      {/* Primary 5-Domain Navigation Hub Grid */}
      <section aria-labelledby="hub-modules-heading" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="hub-modules-heading"
            className="text-lg font-semibold text-slate-100"
          >
            Phân hệ tính toán & vận hành chính
          </h2>
          <span className="text-xs text-slate-400">
            Chọn lĩnh vực để bắt đầu nhập thông số và tính toán
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {DOMAIN_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.to}
                type="button"
                onClick={() => navigate(card.to)}
                className="group flex flex-col justify-between text-left rounded-xl bg-slate-800 border border-slate-700/80 p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-950/60 hover:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid"
              >
                <div className="space-y-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 border border-slate-700/80 text-emerald-400 group-hover:bg-emerald-500/15 group-hover:border-emerald-500/40 group-hover:text-emerald-300 transition-colors">
                    <Icon className="h-7 w-7" strokeWidth={1.9} />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-700/70 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-400 truncate">
                    {card.scope}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400 group-hover:text-emerald-300 whitespace-nowrap shrink-0">
                    <span>Truy cập</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Secondary Auxiliary Engineering Modules */}
      <section aria-labelledby="hub-support-heading" className="space-y-3 pt-2">
        <h2
          id="hub-support-heading"
          className="text-sm font-semibold text-slate-300"
        >
          Phân hệ hỗ trợ Cơ điện & Sổ tay O&amp;M
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SUPPORT_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="group flex items-center justify-between gap-3 min-h-[44px] rounded-xl bg-slate-800/70 border border-slate-700/70 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800 hover:border-emerald-500/70 hover:text-emerald-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid"
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-emerald-400 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
