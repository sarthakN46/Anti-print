import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Plus, X, Minus, ChevronLeft, ChevronRight, FileText, Image as ImageIcon, FileSpreadsheet, Presentation, Check } from 'lucide-react';

export interface ConfiguratorItem {
  storageKey: string;
  originalName: string;
  fileHash: string;
  pageCount: number;
  previewUrl?: string;
  fileType?: string;
  mimeType?: string;
  config: {
    color: 'bw' | 'color';
    side: 'single' | 'double';
    copies: number;
    pageRange: string;
    orientation: 'portrait' | 'landscape';
    paperSize: 'A4' | 'A3' | 'A2' | 'A1';
  };
}

interface DocumentConfiguratorProps {
  items: ConfiguratorItem[];
  shopPricing: {
    bw: { single: number; double: number };
    color: { single: number; double: number };
    otherSizes?: Record<string, { bw: number; color: number }>;
  };
  onBack: () => void;
  onAddFiles: () => void;
  onAddToCart: (items: ConfiguratorItem[]) => void;
  onRemoveItem: (index: number) => void;
  onUpdateItems: (items: ConfiguratorItem[]) => void;
}

const DocumentConfigurator = ({
  items,
  shopPricing,
  onBack,
  onAddFiles,
  onAddToCart,
  onRemoveItem,
  onUpdateItems,
}: DocumentConfiguratorProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [canvasUrls, setCanvasUrls] = useState<Record<number, string>>({});

  // Touch/swipe state
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);
  const isDragging = useRef(false);
  const isVerticalScroll = useRef(false);

  // Ensure activeIndex stays in bounds
  useEffect(() => {
    if (activeIndex >= items.length && items.length > 0) {
      setActiveIndex(items.length - 1);
    }
  }, [items.length, activeIndex]);

  // Render PDF first page to canvas
  const renderPdfPreview = useCallback(async (url: string, index: number) => {
    try {
      if (!(window as any).pdfjsLib) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        document.head.appendChild(script);
        await new Promise<void>((resolve) => {
          script.onload = () => resolve();
        });
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }

      const pdfjsLib = (window as any).pdfjsLib;
      const loadingTask = pdfjsLib.getDocument(url);
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);

      const scale = 2;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;
      const dataUrl = canvas.toDataURL('image/png');

      setCanvasUrls(prev => ({ ...prev, [index]: dataUrl }));
    } catch (err) {
      console.error('PDF preview failed for index', index, err);
    }
  }, []);

  // Generate previews for all items
  useEffect(() => {
    items.forEach((item, index) => {
      if (canvasUrls[index]) return;
      const mime = item.mimeType || '';
      if (mime === 'application/pdf' && item.previewUrl) {
        renderPdfPreview(item.previewUrl, index);
      } else if (mime.startsWith('image/') && item.previewUrl) {
        setCanvasUrls(prev => ({ ...prev, [index]: item.previewUrl! }));
      }
    });
  }, [items, canvasUrls, renderPdfPreview]);

  const currentItem = items[activeIndex];
  if (!currentItem) return null;

  const updateCurrentConfig = (key: string, value: unknown) => {
    const updated = [...items];
    updated[activeIndex] = {
      ...updated[activeIndex],
      config: { ...updated[activeIndex].config, [key]: value },
    };
    onUpdateItems(updated);
  };

  const applyToAll = () => {
    const currentConfig = { ...currentItem.config };
    const updated = items.map(item => ({
      ...item,
      config: { ...currentConfig },
    }));
    onUpdateItems(updated);
  };

  const getRate = (item: ConfiguratorItem) => {
    const size = item.config.paperSize;
    const isColor = item.config.color === 'color';
    const isDouble = item.config.side === 'double';

    if (size !== 'A4' && shopPricing.otherSizes && shopPricing.otherSizes[size]) {
      const sizeP = shopPricing.otherSizes[size];
      return isColor ? sizeP.color : sizeP.bw;
    }

    if (isColor) {
      return isDouble ? shopPricing.color.double : shopPricing.color.single;
    }
    return isDouble ? shopPricing.bw.double : shopPricing.bw.single;
  };

  const getItemCost = (item: ConfiguratorItem) => {
    return getRate(item) * item.pageCount * item.config.copies;
  };

  const totalPages = items.reduce((sum, item) => sum + item.pageCount * item.config.copies, 0);
  const totalCost = items.reduce((sum, item) => sum + getItemCost(item), 0);

  const goTo = (index: number) => {
    if (index >= 0 && index < items.length) {
      setActiveIndex(index);
    }
  };

  // Touch handlers for smooth mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
    isDragging.current = true;
    isVerticalScroll.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;

    const diffX = Math.abs(currentX - touchStartX.current);
    const diffY = Math.abs(currentY - touchStartY.current);

    // If the gesture is primarily vertical, cancel slide dragging to let native scrolling work
    if (diffY > diffX && diffY > 10) {
      isDragging.current = false;
      isVerticalScroll.current = true;
      return;
    }

    touchEndX.current = currentX;
    touchEndY.current = currentY;
  };

  const handleTouchEnd = () => {
    if (isVerticalScroll.current) {
      isVerticalScroll.current = false;
      return;
    }
    if (!isDragging.current) return;
    isDragging.current = false;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 40) {
      if (diff > 0 && activeIndex < items.length - 1) {
        setActiveIndex(activeIndex + 1);
      } else if (diff < 0 && activeIndex > 0) {
        setActiveIndex(activeIndex - 1);
      }
    }
  };

  const getFileIcon = (mime: string) => {
    if (mime?.startsWith('image/')) return <ImageIcon size={40} className="text-blue-400" />;
    if (mime?.includes('presentation') || mime?.includes('powerpoint')) return <Presentation size={40} className="text-orange-400" />;
    if (mime?.includes('spreadsheet') || mime?.includes('excel') || mime?.includes('csv')) return <FileSpreadsheet size={40} className="text-green-400" />;
    if (mime?.includes('word') || mime?.includes('document')) return <FileText size={40} className="text-blue-500" />;
    return <FileText size={40} className="text-slate-400" />;
  };

  // Build preview style based on current config (reactive preview)
  const getPreviewStyle = (item: ConfiguratorItem): React.CSSProperties => {
    const styles: React.CSSProperties = {
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      maxHeight: '260px',
      objectFit: 'contain' as const,
      borderRadius: '8px',
    };

    // Orientation: rotate the preview
    if (item.config.orientation === 'landscape') {
      styles.transform = 'rotate(-90deg) scale(0.7)';
    }

    // B&W: apply grayscale filter
    if (item.config.color === 'bw') {
      styles.filter = 'grayscale(100%)';
    }

    return styles;
  };

  // Selected checkmark component
  const SelectedBadge = () => (
    <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-sm">
      <Check size={12} className="text-white" strokeWidth={3} />
    </div>
  );

  return (
    <div className="h-[100dvh] overflow-hidden bg-white dark:bg-slate-900 flex flex-col page-enter">
      {/* Header — compact for mobile */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-3 py-2.5 flex justify-between items-center sticky top-0 z-20 safe-area-top">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300 active:scale-90 transition-transform"
        >
          <ArrowLeft size={20} />
        </button>

        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
          Configure Print
        </span>

        <button
          onClick={onAddFiles}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 active:scale-90 transition-transform"
        >
          <Plus size={18} />
        </button>
      </header>

      {/* Scrollable Content */}
      <div 
        className="flex-1 overflow-y-auto pb-[100px]"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Preview Section */}
        <div
          className="relative bg-slate-50 dark:bg-slate-800/50 overflow-hidden"
          style={{ minHeight: '220px', maxHeight: '320px', touchAction: 'pan-y' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Nav arrows — hidden on mobile, visible on desktop */}
          {items.length > 1 && activeIndex > 0 && (
            <button
              onClick={() => goTo(activeIndex - 1)}
              className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 dark:bg-slate-700/90 border border-slate-200 dark:border-slate-600 items-center justify-center hover:bg-white shadow"
            >
              <ChevronLeft size={16} />
            </button>
          )}
          {items.length > 1 && activeIndex < items.length - 1 && (
            <button
              onClick={() => goTo(activeIndex + 1)}
              className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 dark:bg-slate-700/90 border border-slate-200 dark:border-slate-600 items-center justify-center hover:bg-white shadow"
            >
              <ChevronRight size={16} />
            </button>
          )}

          {/* Carousel track */}
          <div
            className="flex h-full"
            style={{
              transform: `translateX(-${activeIndex * 100}%)`,
              transition: 'transform 0.35s cubic-bezier(0.25, 0.8, 0.25, 1)',
            }}
          >
            {items.map((item, idx) => (
              <div
                key={idx}
                className="min-w-full flex items-center justify-center p-4 relative"
                style={{ minHeight: '220px' }}
              >
                {/* Remove button */}
                <button
                  className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-white/90 dark:bg-slate-700/90 border border-slate-200 dark:border-slate-600 flex items-center justify-center active:scale-90 transition-transform shadow-sm"
                  onClick={() => onRemoveItem(idx)}
                >
                  <X size={13} className="text-slate-500" />
                </button>

                {/* File name badge */}
                <div className="absolute bottom-3 left-3 right-3 z-10">
                  <div className="bg-black/60 backdrop-blur-sm text-white text-[11px] font-medium px-2.5 py-1 rounded-lg truncate inline-block max-w-full">
                    {item.originalName} • {item.pageCount} pg{item.pageCount > 1 ? 's' : ''}
                  </div>
                </div>

                {/* Preview image with reactive styles */}
                {canvasUrls[idx] ? (
                  <img
                    src={canvasUrls[idx]}
                    alt={item.originalName}
                    style={getPreviewStyle(item)}
                    className="shadow-lg"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 py-6">
                    {getFileIcon(item.mimeType || '')}
                    <span className="text-xs text-slate-400 mt-1">{item.pageCount} page(s)</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Dot indicators + counter */}
        {items.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 py-2.5">
            {items.map((_, idx) => (
              <button
                key={idx}
                className={`rounded-full transition-all duration-300 ${
                  idx === activeIndex
                    ? 'w-5 h-2 bg-green-500'
                    : 'w-2 h-2 bg-slate-300 dark:bg-slate-600'
                }`}
                onClick={() => goTo(idx)}
              />
            ))}
            <span className="text-[10px] text-slate-400 ml-2">{activeIndex + 1}/{items.length}</span>
          </div>
        )}

        {/* Configuration Card */}
        <div className="px-4 pt-1 pb-2 space-y-4">

          {/* Number of copies */}
          <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Number of copies</h4>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                {currentItem.originalName.length > 25
                  ? currentItem.originalName.substring(0, 25) + '...'
                  : currentItem.originalName}
              </p>
            </div>
            <div className="flex items-center rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => updateCurrentConfig('copies', Math.max(1, currentItem.config.copies - 1))}
                disabled={currentItem.config.copies <= 1}
                className="w-9 h-9 flex items-center justify-center bg-green-500 text-white disabled:bg-slate-300 dark:disabled:bg-slate-600 active:scale-90 transition-transform"
              >
                <Minus size={14} />
              </button>
              <span className="w-10 h-9 flex items-center justify-center font-bold text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-white">
                {currentItem.config.copies}
              </span>
              <button
                onClick={() => updateCurrentConfig('copies', currentItem.config.copies + 1)}
                className="w-9 h-9 flex items-center justify-center bg-green-500 text-white active:scale-90 transition-transform"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Choose print color */}
          <div>
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2 px-1">Choose print color</h4>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all active:scale-[0.97] ${
                  currentItem.config.color === 'color'
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                }`}
                onClick={() => updateCurrentConfig('color', 'color')}
              >
                {currentItem.config.color === 'color' && <SelectedBadge />}
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #f472b6, #60a5fa, #fbbf24)' }}>
                  <span className="text-xs">🎨</span>
                </div>
                <div className="text-left min-w-0">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Coloured</div>
                  <div className="text-[11px] text-slate-400">₹{shopPricing.color.single}/pg</div>
                </div>
              </button>

              <button
                className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all active:scale-[0.97] ${
                  currentItem.config.color === 'bw'
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                }`}
                onClick={() => updateCurrentConfig('color', 'bw')}
              >
                {currentItem.config.color === 'bw' && <SelectedBadge />}
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #64748b, #1e293b)' }}>
                  <span className="text-xs">⚫</span>
                </div>
                <div className="text-left min-w-0">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">B & W</div>
                  <div className="text-[11px] text-slate-400">₹{shopPricing.bw.single}/pg</div>
                </div>
              </button>
            </div>
          </div>

          {/* Choose orientation */}
          <div>
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2 px-1">Print orientation</h4>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all active:scale-[0.97] ${
                  currentItem.config.orientation === 'portrait'
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                }`}
                onClick={() => updateCurrentConfig('orientation', 'portrait')}
              >
                {currentItem.config.orientation === 'portrait' && <SelectedBadge />}
                <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <svg width="16" height="20" viewBox="0 0 16 22" fill="none"><rect x="1" y="1" width="14" height="20" rx="2" stroke="#3b82f6" strokeWidth="2" /></svg>
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Portrait</div>
                  <div className="text-[11px] text-slate-400">8.3 × 11.7"</div>
                </div>
              </button>

              <button
                className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all active:scale-[0.97] ${
                  currentItem.config.orientation === 'landscape'
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                }`}
                onClick={() => updateCurrentConfig('orientation', 'landscape')}
              >
                {currentItem.config.orientation === 'landscape' && <SelectedBadge />}
                <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <svg width="20" height="16" viewBox="0 0 22 16" fill="none"><rect x="1" y="1" width="20" height="14" rx="2" stroke="#3b82f6" strokeWidth="2" /></svg>
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Landscape</div>
                  <div className="text-[11px] text-slate-400">11.7 × 8.3"</div>
                </div>
              </button>
            </div>
          </div>

          {/* Print sides */}
          <div>
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2 px-1">Print sides</h4>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all active:scale-[0.97] ${
                  currentItem.config.side === 'single'
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                }`}
                onClick={() => updateCurrentConfig('side', 'single')}
              >
                {currentItem.config.side === 'single' && <SelectedBadge />}
                <div className="w-9 h-9 rounded-lg bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                  <FileText size={16} className="text-orange-500" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Single</div>
                  <div className="text-[11px] text-slate-400">One side</div>
                </div>
              </button>

              <button
                className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all active:scale-[0.97] ${
                  currentItem.config.side === 'double'
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                } ${currentItem.pageCount < 2 ? 'opacity-40 pointer-events-none' : ''}`}
                onClick={() => {
                  if (currentItem.pageCount >= 2) updateCurrentConfig('side', 'double');
                }}
              >
                {currentItem.config.side === 'double' && <SelectedBadge />}
                <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                    <rect x="1" y="3" width="11" height="13" rx="2" stroke="#3b82f6" strokeWidth="1.5" />
                    <rect x="5" y="1" width="11" height="13" rx="2" stroke="#3b82f6" strokeWidth="1.5" fill="white" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Double</div>
                  <div className="text-[11px] text-slate-400">Both sides</div>
                </div>
              </button>
            </div>
          </div>

          {/* Paper Size — compact pill buttons */}
          <div>
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2 px-1">Paper size</h4>
            <div className="flex gap-2">
              {(['A4', 'A3', 'A2', 'A1'] as const).map(size => (
                <button
                  key={size}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-bold transition-all active:scale-95 ${
                    currentItem.config.paperSize === size
                      ? 'border-green-500 bg-green-50 text-green-700 dark:border-green-500 dark:bg-green-900/20 dark:text-green-400'
                      : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'
                  }`}
                  onClick={() => updateCurrentConfig('paperSize', size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Page Range */}
          <div>
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2 px-1">Page range</h4>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all placeholder:text-slate-400"
              placeholder="All (e.g. 1-5, 8, 11-15)"
              value={currentItem.config.pageRange}
              onChange={(e) => updateCurrentConfig('pageRange', e.target.value)}
            />
          </div>

          {/* Apply to all — only when multiple files */}
          {items.length > 1 && (
            <button
              onClick={applyToAll}
              className="w-full flex items-center justify-between py-3 px-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl active:scale-[0.98] transition-transform"
            >
              <span className="text-sm text-green-700 dark:text-green-400">Apply to all {items.length} files</span>
              <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-800/50 px-2.5 py-1 rounded-lg">Apply</span>
            </button>
          )}

          {/* Per-item price */}
          <div className="flex justify-between items-center px-1 text-xs text-slate-400">
            <span>This file: {currentItem.pageCount} pg × {currentItem.config.copies} copy</span>
            <span className="font-bold text-slate-600 dark:text-slate-300">₹{getItemCost(currentItem).toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* Bottom Bar — fixed at bottom with safe area */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-4 py-3 flex justify-between items-center z-30 safe-area-bottom"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div>
          <p className="text-[11px] text-slate-400">
            {items.length} file{items.length > 1 ? 's' : ''} • {totalPages} page{totalPages !== 1 ? 's' : ''}
          </p>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white">₹{totalCost.toFixed(0)}</p>
        </div>
        <button
          className="bg-green-500 hover:bg-green-600 text-white font-bold px-6 py-3 rounded-xl text-sm shadow-lg shadow-green-500/25 active:scale-95 transition-all"
          onClick={() => onAddToCart(items)}
        >
          Add to cart
        </button>
      </div>
    </div>
  );
};

export default DocumentConfigurator;
