import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Layers,
  Activity,
  Cog,
  FlaskConical,
  GitFork,
  ShieldAlert,
  AlertTriangle,
  CloudCog,
  Trash2,
  Wrench,
  Zap,
  ClipboardList,
} from 'lucide-react';
import { FLOW_PRESETS, useAppContext } from '../context/AppContext';

export default function Dashboard() {
  const {
    globalQ,
    setGlobalQ,
    peakingFactor,
    setPeakingFactor,
    hydraulics,
    biologyNod,
  } = useAppContext();

  // Sơ bộ kích thước nhanh từ globalQ cho từng module
  const quickEstimates = [
    {
      to: '/tien-xu-ly',
      title: 'Cụm Tiền xử lý (5 công đoạn)',
      standard: 'Song chắn rác · Lắng cát · Dầu mỡ · Điều hòa · DAF',
      icon: Layers,
      metricLabel: 'Lưu lượng tính toán Qmax',
      metricValue: `${hydraulics.qMaxHour.toFixed(1)} m³/h`,
      detail: 'Nội suy hình học (Chữ nhật/Vuông/Tròn) & kiểm tra ngược V_thực',
    },
    {
      to: '/sinh-hoc',
      title: 'Cụm Xử lý Sinh học (6 công nghệ)',
      standard: 'UASB · Anoxic · Aerotank · SBR · MBBR · MBR',
      icon: Activity,
      metricLabel: 'Lưu lượng tính toán Qtb',
      metricValue: `${hydraulics.qHour.toFixed(1)} m³/h`,
      detail: 'Kiểm tra Nitrat hóa (SRT_min), nhu cầu O₂ tổng & phân bổ chu kỳ SBR',
    },
    {
      to: '/bun-khu-trung',
      title: 'Lắng 2, Xử lý Bùn & Khử trùng',
      standard: 'Lắng 2 · Nén bùn đứng · Máy ép bùn · Clo/UV/Ozone',
      icon: Cog,
      metricLabel: 'Bùn dư ước tính (2% Q)',
      metricValue: `${(hydraulics.qDay * 0.02).toFixed(1)} m³/ng`,
      detail: 'Kiểm tra ngược máng tràn/bề mặt/HRT & định lượng Polymer, Clo/UV/O₃',
    },
    {
      to: '/hoa-ly',
      title: 'Cụm Hóa lý & Lọc áp lực',
      standard: 'Keo tụ · Tạo bông · Lắng hóa lý · Lọc áp lực đa tầng',
      icon: FlaskConical,
      metricLabel: 'Lưu lượng thiết kế Qmax',
      metricValue: `${hydraulics.qMaxHour.toFixed(1)} m³/h`,
      detail: 'Tính motor theo G, bóc tách vật liệu lọc (Sỏi/Cát/Than) & bơm rửa lọc',
    },
    {
      to: '/cap-nuoc',
      title: 'Xử lý Nước cấp Cơ bản',
      standard: 'Khử Sắt/Mangan · Trộn ziczac · Lắng Lamen · Lọc cát nhanh',
      icon: GitFork,
      metricLabel: 'Công suất trạm Q_h',
      metricValue: `${hydraulics.qHour.toFixed(1)} m³/h`,
      detail: 'Kiểm tra ngược G, tốc độ lọc cát thực & tính bơm/quạt rửa lọc',
    },
    {
      to: '/cap-nuoc-nang-cao',
      title: 'Nước Cấp Nâng Cao & Nước Y Tế',
      standard: 'Làm mềm · Lọc than · RO / UF · Nước rửa tay y tế',
      icon: ShieldAlert,
      metricLabel: 'Công suất thành phẩm Q_h',
      metricValue: `${hydraulics.qHour.toFixed(1)} m³/h`,
      detail: 'Nội suy vỏ màng RO/UF, kiểm tra Dead-leg 3:1 & lọc vô trùng 0,2 µm',
    },
    {
      to: '/khi-thai',
      title: 'Cụm Xử lý Khí thải & Bụi',
      standard: 'Xyclon · Lọc túi vải · Scrubber · Hấp phụ than',
      icon: CloudCog,
      metricLabel: 'Lưu lượng khí tham khảo',
      metricValue: '10.000 m³/h',
      detail: 'Nội suy D, H tháp/Xyclon & kiểm tra vận tốc khí thực chống sặc tháp / rách túi',
    },
    {
      to: '/chat-thai-ran',
      title: 'Cụm Xử lý Chất thải rắn & Lò đốt',
      standard: 'Ô chôn lấp · Ủ Compost · Lò đốt rác y tế/nguy hại',
      icon: Trash2,
      metricLabel: 'Công suất rác tham khảo',
      metricValue: '5 tấn/ngày',
      detail: 'Hình chóp cụt/Chữ nhật & kiểm tra ngược thời gian lưu khí cháy buồng thứ cấp ≥ 2s',
    },
    {
      to: '/mep-thuy-luc',
      title: 'Cơ điện MEP & Thủy lực đường ống',
      standard: 'Ống DN (uPVC/Inox) · Bơm · Phễu Inox · Trộn tĩnh Eductor',
      icon: Wrench,
      metricLabel: 'Ống dẫn sơ bộ (Qmax,h)',
      metricValue: `${hydraulics.pipeDiameterMm > 0 ? `DN ${Math.ceil(hydraulics.pipeDiameterMm / 10) * 10}` : 'DN 0'}`,
      detail: 'Kiểm tra ngược vận tốc thực trong ống DN (0,6–2,5 m/s), công suất bơm & phễu Inox 304',
    },
    {
      to: '/dien-may-thoi-khi',
      title: 'Điện động lực & Máy thổi khí',
      standard: 'Cáp đồng · MCB/MCCB · Contactor · SOR/AOR (từ Bước 4)',
      icon: Zap,
      metricLabel: 'NOD đồng bộ từ Sinh học',
      metricValue: `${biologyNod.nodKgHour.toFixed(1)} kg O₂/h`,
      detail: 'Tính dòng định mức/khởi động, kiểm tra an toàn MCB thực tế & công suất máy thổi khí',
    },
    {
      to: '/van-hanh',
      title: 'Sổ tay Vận hành Di động & Pha chế',
      standard: 'Ure/DAP · Mật rỉ/Acetic · NaHCO₃ · Rửa màng MBR (MC/RC)',
      icon: ClipboardList,
      metricLabel: 'Đồng bộ theo lưu lượng Q',
      metricValue: `${hydraulics.qDay.toLocaleString('vi-VN')} m³/ng`,
      detail: 'Pha chế dinh dưỡng 100:5:1, bù Carbon/Kiềm (7,14) & bảng lít rửa màng MBR',
    },
  ];

  const handleFlowInputChange = (e) => {
    const raw = e.target.value;
    if (raw === '') {
      setGlobalQ(0);
      return;
    }
    const parsed = Number(raw);
    setGlobalQ(Number.isNaN(parsed) ? 0 : Math.max(0, parsed));
  };

  return (
    <div className="space-y-8">
      {/* Page Heading */}
      <section className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 text-balance">
          Bảng điều khiển Thiết kế Kỹ thuật Môi trường
        </h1>
        <p className="text-sm sm:text-base text-slate-400 max-w-2xl">
          Thiết lập lưu lượng đầu vào dùng chung (globalQ) để đồng bộ thông số
          thủy lực và kích thước sơ bộ cho toàn bộ dây chuyền xử lý nước thải.
        </p>
      </section>

      {/* Primary Global Input Card */}
      <section className="rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="global-q-input"
                className="block text-sm font-medium text-slate-200 mb-2"
              >
                Lưu lượng thiết kế trung bình (Q) — m³/ngày
              </label>
              <div className="relative flex items-center">
                <input
                  id="global-q-input"
                  type="number"
                  min="0"
                  step="10"
                  value={globalQ === 0 ? '' : globalQ}
                  onChange={handleFlowInputChange}
                  placeholder="Nhập lưu lượng (VD: 1000)"
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-4 pr-24 py-2.5 font-mono text-base font-semibold text-slate-100 tabular-nums placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-colors"
                />
                <span className="absolute right-3.5 text-xs font-mono text-slate-400 pointer-events-none">
                  m³/ngày
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="peaking-factor-input"
                className="block text-sm font-medium text-slate-200 mb-2"
              >
                Hệ số không điều hòa giờ (Kₕ)
              </label>
              <div className="relative flex items-center">
                <input
                  id="peaking-factor-input"
                  type="number"
                  min="1"
                  max="5"
                  step="0.05"
                  value={peakingFactor}
                  onChange={(e) => setPeakingFactor(e.target.value)}
                  className="w-full min-h-[44px] rounded-lg bg-slate-900 border border-slate-700 px-4 pr-16 py-2.5 font-mono text-base font-semibold text-slate-100 tabular-nums focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-colors"
                />
                <span className="absolute right-3.5 text-xs font-mono text-slate-400 pointer-events-none">
                  lần
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Presets Row */}
        <div className="pt-4 border-t border-slate-700/70 space-y-2.5">
          <div className="text-xs font-medium text-slate-400">
            Mức lưu lượng tham khảo nhanh
          </div>
          <div className="flex flex-wrap gap-2.5">
            {FLOW_PRESETS.map((preset) => {
              const isSelected = Number(globalQ) === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setGlobalQ(preset.value)}
                  className={`inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 font-semibold'
                      : 'bg-slate-900 text-slate-300 border border-slate-700 hover:border-slate-500 hover:text-slate-100'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {globalQ <= 0 && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3.5 text-sm text-amber-200"
          >
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              Lưu lượng thiết kế đang bằng 0 m³/ngày. Hãy nhập giá trị dương
              hoặc chọn một mức lưu lượng mẫu ở trên để kích hoạt phép tính công
              trình.
            </div>
          </div>
        )}
      </section>

      {/* Hydraulic Conversion Metrics (4-column KPI strip) */}
      <section aria-labelledby="hydraulics-heading" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="hydraulics-heading"
            className="text-lg font-semibold text-slate-100"
          >
            Quy đổi lưu lượng thủy lực
          </h2>
          <span className="text-xs text-slate-400">
            Tính toán liên tục 24 giờ/ngày · Đường ống tự chảy v ={' '}
            {hydraulics.velocityTarget} m/s
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
            <div className="text-xs font-medium text-slate-400">
              Lưu lượng ngày (Qngày)
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold text-slate-100 tabular-nums">
              {hydraulics.qDay.toLocaleString('vi-VN')}
            </div>
            <div className="mt-1 text-xs text-slate-400">m³/ngày đêm</div>
          </div>

          <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
            <div className="text-xs font-medium text-slate-400">
              Lưu lượng giờ TB (Qtb,h)
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold text-emerald-400 tabular-nums">
              {hydraulics.qHour.toFixed(2)}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              m³/giờ · {hydraulics.qSecond.toFixed(2)} L/s
            </div>
          </div>

          <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
            <div className="text-xs font-medium text-slate-400">
              Lưu lượng giờ cực đại (Qmax,h)
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold text-emerald-400 tabular-nums">
              {hydraulics.qMaxHour.toFixed(2)}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              m³/giờ · Kₕ = {peakingFactor.toFixed(2)}
            </div>
          </div>

          <div className="rounded-xl bg-slate-800 border border-slate-700/80 p-5">
            <div className="text-xs font-medium text-slate-400">
              Đường kính ống dẫn sơ bộ
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold text-slate-100 tabular-nums">
              {hydraulics.pipeDiameterMm > 0
                ? `DN ${Math.ceil(hydraulics.pipeDiameterMm / 10) * 10}`
                : 'DN 0'}
            </div>
            <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
              D tính = {hydraulics.pipeDiameterMm.toFixed(1)} mm (Qmax,s ={' '}
              {hydraulics.qMaxSecond.toFixed(2)} L/s)
            </div>
          </div>
        </div>
      </section>

      {/* Module Quick Access Grid */}
      <section aria-labelledby="modules-heading" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="modules-heading"
            className="text-lg font-semibold text-slate-100"
          >
            Các module tính toán công trình
          </h2>
          <span className="text-xs text-slate-400">
            Tự động nhận globalQ = {hydraulics.qDay.toLocaleString('vi-VN')}{' '}
            m³/ngày
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickEstimates.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.to}
                className="flex flex-col justify-between rounded-xl bg-slate-800 border border-slate-700/80 p-5 sm:p-6"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold text-slate-100">
                        {mod.title}
                      </h3>
                      <div className="text-xs text-slate-400">
                        {mod.standard}
                      </div>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 border border-slate-700 text-emerald-500 shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>

                  <p className="text-sm text-slate-300 leading-relaxed">
                    {mod.detail}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-700/70 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-400">
                      {mod.metricLabel}
                    </div>
                    <div className="font-mono text-lg font-semibold text-emerald-400 tabular-nums">
                      {mod.metricValue}
                    </div>
                  </div>

                  <Link
                    to={mod.to}
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    <span>Mở tính toán</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
