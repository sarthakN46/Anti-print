import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Store, Loader2, Crosshair, UploadCloud, X } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet Default Icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Reverse Geocoding Helper
const getAddressFromCoords = async (lat: number, lng: number) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
    const data = await res.json();
    return data.display_name;
  } catch (e) {
    return '';
  }
};

const LocationMarker = ({ setPos, pos, setAddress }: { setPos: any, pos: [number, number], setAddress: any }) => {
  const map = useMap();
  
  useMapEvents({
    async click(e) {
      setPos([e.latlng.lat, e.latlng.lng]);
      const addr = await getAddressFromCoords(e.latlng.lat, e.latlng.lng);
      if (addr) setAddress((prev: any) => ({ ...prev, address: addr }));
    },
  });

  // Pan map if pos changes programmatically (e.g. locate me)
  React.useEffect(() => {
     map.flyTo(pos, map.getZoom());
  }, [pos, map]);

  return pos ? <Marker position={pos} /> : null;
};

const ShopSetup = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [coords, setCoords] = useState<[number, number]>([19.0760, 72.8777]); 
  const [imgUrl, setImgUrl] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    address: '', // Map Address
    manualAddress: '' // Manual Address
  });

  const handleLocateMe = () => {
     if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
           const { latitude, longitude } = position.coords;
           setCoords([latitude, longitude]);
           const addr = await getAddressFromCoords(latitude, longitude);
           if (addr) setFormData(prev => ({ ...prev, address: addr })); // Update Map Address
           toast.success('Location found');
        }, () => {
           toast.error('Could not access location');
        });
     }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (formData.name.length < 4) {
       toast.error('Shop name must be at least 4 characters');
       return;
    }
    if (!formData.name || !formData.address || !formData.manualAddress || !imgUrl) {
       toast.error('All fields and profile image are mandatory');
       return;
    }

    setLoading(true);

    try {
      await api.post('/shops', {
        name: formData.name,
        address: formData.manualAddress, // Use Manual Address for DB
        location: { coordinates: coords },
        image: imgUrl
      });

      toast.success("Shop configured successfully!");
      navigate('/shop/dashboard', { replace: true }); 

    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  // Image Upload Handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const uploadData = new FormData();
    uploadData.append('file', file);

    setUploadingImg(true);
    try {
      const { data } = await api.post('/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // Note: We now store just the KEY so backend can move it.
      setImgUrl(data.storageKey);
      toast.success('Image uploaded!');
    } catch (err) {
      toast.error('Image upload failed');
    } finally {
      setUploadingImg(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row">
        
        {/* Left: Visual */}
        <div className="bg-secondary p-8 text-white md:w-1/3 flex flex-col justify-between">
          <div>
            <Store className="mb-4 text-primary" size={40} />
            <h2 className="text-xl font-bold">One last step</h2>
            <p className="text-slate-400 text-sm mt-2">
              Tell users where to find you. Your shop will appear in search results immediately.
            </p>
          </div>
        </div>

        {/* Right: Form */}
        <div className="p-8 md:w-2/3">
          <h1 className="text-2xl font-bold text-slate-900 mb-6">Shop Profile</h1>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Shop Name</label>
              <input 
                required
                className="input-field" 
                placeholder="e.g. Campus Copy Center"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Profile Image</label>
                  <div className="relative">
                     {imgUrl ? (
                        <div className="relative h-10 w-full">
                           <div className="h-full w-full bg-slate-100 rounded-lg flex items-center justify-center text-xs text-green-600 border border-green-200">
                             Image Selected
                           </div>
                           <button type="button" onClick={() => setImgUrl('')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"><X size={12}/></button>
                        </div>
                     ) : (
                        <div className="flex items-center gap-2">
                           <label className="cursor-pointer btn btn-outline flex-1 flex justify-center items-center gap-2 py-2 text-xs">
                              {uploadingImg ? <Loader2 className="animate-spin" size={14}/> : <UploadCloud size={14} />}
                              Upload
                              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                           </label>
                        </div>
                     )}
                  </div>
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Map Location (Auto)</label>
                   <input 
                     readOnly
                     className="input-field bg-slate-50 text-slate-500 text-xs truncate cursor-not-allowed"
                     value={formData.address || 'Tap map to set'}
                     title={formData.address}
                   />
                </div>
            </div>

            {/* Manual Address Field */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Official Shop Address (Manual)</label>
              <textarea 
                required
                className="input-field min-h-[80px]" 
                placeholder="Building, Floor, Landmark..."
                value={formData.manualAddress}
                onChange={e => setFormData({...formData, manualAddress: e.target.value})}
              />
            </div>

            <div className="h-[300px] w-full rounded-xl overflow-hidden border border-slate-200 relative z-0">
               <MapContainer center={coords} zoom={13} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <LocationMarker setPos={setCoords} pos={coords} setAddress={setFormData} />
               </MapContainer>
               
               <div className="absolute top-2 right-2 z-[1000] flex flex-col gap-2 items-end">
                  <div className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm text-xs font-bold text-slate-600 border border-slate-200">
                     Tap map to set pin
                  </div>
                  <button type="button" onClick={handleLocateMe} className="bg-white px-3 py-2 rounded-lg shadow-md hover:bg-slate-50 text-primary border border-slate-200 flex items-center gap-2 text-xs font-bold transition-all" title="Use My Location">
                     <Crosshair size={16} /> Use My Location
                  </button>
               </div>
            </div>

            <div className="pt-4">
              <button 
                disabled={loading}
                className="w-full btn btn-primary font-bold"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Launch Dashboard'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
};

export default ShopSetup;