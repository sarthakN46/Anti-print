import { ArrowLeft, FileText, Trash2, ShoppingCart, Image as ImageIcon, Presentation, FileSpreadsheet } from 'lucide-react';
import type { ConfiguratorItem } from './DocumentConfigurator';

interface CartPageProps {
  items: ConfiguratorItem[];
  shopName: string;
  shopPricing: {
    bw: { single: number; double: number };
    color: { single: number; double: number };
    otherSizes?: Record<string, { bw: number; color: number }>;
  };
  onBack: () => void;
  onRemoveItem: (index: number) => void;
  onConfirmPay: () => void;
}

const CartPage = ({
  items,
  shopName,
  shopPricing,
  onBack,
  onRemoveItem,
  onConfirmPay,
}: CartPageProps) => {
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

  const totalCost = items.reduce((sum, item) => sum + getItemCost(item), 0);
  const totalPages = items.reduce((sum, item) => sum + item.pageCount * item.config.copies, 0);

  const getFileIcon = (mime: string) => {
    if (mime?.startsWith('image/')) return <ImageIcon size={18} className="text-blue-400" />;
    if (mime?.includes('presentation') || mime?.includes('powerpoint')) return <Presentation size={18} className="text-orange-400" />;
    if (mime?.includes('spreadsheet') || mime?.includes('excel') || mime?.includes('csv')) return <FileSpreadsheet size={18} className="text-green-500" />;
    return <FileText size={18} className="text-slate-400" />;
  };

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-slate-900 flex flex-col page-enter">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-3 py-2.5 flex items-center gap-3 sticky top-0 z-20">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300 active:scale-90 transition-transform"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="text-base font-bold dark:text-white flex items-center gap-1.5">
            <ShoppingCart size={16} className="text-green-500" />
            Your Cart
          </h1>
          <p className="text-[11px] text-slate-400 truncate">{shopName}</p>
        </div>
        <span className="ml-auto bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold px-2 py-0.5 rounded-lg">
          {items.length}
        </span>
      </header>

      {/* Cart Items */}
      <div className="flex-1 overflow-auto overscroll-contain pb-[140px]">
        {items.length === 0 ? (
          <div className="text-center py-20 px-6 text-slate-400">
            <ShoppingCart size={44} className="mx-auto mb-4 opacity-20" />
            <p className="text-base font-medium">Your cart is empty</p>
            <p className="text-sm mt-1">Go back and add some documents</p>
          </div>
        ) : (
          <div className="px-4 pt-3 space-y-2.5">
            {items.map((item, idx) => {
              const cost = getItemCost(item);
              return (
                <div
                  key={idx}
                  className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-100 dark:border-slate-700 active:bg-slate-100 dark:active:bg-slate-700 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="w-10 h-10 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-600 mt-0.5">
                      {getFileIcon(item.mimeType || '')}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-slate-800 dark:text-white text-sm truncate pr-2">
                        {item.originalName}
                      </h4>

                      {/* Spec badges */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          item.config.color === 'color'
                            ? 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300'
                        }`}>
                          {item.config.color === 'color' ? 'Color' : 'B&W'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                          {item.config.orientation === 'portrait' ? 'Port' : 'Land'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                          {item.config.side === 'double' ? '2-side' : '1-side'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                          {item.config.paperSize}
                        </span>
                        {item.config.copies > 1 && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                            ×{item.config.copies}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 mt-1">
                        {item.pageCount} pg × {item.config.copies} • Range: {item.config.pageRange}
                      </p>
                    </div>

                    {/* Price + Delete */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="font-bold text-sm text-slate-800 dark:text-white">
                        ₹{cost.toFixed(0)}
                      </span>
                      <button
                        onClick={() => onRemoveItem(idx)}
                        className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors active:scale-90"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Checkout Bar */}
      {items.length > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-4 pt-3 pb-3 z-30"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          {/* Summary line */}
          <div className="flex justify-between items-center mb-3">
            <div>
              <p className="text-[11px] text-slate-400">
                {items.length} file{items.length > 1 ? 's' : ''} • {totalPages} page{totalPages !== 1 ? 's' : ''}
              </p>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                ₹{totalCost.toFixed(0)}
              </p>
            </div>
          </div>

          <button
            onClick={onConfirmPay}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-xl text-base shadow-lg shadow-green-500/25 active:scale-[0.97] transition-all"
          >
            Confirm & Pay
          </button>
        </div>
      )}
    </div>
  );
};

export default CartPage;
