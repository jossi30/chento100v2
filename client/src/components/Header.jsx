import { FaSearch, FaGlobe, FaPlus, FaHome, FaCar, FaShieldAlt } from 'react-icons/fa';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function Header() {
  const { currentUser, isAdmin } = useAuth();
  const { t, toggleLanguage } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = (e) => {
    e.preventDefault();
    const urlParams = new URLSearchParams(location.search);
    if (searchTerm.trim()) {
      urlParams.set('searchTerm', searchTerm.trim());
    } else {
      urlParams.delete('searchTerm');
    }
    navigate(`/search?${urlParams.toString()}`);
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const term = urlParams.get('searchTerm') || urlParams.get('city') || '';
    setSearchTerm(term);
  }, [location.search]);

  return (
    <header className='sticky top-0 z-40 backdrop-blur-md bg-white/90 border-b border-slate-200/80 shadow-xs transition-all duration-300'>
      <div className='flex justify-between items-center max-w-6xl mx-auto px-4 py-3 gap-2 sm:gap-4'>
        {/* Brand Logo */}
        <Link to='/' className='group flex items-center transition-transform duration-200 active:scale-95 shrink-0'>
          <h1 className='font-bold text-base sm:text-xl tracking-tight flex items-center'>
            <span className='text-slate-500 group-hover:text-slate-600 transition-colors'>chento</span>
            <span className='text-slate-900 group-hover:text-slate-950 transition-colors font-black'>&nbsp;100</span>
          </h1>
        </Link>

        {/* Search Bar */}
        <form
          onSubmit={handleSubmit}
          className='bg-slate-100 hover:bg-slate-100/90 border border-slate-200 focus-within:border-slate-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-200 px-3.5 py-1.5 sm:py-2 rounded-full flex items-center gap-2 transition-all duration-200 shadow-2xs max-w-xs sm:max-w-sm flex-1'
        >
          <input
            type='text'
            placeholder='Search guest houses, cars, cities...'
            className='bg-transparent focus:outline-hidden text-xs sm:text-sm text-slate-800 placeholder-slate-400 w-full transition-all'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            type='submit'
            aria-label='Search'
            className='text-slate-500 hover:text-slate-800 transition-transform active:scale-90 p-0.5 cursor-pointer'
          >
            <FaSearch className='text-xs sm:text-sm' />
          </button>
        </form>

        {/* Nav Links */}
        <ul className='flex items-center gap-2 sm:gap-3 text-xs sm:text-sm font-semibold shrink-0'>
          <Link to='/search?type=guesthouse' className='hidden md:inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-950 transition-colors py-1'>
            <FaHome className='text-slate-400 text-xs' />
            <span>Guest Houses</span>
          </Link>

          <Link to='/search?type=car' className='hidden md:inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-950 transition-colors py-1'>
            <FaCar className='text-slate-400 text-xs' />
            <span>Car Leasing</span>
          </Link>

          <Link
            to='/create-listing'
            className='inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition shadow-xs text-xs font-bold'
          >
            <FaPlus className='text-[10px]' />
            <span className='hidden sm:inline'>Post Listing</span>
            <span className='sm:hidden'>Post</span>
          </Link>

          {isAdmin && (
            <Link to='/admin-dashboard'>
              <li className='flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-slate-900 text-amber-300 hover:bg-slate-800 transition shadow-xs'>
                <FaShieldAlt className='text-xs' />
                <span className='hidden sm:inline'>Admin</span>
              </li>
            </Link>
          )}

          <button
            type='button'
            onClick={toggleLanguage}
            title={t('header.langTitle')}
            className='flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition shadow-2xs cursor-pointer'
          >
            <FaGlobe className='text-slate-500 text-xs' />
            <span>{t('header.langToggle')}</span>
          </button>

          <Link to='/profile' className='flex items-center'>
            {currentUser ? (
              <img
                className='rounded-full h-8 w-8 object-cover border border-slate-200 ring-2 ring-transparent hover:ring-slate-400 transition'
                src={
                  currentUser.photoURL ||
                  'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'
                }
                alt='profile'
              />
            ) : (
              <span className='text-slate-800 hover:text-slate-950 font-bold px-2 py-1'>
                Sign In
              </span>
            )}
          </Link>
        </ul>
      </div>
    </header>
  );
}
