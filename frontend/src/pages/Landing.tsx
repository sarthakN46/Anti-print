import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Store, User, Printer, ShieldCheck, Zap, LayoutDashboard, Database, Menu, X } from 'lucide-react';

const Landing = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 transition-colors duration-300">
      {/* Navbar */}
      <nav className="border-b border-slate-100 dark:border-slate-800 px-4 sm:px-6 py-4 flex justify-between items-center sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur z-50">
        <div className="flex items-center gap-2">
          <Store className="text-primary" size={24} />
          <span className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">XeroxSaaS</span>
        </div>

        {/* Desktop Nav */}
        <div className="hidden sm:flex items-center gap-4">
          <Link to="/login" className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">Log In</Link>
          <Link to="/register-shop" className="btn btn-primary text-sm py-2 px-4">Partner with Us</Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="sm:hidden p-2 text-slate-600 dark:text-slate-300"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="sm:hidden bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-4 space-y-3 animate-in slide-in-from-top duration-200">
          <Link
            to="/login"
            className="block w-full text-center py-3 text-sm font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl"
            onClick={() => setMobileMenuOpen(false)}
          >
            Log In
          </Link>
          <Link
            to="/register-shop"
            className="block w-full text-center btn btn-primary text-sm py-3"
            onClick={() => setMobileMenuOpen(false)}
          >
            Partner with Us
          </Link>
        </div>
      )}

      {/* Hero */}
      <header className="relative overflow-hidden pt-12 sm:pt-20 pb-20 sm:pb-32 px-4 sm:px-6">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-secondary/5 -skew-x-12 translate-x-1/4 -z-10 hidden sm:block" />
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 items-center">
          <div className="space-y-4 sm:space-y-6 text-center md:text-left">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-slate-800 dark:text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
               <Zap size={14} className="text-primary-hover"/> The Future of Printing
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-slate-900 dark:text-white leading-tight">
              Skip the Queue. <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-hover to-green-500">Just Print.</span>
            </h1>
            <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-md mx-auto md:mx-0">
              The smartest way to print documents. Upload from anywhere, pay securely, and pick up your prints in seconds.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
              <Link to="/login" className="btn btn-secondary px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg w-full sm:w-auto justify-center">
                I'm a User
              </Link>
              <Link to="/login" className="btn btn-primary px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg w-full sm:w-auto justify-center">
                I Own a Shop
              </Link>
            </div>
          </div>

          {/* Hero Card - Hidden on very small screens, shown on sm+ */}
          <div className="relative hidden sm:block">
             <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 rotate-0 md:rotate-2 hover:rotate-0 transition-all duration-500">
                <div className="flex items-center justify-between mb-4 sm:mb-6 border-b border-slate-100 dark:border-slate-700 pb-4">
                   <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center"><User size={20} className="text-slate-500 dark:text-slate-300"/></div>
                      <div>
                         <p className="font-bold text-slate-800 dark:text-white text-sm sm:text-base">Rahul's Thesis.pdf</p>
                         <p className="text-xs text-slate-400">Ready for pickup • 45 Pages</p>
                      </div>
                   </div>
                   <span className="bg-green-100 text-green-700 px-2 sm:px-3 py-1 rounded-full text-xs font-bold dark:bg-green-900 dark:text-green-300">READY</span>
                </div>
                <div className="space-y-3">
                   <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded"></div>
                   <div className="h-2 w-3/4 bg-slate-100 dark:bg-slate-700 rounded"></div>
                   <div className="h-2 w-1/2 bg-slate-100 dark:bg-slate-700 rounded"></div>
                </div>
                <div className="mt-4 sm:mt-6 flex justify-between items-center">
                   <p className="font-bold text-lg sm:text-xl dark:text-white">₹120.00</p>
                   <button className="btn btn-primary py-2 text-sm">Print Now</button>
                </div>
             </div>

             {/* Floating Badge - Hidden on mobile */}
             <div className="absolute -bottom-6 -left-6 bg-secondary text-white p-3 sm:p-4 rounded-xl shadow-lg items-center gap-3 animate-bounce hidden md:flex">
                <Printer className="text-primary"/>
                <div>
                   <p className="font-bold text-base sm:text-lg">500+</p>
                   <p className="text-xs text-slate-400">Shops Connected</p>
                </div>
             </div>
          </div>
        </div>
      </header>

      {/* Features */}
      <section className="py-12 sm:py-20 bg-slate-50 dark:bg-slate-800/50 px-4 sm:px-6">
         <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-16 dark:text-white">Why XeroxSaaS?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-8">
               <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:-translate-y-1 transition-all">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4 sm:mb-6">
                     <Database size={24}/>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 dark:text-white">Secure Storage</h3>
                  <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400">Your documents are encrypted and automatically deleted after 24 hours. Privacy first.</p>
               </div>
               <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:-translate-y-1 transition-all">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center text-green-600 dark:text-green-400 mb-4 sm:mb-6">
                     <LayoutDashboard size={24}/>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 dark:text-white">Shop Dashboard</h3>
                  <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400">Manage orders, track revenue, and set dynamic pricing with our powerful partner tools.</p>
               </div>
               <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:-translate-y-1 transition-all sm:col-span-2 md:col-span-1">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 mb-4 sm:mb-6">
                     <ShieldCheck size={24}/>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 dark:text-white">Verified Partners</h3>
                  <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400">Every shop is verified. See real-time "Open/Closed" status and live pricing.</p>
               </div>
            </div>
         </div>
      </section>

      {/* Footer */}
      <footer className="bg-secondary text-white py-8 sm:py-12 px-4 sm:px-6 dark:bg-black">
         <div className="max-w-6xl mx-auto flex flex-col gap-4 sm:gap-6 items-center text-center md:flex-row md:justify-between md:text-left">
            <div className="flex items-center gap-2">
               <Store className="text-primary" size={24} />
               <span className="font-bold text-lg">XeroxSaaS</span>
            </div>
            <p className="text-slate-400 text-sm order-3 md:order-2">© 2026 XeroxSaaS Inc. All rights reserved.</p>
            <div className="flex gap-6 text-sm text-slate-400 order-2 md:order-3">
               <a href="#" className="hover:text-primary">Privacy</a>
               <a href="#" className="hover:text-primary">Terms</a>
               <a href="#" className="hover:text-primary">Contact</a>
            </div>
         </div>
      </footer>
    </div>
  );
};

export default Landing;
