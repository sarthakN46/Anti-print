import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, AlertCircle, X, Image as ImageIcon, List, CheckCircle, Ban } from 'lucide-react';
import toast from 'react-hot-toast';

interface ScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

const QRScanner = ({ onScan, onClose }: ScannerProps) => {
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    checkInitialPermission();

    return () => {
       mountedRef.current = false;
       cleanupScanner();
    };
  }, []);

  // 2. Effect: Initialize Scanner when isScanning becomes true
  useEffect(() => {
    if (isScanning && !scannerRef.current) {
        initializeScanner();
    }
  }, [isScanning]);

  const cleanupScanner = async () => {
      if (scannerRef.current) {
          try {
              if (scannerRef.current.isScanning) {
                  await scannerRef.current.stop();
              }
              await scannerRef.current.clear(); 
          } catch (e) {
              console.warn("Failed to stop/clear scanner", e);
          }
          scannerRef.current = null;
      }
  };

  const checkInitialPermission = async () => {
    try {
      // @ts-ignore
      const permissionStatus = await navigator.permissions.query({ name: 'camera' });
      if (permissionStatus.state === 'granted') {
         setIsScanning(true); // This triggers the 2nd useEffect
      } else if (permissionStatus.state === 'denied') {
         setPermissionDenied(true);
         setError("Camera permission is denied. Please enable it in browser settings.");
      } else {
         setShowPermissionPrompt(true);
      }
    } catch (e) {
       // Firefox/Safari might not support query, just show prompt
       setShowPermissionPrompt(true);
    }
  };

  const initializeScanner = async () => {
     // Safety delay to ensure DOM is painted
     await new Promise(res => setTimeout(res, 100));
     
     if (!mountedRef.current) return;
     if (!document.getElementById("reader")) return;

     try {
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;
        
        await html5QrCode.start(
           { facingMode: "environment" }, 
           { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
             // Success
             cleanupScanner().then(() => onScan(decodedText));
          },
          () => { /* ignore frame errors */ }
      );
     } catch (err: any) {
        if (!mountedRef.current) return;
        console.error("Camera start error:", err);
        setPermissionDenied(true);
        setIsScanning(false);
        setError("Could not start camera. " + (err?.message || ""));
     }
  };

  const handleAllow = () => {
      setShowPermissionPrompt(false);
      setPermissionDenied(false);
      setError(null);
      setIsScanning(true); // Triggers 2nd useEffect
  };

  const handleClose = async () => {
      await cleanupScanner();
      onClose();
  };

  const handleDeny = () => {
    setShowPermissionPrompt(false);
    setIsScanning(false);
  };

  const handleRetryPermission = () => {
    setShowPermissionPrompt(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
     if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        const html5QrCode = new Html5Qrcode("reader-hidden");
        try {
           const decodedText = await html5QrCode.scanFile(file, true);
           onScan(decodedText);
        } catch (err) {
           toast.error("Could not find QR code in image");
        }
     }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm">
       <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-sm relative">
          <button onClick={handleClose} className="absolute top-4 right-4 text-slate-500 hover:text-red-500 z-10"><X size={24}/></button>
          
          <h3 className="font-bold text-lg dark:text-white mb-4 text-center">Scan Shop QR</h3>
          
          <div className="min-h-[300px] flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden relative">
             {showPermissionPrompt ? (
                <div className="text-center p-6 w-full animate-in fade-in zoom-in duration-200">
                   <div className="bg-blue-100 text-blue-500 p-4 rounded-full inline-block mb-4"><Camera size={32}/></div>
                   <h4 className="font-bold text-slate-800 dark:text-white mb-2">Camera Access Needed</h4>
                   <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                      We need your permission to access the camera to scan QR codes.
                   </p>
                   <div className="flex gap-3 justify-center">
                      <button 
                        onClick={handleDeny}
                        className="btn bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2"
                      >
                         <Ban size={16}/> Deny
                      </button>
                      <button 
                        onClick={handleAllow}
                        className="btn bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2"
                      >
                         <CheckCircle size={16}/> Allow
                      </button>
                   </div>
                </div>
             ) : permissionDenied || error ? (
                <div className="text-center p-6 w-full">
                   <div className="bg-red-100 text-red-500 p-4 rounded-full inline-block mb-4"><AlertCircle size={32}/></div>
                   <p className="text-red-500 font-medium text-sm mb-6">{error || "Camera Access Required"}</p>
                   
                   <div className="space-y-3 w-full">
                      <button 
                        onClick={handleRetryPermission}
                        className="w-full btn bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center gap-2 py-2 rounded-lg font-medium"
                      >
                         <Camera size={18}/> Enable Camera
                      </button>

                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full btn btn-primary flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                         <ImageIcon size={18}/> Scan from Gallery
                      </button>
                      
                      <button 
                        onClick={handleClose}
                        className="w-full btn btn-outline flex items-center justify-center gap-2 text-slate-500 hover:text-slate-700"
                      >
                         <List size={18}/> Select Shop from List
                      </button>
                   </div>
                </div>
             ) : (isScanning || scannerRef.current) ? (
                <div id="reader" className="w-full h-full"></div>
             ) : (
               <div className="text-center p-6 w-full">
                  <div className="bg-slate-200 dark:bg-slate-700 text-slate-400 p-4 rounded-full inline-block mb-4"><Camera size={32}/></div>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mb-6">Camera permission is required to scan.</p>
                   <button 
                     onClick={handleRetryPermission}
                     className="w-full btn bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center gap-2 py-2 rounded-lg font-medium"
                   >
                      <Camera size={18}/> Allow Camera
                   </button>
               </div>
             )}
             
             {/* Hidden div for file scan logic */}
             <div id="reader-hidden" className="hidden"></div>
             <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleFileUpload}
             />
          </div>
          
          {!showPermissionPrompt && !permissionDenied && !error && (isScanning || scannerRef.current) && (
             <p className="text-center text-slate-500 dark:text-slate-400 text-xs mt-4">
                Point camera at the QR code on the shop counter.
             </p>
          )}
       </div>
    </div>
  );
};

export default QRScanner;