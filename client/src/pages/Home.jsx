import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ListingItem from '../components/ListingItem';
import { getApprovedListings, getFeaturedListings } from '../services/listingService';
import { useLanguage } from '../context/LanguageContext';
import { FaSearch, FaHome, FaCar, FaShieldAlt, FaPlus, FaStar } from 'react-icons/fa';

export default function Home() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Search Bar State
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'guesthouse' | 'car'
  const [searchLocation, setSearchLocation] = useState('');

  // Firestore live state
  const [featuredListings, setFeaturedListings] = useState([]);
  const [guestHouses, setGuestHouses] = useState([]);
  const [carListings, setCarListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadMarketplaceData() {
      setLoading(true);
      try {
        const [featuredData, ghData, carData] = await Promise.all([
          getFeaturedListings(null, 4),
          getApprovedListings({ type: 'guesthouse', pageSize: 6 }),
          getApprovedListings({ type: 'car', pageSize: 6 }),
        ]);

        if (isMounted) {
          setFeaturedListings(featuredData || []);
          setGuestHouses(ghData.listings || []);
          setCarListings(carData.listings || []);
        }
      } catch (err) {
        console.warn('Home page live data fetch notice:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadMarketplaceData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (activeTab !== 'all') {
      params.set('type', activeTab);
    }
    if (searchLocation.trim()) {
      params.set('city', searchLocation.trim());
    }
    navigate(`/search?${params.toString()}`);
  };

  const totalListingsCount = guestHouses.length + carListings.length;

  return (
    <div className='flex flex-col gap-10 pb-16'>
      {/* Hero Section */}
      <section className='relative bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white pt-16 sm:pt-24 pb-20 px-4'>
        {/* Subtle grid pattern background */}
        <div className='absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none' />

        <div className='relative max-w-5xl mx-auto text-center space-y-6'>
          {/* Badge */}
          <div className='inline-flex items-center gap-2 bg-slate-800/90 text-amber-400 text-xs font-semibold px-3.5 py-1.5 rounded-full border border-slate-700/80 shadow-xs'>
            <FaShieldAlt className='text-amber-400' />
            <span>100% Moderated &amp; Verified Marketplace</span>
          </div>

          <h1 className='text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight sm:leading-tight'>
            Boutique Guest Houses <br />
            <span className='text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200'>
              &amp; Private Car Leasing
            </span>
          </h1>

          <p className='text-slate-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed'>
            Browse handpicked guest houses and private vehicles with professional drivers. Every listing is reviewed by administrators before publication.
          </p>

          {/* Search Box with Tabbed Selector */}
          <div className='max-w-3xl mx-auto mt-8 bg-white/95 backdrop-blur-md rounded-3xl p-3 sm:p-4 text-slate-800 shadow-2xl border border-slate-200/50'>
            {/* Category Tabs */}
            <div className='flex items-center gap-1 mb-3 bg-slate-100 p-1 rounded-xl w-full sm:w-max'>
              <button
                type='button'
                onClick={() => setActiveTab('all')}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Categories
              </button>
              <button
                type='button'
                onClick={() => setActiveTab('guesthouse')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'guesthouse'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FaHome className='text-amber-500' />
                <span>Guest Houses</span>
              </button>
              <button
                type='button'
                onClick={() => setActiveTab('car')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'car'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FaCar className='text-amber-500' />
                <span>Car Leasing</span>
              </button>
            </div>

            {/* Form Input and Search Button */}
            <form onSubmit={handleSearchSubmit} className='flex flex-col sm:flex-row gap-2.5 items-center'>
              <div className='relative flex-1 w-full'>
                <FaSearch className='absolute left-4 top-3.5 text-slate-400 text-sm' />
                <input
                  type='text'
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                  placeholder={
                    activeTab === 'guesthouse'
                      ? 'Search by city or neighborhood (e.g. Asmara, Downtown, Beach)...'
                      : activeTab === 'car'
                      ? 'Search car make, model, or city (e.g. Toyota, Prado, Sedan)...'
                      : 'Search location, property, or vehicle...'
                  }
                  className='w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:bg-white'
                />
              </div>

              <button
                type='submit'
                className='w-full sm:w-auto px-8 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer'
              >
                <FaSearch />
                <span>Search</span>
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className='max-w-6xl mx-auto px-4 w-full space-y-12'>
        {/* Featured Listings Carousel / Grid (if any exist) */}
        {featuredListings.length > 0 && (
          <section className='space-y-4'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <span className='p-2 bg-amber-100 text-amber-600 rounded-lg text-sm'>
                  <FaStar />
                </span>
                <div>
                  <h2 className='text-xl sm:text-2xl font-black text-slate-900'>Featured Listings</h2>
                  <p className='text-xs text-slate-500'>Hand-verified retreats and premium chauffeured rides</p>
                </div>
              </div>
              <Link to='/search?featured=true' className='text-xs font-bold text-amber-600 hover:underline'>
                View all featured →
              </Link>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5'>
              {featuredListings.map((listing) => (
                <ListingItem key={listing.id} listing={listing} />
              ))}
            </div>
          </section>
        )}

        {/* Section 1: Guest Houses */}
        <section className='space-y-4'>
          <div className='flex items-center justify-between border-b border-slate-200 pb-3'>
            <div className='flex items-center gap-2'>
              <span className='p-2 bg-blue-50 text-blue-600 rounded-lg text-sm'>
                <FaHome />
              </span>
              <div>
                <h2 className='text-xl sm:text-2xl font-black text-slate-900'>Boutique Guest Houses</h2>
                <p className='text-xs text-slate-500'>Relaxing retreats, fully furnished studios, and villas</p>
              </div>
            </div>
            <Link to='/search?type=guesthouse' className='text-xs font-bold text-slate-900 hover:text-amber-600 transition'>
              Show more guest houses →
            </Link>
          </div>

          {loading ? (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
              {[1, 2, 3].map((n) => (
                <div key={n} className='h-80 bg-slate-100 rounded-2xl animate-pulse' />
              ))}
            </div>
          ) : guestHouses.length > 0 ? (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
              {guestHouses.map((listing) => (
                <ListingItem key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            /* Clean Empty State (Rule 1: NO mock, placeholder, or seed data) */
            <div className='bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-8 sm:p-12 text-center space-y-3'>
              <div className='w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto text-xl'>
                <FaHome />
              </div>
              <h3 className='text-base font-bold text-slate-900'>No guest house listings yet</h3>
              <p className='text-xs text-slate-500 max-w-md mx-auto leading-relaxed'>
                There are currently no approved guest houses listed. Be the first host to list your property for travelers!
              </p>
              <div className='pt-2'>
                <Link
                  to='/create-listing'
                  className='inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-xs'
                >
                  <FaPlus className='text-xs' />
                  <span>List a Guest House</span>
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Section 2: Car Leasing & Private Drivers */}
        <section className='space-y-4'>
          <div className='flex items-center justify-between border-b border-slate-200 pb-3'>
            <div className='flex items-center gap-2'>
              <span className='p-2 bg-emerald-50 text-emerald-600 rounded-lg text-sm'>
                <FaCar />
              </span>
              <div>
                <h2 className='text-xl sm:text-2xl font-black text-slate-900'>Car Leasing &amp; Chauffeur Rides</h2>
                <p className='text-xs text-slate-500'>City sedans, safari SUVs, and executive cars with drivers</p>
              </div>
            </div>
            <Link to='/search?type=car' className='text-xs font-bold text-slate-900 hover:text-amber-600 transition'>
              Show more vehicles →
            </Link>
          </div>

          {loading ? (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
              {[1, 2, 3].map((n) => (
                <div key={n} className='h-80 bg-slate-100 rounded-2xl animate-pulse' />
              ))}
            </div>
          ) : carListings.length > 0 ? (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
              {carListings.map((listing) => (
                <ListingItem key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            /* Clean Empty State */
            <div className='bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-8 sm:p-12 text-center space-y-3'>
              <div className='w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-xl'>
                <FaCar />
              </div>
              <h3 className='text-base font-bold text-slate-900'>No car leasing listings yet</h3>
              <p className='text-xs text-slate-500 max-w-md mx-auto leading-relaxed'>
                There are currently no approved vehicles listed. Operators and private chauffeurs can list vehicles for lease now.
              </p>
              <div className='pt-2'>
                <Link
                  to='/create-listing'
                  className='inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-xs'
                >
                  <FaPlus className='text-xs' />
                  <span>List a Vehicle</span>
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Platform Trust & Safety Pillars */}
        <section className='bg-slate-100/70 border border-slate-200/80 rounded-3xl p-6 sm:p-10'>
          <div className='text-center max-w-xl mx-auto mb-8'>
            <h2 className='text-xl sm:text-2xl font-bold text-slate-900'>Why Choose chento 100?</h2>
            <p className='text-xs text-slate-500 mt-1'>A trustworthy marketplace built for hospitality and mobility</p>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left'>
            <div className='bg-white p-5 rounded-2xl border border-slate-200/60 shadow-2xs space-y-2'>
              <div className='w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold'>
                1
              </div>
              <h3 className='font-bold text-slate-900 text-sm'>Pre-moderated Quality</h3>
              <p className='text-xs text-slate-600 leading-relaxed'>
                Every listing is verified by our administration team before appearing publicly. No fake spam or duplicate listings.
              </p>
            </div>

            <div className='bg-white p-5 rounded-2xl border border-slate-200/60 shadow-2xs space-y-2'>
              <div className='w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold'>
                2
              </div>
              <h3 className='font-bold text-slate-900 text-sm'>Direct Owner Contact</h3>
              <p className='text-xs text-slate-600 leading-relaxed'>
                Connect straight with property managers and private chauffeurs via phone, WhatsApp, or email with zero intermediary markup.
              </p>
            </div>

            <div className='bg-white p-5 rounded-2xl border border-slate-200/60 shadow-2xs space-y-2'>
              <div className='w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold'>
                3
              </div>
              <h3 className='font-bold text-slate-900 text-sm'>Verified Profiles</h3>
              <p className='text-xs text-slate-600 leading-relaxed'>
                Hosts and drivers must confirm their email and credentials before submitting listings to protect guests and renters.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
