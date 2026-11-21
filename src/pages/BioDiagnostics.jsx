import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckSquare,
  ChevronDown,
  Droplets,
  Info,
  Layers,
  Search,
  Sparkles,
  Square,
  Stethoscope,
  Wind,
  Wrench,
} from 'lucide-react';
import { useProjectState } from '../hooks/useProjectState';

const BIO_DIAGNOSTICS_DATA = [
  // NHÓM 1: BỌT (FOAM & SCUM)
  {
    id: 'foam-white',
    category: 'Bọt',
    title: 'Bọt trắng, to, dễ vỡ, nổi bồng bềnh',
    symptom: 'Bề mặt bể đầy bọt trắng xóa, nhẹ, bay khi có gió.',
    cause:
      'Vi sinh mới nuôi (tuổi bùn non), hoặc tải lượng hữu cơ (F/M) đột ngột tăng cao.',
    fix: 'Giảm xả bùn dư để tăng lượng vi sinh. Kiểm tra lại lưu lượng và nồng độ nước đầu vào.',
  },
  {
    id: 'foam-brown-nocardia',
    category: 'Bọt',
    title: 'Bọt nâu sẫm, dày, sệt, dính thành váng',
    symptom:
      'Bọt màu nâu sẫm, nhờn dính, tích tụ lớp dày trên mặt bể (như bùn).',
    cause:
      'Vi khuẩn dạng sợi (Nocardia, Microthrix) phát triển quá mức, dầu mỡ nhiều, tuổi bùn quá già (SRT cao).',
    fix: 'Tăng cường xả bùn dư. Vớt váng bề mặt. Dùng tia nước áp lực xịt dập bọt. Tăng cường vớt dầu mỡ đầu vào.',
  },
  {
    id: 'foam-gray',
    category: 'Bọt',
    title: 'Bọt màu xám tro, giòn',
    symptom: 'Bọt màu xám tro, dễ vỡ vụn.',
    cause:
      'Bùn quá già, nồng độ MLSS trong bể quá cao dẫn đến tế bào chết nhiều.',
    fix: 'Tăng lưu lượng bơm xả bùn dư (WAS). Kiểm tra lại nồng độ MLSS/SV30.',
  },

  // NHÓM 2: BÙN & LẮNG (SLUDGE & SETTLING)
  {
    id: 'sludge-rising',
    category: 'Màu & Trạng thái Bùn',
    title: 'Bùn nổi từng tảng to (có khí li ti) ở Bể Lắng',
    symptom:
      'Bùn lắng tốt nhưng sau đó nổi lềnh bềnh từng tảng to có bọt khí N2 bám vào.',
    cause: 'Khử Nitrat hóa tại bể lắng do lưu bùn ở đáy quá lâu, thiếu oxy.',
    fix: 'Tăng lưu lượng bơm tuần hoàn bùn (RAS). Quét gạt bùn đáy thường xuyên, không để bùn lưu ở bể lắng quá 2h.',
  },
  {
    id: 'sludge-bulking',
    category: 'Màu & Trạng thái Bùn',
    title: 'Bùn khó lắng, xốp bồng (Sludge Bulking)',
    symptom:
      'Chỉ số SVI rất cao (>150), lớp bùn trong bể lắng dâng cao, dễ tràn mương răng cưa.',
    cause:
      'Quá phát triển vi khuẩn dạng sợi do: thiếu DO, thiếu dinh dưỡng (N, P), hoặc pH thấp.',
    fix: 'Đo lại DO (đảm bảo >2mg/L). Châm thêm Ure/DAP. Châm Javen/H2O2 liều lượng nhỏ vào bùn tuần hoàn để diệt vi khuẩn sợi.',
  },
  {
    id: 'sludge-pinpoint',
    category: 'Màu & Trạng thái Bùn',
    title: 'Bùn nát mịn (Pin-point Floc), vụn vặt',
    symptom: 'Bông bùn li ti như đầu kim, không kết dính được thành bông to.',
    cause:
      'Sục khí quá mạnh làm vỡ bông bùn, hoặc bùn quá già (đói dinh dưỡng kéo dài).',
    fix: 'Giảm công suất máy thổi khí (giảm DO xuống 1.5-2mg/L). Châm thêm mật rỉ đường. Bổ sung hóa chất keo tụ (Polymer) để hỗ trợ lắng.',
  },
  {
    id: 'sludge-black',
    category: 'Màu & Trạng thái Bùn',
    title: 'Bùn màu đen tuyền',
    symptom: 'Bùn trong bể Aerotank chuyển từ nâu sang đen.',
    cause:
      'Yếm khí cục bộ do thiếu Oxy (DO < 0.5 mg/L), hệ thống phân phối khí bị nghẹt/bục.',
    fix: 'Chạy tối đa máy thổi khí. Kiểm tra/vệ sinh hệ thống đĩa phân phối khí dưới đáy bể.',
  },

  // NHÓM 3: MÙI (ODOR)
  {
    id: 'odor-h2s',
    category: 'Mùi',
    title: 'Mùi trứng thối (H2S)',
    symptom: 'Bốc mùi thối nồng nặc quanh khu vực trạm.',
    cause:
      'Bể bị kỵ khí, chết vi sinh do DO quá thấp, hoặc có góc chết không được sục khí.',
    fix: 'Sục khí mạnh toàn bể. Dùng vòi xịt phá vỡ các góc chết bùn lắng đọng.',
  },
  {
    id: 'odor-sour',
    category: 'Mùi',
    title: 'Mùi chua, hăng ngắt',
    symptom: 'Mùi chua rắt bốc lên từ mặt nước.',
    cause:
      'Độ pH giảm thấp (<6.0), quá trình Nitrat hóa vắt kiệt độ kiềm, hoặc nước đầu vào nhiễm axit.',
    fix: 'Châm kiềm (NaOH, Na2CO3) ngay lập tức để nâng pH lên 7.0 - 7.5. Bổ sung mật rỉ đường.',
  },

  // NHÓM 4: NƯỚC SAU LẮNG (EFFLUENT)
  {
    id: 'water-turbid',
    category: 'Chất lượng Nước',
    title: 'Nước đục ngầu, trắng xóa, không thấy bông bùn',
    symptom: 'Nước sau lắng đục như nước vo gạo, vi sinh mất sạch.',
    cause:
      'Sốc tải lượng hữu cơ đột ngột hoặc ngộ độc hóa chất/kim loại nặng làm chết vi sinh đồng loạt.',
    fix: 'Ngừng ngay bơm nước thải đầu vào (cô lập). Sục khí phục hồi, châm bùn vi sinh mới và các chế phẩm cứu hộ sinh học.',
  },
  {
    id: 'water-straggler-floc',
    category: 'Chất lượng Nước',
    title: 'Nước trong nhưng cặn li ti trôi ra ngoài',
    symptom:
      'Nước trong vắt nhưng có bụi bùn nhỏ lơ lửng trôi qua máng răng cưa.',
    cause:
      'Tuổi bùn quá cao, vi sinh đói dinh dưỡng sinh ra lớp vỏ nhầy (EPS) kém, dễ bong tróc.',
    fix: 'Tăng xả bùn dư, châm bổ sung tỷ lệ C:N:P để nuôi lại lớp nhầy cho bông bùn.',
  },
];

