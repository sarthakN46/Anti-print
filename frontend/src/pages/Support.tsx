import { Phone, Mail, MapPin, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Support = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        <button 
           onClick={() => navigate(-1)} 
           className="mb-8 flex items-center gap-2 text-slate-500 hover:text-primary transition-colors font-medium"
        >
           <ArrowLeft size={20} /> Back
        </button>

        <div className="text-center mb-12">
           <h1 className="text-4xl font-bold mb-4">How can we help you?</h1>
           <p className="text-slate-500 dark:text-slate-400 text-lg">Our team is available Mon-Fri, 9am - 6pm IST.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {/* Call Card */}
           <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow text-center group">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                 <Phone size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">Call Support</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">Speak directly with our support team for urgent issues.</p>
              <a href="tel:+919876543210" className="btn btn-outline w-full justify-center border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20">
                 +91 98765 43210
              </a>
           </div>

           {/* Email Card */}
           <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow text-center group">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                 <Mail size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">Email Us</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">Send us a detailed message and we'll reply within 24 hours.</p>
              <a href="mailto:support@xeroxsaas.com" className="btn btn-outline w-full justify-center border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/20">
                 support@xeroxsaas.com
              </a>
           </div>
        </div>

        {/* Office Address (Optional Footer) */}
        <div className="mt-12 text-center border-t border-slate-200 dark:border-slate-800 pt-8">
           <p className="flex items-center justify-center gap-2 text-slate-400 text-sm">
              <MapPin size={16} />
              123, Innovation Tower, Tech Park, Bangalore - 560102
           </p>
        </div>
      </div>
    </div>
  );
};

export default Support;