import { useState, useContext, useEffect, useRef } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import FileUpload from '../components/FileUpload';
import UploadProgressModal from '../components/UploadProgressModal';
import DocumentConfigurator from '../components/DocumentConfigurator';
import CartPage from '../components/CartPage';
import QRScanner from '../components/QRScanner';
import toast from 'react-hot-toast';
import { Store, LogOut, FileText, MapPin, ArrowRight, Loader2, Info, QrCode, X, ArrowLeft, Clock, List, Map as MapIcon, CheckCircle, HelpCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { io } from 'socket.io-client';
import type { ConfiguratorItem } from '../components/DocumentConfigurator';
import type { UploadedFile } from '../components/FileUpload';

// Cart persistence key
const CART_STORAGE_KEY = 'xerox_cart';
const SHOP_STORAGE_KEY = 'xerox_selected_shop';

const UserDashboard = () => {
  const { user, logout } = useContext(AuthContext)!;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [shops, setShops] = useState<any[]>([]);
  const [loadingShops, setLoadingShops] = useState(true);
  const [selectedShop, setSelectedShop] = useState<any>(null);

  // Multi-step flow: 'upload' | 'configure' | 'cart'
  const [step, setStep] = useState<'upload' | 'configure' | 'cart'>('upload');

  // Items being configured (before adding to cart)
  const [configuringItems, setConfiguringItems] = useState<ConfiguratorItem[]>([]);

  // Final cart items (after "Add to Cart")
  const [cart, setCart] = useState<ConfiguratorItem[]>([]);

  const [showScanner, setShowScanner] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  
  // Upload progress state
  const [showUploadProgress, setShowUploadProgress] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, percent: 0 });

  // Notification Modal State
  const [completedOrder, setCompletedOrder] = useState<any>(null);
  const [refundNotifications, setRefundNotifications] = useState<any[]>([]);

  // Processing guard (prevents double-clicks)
  const [isProcessing, setIsProcessing] = useState(false);

  // File input ref for "Add files" in configurator
  const addFilesInputRef = useRef<HTMLInputElement>(null);

  // --- Cart Persistence ---
  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      const savedShop = localStorage.getItem(SHOP_STORAGE_KEY);
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCart(parsed);
        }
      }
      if (savedShop) {
        const parsedShop = JSON.parse(savedShop);
        if (parsedShop && parsedShop._id) {
          setSelectedShop(parsedShop);
        }
      }
    } catch (e) {
      // Silently ignore corrupted data
      localStorage.removeItem(CART_STORAGE_KEY);
      localStorage.removeItem(SHOP_STORAGE_KEY);
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    try {
      if (cart.length > 0) {
        // Strip previewUrl before saving (can't persist blob URLs)
        const cartToSave = cart.map(item => ({
          ...item,
          previewUrl: undefined,
        }));
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartToSave));
      } else {
        localStorage.removeItem(CART_STORAGE_KEY);
      }
    } catch (e) {
      // Silently ignore
    }
  }, [cart]);

  // Save selected shop to localStorage
  useEffect(() => {
    try {
      if (selectedShop) {
        localStorage.setItem(SHOP_STORAGE_KEY, JSON.stringify(selectedShop));
      } else {
        localStorage.removeItem(SHOP_STORAGE_KEY);
      }
    } catch (e) {
      // Silently ignore
    }
  }, [selectedShop]);

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
      
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const shopsWithDistance = data.map((shop: any) => {
               if(shop.location && shop.location.coordinates) {
                   const [sLng, sLat] = shop.location.coordinates;
                   return { ...shop, distance: getDistance(latitude, longitude, sLat, sLng) };
               }
               return { ...shop, distance: 9999 };
            });
            setShops(shopsWithDistance.sort((a: any, b: any) => a.distance - b.distance));
            setLoadingShops(false);
          },
          (_err) => {
            setShops(data);
            setLoadingShops(false);
          }
        );
      } else {
        setShops(data);
        setLoadingShops(false);
      }
    } catch (_err) {
      toast.error('Failed to load shops');
      setLoadingShops(false);
    }
  };

  const fetchOrders = async () => {
     try {
        const { data } = await api.get('/orders/my');
        setMyOrders(data);
     } catch (_error) {
        console.error("Failed to fetch orders");
     }
  };

  useEffect(() => {
    fetchShops();
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectShop = (shop: any) => {
    setSelectedShop(shop);
    setStep('upload');
    setConfiguringItems([]);
    // Don't clear cart — persist across shop changes only if same shop
    // But clear if different shop
    if (cart.length > 0) {
      const existingShopId = localStorage.getItem(SHOP_STORAGE_KEY);
      try {
        const parsed = existingShopId ? JSON.parse(existingShopId) : null;
        if (parsed?._id !== shop._id) {
          setCart([]);
        }
      } catch {
        setCart([]);
      }
    }
  };

  useEffect(() => {
      // 1. Handle Razorpay Redirects
      const successParam = searchParams.get('success');
      const errorParam = searchParams.get('error');

      if (successParam === 'true') {
        toast.success('Payment Successful! Order sent to shop.');
        setCart([]);
        setStep('upload');
        localStorage.removeItem(CART_STORAGE_KEY);
        setSearchParams({}, { replace: true });
        fetchOrders();
        return; // Don't process shopId logic below
      } else if (errorParam) {
        toast.error(`Payment Failed: ${errorParam}`);
        setSearchParams({}, { replace: true });
        return;
      }

      // 2. Handle QR Shop Scan Redirect
      const shopId = searchParams.get('shopId');
    if (!shopId) return;
    if (loadingShops) return;

    const selectShopFromParam = async () => {
      const foundShop = shops.find(s => s._id === shopId);
      if (foundShop) {
         if (foundShop.status === 'CLOSED') {
            toast.error(`Shop '${foundShop.name}' is currently CLOSED.`);
            setSearchParams({}, { replace: true });
            return;
         }
         handleSelectShop(foundShop);
         toast.success(`Joined ${foundShop.name}`);
         setSearchParams({}, { replace: true });
      } else {
         try {
            toast.loading("Fetching shop details...");
            const { data: shop } = await api.get(`/shops/qr/${shopId}`);
            toast.dismiss();
            if (shop) {
               const status = shop.status?.toUpperCase();
               if (status === 'CLOSED') {
                  toast.error(`Shop '${shop.name}' is currently CLOSED.`);
               } else {
                  handleSelectShop(shop);
                  toast.success(`Joined ${shop.name}`);
               }
            } else {
               toast.error('Shop not found');
            }
         } catch (_e) {
            toast.dismiss();
            toast.error("Failed to load shop");
         } finally {
            setSearchParams({}, { replace: true });
         }
      }
    };

    selectShopFromParam();
  }, [searchParams, loadingShops, shops, setSearchParams]);

  const handleClearShop = () => {
    setSelectedShop(null);
    setCart([]);
    setConfiguringItems([]);
    setStep('upload');
    localStorage.removeItem(CART_STORAGE_KEY);
    localStorage.removeItem(SHOP_STORAGE_KEY);
  };

  // --- Upload Handlers ---
  const handleUploadComplete = (files: UploadedFile[]) => {
    const newItems: ConfiguratorItem[] = files.map(fileData => ({
        storageKey: fileData.storageKey,
        originalName: fileData.originalName,
        fileHash: fileData.fileHash,
        pageCount: fileData.pageCount || 1,
        previewUrl: fileData.previewUrl,
        fileType: fileData.fileType,
        mimeType: fileData.mimeType,
        config: {
          color: 'bw' as const,
          side: 'single' as const,
          copies: 1,
          pageRange: 'All',
          orientation: 'portrait' as const,
          paperSize: 'A4' as const
        }
    }));
    
    setConfiguringItems(prev => [...prev, ...newItems]);
    setStep('configure');
    setShowUploadProgress(false);
    toast.success(`${files.length} file(s) ready to configure`);
  };

  const handleUploadProgress = (current: number, total: number, percent: number) => {
    setUploadProgress({ current, total, percent });
  };

  const handleUploadStart = () => {
    setShowUploadProgress(true);
    setUploadProgress({ current: 0, total: 0, percent: 0 });
  };

  const handleUploadEnd = () => {
    // Small delay so user sees 100%
    setTimeout(() => {
      setShowUploadProgress(false);
    }, 500);
  };

  // --- Configurator Handlers ---
  const handleAddToCart = (configuredItems: ConfiguratorItem[]) => {
    setCart(prev => [...prev, ...configuredItems]);
    setConfiguringItems([]);
    setStep('cart');
    toast.success(`${configuredItems.length} item(s) added to cart`);
  };

  const handleRemoveFromCart = (index: number) => {
    setCart(prev => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleRemoveConfiguringItem = (index: number) => {
    setConfiguringItems(prev => {
      const updated = [...prev];
      updated.splice(index, 1);
      if (updated.length === 0) {
        setStep('upload');
      }
      return updated;
    });
  };

  // Hidden file input for "Add files" from configurator
  const handleAddFilesFromConfigurator = () => {
    addFilesInputRef.current?.click();
  };

  const handleAdditionalFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const files = Array.from(e.target.files);
    const validTypes = [
      'application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv', 'image/png', 'image/jpeg'
    ];
    const validFiles = files.filter(f => validTypes.includes(f.type));
    if (validFiles.length === 0) {
      toast.error('No supported files selected');
      return;
    }

    setShowUploadProgress(true);
    setUploadProgress({ current: 0, total: validFiles.length, percent: 0 });

    try {
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        setUploadProgress({ current: i, total: validFiles.length, percent: Math.round((i / validFiles.length) * 100) });

        const formData = new FormData();
        formData.append('file', file);
        if (selectedShop?._id) formData.append('shopId', selectedShop._id);

        const { data } = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        const objectUrl = URL.createObjectURL(file);

        const newItem: ConfiguratorItem = {
          storageKey: data.storageKey,
          originalName: data.originalName,
          fileHash: data.fileHash,
          pageCount: data.pageCount || 1,
          previewUrl: objectUrl,
          fileType: data.fileType,
          mimeType: file.type,
          config: {
            color: 'bw', side: 'single', copies: 1,
            pageRange: 'All', orientation: 'portrait', paperSize: 'A4'
          }
        };

        setConfiguringItems(prev => [...prev, newItem]);
        setUploadProgress({ current: i + 1, total: validFiles.length, percent: Math.round(((i + 1) / validFiles.length) * 100) });
      }
      toast.success(`${validFiles.length} file(s) added`);
    } catch (_err) {
      toast.error('Failed to upload additional files');
    } finally {
      setShowUploadProgress(false);
      e.target.value = '';
    }
  };

  const calculateTotal = () => {
    if (!selectedShop) return 0;
    return cart.reduce((total, item) => {
      const size = item.config.paperSize;
      const isColor = item.config.color === 'color';
      const isDouble = item.config.side === 'double';

      let rate = 0;
      if (size !== 'A4' && selectedShop.pricing?.otherSizes?.[size]) {
        const sizeP = selectedShop.pricing.otherSizes[size];
        rate = isColor ? sizeP.color : sizeP.bw;
      } else if (isColor) {
        rate = isDouble ? selectedShop.pricing?.color?.double : selectedShop.pricing?.color?.single;
      } else {
        rate = isDouble ? selectedShop.pricing?.bw?.double : selectedShop.pricing?.bw?.single;
      }
      return total + (rate * item.pageCount * item.config.copies);
    }, 0);
  };

  const handleScanResult = async (result: string) => {
     let shopId = '';
     if (result.startsWith("SHOP:")) {
        shopId = result.split(":")[1];
     } else {
        try {
           const url = new URL(result);
           const params = new URLSearchParams(url.search);
           const id = params.get('shopId');
           if (id) {
              shopId = id;
           }
        } catch (e) {
           if (result.includes('shopId=')) {
              const matches = result.match(/[?&]shopId=([^&]+)/);
              if (matches && matches[1]) {
                 shopId = matches[1];
              }
           }
        }
     }

     if (!shopId) {
        toast.error("Invalid QR Code scanned.");
        return;
     }

     const foundShop = shops.find(s => s._id === shopId);
     
     if (foundShop) {
        if (foundShop.status === 'CLOSED') {
           toast.error(`Shop '${foundShop.name}' is currently CLOSED.`);
           setShowScanner(false);
           return;
        }
        handleSelectShop(foundShop);
        setShowScanner(false);
        toast.success(`Joined ${foundShop.name}`);
     } else {
        try {
           toast.loading("Fetching shop details...");
           const { data: shop } = await api.get(`/shops/qr/${shopId}`);
           toast.dismiss();
           if (shop) {
              const status = shop.status?.toUpperCase();
              if (status === 'CLOSED') {
                 toast.error(`Shop '${shop.name}' is currently CLOSED.`);
                 setShowScanner(false);
                 return;
              }
              handleSelectShop(shop);
              setShowScanner(false);
              toast.success(`Joined ${shop.name}`);
           } else {
              toast.error('Shop not found');
           }
        } catch (_e) {
           toast.dismiss();
           toast.error('Could not find shop. It might be closed.');
        }
     }
  };

  const handleCancelOrder = async (orderId: string) => {
     if(!window.confirm('Are you sure you want to cancel this order? Refund will be initiated.')) return;
     try {
        await api.put(`/orders/${orderId}/cancel`);
        toast.success('Cancellation request sent');
        fetchOrders();
     } catch (_error) {
        toast.error('Failed to cancel order');
     }
  };

  // Socket Listener for Notifications
  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
      auth: { token: sessionStorage.getItem('token') },
    });
    socket.emit('join_user', user?._id);

     socket.on('notification', (data: any) => {
        if (data.type === 'error') toast.error(data.message, { duration: 5000 });
        else toast(data.message, { icon: 'ℹ️', duration: 5000 });
     });

     const handleOrderUpdate = (updatedOrder: any) => {
        const orderUserId = typeof updatedOrder.user === 'string' ? updatedOrder.user : updatedOrder.user?._id;
        
        if (user && orderUserId === user._id) {
            if (updatedOrder.orderStatus === 'READY') {
               toast.success(`Order #${updatedOrder._id.slice(-4)} is READY for pickup!`, { duration: 5000, icon: '🎉' });
            }
            if (updatedOrder.orderStatus === 'COMPLETED') {
               setCompletedOrder(updatedOrder);
            }
            if (updatedOrder.paymentStatus === 'REFUNDED') {
               setRefundNotifications(prev => [...prev, updatedOrder]);
            }
        }

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

  // --- CHECKOUT (Razorpay) ---
  const handleCheckout = async () => {
    if (cart.length === 0 || !selectedShop || isProcessing) return;
    setIsProcessing(true);
    
    const total = calculateTotal();
    if (total < 1) {
      toast.error('Order total must be at least ₹1');
      return;
    }

    const res = await loadRazorpay();
    if (!res) {
      toast.error('Razorpay SDK failed to load. Are you online?');
      return;
    }

    const orderItems = cart.map(item => {
       const size = item.config.paperSize;
       const isColor = item.config.color === 'color';
       const isDouble = item.config.side === 'double';

       let rate = 0;
       if (size !== 'A4' && selectedShop.pricing?.otherSizes?.[size]) {
         const sizeP = selectedShop.pricing.otherSizes[size];
         rate = isColor ? sizeP.color : sizeP.bw;
       } else if (isColor) {
         rate = isDouble ? selectedShop.pricing?.color?.double : selectedShop.pricing?.color?.single;
       } else {
         rate = isDouble ? selectedShop.pricing?.bw?.double : selectedShop.pricing?.bw?.single;
       }
       const cost = rate * item.pageCount * item.config.copies;
       
       return {
          ...item,
          previewUrl: undefined, // Don't send blob URLs to server
          calculatedCost: cost
       };
    });

    try {
      const { data: order } = await api.post('/orders', {
        shopId: selectedShop._id,
        items: orderItems
      });

      const { data: paymentOrder } = await api.post('/orders/checkout', { orderId: order._id });

      const options = {
        key: paymentOrder.keyId, 
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        name: "XeroxSaaS",
        description: `Print Order #${order._id.slice(-4)}`,
        order_id: paymentOrder.id,
        handler: async function (response: any) {
           try {
              const verifyRes = await api.post('/orders/verify', {
                 orderId: order._id,
                 razorpay_payment_id: response.razorpay_payment_id,
                 razorpay_order_id: response.razorpay_order_id,
                 razorpay_signature: response.razorpay_signature
              });
              
              if(verifyRes.data.status === 'success'){
                 toast.success('Payment Successful! Order sent to shop.');
                 setCart([]);
                 setStep('upload');
                 localStorage.removeItem(CART_STORAGE_KEY);
                 fetchOrders();
              }
           } catch (_err) {
              toast.error('Payment Verification Failed');
           } finally {
              setIsProcessing(false);
           }
        },
        modal: {
          ondismiss: async function() {
             toast.error('Payment Cancelled');
             setIsProcessing(false);
             try {
                await api.put(`/orders/${order._id}/cancel`);
             } catch (_e) { console.error('Failed to cancel order'); }
          }
        },
        prefill: {
          name: user?.name,
          email: user?.email,
        },
        theme: {
          color: "#16a34a"
        }
      };

      const paymentObject = new (window as any).Razorpay(options);
      
      paymentObject.on('payment.failed', async function (response: any){
          toast.error(response.error.description);
          setIsProcessing(false);
          try {
             await api.put(`/orders/${order._id}/cancel`); 
          } catch (_e) { console.error('Failed to cancel order'); }
      });

      paymentObject.open();

    } catch (_err) {
      toast.error('Order processing failed');
      setIsProcessing(false);
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
                 <button onClick={() => { logout(); navigate('/login'); }} className="text-xs font-normal text-slate-500 dark:text-slate-400 hover:text-red-500 transition-colors text-left flex items-center gap-1" title="Click to Logout">
                   Hi, {user?.name} <LogOut size={10} />
                 </button>
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
                        const [lng, lat] = shop.location?.coordinates || [0, 0];
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
                                     <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-slate-900 text-slate-900 dark:border-slate-300 dark:text-slate-300">{order.orderStatus}</span>
                                  </div>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(order.createdAt).toLocaleString([], { hour: 'numeric', minute: '2-digit', hour12: true, month: 'short', day: 'numeric' })} • ₹{order.totalAmount}</p>
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

  // --- VIEW 2: SHOP SELECTED — MULTI-STEP FLOW ---

  // Step: Configure
  if (step === 'configure' && configuringItems.length > 0) {
    return (
      <>
        <DocumentConfigurator
          items={configuringItems}
          shopPricing={selectedShop.pricing}
          onBack={() => {
            if (configuringItems.length > 0) {
              if (window.confirm('Go back? Your current configuration will be lost.')) {
                setConfiguringItems([]);
                setStep('upload');
              }
            } else {
              setStep('upload');
            }
          }}
          onAddFiles={handleAddFilesFromConfigurator}
          onAddToCart={handleAddToCart}
          onRemoveItem={handleRemoveConfiguringItem}
          onUpdateItems={setConfiguringItems}
        />
        {/* Hidden file input for adding files from configurator */}
        <input
          ref={addFilesInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.png,.jpg,.jpeg"
          onChange={handleAdditionalFiles}
        />
        {/* Upload progress overlay */}
        {showUploadProgress && (
          <UploadProgressModal
            current={uploadProgress.current}
            total={uploadProgress.total}
            percent={uploadProgress.percent}
            onCancel={() => setShowUploadProgress(false)}
          />
        )}
        {/* Completion Modal */}
        {completedOrder && (
           <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
                 <div className="mx-auto w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-6 animate-bounce">
                    <CheckCircle size={40} className="text-green-600 dark:text-green-400" />
                 </div>
                 <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Order Completed!</h2>
                 <p className="text-slate-500 dark:text-slate-400 mb-6">
                    Your order <span className="font-mono font-bold">#{completedOrder._id.slice(-4)}</span> has been fulfilled.
                 </p>
                 <button onClick={() => setCompletedOrder(null)} className="w-full btn btn-primary py-3 text-lg font-bold">Awesome!</button>
              </div>
           </div>
        )}
        {refundNotifications.length > 0 && (
           <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
                 <div className="mx-auto w-20 h-20 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-6">
                    <Info size={40} className="text-red-600 dark:text-red-400" />
                 </div>
                 <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Refund Initiated</h2>
                 <p className="text-slate-500 dark:text-slate-400 mb-6">
                    Order <span className="font-mono font-bold">#{refundNotifications[0]._id.slice(-4)}</span> was cancelled. Refund processed.
                 </p>
                 <button onClick={() => setRefundNotifications(prev => prev.slice(1))} className="w-full btn btn-outline py-3 text-lg font-bold">Close</button>
              </div>
           </div>
        )}
      </>
    );
  }

  // Step: Cart
  if (step === 'cart') {
    return (
      <>
        <CartPage
          items={cart}
          shopName={selectedShop.name}
          shopPricing={selectedShop.pricing}
          onBack={() => setStep('upload')}
          onRemoveItem={handleRemoveFromCart}
          onConfirmPay={handleCheckout}
          isProcessing={isProcessing}
        />
        {completedOrder && (
           <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
                 <div className="mx-auto w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-6 animate-bounce">
                    <CheckCircle size={40} className="text-green-600 dark:text-green-400" />
                 </div>
                 <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Order Completed!</h2>
                 <p className="text-slate-500 dark:text-slate-400 mb-6">
                    Your order <span className="font-mono font-bold">#{completedOrder._id.slice(-4)}</span> has been fulfilled.
                 </p>
                 <button onClick={() => setCompletedOrder(null)} className="w-full btn btn-primary py-3 text-lg font-bold">Awesome!</button>
              </div>
           </div>
        )}
        {refundNotifications.length > 0 && (
           <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
                 <div className="mx-auto w-20 h-20 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-6">
                    <Info size={40} className="text-red-600 dark:text-red-400" />
                 </div>
                 <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Refund Initiated</h2>
                 <p className="text-slate-500 dark:text-slate-400 mb-6">
                    Order <span className="font-mono font-bold">#{refundNotifications[0]._id.slice(-4)}</span> was cancelled. Refund processed.
                 </p>
                 <button onClick={() => setRefundNotifications(prev => prev.slice(1))} className="w-full btn btn-outline py-3 text-lg font-bold">Close</button>
              </div>
           </div>
        )}
      </>
    );
  }

  // Step: Upload (default)
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
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg">
              <span className="font-bold text-slate-700 dark:text-slate-200">B&W ₹{selectedShop.pricing?.bw?.single}</span>
              <span>/</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">Color ₹{selectedShop.pricing?.color?.single}</span>
            </div>
            <button onClick={() => setShowOrdersModal(true)} className="p-2 text-slate-500 hover:text-primary rounded-lg" title="My Orders">
              <Clock size={20} />
            </button>
            <button onClick={() => { logout(); navigate('/login'); }} className="text-sm text-slate-500 hover:text-red-500 flex items-center gap-2 dark:text-slate-400 dark:hover:text-red-400">
              <LogOut size={18} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">

        {/* Mobile Rates Banner */}
        <div className="md:hidden flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
          <Info size={14}/>
          <span>Rates: <span className="font-bold text-slate-700 dark:text-slate-200">B&W ₹{selectedShop.pricing?.bw?.single}</span> / <span className="font-bold text-slate-700 dark:text-slate-200">Color ₹{selectedShop.pricing?.color?.single}</span></span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-lg dark:text-white mb-4">Upload Documents</h2>
          <FileUpload 
            onUploadComplete={handleUploadComplete} 
            onProgress={handleUploadProgress}
            onUploadStart={handleUploadStart}
            onUploadEnd={handleUploadEnd}
            shopId={selectedShop._id} 
          />
        </div>

        {/* Show existing cart items count */}
        {cart.length > 0 && (
          <div 
            onClick={() => setStep('cart')}
            className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-green-200 dark:border-green-800 shadow-sm cursor-pointer hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-xl flex items-center justify-center">
                  <FileText size={20} className="text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-white">{cart.length} item{cart.length > 1 ? 's' : ''} in cart</p>
                  <p className="text-xs text-slate-400">₹{calculateTotal().toFixed(0)} total</p>
                </div>
              </div>
              <button className="btn-add-to-cart py-2.5 px-4 text-sm">
                View Cart <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {cart.length === 0 && (
          <div className="text-center py-10 sm:py-12 text-slate-400 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
            <FileText size={40} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm sm:text-base">Upload documents to get started</p>
          </div>
        )}
      </main>

      {/* Upload Progress Modal */}
      {showUploadProgress && (
        <UploadProgressModal
          current={uploadProgress.current}
          total={uploadProgress.total}
          percent={uploadProgress.percent}
          onCancel={() => setShowUploadProgress(false)}
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
                           <div className="flex justify-between items-start mb-3 sm:mb-4">
                              <div className="flex items-center gap-2">
                                 <span className="font-mono font-bold text-slate-800 dark:text-slate-200">#{order._id.slice(-4)}</span>
                                 <span className="px-2.5 py-1 rounded-full text-xs font-bold border border-slate-900 text-slate-900 dark:border-slate-300 dark:text-slate-300">
                                    {order.orderStatus}
                                 </span>
                              </div>
                              <div className="text-right">
                                 <p className="font-bold text-slate-900 dark:text-white mb-0.5 text-sm sm:text-base">₹{order.totalAmount.toFixed(2)}</p>
                                 <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(order.createdAt).toLocaleString([], { hour: 'numeric', minute: '2-digit', hour12: true, month: 'short', day: 'numeric' })}</p>
                              </div>
                           </div>
                           {order.orderStatus === 'QUEUED' && (
                              <button onClick={() => handleCancelOrder(order._id)} className="btn btn-outline text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 border-red-200 dark:border-red-900 text-xs py-1.5 px-2 w-full mt-2">
                                 Cancel Order
                              </button>
                           )}
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
      {/* Refund Notification Modal */}
      {refundNotifications.length > 0 && (
          <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-sm w-full text-center animate-in fade-in zoom-in shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-300 via-transparent to-transparent pointer-events-none" />
                <div className="mx-auto w-20 h-20 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-6">
                  <Info size={40} className="text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Refund Initiated</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">
                  Your order <span className="font-mono font-bold text-slate-800 dark:text-slate-200">#{refundNotifications[0]._id.slice(-4)}</span> was cancelled.
                  <br/>A full refund has been processed to your source account.
                </p>
                <button onClick={() => setRefundNotifications(prev => prev.slice(1))} className="w-full btn btn-outline border-slate-200 dark:border-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 py-3 text-lg font-bold">Close</button>
            </div>
          </div>
      )}
    </div>
  );
}

export default UserDashboard;
