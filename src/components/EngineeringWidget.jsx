import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Calculator,
  Check,
  Clock,
  Copy,
  Delete,
  Trash2,
  X,
} from 'lucide-react';
import { UnitConverterPanel } from './UnitConverter';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

const MAX_HISTORY_ITEMS = 8;

/**
 * Safe recursive-descent math expression evaluator (no eval / no Function).
 * Supports: numbers (incl. scientific notation), decimals, +, -, *, /,
 * parentheses (), ^2 (²), sqrt() (√), π (pi), % (postfix /100), Ans.
 */
function tokenizeExpression(raw, ansValue = 0) {
  const s = String(raw || '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/²/g, '^2')
    .replace(/√/g, 'sqrt')
    .replace(/π/g, 'pi')
    .replace(/\s+/g, '');

  const tokens = [];
  let i = 0;

  while (i < s.length) {
    const ch = s[i];

    // Number literal (supports optional scientific notation e.g. 1.2e-6)
    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let numStr = '';
      let dotCount = 0;
      while (i < s.length && ((s[i] >= '0' && s[i] <= '9') || s[i] === '.')) {
        if (s[i] === '.') dotCount += 1;
        if (dotCount > 1) throw new Error('Số thập phân không hợp lệ');
        numStr += s[i];
        i += 1;
      }
      if (numStr === '.') throw new Error('Biểu thức không hợp lệ');

      if (i < s.length && (s[i] === 'e' || s[i] === 'E')) {
        const expStart = i;
        i += 1;
        if (i < s.length && (s[i] === '+' || s[i] === '-')) {
          i += 1;
        }
        let expDigits = 0;
        while (i < s.length && s[i] >= '0' && s[i] <= '9') {
          expDigits += 1;
          i += 1;
        }
        if (expDigits === 0) {
          throw new Error('Số mũ không hợp lệ');
        }
        numStr += s.slice(expStart, i);
      }

      const parsed = parseFloat(numStr);
      if (!Number.isFinite(parsed)) throw new Error('Giá trị vượt giới hạn');
      tokens.push({ type: 'num', value: parsed });
      continue;
    }

    const lowerSlice = s.slice(i).toLowerCase();

    if (lowerSlice.startsWith('sqrt')) {
      tokens.push({ type: 'func', value: 'sqrt' });
      i += 4;
      continue;
    }

    if (lowerSlice.startsWith('ans')) {
      tokens.push({
        type: 'const',
        value: Number.isFinite(ansValue) ? ansValue : 0,
      });
      i += 3;
      continue;
    }

    if (lowerSlice.startsWith('pi')) {
      tokens.push({ type: 'const', value: Math.PI });
      i += 2;
      continue;
    }

    if ('+-*/()^%'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i += 1;
      continue;
    }

    throw new Error('Ký tự không hợp lệ');
  }

  return tokens;
}

function insertImplicitMultiplication(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const curr = tokens[i];
    const prev = out[out.length - 1];
    if (prev) {
      const prevEndsValue =
        prev.type === 'num' ||
        prev.type === 'const' ||
        (prev.type === 'op' && (prev.value === ')' || prev.value === '%'));

      const currStartsGroup =
        (curr.type === 'op' && curr.value === '(') ||
        curr.type === 'func' ||
        curr.type === 'const';

      const prevIsGroupOrConst =
        prev.type === 'const' ||
        (prev.type === 'op' && (prev.value === ')' || prev.value === '%'));

      if (
        (prevEndsValue && currStartsGroup) ||
        (prevIsGroupOrConst && curr.type === 'num')
      ) {
        out.push({ type: 'op', value: '*' });
      }
    }
    out.push(curr);
  }
  return out;
}

