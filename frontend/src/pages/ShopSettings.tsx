import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, DollarSign, Package, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ShopSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<any>(null);
  
  // Pricing State
  const [bw, setBw] = useState({ single: 0, double: 0 });
  const [color, setColor] = useState({ single: 0, double: 0 });
  const [bulk, setBulk] = useState({ enabled: false, threshold: 100, bwPrice: 0, colorPrice: 0 });
  const [otherSizes, setOtherSizes] = useState({
    A3: { bw: 6, color: 20 },
    A2: { bw: 15, color: 50 },
    A1: { bw: 30, color: 100 }
  });
  
  useEffect(() => {
    fetchShopData();
  }, []);

  const fetchShopData = async () => {
    try {
      const { data } = await api.get('/shops/my-shop');
      setShop(data);
      setBw(data.pricing.bw || { single: 3, double: 2 });
      setColor(data.pricing.color || { single: 10, double: 8 });
      setBulk(data.pricing.bulkDiscount || { enabled: false, threshold: 100, bwPrice: 1.5, colorPrice: 8 });
      if (data.pricing.otherSizes) setOtherSizes(data.pricing.otherSizes);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load settings');
      setLoading(false);
    }
  };

  const handleSavePricing = async () => {
    try {
      await api.put('/shops/pricing', {
        bw,
        color,
        bulkDiscount: bulk,
        otherSizes
      });
      toast.success('Pricing updated successfully');
    } catch (error) {
      toast.error('Failed to update pricing');
    }
  };

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={() => navigate('/shop/dashboard')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
          <ArrowLeft size={20} />
        </button>
        <div>
           <h1 className="text-xl font-bold text-slate-800">Shop Settings</h1>
           {shop && <p className="text-xs text-slate-500">{shop.name}</p>}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        
        {/* Standard Rates */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="p-3 bg-green-100 text-green-700 rounded-xl">
              <DollarSign size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Standard Rates</h2>
              <p className="text-sm text-slate-500">Set explicit prices for Single vs Double sided prints.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Black & White */}
            <div className="space-y-4">
               <h3 className="font-bold text-slate-700 flex items-center gap-2">
                 <div className="w-3 h-3 bg-slate-800 rounded-full"></div> Black & White
               </h3>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Single Side</label>
                    <div className="relative">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                       <input 
                        type="number" step="0.1" min="0" className="input-field pl-6"
                        value={bw.single} onChange={e => setBw({...bw, single: parseFloat(e.target.value)})}
                       />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Double Side</label>
                    <div className="relative">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                       <input 
                        type="number" step="0.1" min="0" className="input-field pl-6"
                        value={bw.double} onChange={e => setBw({...bw, double: parseFloat(e.target.value)})}
                       />
                    </div>
                  </div>
               </div>
            </div>

            {/* Color */}
            <div className="space-y-4">
               <h3 className="font-bold text-pink-600 flex items-center gap-2">
                 <div className="w-3 h-3 bg-pink-500 rounded-full"></div> Color
               </h3>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Single Side</label>
                    <div className="relative">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                       <input 
                        type="number" step="0.1" min="0" className="input-field pl-6"
                        value={color.single} onChange={e => setColor({...color, single: parseFloat(e.target.value)})}
                       />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Double Side</label>
                    <div className="relative">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                       <input 
                        type="number" step="0.1" min="0" className="input-field pl-6"
                        value={color.double} onChange={e => setColor({...color, double: parseFloat(e.target.value)})}
                       />
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </section>

        {/* Bulk Discounts */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 text-blue-700 rounded-xl">
                <Package size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Bulk Discounts</h2>
                <p className="text-sm text-slate-500">Offer lower rates for large documents.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
               <span className="text-sm font-bold text-slate-600">Enable</span>
               <button 
                 onClick={() => setBulk({...bulk, enabled: !bulk.enabled})}
                 className={`w-12 h-6 rounded-full transition-colors relative ${bulk.enabled ? 'bg-primary' : 'bg-slate-300'}`}
               >
                 <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${bulk.enabled ? 'left-7' : 'left-1'}`} />
               </button>
            </div>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 transition-opacity ${bulk.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Page Threshold</label>
                <input 
                  type="number" min="10" className="input-field"
                  value={bulk.threshold} onChange={e => setBulk({...bulk, threshold: parseInt(e.target.value)})}
                />
                <p className="text-xs text-slate-400 mt-1">Min. pages to trigger discount</p>
             </div>
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Discounted B&W Rate</label>
                <div className="relative">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                   <input 
                    type="number" step="0.1" className="input-field pl-6"
                    value={bulk.bwPrice} onChange={e => setBulk({...bulk, bwPrice: parseFloat(e.target.value)})}
                   />
                </div>
             </div>
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Discounted Color Rate</label>
                <div className="relative">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                   <input 
                    type="number" step="0.1" className="input-field pl-6"
                    value={bulk.colorPrice} onChange={e => setBulk({...bulk, colorPrice: parseFloat(e.target.value)})}
                   />
                </div>
             </div>
          </div>
        </section>

        {/* Other Paper Sizes */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="p-3 bg-purple-100 text-purple-700 rounded-xl">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Large Format Pricing</h2>
              <p className="text-sm text-slate-500">Set prices for A3, A2, and A1 sizes.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {/* A3 */}
             <div className="space-y-3">
                <h3 className="font-bold text-slate-700">A3 Size</h3>
                <div className="grid grid-cols-2 gap-3">
                   <div>
                      <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">B&W</label>
                      <div className="relative">
                         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                         <input 
                          type="number" step="0.1" min="0" className="input-field pl-6"
                          // @ts-ignore
                          value={otherSizes.A3.bw} onChange={e => setOtherSizes({...otherSizes, A3: {...otherSizes.A3, bw: parseFloat(e.target.value)}})}
                         />
                      </div>
                   </div>
                   <div>
                      <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Color</label>
                      <div className="relative">
                         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                         <input 
                          type="number" step="0.1" min="0" className="input-field pl-6"
                          // @ts-ignore
                          value={otherSizes.A3.color} onChange={e => setOtherSizes({...otherSizes, A3: {...otherSizes.A3, color: parseFloat(e.target.value)}})}
                         />
                      </div>
                   </div>
                </div>
             </div>

             {/* A2 */}
             <div className="space-y-3">
                <h3 className="font-bold text-slate-700">A2 Size</h3>
                <div className="grid grid-cols-2 gap-3">
                   <div>
                      <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">B&W</label>
                      <div className="relative">
                         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                         <input 
                          type="number" step="0.1" min="0" className="input-field pl-6"
                          // @ts-ignore
                          value={otherSizes.A2.bw} onChange={e => setOtherSizes({...otherSizes, A2: {...otherSizes.A2, bw: parseFloat(e.target.value)}})}
                         />
                      </div>
                   </div>
                   <div>
                      <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Color</label>
                      <div className="relative">
                         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                         <input 
                          type="number" step="0.1" min="0" className="input-field pl-6"
                          // @ts-ignore
                          value={otherSizes.A2.color} onChange={e => setOtherSizes({...otherSizes, A2: {...otherSizes.A2, color: parseFloat(e.target.value)}})}
                         />
                      </div>
                   </div>
                </div>
             </div>

             {/* A1 */}
             <div className="space-y-3">
                <h3 className="font-bold text-slate-700">A1 Size</h3>
                <div className="grid grid-cols-2 gap-3">
                   <div>
                      <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">B&W</label>
                      <div className="relative">
                         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                         <input 
                          type="number" step="0.1" min="0" className="input-field pl-6"
                          // @ts-ignore
                          value={otherSizes.A1.bw} onChange={e => setOtherSizes({...otherSizes, A1: {...otherSizes.A1, bw: parseFloat(e.target.value)}})}
                         />
                      </div>
                   </div>
                   <div>
                      <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Color</label>
                      <div className="relative">
                         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                         <input 
                          type="number" step="0.1" min="0" className="input-field pl-6"
                          // @ts-ignore
                          value={otherSizes.A1.color} onChange={e => setOtherSizes({...otherSizes, A1: {...otherSizes.A1, color: parseFloat(e.target.value)}})}
                         />
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </section>

        <div className="flex justify-end">
            <button onClick={handleSavePricing} className="btn btn-primary flex items-center gap-2 px-8 py-3 text-lg">
              <Save size={20} /> Save Changes
            </button>
        </div>

      </main>
    </div>
  );
};

export default ShopSettings;