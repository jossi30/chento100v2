import React from 'react';
import { Link } from 'react-router-dom';
import { FaHome, FaCar, FaShieldAlt, FaPhoneAlt, FaEnvelope } from 'react-icons/fa';

export default function Footer() {
  return (
    <footer className='bg-slate-900 text-slate-300 pt-12 pb-8 border-t border-slate-800 text-xs sm:text-sm'>
      <div className='max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8 mb-8'>
        {/* Brand column */}
        <div className='space-y-3'>
          <Link to='/' className='flex items-center gap-1 text-white font-extrabold text-lg tracking-tight'>
            <span className='text-amber-400'>chento</span>
            <span>100</span>
          </Link>
          <p className='text-slate-400 text-xs leading-relaxed'>
            Premier verified marketplace for boutique guest house rentals and private car leasing with professional chauffeur services.
          </p>
          <div className='flex items-center gap-2 text-slate-400 text-xs pt-1'>
            <span className='w-2 h-2 rounded-full bg-emerald-400 animate-pulse'></span>
            <span>Live moderated listings</span>
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h3 className='text-white font-semibold mb-3 text-xs uppercase tracking-wider text-slate-200'>
            Marketplace
          </h3>
          <ul className='space-y-2 text-slate-400 text-xs'>
            <li>
              <Link to='/search?type=guesthouse' className='hover:text-amber-400 transition flex items-center gap-1.5'>
                <FaHome className='text-slate-500' />
                Guest Houses
              </Link>
            </li>
            <li>
              <Link to='/search?type=car' className='hover:text-amber-400 transition flex items-center gap-1.5'>
                <FaCar className='text-slate-500' />
                Car Leasing &amp; Drivers
              </Link>
            </li>
            <li>
              <Link to='/create-listing' className='hover:text-amber-400 transition'>
                List Your Property / Vehicle
              </Link>
            </li>
            <li>
              <Link to='/search' className='hover:text-amber-400 transition'>
                Browse All Listings
              </Link>
            </li>
          </ul>
        </div>

        {/* Trust & Legal */}
        <div>
          <h3 className='text-white font-semibold mb-3 text-xs uppercase tracking-wider text-slate-200'>
            Trust &amp; Policies
          </h3>
          <ul className='space-y-2 text-slate-400 text-xs'>
            <li>
              <Link to='/terms' className='hover:text-amber-400 transition flex items-center gap-1.5'>
                <FaShieldAlt className='text-slate-500' />
                Terms of Service
              </Link>
            </li>
            <li>
              <Link to='/privacy' className='hover:text-amber-400 transition'>
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link to='/contact' className='hover:text-amber-400 transition'>
                Community Guidelines
              </Link>
            </li>
            <li>
              <span className='text-slate-500 text-[11px] block pt-1'>
                Moderated: every listing is verified before going live.
              </span>
            </li>
          </ul>
        </div>

        {/* Contact info */}
        <div>
          <h3 className='text-white font-semibold mb-3 text-xs uppercase tracking-wider text-slate-200'>
            Contact &amp; Support
          </h3>
          <ul className='space-y-2 text-slate-400 text-xs'>
            <li className='flex items-center gap-2'>
              <FaEnvelope className='text-amber-400 shrink-0' />
              <span>support@chento100.com</span>
            </li>
            <li className='flex items-center gap-2'>
              <FaPhoneAlt className='text-amber-400 shrink-0' />
              <span>Direct Concierge Desk</span>
            </li>
            <li className='pt-2'>
              <Link
                to='/contact'
                className='inline-block px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700 transition'
              >
                Send Us a Message
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom bar with required credit */}
      <div className='max-w-6xl mx-auto px-4 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-xs'>
        <p>© {new Date().getFullYear()} chento 100 Marketplace. All rights reserved.</p>
        <p className='font-medium text-slate-400'>
          Built by <span className='text-amber-400 font-semibold'>jpulse systems</span>
        </p>
      </div>
    </footer>
  );
}