function evaluateSafeExpression(rawExpr, ansValue = 0) {
  const clean = String(rawExpr || '').trim();
  if (!clean) return { ok: true, value: 0 };

  // Auto-close unmatched open parentheses for smooth UX
  const openCount = (clean.match(/\(/g) || []).length;
  const closeCount = (clean.match(/\)/g) || []).length;
  const balancedExpr =
    openCount > closeCount ? clean + ')'.repeat(openCount - closeCount) : clean;

  const rawTokens = tokenizeExpression(balancedExpr, ansValue);
  if (rawTokens.length === 0) return { ok: true, value: 0 };

  const tokens = insertImplicitMultiplication(rawTokens);
  let pos = 0;

  const peek = () => tokens[pos];
  const consume = () => {
    const t = tokens[pos];
    pos += 1;
    return t;
  };

  function parseExpression() {
    let left = parseTerm();
    while (
      peek()?.type === 'op' &&
      (peek().value === '+' || peek().value === '-')
    ) {
      const op = consume().value;
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm() {
    let left = parseUnary();
    while (
      peek()?.type === 'op' &&
      (peek().value === '*' || peek().value === '/')
    ) {
      const op = consume().value;
      const right = parseUnary();
      if (op === '/') {
        if (right === 0) throw new Error('Không thể chia cho 0');
        left /= right;
      } else {
        left *= right;
      }
    }
    return left;
  }

  function parseUnary() {
    if (
      peek()?.type === 'op' &&
      (peek().value === '+' || peek().value === '-')
    ) {
      const op = consume().value;
      const val = parseUnary();
      return op === '-' ? -val : val;
    }
    return parsePostfix();
  }

  function parsePostfix() {
    let val = parsePrimary();
    while (
      peek()?.type === 'op' &&
      (peek().value === '^' || peek().value === '%')
    ) {
      const op = consume().value;
      if (op === '%') {
        val /= 100;
      } else {
        const exp = parseUnary();
        val = Math.pow(val, exp);
      }
    }
    return val;
  }

  function parsePrimary() {
    const tok = peek();
    if (!tok) throw new Error('Biểu thức chưa hoàn chỉnh');

    if (tok.type === 'num' || tok.type === 'const') {
      consume();
      return tok.value;
    }

    if (tok.type === 'func' && tok.value === 'sqrt') {
      consume();
      let inner;
      if (peek()?.type === 'op' && peek().value === '(') {
        consume();
        inner = parseExpression();
        if (peek()?.type !== 'op' || peek().value !== ')') {
          throw new Error('Thiếu dấu ngoặc đóng )');
        }
        consume();
      } else {
        inner = parseUnary();
      }
      if (inner < 0) throw new Error('Không thể căn số âm');
      return Math.sqrt(inner);
    }

    if (tok.type === 'op' && tok.value === '(') {
      consume();
      const inner = parseExpression();
      if (peek()?.type !== 'op' || peek().value !== ')') {
        throw new Error('Thiếu dấu ngoặc đóng )');
      }
      consume();
      return inner;
    }

    throw new Error('Cú pháp không hợp lệ');
  }

  const result = parseExpression();
  if (pos < tokens.length || !Number.isFinite(result)) {
    throw new Error('Lỗi phép tính');
  }

  return { ok: true, value: result };
}

function formatCalcResult(num) {
  if (!Number.isFinite(num)) return 'Lỗi';
  // Clean floating-point drift such as 0.1 + 0.2 = 0.30000000000000004
  const cleaned = Number(num.toPrecision(12));
  if (Object.is(cleaned, -0) || cleaned === 0) return '0';
  const abs = Math.abs(cleaned);
  if (abs >= 1e-6 && abs < 1e12) {
    return String(Number(cleaned.toFixed(10)));
  }
  return cleaned.toExponential(6).replace(/\.?0+e/, 'e');
}

function formatExpressionForDisplay(expr) {
  return String(expr || '')
    .replace(/\*/g, '×')
    .replace(/\//g, '÷');
}

function getBtnClasses(variant) {
  switch (variant) {
    case 'danger':
      return 'bg-red-500/15 border-red-500/40 text-red-400 hover:bg-red-500/25 hover:text-red-300';
    case 'sci':
      return 'bg-slate-800/90 border-slate-700 text-sky-300 hover:bg-slate-700 hover:text-slate-100';
    case 'func':
      return 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white';
    case 'op':
      return 'bg-slate-800 border-slate-700 text-emerald-400 hover:bg-emerald-600/20 hover:border-emerald-500/50 hover:text-emerald-300';
    case 'equal':
      return 'bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500 font-bold shadow-md shadow-emerald-950/50';
    default:
      return 'bg-slate-800/80 border-slate-700/80 text-slate-100 hover:bg-slate-700 hover:text-white';
  }
}

const EngineeringWidget = memo(function EngineeringWidget({
  isOpen,
  onClose,
  initialTab = 'calc',
}) {
  const [activeTab, setActiveTab] = useState(initialTab);

  // Calculator state
  const [expression, setExpression] = useState('');
  const [displayValue, setDisplayValue] = useState('0');
  const [historyLine, setHistoryLine] = useState('');
  const [calcError, setCalcError] = useState('');
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [lastAnswer, setLastAnswer] = useState(0);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef(null);

  // Sync tab if opened with explicit tab
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Cleanup copy timer on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const pushHistory = useCallback((exprText, resultText) => {
    setHistoryItems((prev) => {
      const nextEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        expr: exprText,
        result: resultText,
      };
      if (
        prev.length > 0 &&
        prev[0].expr === nextEntry.expr &&
        prev[0].result === nextEntry.result
      ) {
        return prev;
      }
      return [nextEntry, ...prev].slice(0, MAX_HISTORY_ITEMS);
    });
  }, []);

  const handleClear = useCallback(() => {
    setExpression('');
    setDisplayValue('0');
    setHistoryLine('');
    setCalcError('');
    setJustEvaluated(false);
  }, []);

  const handleBackspace = useCallback(() => {
    setCalcError('');
    if (justEvaluated) {
      setJustEvaluated(false);
      setHistoryLine('');
    }
    setExpression((prev) => {
      if (!prev) return '';
      let next;
      if (prev.endsWith('Ans')) {
        next = prev.slice(0, -3);
      } else if (prev.endsWith('√(')) {
        next = prev.slice(0, -2);
      } else {
        next = prev.slice(0, -1);
      }
      setDisplayValue(next ? formatExpressionForDisplay(next) : '0');
      return next;
    });
  }, [justEvaluated]);

  const appendToken = useCallback(
    (token) => {
      setCalcError('');
      const isContinuationOp = ['+', '-', '*', '/', '²', '%'].includes(token);

      if (justEvaluated) {
        setJustEvaluated(false);
        if (isContinuationOp) {
          const base = displayValue === 'Lỗi' ? '0' : displayValue;
          const next = `${base}${token}`;
          setExpression(next);
          setDisplayValue(formatExpressionForDisplay(next));
          return;
        }
        const next = token === '.' ? '0.' : token;
        setHistoryLine('');
        setExpression(next);
        setDisplayValue(formatExpressionForDisplay(next));
        return;
      }

      setExpression((prev) => {
        if (token === '.') {
          const lastSegment = prev.split(/[+\-*/()²%√π]/).pop() || '';
          if (lastSegment.includes('.') || lastSegment.endsWith('Ans')) {
            return prev;
          }
          const next = lastSegment === '' ? `${prev}0.` : `${prev}.`;
          setDisplayValue(formatExpressionForDisplay(next));
          return next;
        }

        if (token === '²' || token === '%') {
          if (!prev) return prev;
          const last = prev.slice(-1);
          if ('+-*/(√'.includes(last)) return prev;
          const next = `${prev}${token}`;
          setDisplayValue(formatExpressionForDisplay(next));
          return next;
        }

        if (['+', '*', '/'].includes(token)) {
          if (!prev) return prev;
          const last = prev.slice(-1);
          if ('+-*/'.includes(last)) {
            const next = `${prev.slice(0, -1)}${token}`;
            setDisplayValue(formatExpressionForDisplay(next));
            return next;
          }
          if (last === '(') return prev;
        }

        const next = `${prev}${token}`;
        setDisplayValue(formatExpressionForDisplay(next));
        return next;
      });
    },
    [justEvaluated, displayValue]
  );

  const handleSquareRoot = useCallback(() => {
    setCalcError('');
    if (justEvaluated) {
      setJustEvaluated(false);
      const base = displayValue === 'Lỗi' ? '0' : displayValue;
      const nextExpr = `√(${base})`;
      try {
        const res = evaluateSafeExpression(nextExpr, lastAnswer);
        const formatted = formatCalcResult(res.value);
        setHistoryLine(`${nextExpr} =`);
        setDisplayValue(formatted);
        setExpression(formatted);
        setLastAnswer(res.value);
        pushHistory(nextExpr, formatted);
        setJustEvaluated(true);
      } catch (err) {
        setCalcError(err.message || 'Lỗi phép tính');
        setDisplayValue('Lỗi');
      }
      return;
    }

    setExpression((prev) => {
      const next = `${prev}√(`;
      setDisplayValue(formatExpressionForDisplay(next));
      return next;
    });
  }, [justEvaluated, displayValue, lastAnswer, pushHistory]);

  const handleEvaluate = useCallback(() => {
    const targetExpr = expression.trim();
    if (!targetExpr) return;

    try {
      const res = evaluateSafeExpression(targetExpr, lastAnswer);
      const formatted = formatCalcResult(res.value);
      const prettyExpr = formatExpressionForDisplay(targetExpr);
      setHistoryLine(`${prettyExpr} =`);
      setDisplayValue(formatted);
      setExpression(formatted);
      setLastAnswer(res.value);
      pushHistory(prettyExpr, formatted);
      setCalcError('');
      setJustEvaluated(true);
    } catch (err) {
      setCalcError(err.message || 'Biểu thức không hợp lệ');
      setDisplayValue('Lỗi');
    }
  }, [expression, lastAnswer, pushHistory]);

  const handleApplyHistoryResult = useCallback(
    (resultStr) => {
      if (!resultStr || resultStr === 'Lỗi') return;
      setCalcError('');
      if (justEvaluated || !expression) {
        setJustEvaluated(false);
        setHistoryLine('');
        setExpression(resultStr);
        setDisplayValue(resultStr);
        return;
      }
      const lastChar = expression.slice(-1);
      const next = '+-*/('.includes(lastChar)
        ? `${expression}${resultStr}`
        : resultStr;
      setExpression(next);
      setDisplayValue(formatExpressionForDisplay(next));
    },
    [expression, justEvaluated]
  );

  const handleCopyDisplay = useCallback(async () => {
    if (!displayValue || displayValue === 'Lỗi') return;
    try {
      await navigator.clipboard.writeText(displayValue);
      setCopied(true);
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        copyTimerRef.current = null;
      }, 1500);
    } catch {
      // Ignore clipboard failures in restricted environments
    }
  }, [displayValue]);

  // Keyboard support when Modal is open
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (activeTab !== 'calc') return;

      const targetTag = event.target?.tagName;
      if (
        targetTag === 'INPUT' ||
        targetTag === 'TEXTAREA' ||
        targetTag === 'SELECT' ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      const key = event.key;
      if (/^[0-9]$/.test(key) || ['.', '+', '-', '*', '/', '(', ')', '%'].includes(key)) {
        event.preventDefault();
        appendToken(key);
      } else if (key === 'Enter' || key === '=') {
        event.preventDefault();
        handleEvaluate();
      } else if (key === 'Backspace') {
        event.preventDefault();
        handleBackspace();
      } else if (key === 'Delete') {
        event.preventDefault();
        handleClear();
      } else if (key === '^') {
        event.preventDefault();
        appendToken('²');
      } else if (key === 'p' || key === 'P') {
        event.preventDefault();
        appendToken('π');
      } else if (key === 'a' || key === 'A') {
        event.preventDefault();
        appendToken('Ans');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    activeTab,
    onClose,
    appendToken,
    handleEvaluate,
    handleBackspace,
    handleClear,
  ]);

  const handleSelectCalcTab = useCallback(() => setActiveTab('calc'), []);
  const handleSelectConverterTab = useCallback(() => setActiveTab('converter'), []);
  const handleStopPropagation = useCallback((e) => e.stopPropagation(), []);

  const scientificRow = useMemo(
    () => [
      {
        label: '(',
        aria: 'Mở ngoặc',
        onClick: () => appendToken('('),
        variant: 'sci',
      },
      {
        label: ')',
        aria: 'Đóng ngoặc',
        onClick: () => appendToken(')'),
        variant: 'sci',
      },
      {
        label: 'x²',
        aria: 'Bình phương',
        onClick: () => appendToken('²'),
        variant: 'sci',
      },
      {
        label: '√',
        aria: 'Căn bậc hai',
        onClick: handleSquareRoot,
        variant: 'sci',
      },
      {
        label: 'π',
        aria: 'Hằng số Pi',
        onClick: () => appendToken('π'),
        variant: 'sci',
      },
    ],
    [appendToken, handleSquareRoot]
  );

  const keypadButtons = useMemo(
    () => [
      {
        label: 'C',
        aria: 'Xóa toàn bộ',
        onClick: handleClear,
        variant: 'danger',
      },
      {
        label: 'Ans',
        aria: 'Gọi lại kết quả gần nhất',
        onClick: () => appendToken('Ans'),
        variant: 'func',
      },
      {
        label: '%',
        aria: 'Phần trăm',
        onClick: () => appendToken('%'),
        variant: 'func',
      },
      {
        label: '÷',
        aria: 'Chia',
        onClick: () => appendToken('/'),
        variant: 'op',
      },

      { label: '7', onClick: () => appendToken('7'), variant: 'num' },
      { label: '8', onClick: () => appendToken('8'), variant: 'num' },
      { label: '9', onClick: () => appendToken('9'), variant: 'num' },
      {
        label: '×',
        aria: 'Nhân',
        onClick: () => appendToken('*'),
        variant: 'op',
      },

      { label: '4', onClick: () => appendToken('4'), variant: 'num' },
      { label: '5', onClick: () => appendToken('5'), variant: 'num' },
      { label: '6', onClick: () => appendToken('6'), variant: 'num' },
      {
        label: '−',
        aria: 'Trừ',
        onClick: () => appendToken('-'),
        variant: 'op',
      },

      { label: '1', onClick: () => appendToken('1'), variant: 'num' },
      { label: '2', onClick: () => appendToken('2'), variant: 'num' },
      { label: '3', onClick: () => appendToken('3'), variant: 'num' },
      {
        label: '+',
        aria: 'Cộng',
        onClick: () => appendToken('+'),
        variant: 'op',
      },

      { label: '0', onClick: () => appendToken('0'), variant: 'num' },
      {
        label: '.',
        aria: 'Dấu thập phân',
        onClick: () => appendToken('.'),
        variant: 'num',
      },
      {
        label: '⌫',
        icon: Delete,
        aria: 'Xóa lùi',
        onClick: handleBackspace,
        variant: 'func',
      },
      {
        label: '=',
        aria: 'Tính kết quả',
        onClick: handleEvaluate,
        variant: 'equal',
      },
    ],
    [handleClear, handleBackspace, handleEvaluate, appendToken]
  );

  useBodyScrollLock(Boolean(isOpen));

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="engineering-widget-title"
      onClick={onClose}
      className="no-print print:hidden fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
    >
      <div
        onClick={handleStopPropagation}
        className="w-full sm:max-w-lg max-h-[85dvh] flex flex-col bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-xl text-slate-100 shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0">
              <Calculator className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2
                id="engineering-widget-title"
                className="text-base font-bold text-slate-100 truncate"
              >
                Tiện ích Kỹ sư omniEco
              </h2>
              <p className="text-xs text-slate-400 truncate">
                Máy tính Kỹ thuật &amp; Chuyển đổi Đơn vị Môi trường / MEP
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng tiện ích kỹ sư"
            title="Đóng (Esc)"
            className="flex items-center justify-center min-h-[40px] min-w-[40px] rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 2 Tabs Switcher */}
        <div className="px-4 sm:px-5 pt-3 pb-2 border-b border-slate-800/80 shrink-0">
          <div
            role="tablist"
            aria-label="Chức năng tiện ích kỹ sư"
            className="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-800/80 p-1 border border-slate-700/80"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'calc'}
              onClick={handleSelectCalcTab}
              className={`flex items-center justify-center gap-2 min-h-[40px] px-3 py-2 rounded-md text-xs sm:text-sm font-semibold transition-colors cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                activeTab === 'calc'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
              }`}
            >
              <Calculator className="h-4 w-4 shrink-0 pointer-events-none" />
              <span className="pointer-events-none">Máy tính Kỹ thuật</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'converter'}
              onClick={handleSelectConverterTab}
              className={`flex items-center justify-center gap-2 min-h-[40px] px-3 py-2 rounded-md text-xs sm:text-sm font-semibold transition-colors cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                activeTab === 'converter'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
              }`}
            >
              <ArrowLeftRight className="h-4 w-4 shrink-0 pointer-events-none" />
              <span className="pointer-events-none">Đổi đơn vị</span>
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain overflow-x-hidden p-4 sm:p-5">
          {activeTab === 'calc' ? (
            <div className="space-y-3">
              {/* Màn hình hiển thị kết quả */}
              <div className="rounded-xl bg-slate-800 border border-slate-700 p-3.5 sm:p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 min-h-[20px]">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-400 shrink-0">
                    <span className="px-1.5 py-0.5 rounded bg-slate-900/70 border border-slate-700/80 text-sky-400">
                      Ans = {formatCalcResult(lastAnswer)}
                    </span>
                  </span>

                  <span className="font-mono text-xs text-slate-400 truncate text-right">
                    {calcError ? (
                      <span className="text-red-400">{calcError}</span>
                    ) : (
                      historyLine || 'Hỗ trợ bàn phím (0-9, +, -, *, /, Enter)'
                    )}
                  </span>
                </div>

                <div className="flex items-end justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleCopyDisplay}
                    disabled={!displayValue || displayValue === 'Lỗi'}
                    title="Sao chép kết quả"
                    aria-label="Sao chép kết quả"
                    className="inline-flex items-center gap-1 min-h-[32px] px-2.5 py-1 rounded-lg bg-slate-900/70 border border-slate-700/80 text-xs font-medium text-slate-300 hover:border-emerald-500/60 hover:text-emerald-400 disabled:opacity-40 transition-colors shrink-0 cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Đã chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <div
                    aria-live="polite"
                    className={`flex-1 text-right font-mono text-2xl sm:text-3xl font-bold tabular-nums break-all leading-tight ${
                      calcError ? 'text-red-400' : 'text-slate-100'
                    }`}
                  >
                    {displayValue}
                  </div>
                </div>
              </div>

              {/* Thanh Lịch sử phép tính (8 phép gần nhất trong phiên) */}
              <div className="rounded-xl bg-slate-900/60 border border-slate-700/70 overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setHistoryOpen((prev) => !prev)}
                    aria-expanded={historyOpen}
                    className="flex-1 flex items-center gap-2 text-left text-xs font-semibold text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    <Clock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span>
                      Lịch sử phép tính ({historyItems.length}/{MAX_HISTORY_ITEMS})
                    </span>
                  </button>

                  {historyItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setHistoryItems([])}
                      title="Xóa lịch sử phép tính"
                      aria-label="Xóa lịch sử phép tính"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Xóa</span>
                    </button>
                  )}
                </div>

                {historyOpen && (
                  <div className="border-t border-slate-700/70 max-h-36 overflow-y-auto overscroll-contain divide-y divide-slate-800/70">
                    {historyItems.length === 0 ? (
                      <p className="px-3 py-2.5 text-xs text-slate-400 text-center">
                        Chưa có phép tính nào trong phiên làm việc.
                      </p>
                    ) : (
                      historyItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleApplyHistoryResult(item.result)}
                          title="Bấm để đưa kết quả lên màn hình tính tiếp"
                          className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-800/70 transition-colors cursor-pointer"
                        >
                          <span className="font-mono text-xs text-slate-400 truncate">
                            {item.expr} =
                          </span>
                          <span className="font-mono text-xs font-bold text-emerald-400 tabular-nums shrink-0">
                            {item.result}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Hàng phím kỹ thuật (5 cột: (, ), x², √, π) */}
              <div className="grid grid-cols-5 gap-1.5">
                {scientificRow.map((btn) => (
                  <button
                    key={btn.label}
                    type="button"
                    onClick={btn.onClick}
                    aria-label={btn.aria}
                    className={`flex items-center justify-center min-h-[40px] rounded-lg border font-mono text-sm font-semibold transition-colors active:scale-[0.97] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${getBtnClasses(btn.variant)}`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {/* Bàn phím chính (4 cột x 5 hàng) */}
              <div className="grid grid-cols-4 gap-2">
                {keypadButtons.map((btn) => {
                  const Icon = btn.icon;
                  return (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={btn.onClick}
                      aria-label={btn.aria || btn.label}
                      className={`flex items-center justify-center min-h-[46px] rounded-lg border font-mono text-base font-semibold transition-colors active:scale-[0.97] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${getBtnClasses(btn.variant)}`}
                    >
                      {Icon ? <Icon className="h-4 w-4" /> : btn.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <UnitConverterPanel />
          )}
        </div>

        {/* Mobile sticky close bar */}
        <div className="sm:hidden sticky bottom-0 z-20 flex items-center justify-end bg-slate-900/90 backdrop-blur border-t border-slate-800 p-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium text-slate-200 cursor-pointer"
          >
            Đóng tiện ích
          </button>
        </div>
      </div>
    </div>
  );
});

export default EngineeringWidget;