const CATEGORY_FILTERS = [
  {
    id: 'all',
    label: 'Tất cả',
    matchCategory: null,
    icon: Stethoscope,
  },
  {
    id: 'Bọt',
    label: 'Bọt',
    matchCategory: 'Bọt',
    icon: Sparkles,
  },
  {
    id: 'Màu & Trạng thái Bùn',
    label: 'Bùn',
    matchCategory: 'Màu & Trạng thái Bùn',
    icon: Layers,
  },
  {
    id: 'Mùi',
    label: 'Mùi',
    matchCategory: 'Mùi',
    icon: Wind,
  },
  {
    id: 'Chất lượng Nước',
    label: 'Nước',
    matchCategory: 'Chất lượng Nước',
    icon: Droplets,
  },
];

function getCategoryMeta(category) {
  switch (category) {
    case 'Bọt':
      return {
        shortLabel: 'Bọt (Foam & Scum)',
        icon: Sparkles,
        badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
      };
    case 'Màu & Trạng thái Bùn':
      return {
        shortLabel: 'Màu & Trạng thái Bùn',
        icon: Layers,
        badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      };
    case 'Mùi':
      return {
        shortLabel: 'Mùi (Odor)',
        icon: Wind,
        badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
      };
    default:
      return {
        shortLabel: 'Chất lượng Nước',
        icon: Droplets,
        badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      };
  }
}

