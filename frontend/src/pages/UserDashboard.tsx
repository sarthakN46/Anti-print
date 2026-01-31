import { useState, useContext, useEffect } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import FileUpload from '../components/FileUpload';
import QRScanner from '../components/QRScanner';
import toast from 'react-hot-toast';
import { Store, ShoppingCart, LogOut, FileText, Trash2, Eye, MapPin, ArrowRight, Loader2, Info, QrCode, X, ArrowLeft, Clock, List, Map as MapIcon, CheckCircle, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { io } from 'socket.io-client';

interface CartItem {
  storageKey: string;
  originalName: string;
  fileHash: string;
  pageCount: number;
  previewUrl?: string;
  fileType?: string; // To track if it is pptx
  config: {
    color: 'bw' | 'color';
    side: 'single' | 'double';
    copies: number;
    pageRange: string;
    orientation: 'portrait' | 'landscape';
    paperSize: 'A4' | 'A3' | 'A2' | 'A1';
  };
}

const UserDashboard = () => {
  const { user, logout } = useContext(AuthContext)!;
  const navigate = useNavigate();

  const [shops, setShops] = useState<any[]>([]);
  const [loadingShops, setLoadingShops] = useState(true);
  const [selectedShop, setSelectedShop] = useState<any>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  
  // Notification Modal State
  const [completedOrder, setCompletedOrder] = useState<any>(null);
  const [refundNotification, setRefundNotification] = useState<any>(null);

  // Calculate Distance (Haversine Formula)
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // --- MISSING FUNCTIONS RESTORED ---

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const fetchShops = async () => {
    try {
      const { data } = await api.get('/shops');
      
      // Calculate distances if user geolocation is available
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const shopsWithDistance = data.map((shop: any) => {
               if(shop.location && shop.location.coordinates) {
                   const [sLat, sLng] = shop.location.coordinates;
                   return { ...shop, distance: getDistance(latitude, longitude, sLat, sLng) };
               }
               return { ...shop, distance: 9999 };
            });
            // Sort by distance
            setShops(shopsWithDistance.sort((a: any, b: any) => a.distance - b.distance));
            setLoadingShops(false);
          },
          (err) => {
            console.error("Loc Error", err);
            setShops(data); // Fallback without distance
            setLoadingShops(false);
          }
        );
      } else {
        setShops(data);
        setLoadingShops(false);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load shops');
      setLoadingShops(false);
    }
  };

  const fetchOrders = async () => {
     try {
        const { data } = await api.get('/orders/my'); // Corrected route
        setMyOrders(data);
     } catch (error) {
        console.error("Failed to fetch orders");
     }
  };

  useEffect(() => {
    fetchShops();
    fetchOrders();
    // Poll for orders every 30s
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectShop = (shop: any) => {
    setSelectedShop(shop);
    setCart([]); // Clear cart when switching shops
  };

  const handleClearShop = () => {
    setSelectedShop(null);
    setCart([]);
  };

  const handleUploadComplete = (fileData: any) => {
    setCart(prev => [
      ...prev,
      {
        storageKey: fileData.key,
        originalName: fileData.originalName,
        fileHash: fileData.fileHash,
        pageCount: fileData.pageCount || 1, // Default to 1 if detection fails
        previewUrl: fileData.previewUrl,
        fileType: fileData.mimetype,
        config: {
          color: 'bw',
          side: 'single',
          copies: 1,
          pageRange: 'All',
          orientation: 'portrait',
          paperSize: 'A4'
        }
      }
    ]);
    toast.success('File added to cart');
  };

  const updateConfig = (index: number, key: string, value: any) => {
    const newCart = [...cart];
    newCart[index].config = { ...newCart[index].config, [key]: value };
    setCart(newCart);
  };

  const calculateTotal = () => {
    if (!selectedShop) return 0;
    return cart.reduce((total, item) => {
      const rate = item.config.color === 'bw' 
        ? selectedShop.pricing.bw.single 
        : selectedShop.pricing.color.single;
      // Simple logic: rate * pages * copies. 
      // (Advanced logic for double-sided could be added here)
      return total + (rate * item.pageCount * item.config.copies);
    }, 0);
  };

  const handleScanResult = async (result: string) => {
     // Expected format: "SHOP:shop_id_here"
     if (result.startsWith("SHOP:")) {
        const shopId = result.split(":")[1];
        
        // 1. Try to find in local list
        const foundShop = shops.find(s => s._id === shopId);
        
        if (foundShop) {
           handleSelectShop(foundShop);
           setShowScanner(false);
           toast.success(`Joined ${foundShop.name}`);
        } else {
           // 2. If not found (e.g. shop list limited by distance), fetch specific shop
           try {
              toast.loading("Fetching shop details...");
              // We need a route for this, or just filter getAllShops? 
              // Better to use generic GET /shops/:id if available, or just GET /shops and find.
              // Let's assume GET /shops supports getting all and we filter, or we add a new endpoint.
              // Ideally: const { data } = await api.get(`/shops/${shopId}`);
              // But backend might not have public get-by-id. Let's check shopController.
              // shopController has getMyShop (private) and getAllShops (public).
              // We will just try to reload all shops and check again, or handle gracefully.
              
              // For now, let's just show error if not in list (simplest fix without backend change)
              // OR better: Just set the ID and let the UI try to render (might break if details missing).
              
              toast.dismiss();
              toast.error('Shop is too far or not listed. Refreshing...');
              await fetchShops(); 
              // Retry find after fetch
              // (This is tricky due to async state updates. User has to scan again).
           } catch(e) {
              toast.dismiss();
              toast.error('Could not find shop');
           }
        }
     }
  };

  const handleCancelOrder = async (orderId: string) => {
     if(!window.confirm('Are you sure you want to cancel this order? Refund will be initiated.')) return;
     
     try {
        await api.put(`/orders/${orderId}/cancel`);
        toast.success('Cancellation request sent');
        fetchOrders();
     } catch (error) {
        toast.error('Failed to cancel order');
     }
  };

  // Socket Listener for Notifications
  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');

    socket.emit('join_user', user?._id);


     socket.on('notification', (data: any) => {
        if (data.type === 'error') toast.error(data.message, { duration: 5000 });
        else toast(data.message, { icon: 'ℹ️', duration: 5000 });
     });

     const handleOrderUpdate = (updatedOrder: any) => {
        // 1. Check if this order belongs to the logged-in user
        const orderUserId = typeof updatedOrder.user === 'string' ? updatedOrder.user : updatedOrder.user?._id;
        
        if (user && orderUserId === user._id) {
            if (updatedOrder.orderStatus === 'READY') {
               toast.success(`Order #${updatedOrder._id.slice(-4)} is READY for pickup!`, { duration: 5000, icon: '🎉' });
            }
            if (updatedOrder.orderStatus === 'COMPLETED') {
               setCompletedOrder(updatedOrder);
            }
            if (updatedOrder.paymentStatus === 'REFUNDED') {
               setRefundNotification(updatedOrder);
            }
        }

        // 2. Update the list if it exists
        setMyOrders(prev => {
           const exists = prev.find(o => o._id === updatedOrder._id);
           if (exists) {
              return prev.map(o => o._id === updatedOrder._id ? updatedOrder : o);
           }
           return prev;
        });
     };

     socket.on('order_status_updated', handleOrderUpdate);
     socket.on('order_updated', handleOrderUpdate); 

     return () => { socket.disconnect(); };
  }, [user]);

  // ... (rest of code)

  const handleCheckout = async () => {
    if (cart.length === 0 || !selectedShop) return;
    
    const res = await loadRazorpay();
    if (!res) {
      toast.error('Razorpay SDK failed to load. Are you online?');
      return;
    }

    // Map cart items to match Backend Schema
    const orderItems = cart.map(item => {
       const rate = item.config.color === 'bw' 
          ? selectedShop.pricing.bw.single 
          : selectedShop.pricing.color.single;
       const cost = rate * item.pageCount * item.config.copies;
       
       return {
          ...item,
          calculatedCost: cost // <--- Added missing field
       };
    });

    try {
      // 1. Create Order in Backend
      const { data: order } = await api.post('/orders', {
        shopId: selectedShop._id,
        items: orderItems // <--- Send the mapped items
      });

      // 2. Init Payment in Backend
      const { data: paymentOrder } = await api.post('/orders/checkout', { orderId: order._id });

      // 3. Open Razorpay Options
      const options = {
        key: paymentOrder.keyId, 
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        name: "XeroxSaaS",
        description: `Print Order #${order._id.slice(-4)}`,
        order_id: paymentOrder.id,
        // Handle Success
        handler: async function (response: any) {
           try {
              const verifyRes = await api.post('/orders/verify', {
                 orderId: order._id,
                 razorpay_payment_id: response.razorpay_payment_id,
                 razorpay_order_id: response.razorpay_order_id,
                 razorpay_signature: response.razorpay_signature
              });
              
              if(verifyRes.data.status === 'success'){
                 toast.success('Payment Successful!');
                 setCart([]);
                 setShowMobileCart(false);
              }
           } catch (err) {
              toast.error('Payment Verification Failed');
           }
        },
        // Handle Dismissal (User closes popup)
        modal: {
          ondismiss: async function() {
             toast.error('Payment Cancelled');
             try {
                await api.put(`/orders/${order._id}/cancel`);
             } catch(e) { console.error('Failed to cancel order'); }
          }
        },
        prefill: {
          name: user?.name,
          email: user?.email,
        },
        theme: {
          color: "#3399cc"
        }
      };

      const paymentObject = new (window as any).Razorpay(options);
      
      // Handle Failure (e.g. Bank failure)
      paymentObject.on('payment.failed', async function (response: any){
          toast.error(response.error.description);
          try {
             await api.put(`/orders/${order._id}/cancel`); 
          } catch(e) { console.error('Failed to cancel order'); }
      });

      paymentObject.open();

    } catch (err: any) {
      toast.error('Order processing failed');
    }
  };

  // --- VIEW 1: SHOP SELECTION ---
  if (!selectedShop) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        {/* Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-20 shadow-sm transition-colors duration-300">
          <div className="flex justify-between items-center">
            <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2 dark:text-white">
              <Store className="text-primary" size={22} />
              <div className="flex flex-col">
                 <span className="hidden xs:inline">XeroxSaaS</span>
                 <span className="text-xs font-normal text-slate-500 dark:text-slate-400">Hi, {user?.name}</span>
              </div>
            </h1>

            {/* Desktop Actions */}
            <div className="hidden sm:flex gap-3 items-center">
               <button onClick={() => navigate('/support')} className="btn btn-ghost text-slate-500 hover:text-primary p-2" title="Customer Support">
                 <HelpCircle size={20} />
               </button>
               <button onClick={() => setShowOrdersModal(true)} className="btn btn-outline flex items-center gap-2 text-sm dark:text-white dark:border-slate-700 dark:hover:bg-slate-800">
                 <Clock size={16} /> My Orders
               </button>
               <button onClick={() => setShowScanner(true)} className="btn bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 flex items-center gap-2 text-sm shadow-sm">
                 <QrCode size={16} className="text-slate-900" /> Scan QR
               </button>
               <button onClick={() => { logout(); navigate('/login'); }} className="text-sm text-slate-500 hover:text-red-500 flex items-center gap-2">
                 <LogOut size={16} />
               </button>
            </div>

            {/* Mobile Actions */}
            <div className="flex sm:hidden gap-2 items-center">
               <button onClick={() => navigate('/support')} className="p-2 text-slate-500 hover:text-primary">
                 <HelpCircle size={20} />
               </button>
               <button onClick={() => setShowOrdersModal(true)} className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                 <Clock size={20} />
               </button>
               <button onClick={() => setShowScanner(true)} className="p-2 bg-white text-slate-900 border border-slate-200 rounded-lg shadow-sm">
                 <QrCode size={20} className="text-slate-900" />
               </button>
               <button onClick={() => { logout(); navigate('/login'); }} className="p-2 text-slate-500 hover:text-red-500">
                 <LogOut size={20} />
               </button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-4 sm:p-6">
          <div className="mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">Select a Print Shop</h2>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400">Choose a partner to start printing.</p>
          </div>

          {loadingShops ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={40} /></div>
          ) : shops.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              <p className="text-slate-500 dark:text-slate-400">No shops available right now.</p>
            </div>
          ) : (
            <>
            {/* Toggle View */}
            <div className="flex justify-end mb-4">
               <button onClick={() => setShowMap(!showMap)} className="btn btn-outline flex items-center gap-2 text-sm dark:text-white dark:border-slate-700 dark:hover:bg-slate-800 py-2 px-3">
                  {showMap ? <List size={16}/> : <MapIcon size={16}/>}
                  <span className="hidden xs:inline">{showMap ? 'List View' : 'Map View'}</span>
               </button>
            </div>

            {showMap ? (
               <div className="h-[400px] sm:h-[500px] md:h-[600px] rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-700 z-0">
                  <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%', width: '100%' }}>
                     <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                     />
                     {shops.map(shop => {
                        const [lat, lng] = shop.location?.coordinates || [0, 0];
                        if(lat === 0 && lng === 0) return null;
                        return (
                           <Marker key={shop._id} position={[lat, lng]}>
                              <Popup>
                                 <div className="min-w-[150px]">
                                    <h3 className="font-bold">{shop.name}</h3>
                                    <p className="text-xs text-slate-500 mb-2">{shop.address}</p>
                                    <button onClick={() => handleSelectShop(shop)} className="btn btn-primary btn-sm w-full">Select</button>
                                 </div>
                              </Popup>
                           </Marker>
                        )
                     })}
                  </MapContainer>
               </div>
            ) : (
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto pr-2 -mr-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {shops.map(shop => (
                <div key={shop._id} className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all cursor-pointer group" onClick={() => handleSelectShop(shop)}>
                  {/* Shop Image */}
                  {shop.image ? (
                     <div className="h-28 sm:h-32 w-full bg-cover bg-center rounded-xl mb-3 sm:mb-4" style={{backgroundImage: `url(${shop.image})`}} />
                  ) : (
                     <div className="h-28 sm:h-32 w-full bg-slate-100 dark:bg-slate-900 rounded-xl mb-3 sm:mb-4 flex items-center justify-center text-slate-300 dark:text-slate-600">
                        <Store size={36} />
                     </div>
                  )}

                  <div className="flex justify-between items-start mb-3 sm:mb-4">
                    <div className="flex-1 min-w-0 mr-2">
                      <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white group-hover:text-primary transition-colors truncate">{shop.name}</h3>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                        <MapPin size={12} />
                        <span className="truncate">{shop.address}</span>
                      </p>
                      {shop.distance !== undefined && (
                        <span className="text-xs font-bold text-primary">{shop.distance.toFixed(1)} km away</span>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border shrink-0
                      ${shop.status === 'OPEN' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-800' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900 dark:text-red-300 dark:border-red-800'}
                    `}>
                      {shop.status}
                    </span>
                  </div>

                  <div className="flex gap-3 sm:gap-4 text-sm mb-4 sm:mb-6 bg-slate-50 dark:bg-slate-700/30 p-2 sm:p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                    <div>
                      <span className="block text-slate-400 text-[10px] sm:text-xs uppercase font-bold">B&W</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">₹{shop.pricing?.bw?.single || 0}</span>
                    </div>
                    <div>
                      <span className="block text-slate-400 text-[10px] sm:text-xs uppercase font-bold">Color</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">₹{shop.pricing?.color?.single || 0}</span>
                    </div>
                  </div>

                  <button className="w-full btn btn-outline dark:text-white dark:border-slate-600 dark:hover:bg-primary dark:hover:text-black group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all flex items-center justify-center gap-2 py-2.5 text-sm">
                    Select <ArrowRight size={14} />
                  </button>
                </div>
                ))}
              </div>
            </div>
            )}
            </>
          )}
        </main>

        {/* Scanner Modal */}
        {showScanner && (
           <QRScanner 
             onScan={handleScanResult} 
             onClose={() => setShowScanner(false)} 
           />
        )}

        {/* My Orders Modal */}
        {showOrdersModal && (
           <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
              <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] sm:max-h-[80vh] overflow-hidden flex flex-col shadow-xl sm:m-4">
                 <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900 shrink-0">
                    <h3 className="font-bold text-lg dark:text-white">My Orders</h3>
                    <button onClick={() => setShowOrdersModal(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg dark:text-slate-400"><X size={20}/></button>
                 </div>
                 <div className="flex-1 overflow-auto p-4 space-y-3">
                    {myOrders.length === 0 ? <p className="text-center text-slate-400 py-10">No orders yet.</p> :
                       myOrders.map(order => (
                          <div key={order._id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 sm:p-4 dark:bg-slate-800">
                             <div className="flex justify-between items-start gap-2">
                               <div className="min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                     <span className="font-bold text-slate-800 dark:text-white">#{order._id.slice(-4)}</span>
                                     <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        order.orderStatus === 'QUEUED' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                                        order.orderStatus === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                        order.orderStatus === 'CANCELLED' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : 'bg-slate-100 dark:bg-slate-700'
                                     }`}>{order.orderStatus}</span>
                                  </div>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(order.createdAt).toLocaleString()} • ₹{order.totalAmount}</p>
                               </div>
                               {order.orderStatus === 'QUEUED' && (
                                  <button onClick={() => handleCancelOrder(order._id)} className="btn btn-outline text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 border-red-200 dark:border-red-900 text-xs py-1.5 px-2 shrink-0">
                                     Cancel
                                  </button>
                               )}
                             </div>
                          </div>
                       ))
                    }
                 </div>
              </div>
           </div>
        )}
        {/* Completion Modal */}
        {completedOrder && (
           <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-sm w-full text-center animate-in fade-in zoom-in shadow-2xl relative overflow-hidden">
                 {/* Confetti Background Effect (Optional/Simple) */}
                 <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-green-300 via-transparent to-transparent pointer-events-none" />

                 <div className="mx-auto w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-6 animate-bounce">
                    <CheckCircle size={40} className="text-green-600 dark:text-green-400" />
                 </div>
                 
                 <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Order Completed!</h2>
                 <p className="text-slate-500 dark:text-slate-400 mb-6">
                    Your order <span className="font-mono font-bold text-slate-800 dark:text-slate-200">#{completedOrder._id.slice(-4)}</span> has been fulfilled.
                    <br/>Thank you for printing with us!
                 </p>

                 <button 
                    onClick={() => setCompletedOrder(null)} 
                    className="w-full btn btn-primary py-3 text-lg font-bold shadow-lg hover:shadow-green-500/20"
                 >
                    Awesome, Thanks!
                 </button>
              </div>
           </div>
        )}
      </div>
    );
  }

  // --- VIEW 2: DASHBOARD (Shop Selected) ---
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 pb-20 lg:pb-0">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-20 shadow-sm transition-colors duration-300">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-4">
             <button onClick={handleClearShop} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400" title="Back to Shops">
               <ArrowLeft size={20} />
             </button>
             <div>
               <h1 className="text-base sm:text-xl font-bold flex items-center gap-2 dark:text-white">
                 <Store className="text-primary hidden sm:block" size={20} />
                 <span className="truncate max-w-[150px] sm:max-w-none">{selectedShop.name}</span>
               </h1>
               <p className="text-xs text-slate-400 hidden sm:block">Upload documents to print • {user?.name}</p>
             </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Desktop: Show shop rates */}
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg">
              <span className="font-bold text-slate-700 dark:text-slate-200">B&W ₹{selectedShop.pricing?.bw?.single}</span>
              <span>/</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">Color ₹{selectedShop.pricing?.color?.single}</span>
            </div>
            <button onClick={() => { logout(); navigate('/login'); }} className="text-sm text-slate-500 hover:text-red-500 flex items-center gap-2 dark:text-slate-400 dark:hover:text-red-400">
              <LogOut size={18} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">

        {/* Left: Upload & Config */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">

          {/* Mobile Rates Banner */}
          <div className="md:hidden flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
            <Info size={14}/>
            <span>Rates: <span className="font-bold text-slate-700 dark:text-slate-200">B&W ₹{selectedShop.pricing?.bw?.single}</span> / <span className="font-bold text-slate-700 dark:text-slate-200">Color ₹{selectedShop.pricing?.color?.single}</span></span>
          </div>

          <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="font-bold text-lg dark:text-white mb-4">Upload Documents</h2>
            <FileUpload onUploadComplete={handleUploadComplete} shopId={selectedShop._id} />
          </div>

          <div className="space-y-3 sm:space-y-4">
            {cart.map((item, idx) => (
              <div key={idx} className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">

                {/* File Header */}
                <div className="flex items-start justify-between mb-3 sm:mb-4 border-b border-slate-100 dark:border-slate-700 pb-3 sm:pb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 sm:p-3 bg-slate-100 dark:bg-slate-700 rounded-xl shrink-0">
                      <FileText size={20} className="text-slate-600 dark:text-slate-300" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-800 dark:text-white text-sm sm:text-lg truncate">{item.originalName}</h4>
                      <div className="flex items-center gap-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                        <span>Pages:</span>
                        <input
                          type="number"
                          readOnly
                          className="w-12 bg-slate-100 dark:bg-slate-900 text-center font-bold focus:outline-none dark:text-white rounded px-1 cursor-not-allowed text-slate-500"
                          value={item.pageCount}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1 shrink-0">
                    {item.previewUrl && (
                      <a href={item.previewUrl} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-primary-hover hover:bg-primary/5 rounded-lg transition-colors" title="Preview">
                        <Eye size={18} />
                      </a>
                    )}
                    <button onClick={() => {
                      const newCart = [...cart];
                      newCart.splice(idx, 1);
                      setCart(newCart);
                    }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Configuration Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                  <div>
                    <label className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1 block">Color</label>
                    <select
                      className="w-full input-field py-2 text-xs sm:text-sm dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                      value={item.config.color}
                      onChange={(e) => updateConfig(idx, 'color', e.target.value)}
                    >
                      <option value="bw">B&W</option>
                      <option value="color">Color</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1 block">Sides</label>
                    <select
                      className="w-full input-field py-2 text-xs sm:text-sm dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                      value={item.config.side}
                      onChange={(e) => updateConfig(idx, 'side', e.target.value)}
                    >
                      <option value="single">Single</option>
                      <option value="double">Double</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1 block">Orientation</label>
                    <select
                      className="w-full input-field py-2 text-xs sm:text-sm dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                      value={item.config.orientation}
                      onChange={(e) => updateConfig(idx, 'orientation', e.target.value)}
                    >
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1 block">Size</label>
                    <select
                      className="w-full input-field py-2 text-xs sm:text-sm dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                      value={item.config.paperSize}
                      onChange={(e) => updateConfig(idx, 'paperSize', e.target.value)}
                    >
                      <option value="A4">A4</option>
                      <option value="A3">A3</option>
                      <option value="A2">A2</option>
                      <option value="A1">A1</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1 block">Page Range</label>
                    <input
                      type="text"
                      className="w-full input-field py-2 text-xs sm:text-sm dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                      placeholder="All"
                      value={item.config.pageRange}
                      onChange={(e) => updateConfig(idx, 'pageRange', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1 block">Copies</label>
                    <input
                      type="number"
                      min="1"
                      className="w-full input-field py-2 text-xs sm:text-sm dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                      value={item.config.copies}
                      onChange={(e) => updateConfig(idx, 'copies', parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>
              </div>
            ))}

            {cart.length === 0 && (
              <div className="text-center py-10 sm:py-12 text-slate-400 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                <FileText size={40} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm sm:text-base">Upload documents to get started</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Checkout Summary - Desktop */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 sticky top-24">
            <h3 className="font-bold text-xl mb-6 flex items-center gap-2 dark:text-white">
              <ShoppingCart className="text-primary" /> Order Summary
            </h3>

            <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto pr-2">
              {cart.map((item, i) => (
                <div key={i} className="flex justify-between items-start text-sm pb-4 border-b border-slate-50 dark:border-slate-700 last:border-0">
                  <div className="w-2/3">
                    <p className="font-medium text-slate-800 dark:text-white truncate">{item.originalName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {item.config.color === 'color' ? 'Color' : 'B&W'} • {item.config.paperSize} • {item.config.orientation} • {item.config.copies}x
                    </p>
                  </div>
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                     ₹{((item.config.color === 'bw' ? selectedShop.pricing?.bw?.single : selectedShop.pricing?.color?.single) * item.pageCount * item.config.copies).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-4 mt-auto">
              <div className="flex justify-between items-center mb-6">
                <span className="text-slate-500 dark:text-slate-400">Total</span>
                <span className="text-3xl font-bold text-slate-900 dark:text-white">₹{calculateTotal().toFixed(2)}</span>
              </div>

              <button
                onClick={handleCheckout}
                disabled={cart.length === 0}
                className="w-full btn btn-primary font-bold text-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Pay & Print
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Floating Cart Button */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shadow-lg z-30">
          <button
            onClick={() => setShowMobileCart(true)}
            className="w-full btn btn-primary font-bold text-base flex items-center justify-center gap-3 py-3"
          >
            <ShoppingCart size={20} />
            <span>View Cart ({cart.length})</span>
            <span className="bg-white/20 px-3 py-1 rounded-lg">₹{calculateTotal().toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Mobile Cart Modal */}
      {showMobileCart && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="bg-white dark:bg-slate-800 rounded-t-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-xl">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900 shrink-0">
              <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                <ShoppingCart className="text-primary" size={20} /> Order Summary
              </h3>
              <button onClick={() => setShowMobileCart(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg dark:text-slate-400">
                <X size={20}/>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3">
              {cart.map((item, i) => (
                <div key={i} className="flex justify-between items-start text-sm pb-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="font-medium text-slate-800 dark:text-white truncate">{item.originalName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {item.config.color === 'color' ? 'Color' : 'B&W'} • {item.config.paperSize} • {item.config.orientation} • {item.config.copies}x copy
                    </p>
                  </div>
                  <span className="font-bold text-slate-700 dark:text-slate-200 shrink-0">
                     ₹{((item.config.color === 'bw' ? selectedShop.pricing?.bw?.single : selectedShop.pricing?.color?.single) * item.pageCount * item.config.copies).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 shrink-0">
              <div className="flex justify-between items-center mb-4">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Total Amount</span>
                <span className="text-2xl font-bold text-slate-900 dark:text-white">₹{calculateTotal().toFixed(2)}</span>
              </div>
              <button
                onClick={handleCheckout}
                className="w-full btn btn-primary font-bold text-lg py-3"
              >
                Pay & Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completion Modal (Global for View 2) */}
      {completedOrder && (
          <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-sm w-full text-center animate-in fade-in zoom-in shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-green-300 via-transparent to-transparent pointer-events-none" />
                <div className="mx-auto w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-6 animate-bounce">
                  <CheckCircle size={40} className="text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Order Completed!</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">
                  Your order <span className="font-mono font-bold text-slate-800 dark:text-slate-200">#{completedOrder._id.slice(-4)}</span> has been fulfilled.
                  <br/>Thank you for printing with us!
                </p>
                <button onClick={() => setCompletedOrder(null)} className="w-full btn btn-primary py-3 text-lg font-bold shadow-lg hover:shadow-green-500/20">Awesome, Thanks!</button>
            </div>
          </div>
      )}

      {/* Refund Notification Modal */}
      {refundNotification && (
          <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-sm w-full text-center animate-in fade-in zoom-in shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-300 via-transparent to-transparent pointer-events-none" />
                <div className="mx-auto w-20 h-20 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-6">
                  <Info size={40} className="text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Refund Initiated</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">
                  Your order <span className="font-mono font-bold text-slate-800 dark:text-slate-200">#{refundNotification._id.slice(-4)}</span> was cancelled.
                  <br/>A full refund has been processed to your source account.
                </p>
                <button onClick={() => setRefundNotification(null)} className="w-full btn btn-outline border-slate-200 dark:border-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 py-3 text-lg font-bold">Close</button>
            </div>
          </div>
      )}
    </div>
  );
}

export default UserDashboard;
