import { useState, useEffect } from 'react';
import api from '../services/api';
import { ArrowLeft, Search, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ShopHistory = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    fetchHistory();
  }, [startDate, endDate]); // Refetch on date change

  const fetchHistory = async () => {
    setLoading(true);
    try {
       // Query params
       const params = new URLSearchParams();
       if (startDate) params.append('startDate', startDate);
       if (endDate) params.append('endDate', endDate);
       if (search) params.append('search', search);

       const { data } = await api.get(`/orders/shop?${params.toString()}`); 
       // Note: Currently /orders/shop returns all orders sorted by date. 
       // We might need a dedicated /history endpoint if the list gets huge, 
       // but for MVP reuse is okay. 
       // *Correction*: The prompt asked for "history of overall from creation". 
       // The current `getShopOrders` gets all orders.
       // We will do client-side filtering for search/status for responsiveness on small datasets.
       setOrders(data);
    } catch (e) {
       console.error(e);
    } finally {
       setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
     const matchesSearch = 
        order._id.toLowerCase().includes(search.toLowerCase()) || 
        order.user?.name.toLowerCase().includes(search.toLowerCase());
     
     const matchesStatus = statusFilter === 'ALL' || order.orderStatus === statusFilter;

     return matchesSearch && matchesStatus;
  });

  const totalRevenue = filteredOrders
    .filter(o => o.orderStatus !== 'CANCELLED')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={() => navigate('/shop/dashboard')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
          <ArrowLeft size={20} />
        </button>
        <div>
           <h1 className="text-xl font-bold text-slate-800">Order History</h1>
           <p className="text-xs text-slate-500">Full archive of all transactions</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
         
         {/* Filters Bar */}
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                  <input 
                     type="text" 
                     placeholder="Search Order ID or Name" 
                     className="input-field pl-10 py-2 text-sm w-full md:w-64"
                     value={search}
                     onChange={e => setSearch(e.target.value)}
                  />
               </div>
               
               <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-slate-400"/>
                  <input 
                     type="date" 
                     className="input-field py-2 text-sm"
                     value={startDate}
                     onChange={e => setStartDate(e.target.value)}
                  />
                  <span className="text-slate-400">-</span>
                  <input 
                     type="date" 
                     className="input-field py-2 text-sm"
                     value={endDate}
                     onChange={e => setEndDate(e.target.value)}
                  />
               </div>

               <select 
                  className="input-field py-2 text-sm w-full md:w-auto"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
               >
                  <option value="ALL">All Status</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="QUEUED">Queued</option>
               </select>
            </div>

            <div className="text-right">
               <p className="text-xs text-slate-400 font-bold uppercase">Total Revenue (Filtered)</p>
               <p className="text-2xl font-bold text-slate-800">₹{totalRevenue.toFixed(2)}</p>
            </div>
         </div>

         {/* Table */}
         <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-320px)]">
            <div className="overflow-auto flex-1">
               <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold sticky top-0">
                     <tr>
                        <th className="p-4">Date</th>
                        <th className="p-4">Order ID</th>
                        <th className="p-4">Customer</th>
                        <th className="p-4">Details</th>
                        <th className="p-4">Amount</th>
                        <th className="p-4">Status</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {loading ? (
                        <tr><td colSpan={6} className="p-8 text-center text-slate-400">Loading history...</td></tr>
                     ) : filteredOrders.length === 0 ? (
                        <tr><td colSpan={6} className="p-8 text-center text-slate-400">No records found.</td></tr>
                     ) : (
                        filteredOrders.map(order => (
                           <tr key={order._id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-4 text-sm text-slate-600">
                                 {new Date(order.createdAt).toLocaleDateString()}
                                 <div className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleTimeString()}</div>
                              </td>
                              <td className="p-4 font-mono text-sm text-slate-500">#{order._id.slice(-6)}</td>
                              <td className="p-4 font-medium text-slate-800">{order.user?.name || 'Guest'}</td>
                              <td className="p-4 text-sm text-slate-600">
                                 {order.items.length} Files
                                 <div className="text-xs text-slate-400 truncate max-w-[200px]">
                                    {order.items.map((i: any) => i.originalName).join(', ')}
                                 </div>
                              </td>
                              <td className="p-4 font-bold text-slate-800">₹{order.totalAmount}</td>
                              <td className="p-4">
                                 <span className={`px-2 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1
                                    ${order.orderStatus === 'COMPLETED' ? 'bg-green-100 text-green-700' : 
                                      order.orderStatus === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}
                                 `}>
                                    {order.orderStatus === 'COMPLETED' ? <CheckCircle size={12}/> : 
                                     order.orderStatus === 'CANCELLED' ? <XCircle size={12}/> : <Clock size={12}/>}
                                    {order.orderStatus}
                                 </span>
                              </td>
                           </tr>
                        ))
                     )}
                  </tbody>
               </table>
            </div>
         </div>

      </main>
    </div>
  );
};

export default ShopHistory;