function splitFixToSteps(fixText) {
  return String(fixText || '')
    .split(/(?<=[.])\s+/)
    .map((step) => step.trim().replace(/\.$/, ''))
    .filter(Boolean);
}

export default function BioDiagnostics() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [openIds, setOpenIds] = useState(() => new Set(['foam-white']));
  const [checkedSteps, setCheckedSteps] = useProjectState('diag_checkedSteps', {});

  const categoryCounts = useMemo(() => {
    const counts = { all: BIO_DIAGNOSTICS_DATA.length };
    BIO_DIAGNOSTICS_DATA.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    return counts;
  }, []);

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return BIO_DIAGNOSTICS_DATA.filter((item) => {
      const matchCat =
        selectedCategory === 'all' || item.category === selectedCategory;
      if (!matchCat) return false;
      if (!query) return true;
      return (
        item.title.toLowerCase().includes(query) ||
        item.symptom.toLowerCase().includes(query) ||
        item.cause.toLowerCase().includes(query) ||
        item.fix.toLowerCase().includes(query)
      );
    });
  }, [selectedCategory, searchTerm]);

  const toggleCard = (id) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleFilterToggle = (filterId) => {
    setSelectedCategory((prev) =>
      prev === filterId && filterId !== 'all' ? 'all' : filterId
    );
  };

  const toggleStepDone = (itemId, stepIdx) => {
    const key = `${itemId}:${stepIdx}`;
    setCheckedSteps((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <section className="space-y-2 pb-4 border-b border-slate-800 print:border-gray-300">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0">
            <Stethoscope className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-slate-100">
              Trợ lý Chẩn đoán Bể Sinh học
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Tra cứu nhanh sự cố Aerotank / MBR / Bể lắng bằng cảm quan và quy
              trình khắc phục tại hiện trường.
            </p>
          </div>
        </div>
      </section>

      {/* Phần trên: Filter Toggle Buttons + Quick Search */}
      <section className="print:hidden rounded-xl bg-slate-800/70 border border-slate-700/80 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Lọc nhóm sự cố bể sinh học"
            className="flex flex-wrap items-center gap-2"
          >
            {CATEGORY_FILTERS.map((cat) => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              const count = categoryCounts[cat.id] ?? 0;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleFilterToggle(cat.id)}
                  aria-pressed={isActive}
                  className={`inline-flex items-center gap-2 min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-colors cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    isActive
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm'
                      : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 pointer-events-none" />
                  <span className="pointer-events-none">{cat.label}</span>
                  <span
                    className={`pointer-events-none font-mono text-xs px-1.5 py-0.5 rounded-md ${
                      isActive
                        ? 'bg-emerald-700/80 text-emerald-100'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-72 shrink-0">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm triệu chứng, Nocardia, DO..."
              aria-label="Tìm nhanh hiện tượng sự cố"
              className="w-full min-h-[44px] rounded-xl bg-slate-900 border border-slate-700 pl-10 pr-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
        </div>
      </section>

      {/* Phần dưới: Danh sách Sự cố dạng Accordion */}
      <section aria-label="Danh sách chẩn đoán sự cố" className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="rounded-xl bg-slate-800 border border-slate-700 p-8 text-center space-y-2">
            <Info className="h-6 w-6 text-slate-400 mx-auto" />
            <p className="text-sm text-slate-300 font-medium">
              Không tìm thấy hiện tượng phù hợp với bộ lọc hiện tại.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setSearchTerm('');
              }}
              className="inline-flex items-center justify-center min-h-[40px] px-4 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-slate-100 transition-colors"
            >
              Xem toàn bộ {BIO_DIAGNOSTICS_DATA.length} sự cố
            </button>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isExpanded = openIds.has(item.id);
            const meta = getCategoryMeta(item.category);
            const CatIcon = meta.icon;
            const fixSteps = splitFixToSteps(item.fix);

            return (
              <article
                key={item.id}
                className={`rounded-xl bg-slate-800 border transition-colors overflow-hidden print:bg-transparent print:border print:border-gray-300 print:shadow-none print:text-gray-900 print:break-inside-avoid ${
                  isExpanded
                    ? 'border-emerald-500/60 shadow-lg shadow-slate-950/50'
                    : 'border-slate-700/80 hover:border-slate-600'
                }`}
              >
                {/* Accordion Trigger Header */}
                <button
                  type="button"
                  onClick={() => toggleCard(item.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`diag-panel-${item.id}`}
                  className="w-full text-left p-4 sm:p-5 flex items-start justify-between gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
                >
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold ${meta.badgeClass}`}
                      >
                        <CatIcon className="h-3.5 w-3.5 shrink-0" />
                        <span>{meta.shortLabel}</span>
                      </span>
                    </div>

                    <h2 className="text-base sm:text-lg font-bold text-slate-100 leading-snug">
                      {item.title}
                    </h2>

                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed flex items-start gap-1.5">
                      <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      <span>{item.symptom}</span>
                    </p>
                  </div>

                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 border border-slate-700 text-slate-300 shrink-0 transition-transform duration-200 mt-1 ${
                      isExpanded ? 'rotate-180 text-emerald-400 border-emerald-500/40' : ''
                    }`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </span>
                </button>

                {/* Accordion Body */}
                {isExpanded && (
                  <div
                    id={`diag-panel-${item.id}`}
                    className="px-4 pb-4 sm:px-5 sm:pb-5 pt-1 border-t border-slate-700/70 bg-slate-900/40"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-3">
                      {/* Khối đỏ/cam: NGUYÊN NHÂN */}
                      <div className="rounded-xl bg-red-500/10 border border-red-500/35 p-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-wide text-amber-300">
                          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                          <span>⚠️ Nguyên nhân</span>
                        </div>
                        <p className="text-sm text-slate-200 leading-relaxed">
                          {item.cause}
                        </p>
                      </div>

                      {/* Khối xanh lá: HƯỚNG XỬ LÝ (Checklist thao tác) */}
                      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/35 p-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-wide text-emerald-300">
                            <Wrench className="h-4 w-4 text-emerald-400 shrink-0" />
                            <span>🛠 Hướng xử lý (Checklist thao tác)</span>
                          </div>
                        </div>

                        <ul className="space-y-2">
                          {fixSteps.map((step, idx) => {
                            const done = Boolean(
                              checkedSteps[`${item.id}:${idx}`]
                            );
                            return (
                              <li key={idx}>
                                <button
                                  type="button"
                                  onClick={() => toggleStepDone(item.id, idx)}
                                  aria-pressed={done}
                                  className={`w-full text-left flex items-start gap-2.5 p-2 rounded-lg border transition-colors ${
                                    done
                                      ? 'bg-emerald-950/50 border-emerald-500/40 text-slate-400 line-through'
                                      : 'bg-slate-900/60 border-slate-700/60 text-slate-100 hover:border-emerald-500/40'
                                  }`}
                                >
                                  {done ? (
                                    <CheckSquare className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                                  ) : (
                                    <Square className="h-4 w-4 text-emerald-500/80 shrink-0 mt-0.5" />
                                  )}
                                  <span className="text-sm leading-snug">
                                    {step}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
