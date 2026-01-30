import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { LayoutDashboard, LogOut, Printer, RefreshCw, CheckCircle, Clock, FileText, Layers, Palette, Power, UserPlus, X, Settings, QrCode, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import QRCode from 'react-qr-code';
import printJS from 'print-js'; // Import print-js

const ShopDashboard = () => {
  const { user, logout } = useContext(AuthContext)!;
  const navigate = useNavigate();
  
  const [orders, setOrders] = useState<any[]>([]);
  const [shop, setShop] = useState<any>(null);
  const [stats, setStats] = useState({ pending: 0, printed: 0, revenue: 0 });
  const [socket, setSocket] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  
  // UI States
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string>('pdf'); 
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showQR, setShowQR] = useState(false);
  
  // Print State
  const [autoPrintTriggered, setAutoPrintTriggered] = useState(false);

  // Employee Form
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empPass, setEmpPass] = useState('');

  const downloadQR = () => {
     // ... (Existing QR logic)
     const svg = document.getElementById("shop-qr");
     if (!svg) return;
     const svgData = new XMLSerializer().serializeToString(svg);
     const canvas = document.createElement("canvas");
     const ctx = canvas.getContext("2d");
     const img = new Image();
     img.onload = () => {
       canvas.width = img.width;
       canvas.height = img.height;
       ctx?.drawImage(img, 0, 0);
       const pngFile = canvas.toDataURL("image/png");
       const downloadLink = document.createElement("a");
       downloadLink.download = `${shop.name}-QR.png`;
       downloadLink.href = pngFile;
       downloadLink.click();
     };
     img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  // 1. Fetch Initial Data
  const fetchShopDetails = async () => {
    try {
      const { data } = await api.get('/shops/my-shop');
      setShop(data);
    } catch (err: any) { 
      if (err.response?.status === 404 && user?.role === 'OWNER') {
         navigate('/shop/setup');
      }
      console.error(err); 
    }
  };

  const fetchOrders = async () => {
    try {
      const { data } = await api.get('/orders/shop');
      setOrders(data);
      updateStats(data);
    } catch (err) { }
  };

  const updateStats = (data: any[]) => {
    const pending = data.filter((o: any) => o.orderStatus === 'QUEUED').length;
    const printed = data.filter((o: any) => o.orderStatus === 'COMPLETED').length;
    const revenue = data
       .filter((o: any) => o.orderStatus !== 'CANCELLED')
       .reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);
    setStats({ pending, printed, revenue });
  };

  // --- Printing Logic (Updated for print-js + Backend Conversion) ---

  const handlePrint = () => {
    if (!previewUrl) return;

    // Use print-js
    if (previewType === 'img') {
       printJS({ printable: previewUrl, type: 'image', header: 'XeroxSaaS Print' });
    } else {
       // Assume PDF for everything else (since backend converts DOC/PPT)
       printJS({ printable: previewUrl, type: 'pdf', showModal: true });
    }
  };

  // Auto-Print Effect when Preview Opens
  useEffect(() => {
     if (autoPrintTriggered && previewUrl) {
        handlePrint();
        setAutoPrintTriggered(false); // Reset
     }
  }, [previewUrl, autoPrintTriggered]);


  useEffect(() => {
    fetchShopDetails();
    fetchOrders();

    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    return () => { newSocket.close(); };
  }, []);

  useEffect(() => {
    if (socket && shop) {
      socket.emit('join_shop', shop._id);
      
      const handleNewOrder = (newOrder: any) => {
        toast(() => (
          <div className="flex items-center gap-2">
            <span className="text-xl">🔔</span>
            <div>
               <p className="font-bold">New Order Received!</p>
               <p className="text-sm">#{newOrder._id.slice(-4)} • ₹{newOrder.totalAmount}</p>
            </div>
          </div>
        ), { duration: 5000, position: 'top-right' });
        
        setOrders(prev => {
           const updated = [newOrder, ...prev];
           updateStats(updated);
           return updated;
        });
      };

      const handleOrderUpdate = (updatedOrder: any) => {
         setOrders(prev => {
            const newOrders = prev.map(o => o._id === updatedOrder._id ? updatedOrder : o);
            updateStats(newOrders);
            return newOrders;
         });
      };

      socket.on('new_order', handleNewOrder);
      socket.on('order_updated', handleOrderUpdate);
      socket.on('order_status_updated', handleOrderUpdate); // Listen to this too for status changes

      return () => { 
         socket.off('new_order', handleNewOrder);
         socket.off('order_updated', handleOrderUpdate);
         socket.off('order_status_updated', handleOrderUpdate);
      };
    }
  }, [socket, shop]);


  const markCompleted = async (orderId: string) => {
    try {
      await api.put(`/orders/${orderId}/status`, { status: 'COMPLETED' });
      const updatedOrders = orders.map(o => o._id === orderId ? { ...o, orderStatus: 'COMPLETED' } : o);
      setOrders(updatedOrders);
      updateStats(updatedOrders);
      toast.success('Order Completed');
    } catch (error) { toast.error('Failed to update status'); }
  };

  const cancelOrder = async (orderId: string) => {
    if (!window.confirm('Cancel this order? Refund will be recorded.')) return;
    try {
      const { data } = await api.put(`/orders/${orderId}/cancel`);
      const updatedOrders = orders.map(o => o._id === orderId ? data.order : o);
      setOrders(updatedOrders);
      updateStats(updatedOrders);
      toast.success('Order Cancelled');
    } catch (error) { toast.error('Failed to cancel order'); }
  };

  const [toggling, setToggling] = useState(false);

  const toggleStatus = async () => {
    if (toggling) return;
    setToggling(true);
    try {
      const { data } = await api.put('/shops/status');
      await fetchShopDetails();
      toast.success(data.status === 'OPEN' ? 'Shop is now OPEN' : 'Shop is now CLOSED');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to toggle status');
    } finally { setToggling(false); }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/shops/employees', { name: empName, email: empEmail, password: empPass });
      toast.success('Employee added successfully');
      setShowEmployeeModal(false);
      setEmpName(''); setEmpEmail(''); setEmpPass('');
    } catch (e) { toast.error('Failed to add employee'); }
  };

  const openPreview = async (storageKey: string, _originalName: string, autoPrint = false) => {
     try {
       toast.loading('Preparing document...', { id: 'preview-loader' });
       
       // Call the NEW conversion endpoint
       const response = await api.post('/upload/preview-pdf', { storageKey }, {
          responseType: 'blob' // We expect a binary blob
       });

       const blob = new Blob([response.data], { type: response.headers['content-type'] });
       const url = URL.createObjectURL(blob);
       
       setPreviewUrl(url);

       const type = response.headers['content-type'];
       if (type.startsWith('image/')) {
          setPreviewType('img');
       } else {
          setPreviewType('pdf'); // Everything else is PDF now
       }
       
       toast.dismiss('preview-loader');
       
       if (autoPrint) setAutoPrintTriggered(true);

     } catch (e) { 
        toast.dismiss('preview-loader');
        toast.error('Could not load file. Server conversion failed.');
     }
  };

  // ... (Rest of UI)


  const renderSpecs = (config: any) => (
      <div className="flex flex-wrap gap-2 mt-1">
        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border flex items-center gap-1 ${config.color === 'color' ? 'bg-pink-100 text-pink-700 border-pink-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
          <Palette size={10} /> {config.color === 'color' ? 'COLOR' : 'B&W'}
        </span>
        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border flex items-center gap-1 ${config.side === 'double' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
          <Layers size={10} /> {config.side === 'double' ? 'DUPLEX' : 'SINGLE'}
        </span>
        {config.copies > 1 && (
          <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-700 border border-purple-200">
            {config.copies} COPIES
          </span>
        )}
      </div>
  );

  // Improved Distinct Color Generator
  const getUserColor = (id: string) => {
    if (!id) return '#f8fafc';
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    const h = Math.abs(hash) % 360;
    // High saturation, High lightness for pastel-like but distinct background
    return `hsl(${h}, 85%, 92%)`; 
  };

  const filteredOrders = orders.filter(o => {
    if (activeTab === 'active') return ['QUEUED', 'PRINTING', 'READY'].includes(o.orderStatus);
    return ['COMPLETED', 'CANCELLED'].includes(o.orderStatus);
  });

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 relative">
      {/* Sidebar */}
      <aside className="w-64 bg-secondary text-white hidden md:flex flex-col dark:bg-black border-r dark:border-slate-800">
        <div className="p-6 border-b border-slate-700 dark:border-slate-800">
          <h2 className="text-xl font-bold flex items-center gap-2"><Printer className="text-primary"/> XeroxSaaS</h2>
          <p className="text-xs text-slate-400 mt-1">Partner Portal</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <div className="flex items-center gap-3 px-4 py-3 bg-white/10 text-primary rounded-xl cursor-pointer">
            <LayoutDashboard size={20} /> Dashboard
          </div>
          <button onClick={() => navigate('/shop/history')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors text-left">
               <Clock size={20} /> History
          </button>
          {user?.role === 'OWNER' && (
             <button onClick={() => navigate('/shop/settings')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors text-left">
               <Settings size={20} /> Settings
             </button>
          )}
          <button onClick={() => navigate('/support')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors text-left">
               <HelpCircle size={20} /> Support
          </button>
        </nav>
        <div className="p-4 border-t border-slate-700 dark:border-slate-800"><button onClick={() => { logout(); navigate('/login'); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-400/10 rounded-lg"><LogOut size={16} /> Logout</button></div>
      </aside>

      <main className="flex-1 overflow-auto flex flex-col">
        {/* Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center sticky top-0 z-10 gap-4">
          <div className="flex justify-between w-full md:w-auto items-center">
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-slate-800 dark:text-white">Shop Dashboard</h1>
               <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                     Logged in as: <span className="font-bold text-primary">{user?.name}</span>
                  </p>
                  {shop && <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-mono">ID: {shop._id}</span>
                    {user?.role === 'OWNER' && <span className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-1 rounded font-bold">OWNER</span>}
                  </div>}
               </div>
            </div>
            <button onClick={() => { logout(); navigate('/login'); }} className="md:hidden text-slate-500 hover:text-red-500 p-2">
              <LogOut size={20} />
            </button>
          </div>
          
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
             {shop && (
               <button onClick={toggleStatus} className={`flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg font-bold transition-all text-xs md:text-sm whitespace-nowrap ${shop.status === 'OPEN' ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300'}`}>
                 <Power size={16} /> {shop.status === 'OPEN' ? 'OPEN' : 'CLOSED'}
               </button>
             )}
             <button onClick={() => setShowQR(true)} className="btn btn-outline flex items-center gap-2 text-xs md:text-sm whitespace-nowrap px-3 py-1.5 md:px-4 md:py-2">
                <QrCode size={16} /> <span className="hidden sm:inline">QR Code</span>
             </button>
             {user?.role === 'OWNER' && (
                <button onClick={() => setShowEmployeeModal(true)} className="btn btn-outline flex items-center gap-2 text-xs md:text-sm whitespace-nowrap px-3 py-1.5 md:px-4 md:py-2">
                  <UserPlus size={16} /> <span className="hidden sm:inline">Staff</span>
                </button>
             )}
             <button onClick={fetchOrders} className="p-2 text-slate-500 hover:text-primary-hover"><RefreshCw size={20}/></button>
          </div>
        </header>

        <div className="p-6 max-w-7xl mx-auto space-y-8 w-full">
           {/* Stats */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">Queue Size</p><h3 className="text-3xl font-bold text-slate-900 dark:text-white">{stats.pending}</h3>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">Completed Today</p><h3 className="text-3xl font-bold text-slate-900 dark:text-white">{stats.printed}</h3>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">Revenue Estimate</p><h3 className="text-3xl font-bold text-primary-hover">₹{stats.revenue.toFixed(2)}</h3>
            </div>
          </div>

          {/* Orders Table with Tabs */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-350px)]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
               <div className="flex gap-4">
                  <button 
                    onClick={() => setActiveTab('active')}
                    className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'active' ? 'text-primary border-primary' : 'text-slate-400 border-transparent hover:text-slate-600 dark:hover:text-slate-300'}`}
                  >
                    Queue ({orders.filter(o => ['QUEUED', 'PRINTING', 'READY'].includes(o.orderStatus)).length})
                  </button>
                  <button 
                    onClick={() => setActiveTab('history')}
                    className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'history' ? 'text-primary border-primary' : 'text-slate-400 border-transparent hover:text-slate-600 dark:hover:text-slate-300'}`}
                  >
                    Completed
                  </button>
               </div>
            </div>
            
            <div className="overflow-auto flex-1">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold sticky top-0 z-10">
                  <tr><th className="p-4">Order ID</th><th className="p-4">User</th><th className="p-4">Files & Config</th><th className="p-4">Status</th><th className="p-4">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredOrders.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">No {activeTab} orders.</td></tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order._id} style={{ backgroundColor: getUserColor(order.user?._id) }} className="hover:brightness-95 dark:hover:bg-slate-700 transition-colors dark:text-white">
                        <td className="p-4 font-mono text-sm font-bold text-slate-700 dark:text-slate-400">#{order._id.slice(-6)}</td>
                        <td className="p-4 font-medium text-slate-900 dark:text-white">
                           {order.user?.name || (order.user?.email ? order.user.email.split('@')[0] : 'Guest')}
                        </td>
                        <td className="p-4">
                          <div className="space-y-3">
                            {order.items.map((item: any, idx: number) => (
                              <div key={idx} className="flex flex-col gap-1">
                                <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                                  <FileText size={16} className="text-slate-600 dark:text-slate-400" />
                                  <span className="truncate max-w-[200px]">{item.originalName}</span>
                                  <button 
                                    onClick={() => openPreview(item.convertedKey || item.storageKey, item.originalName, true)}
                                    className="ml-2 btn bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 text-[10px] py-1 px-3 shadow-none flex items-center gap-1"
                                  >
                                    <Printer size={12}/> Print
                                  </button>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-400 pl-6">
                                  <span>Range: <b className="text-slate-900 dark:text-slate-300">{item.config.pageRange || 'All'}</b></span>
                                  <span>•</span>
                                  <span><b className="text-slate-900 dark:text-slate-300">{item.pageCount}</b> Pgs</span>
                                </div>
                                <div className="pl-6">{renderSpecs(item.config)}</div>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${order.orderStatus === 'QUEUED' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'}`}>
                            {order.orderStatus === 'QUEUED' ? <Clock size={12}/> : <CheckCircle size={12}/>}
                            {order.orderStatus}
                          </span>
                        </td>
                        <td className="p-4">
                          {order.orderStatus === 'QUEUED' ? (
                            <div className="flex gap-2">
                              <button onClick={() => markCompleted(order._id)} className="btn bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 text-xs py-2 px-4 shadow-none flex items-center gap-2">
                                <CheckCircle size={16} /> Mark Done
                              </button>
                              <button onClick={() => cancelOrder(order._id)} className="btn bg-white dark:bg-slate-800 text-red-500 border border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-900/30 text-xs py-2 px-3 shadow-none" title="Cancel & Refund">
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-600 dark:text-slate-400 text-sm">Archived</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* --- MODALS --- */}

      {/* 1. Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl h-[85vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
             <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><FileText size={20}/> Document Preview</h3>
                <div className="flex gap-2">
                   <button onClick={handlePrint} className="btn btn-primary text-sm py-1.5 flex items-center gap-2">
                     <Printer size={16}/> Print Now
                   </button>
                   <a href={previewUrl} download className="btn btn-outline text-sm py-1.5" target="_blank" rel="noreferrer">Download File</a>
                   <button onClick={() => setPreviewUrl(null)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500"><X size={24}/></button>
                </div>
             </div>
             <div className="flex-1 bg-slate-100 p-4 flex items-center justify-center overflow-auto relative">
                {previewType === 'pdf' ? (
                   <iframe 
                      src={previewUrl} 
                      className="w-full h-full rounded-xl bg-white shadow-sm" 
                      title="Preview"
                   />
                ) : previewType === 'img' ? (
                   <img src={previewUrl} alt="Preview" className="max-w-full max-h-full rounded-xl shadow-lg" />
                ) : previewType === 'office' ? (
                  // Google Docs Viewer for Office files
                  <iframe 
                    src={`https://docs.google.com/gview?url=${encodeURIComponent(previewUrl)}&embedded=true`}
                    className="w-full h-full rounded-xl bg-white shadow-sm"
                    title="Office Preview"
                  />
                ) : (
                   // Fallback for Unknown Types
                   <div className="text-center p-8 bg-white rounded-xl shadow-sm border border-slate-200">
                      <FileText size={48} className="mx-auto text-blue-500 mb-4"/>
                      <h3 className="text-lg font-bold text-slate-800">File Type Not Supported</h3>
                      <p className="text-slate-500 text-sm mb-6 max-w-xs">
                         This file cannot be previewed in the browser.
                         Please download to print.
                      </p>
                      <a href={previewUrl} download className="btn btn-primary w-full flex items-center justify-center gap-2">
                         <Printer size={18}/> Download & Print
                      </a>
                   </div>
                )}
             </div>
          </div>
        </div>
      )}

      {/* 2. Employee Modal */}
      {showEmployeeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl p-6 shadow-xl animate-in fade-in zoom-in duration-200">
             <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-xl dark:text-white">Add Employee</h3>
                <button onClick={() => setShowEmployeeModal(false)}><X size={24} className="text-slate-400 hover:text-red-500"/></button>
             </div>
             <form onSubmit={handleAddEmployee} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                  <input type="text" required className="input-field" value={empName} onChange={e => setEmpName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                  <input type="email" required className="input-field" value={empEmail} onChange={e => setEmpEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                  <input type="password" required className="input-field" value={empPass} onChange={e => setEmpPass(e.target.value)} />
                </div>
                <button type="submit" className="w-full btn btn-primary flex justify-center items-center gap-2">
                  <UserPlus size={18} /> Create Account
                </button>
             </form>
          </div>
        </div>
      )}

      {/* 3. QR Code Modal */}
      {showQR && shop && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center animate-in fade-in zoom-in">
              <h3 className="font-bold text-2xl mb-2">{shop.name}</h3>
              <p className="text-slate-500 mb-6 text-sm">Scan to upload documents here</p>
              
              <div className="bg-white p-4 rounded-xl border border-slate-200 inline-block mb-6">
                 <QRCode 
                    id="shop-qr"
                    value={`${window.location.origin}/user/dashboard?shopId=${shop._id}`} 
                    size={200}
                    level="H"
                 />
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <button onClick={downloadQR} className="btn btn-primary">Download</button>
                 <button onClick={() => setShowQR(false)} className="btn btn-outline">Close</button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default ShopDashboard;