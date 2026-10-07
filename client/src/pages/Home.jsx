import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ListingItem from '../components/ListingItem';
import { getApprovedListings, getOfferListings } from '../services/listingService';
import { useLanguage } from '../context/LanguageContext';
import {
  FaSearch,
  FaHome,
  FaCar,
  FaPlus,
  FaFire,
  FaTag,
  FaChevronLeft,
  FaChevronRight,
  FaMapMarkerAlt,
  FaBed,
  FaBath,
  FaUserFriends,
} from 'react-icons/fa';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

// Put your hero photo in /public (e.g. /public/hero.jpg) or change this path.
// A wide, bright architectural photo works best (like the reference image).
const HERO_IMAGE = '/hero.jpg';

export default function Home() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const heroSwiperRef = useRef(null);
  const swiperRef = useRef(null);

  // Search Bar State
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'guesthouse' | 'car'
  const [searchLocation, setSearchLocation] = useState('');

  // Firestore live state
  const [bestOffers, setBestOffers] = useState([]);
  const [guestHouses, setGuestHouses] = useState([]);
  const [carListings, setCarListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadMarketplaceData() {
      setLoading(true);
      try {
        const [offersData, ghData, carData] = await Promise.all([
          getOfferListings(8),
          getApprovedListings({ type: 'guesthouse', pageSize: 6 }),
          getApprovedListings({ type: 'car', pageSize: 6 }),
        ]);

        if (isMounted) {
          setBestOffers(offersData || []);
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

  // Shared tab styles
  const tabBase =
    'flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition cursor-pointer';
  const tabActive = 'bg-neutral-900 text-white';
  const tabIdle = 'text-neutral-500 hover:text-neutral-900';

  return (
    <div className="flex flex-col gap-24 pb-24 bg-white text-neutral-900 font-['Inter_Tight','Inter',ui-sans-serif,system-ui,sans-serif]">
      {/* Hero Section */}
      <section className='relative bg-white pt-14 sm:pt-20 px-4 sm:px-8'>
        <div className='max-w-7xl mx-auto'>
          {/* Headline row: big title left, small gray copy right */}
          <div className='grid grid-cols-1 lg:grid-cols-12 gap-8 items-start'>
            <div className='lg:col-span-8 space-y-8'>
              <h1 className='text-5xl sm:text-6xl lg:text-7xl font-medium tracking-tighter leading-[1.02] text-neutral-900'>
                Find your next Guest Houses &amp; Private Car with ease
              </h1>
            </div>

            <p className='lg:col-span-3 lg:col-start-10 lg:pt-10 text-neutral-500 text-xs sm:text-[13px] leading-relaxed max-w-xs'>
              Browse handpicked guest houses and private vehicles with professional drivers. Every listing is reviewed by administrators before publication.
            </p>
          </div>

          {/* Hero image with floating search box */}
          <div className='relative mt-10 sm:mt-14'>
            <div className='h-[360px] sm:h-[480px] lg:h-[560px] w-full rounded-3xl overflow-hidden relative shadow-md bg-neutral-900 group'>
              {bestOffers.length > 0 ? (
                <Swiper
                  modules={[Navigation, Pagination, Autoplay]}
                  onBeforeInit={(swiper) => {
                    heroSwiperRef.current = swiper;
                  }}
                  loop={bestOffers.length > 1}
                  speed={750}
                  autoplay={{
                    delay: 5000,
                    disableOnInteraction: false,
                    pauseOnMouseEnter: true,
                  }}
                  pagination={{
                    clickable: true,
                    dynamicBullets: true,
                  }}
                  className='w-full h-full hero-offers-swiper'
                >
                  {bestOffers.map((offer, index) => {
                    const isGuestHouse =
                      offer.type === 'guesthouse' ||
                      offer.category === 'guesthouse' ||
                      offer.type === 'rent';

                    const images =
                      Array.isArray(offer.images) && offer.images.length > 0
                        ? offer.images
                        : Array.isArray(offer.imageUrls) && offer.imageUrls.length > 0
                        ? offer.imageUrls
                        : [];

                    const coverImage =
                      images[0] ||
                      (isGuestHouse
                        ? '/images/airbnb_apartment_living.jpg'
                        : '/images/city_regular_sedan.jpg');

                    const regularPrice = Number(offer.regularPrice || offer.price || 0);
                    const discountPrice = Number(offer.discountPrice || 0);
                    const hasDiscount = discountPrice > 0 && discountPrice < regularPrice;
                    const effectivePrice = hasDiscount ? discountPrice : Number(offer.price || regularPrice);
                    const savings = hasDiscount ? regularPrice - discountPrice : 0;
                    const priceUnit = offer.priceUnit || (isGuestHouse ? 'night' : 'day');
                    const currency = offer.currency || 'USD';
                    const locationText =
                      [offer.city, offer.area].filter(Boolean).join(', ') ||
                      offer.location ||
                      offer.address ||
                      'City Center';

                    return (
                      <SwiperSlide key={offer.id || index} className='relative w-full h-full'>
                        {/* Background Photo */}
                        <div
                          className='absolute inset-0 w-full h-full bg-cover bg-center transition-transform duration-1000 scale-100 group-hover:scale-105'
                          style={{ backgroundImage: `url(${coverImage})` }}
                          role='img'
                          aria-label={offer.title}
                        />

                        {/* Elegant Dark Gradient Overlays */}
                        <div className='absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/45' />
                        <div className='absolute inset-0 bg-gradient-to-r from-black/75 via-black/25 to-transparent' />

                        {/* Floating Offer Badge Card */}
                        <div className='absolute top-5 left-5 sm:top-8 sm:left-8 z-10 max-w-sm sm:max-w-md text-white space-y-2 pointer-events-auto'>
                          <div className='flex items-center gap-2 flex-wrap'>
                            <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold tracking-wider uppercase bg-rose-600 text-white shadow-md'>
                              <FaFire className='text-amber-300 text-xs' />
                              <span>Admin Offer</span>
                            </span>

                            <span className='px-3 py-1 rounded-full text-[11px] font-semibold bg-white/20 backdrop-blur-md text-white border border-white/20 shadow-xs'>
                              {isGuestHouse ? '🏡 Guest House' : '🚗 Car Leasing'}
                            </span>

                            {hasDiscount && (
                              <span className='px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-400 text-neutral-950 shadow-md'>
                                Save ${savings}/{priceUnit}
                              </span>
                            )}
                          </div>

                          <Link to={`/listing/${offer.id}`}>
                            <h2 className='text-lg sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white drop-shadow-md line-clamp-1 hover:text-amber-300 transition-colors'>
                              {offer.title || offer.name}
                            </h2>
                          </Link>

                          <div className='flex items-center gap-2 text-xs text-neutral-200'>
                            <span className='flex items-center gap-1'>
                              <FaMapMarkerAlt className='text-rose-400' />
                              <span>{locationText}</span>
                            </span>
                            <span>•</span>
                            <div className='flex items-baseline gap-1'>
                              {hasDiscount && (
                                <span className='text-neutral-400 line-through text-xs'>
                                  ${regularPrice}
                                </span>
                              )}
                              <span className='text-base sm:text-lg font-black text-amber-300'>
                                {currency === 'USD' ? '$' : `${currency} `}
                                {effectivePrice.toLocaleString()}
                              </span>
                              <span className='text-xs text-neutral-300 font-normal'>
                                /{priceUnit}
                              </span>
                            </div>
                          </div>

                          <div className='pt-1'>
                            <Link
                              to={`/listing/${offer.id}`}
                              className='inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white text-neutral-950 hover:bg-amber-300 font-bold text-xs shadow-md transition'
                            >
                              <span>Explore Offer</span>
                              <span>→</span>
                            </Link>
                          </div>
                        </div>
                      </SwiperSlide>
                    );
                  })}
                </Swiper>
              ) : (
                /* Fallback single hero image if no offers yet */
                <div
                  className='h-full w-full bg-cover bg-center'
                  style={{ backgroundImage: `url(${HERO_IMAGE})` }}
                  role='img'
                  aria-label='Modern house exterior'
                />
              )}

              {/* Prev / Next controls on the sides of the hero slideshow */}
              {bestOffers.length > 1 && (
                <>
                  <button
                    type='button'
                    onClick={() => heroSwiperRef.current?.slidePrev()}
                    aria-label='Previous offer'
                    className='absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/45 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 flex items-center justify-center transition shadow-lg opacity-80 hover:opacity-100 cursor-pointer'
                  >
                    <FaChevronLeft className='text-xs sm:text-sm' />
                  </button>
                  <button
                    type='button'
                    onClick={() => heroSwiperRef.current?.slideNext()}
                    aria-label='Next offer'
                    className='absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/45 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 flex items-center justify-center transition shadow-lg opacity-80 hover:opacity-100 cursor-pointer'
                  >
                    <FaChevronRight className='text-xs sm:text-sm' />
                  </button>
                </>
              )}
            </div>

            {/* Search Box with Tabbed Selector */}
            <div className='relative sm:absolute sm:left-1/2 sm:-translate-x-1/2 sm:bottom-8 -mt-16 sm:mt-0 mx-3 sm:mx-0 w-auto sm:w-[92%] max-w-3xl bg-white rounded-2xl p-3 sm:p-4 text-neutral-900 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)] border border-neutral-200 z-10'>
              {/* Category Tabs */}
              <div className='flex items-center gap-1 mb-3 bg-neutral-100 p-1 rounded-full w-full sm:w-max'>
                <button
                  type='button'
                  onClick={() => setActiveTab('all')}
                  className={`${tabBase} ${activeTab === 'all' ? tabActive : tabIdle}`}
                >
                  All Categories
                </button>
                <button
                  type='button'
                  onClick={() => setActiveTab('guesthouse')}
                  className={`${tabBase} ${activeTab === 'guesthouse' ? tabActive : tabIdle}`}
                >
                  <FaHome />
                  <span>Guest Houses</span>
                </button>
                <button
                  type='button'
                  onClick={() => setActiveTab('car')}
                  className={`${tabBase} ${activeTab === 'car' ? tabActive : tabIdle}`}
                >
                  <FaCar />
                  <span>Car Leasing</span>
                </button>
              </div>

              {/* Form Input and Search Button */}
              <form onSubmit={handleSearchSubmit} className='flex flex-col sm:flex-row gap-2.5 items-center'>
                <div className='relative flex-1 w-full'>
                  <FaSearch className='absolute left-4 top-3.5 text-neutral-400 text-sm' />
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
                    className='w-full pl-11 pr-4 py-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder-neutral-400 focus:outline-hidden focus:border-neutral-900'
                  />
                </div>

                <button
                  type='submit'
                  className='w-full sm:w-auto px-8 py-3 bg-neutral-900 hover:bg-neutral-700 text-white font-medium text-sm rounded-lg transition flex items-center justify-center gap-2 cursor-pointer'
                >
                  <FaSearch />
                  <span>Search</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className='max-w-7xl mx-auto px-4 sm:px-8 w-full space-y-20'>
        {/* Section: Best Offers Slideshow */}
        {bestOffers.length > 0 && (
          <section className='space-y-6 relative'>
            <div className='flex items-end justify-between'>
              <div className='flex items-center gap-3'>
                <span className='w-9 h-9 flex items-center justify-center border border-rose-200 bg-rose-50 text-rose-600 rounded-full text-sm shadow-xs'>
                  <FaFire />
                </span>
                <div>
                  <div className='inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-100 text-rose-700 mb-1'>
                    <FaTag className='text-[10px]' />
                    <span>Special Promotional Rates</span>
                  </div>
                  <h2 className='text-2xl sm:text-3xl font-medium tracking-tight text-neutral-900'>
                    Best Offers &amp; Highlights
                  </h2>
                  <p className='text-xs text-neutral-500 mt-0.5'>
                    Handpicked discounts on premium guest retreats and private chauffeured vehicles
                  </p>
                </div>
              </div>

              <div className='flex items-center gap-3'>
                {/* Desktop/Tablet Slideshow Prev & Next Controls */}
                <div className='hidden sm:flex items-center gap-1.5'>
                  <button
                    type='button'
                    onClick={() => swiperRef.current?.slidePrev()}
                    aria-label='Previous slide'
                    className='w-9 h-9 rounded-full border border-neutral-200 hover:border-neutral-900 bg-white hover:bg-neutral-900 text-neutral-700 hover:text-white flex items-center justify-center transition shadow-xs cursor-pointer'
                  >
                    <FaChevronLeft className='text-xs' />
                  </button>
                  <button
                    type='button'
                    onClick={() => swiperRef.current?.slideNext()}
                    aria-label='Next slide'
                    className='w-9 h-9 rounded-full border border-neutral-200 hover:border-neutral-900 bg-white hover:bg-neutral-900 text-neutral-700 hover:text-white flex items-center justify-center transition shadow-xs cursor-pointer'
                  >
                    <FaChevronRight className='text-xs' />
                  </button>
                </div>

                <Link
                  to='/search?offer=true'
                  className='text-xs font-medium text-neutral-900 border border-neutral-200 hover:border-neutral-900 px-4 py-2 rounded-md transition whitespace-nowrap'
                >
                  View all offers →
                </Link>
              </div>
            </div>

            {/* Swiper Slideshow Container */}
            <div className='relative best-offers-slideshow'>
              <Swiper
                modules={[Navigation, Pagination, Autoplay]}
                onBeforeInit={(swiper) => {
                  swiperRef.current = swiper;
                }}
                pagination={{
                  clickable: true,
                  dynamicBullets: true,
                }}
                autoplay={{
                  delay: 4500,
                  disableOnInteraction: false,
                  pauseOnMouseEnter: true,
                }}
                loop={bestOffers.length > 3}
                spaceBetween={20}
                slidesPerView={1}
                breakpoints={{
                  640: { slidesPerView: 2, spaceBetween: 20 },
                  1024: { slidesPerView: 3, spaceBetween: 24 },
                  1280: { slidesPerView: 4, spaceBetween: 24 },
                }}
                className='pb-12 pt-1'
              >
                {bestOffers.map((listing) => {
                  const isGuestHouse =
                    listing.type === 'guesthouse' ||
                    listing.category === 'guesthouse' ||
                    listing.type === 'rent';

                  const images =
                    Array.isArray(listing.images) && listing.images.length > 0
                      ? listing.images
                      : Array.isArray(listing.imageUrls) && listing.imageUrls.length > 0
                      ? listing.imageUrls
                      : [];

                  const coverImage =
                    images[0] ||
                    (isGuestHouse
                      ? 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80'
                      : 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80');

                  const regularPrice = Number(listing.regularPrice || listing.price || 0);
                  const discountPrice = Number(listing.discountPrice || 0);
                  const hasDiscount = discountPrice > 0 && discountPrice < regularPrice;
                  const effectivePrice = hasDiscount ? discountPrice : Number(listing.price || regularPrice);
                  const savings = hasDiscount ? regularPrice - discountPrice : 0;
                  const priceUnit = listing.priceUnit || (isGuestHouse ? 'night' : 'day');
                  const currency = listing.currency || 'USD';
                  const locationText =
                    [listing.city, listing.area].filter(Boolean).join(', ') ||
                    listing.location ||
                    listing.address ||
                    'City Center';

                  return (
                    <SwiperSlide key={listing.id} className='h-auto'>
                      <div className='group bg-white rounded-2xl border border-neutral-200/90 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col h-full'>
                        {/* Slide Photo with Badges */}
                        <Link
                          to={`/listing/${listing.id}`}
                          className='relative h-56 w-full overflow-hidden bg-neutral-100 block'
                        >
                          <img
                            src={coverImage}
                            alt={listing.title}
                            loading='lazy'
                            className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out'
                          />

                          {/* Floating Badges */}
                          <div className='absolute top-3 left-3 flex items-center gap-1.5 flex-wrap'>
                            <span className='bg-neutral-900/85 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-xs border border-white/10'>
                              {isGuestHouse ? 'Guest House' : 'Car Leasing'}
                            </span>
                            <span className='bg-rose-600 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1'>
                              <FaFire className='text-amber-300 text-xs' />
                              <span>Best Offer</span>
                            </span>
                          </div>

                          {/* Discount Savings Tag */}
                          {hasDiscount && (
                            <div className='absolute top-3 right-3 bg-amber-400 text-neutral-950 font-black text-[11px] px-2.5 py-1 rounded-full shadow-md'>
                              Save ${savings}/{priceUnit}
                            </div>
                          )}
                        </Link>

                        {/* Slide Details */}
                        <div className='p-4 sm:p-5 flex flex-col flex-1 gap-2.5'>
                          <Link to={`/listing/${listing.id}`}>
                            <h3 className='font-bold text-neutral-900 text-base line-clamp-1 group-hover:text-rose-600 transition-colors'>
                              {listing.title || listing.name}
                            </h3>
                          </Link>

                          <div className='flex items-center gap-1.5 text-neutral-500 text-xs truncate'>
                            <FaMapMarkerAlt className='text-rose-500 shrink-0 text-xs' />
                            <span className='truncate'>{locationText}</span>
                          </div>

                          {/* Specs */}
                          <div className='flex items-center gap-3 text-xs text-neutral-600 py-2 border-y border-neutral-100 my-1'>
                            {isGuestHouse ? (
                              <>
                                <span className='flex items-center gap-1'>
                                  <FaBed className='text-neutral-400' />
                                  <span>{listing.bedrooms || 1} beds</span>
                                </span>
                                <span className='flex items-center gap-1'>
                                  <FaBath className='text-neutral-400' />
                                  <span>{listing.bathrooms || 1} baths</span>
                                </span>
                                <span className='flex items-center gap-1'>
                                  <FaUserFriends className='text-neutral-400' />
                                  <span>{listing.maxGuests || 2} max</span>
                                </span>
                              </>
                            ) : (
                              <>
                                <span className='flex items-center gap-1'>
                                  <FaCar className='text-neutral-400' />
                                  <span>{listing.seats || 4} seats</span>
                                </span>
                                <span className='capitalize font-medium'>
                                  {listing.transmission || 'Auto'}
                                </span>
                                <span className='text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded'>
                                  {listing.driverIncluded ? 'With Driver' : 'Self-Drive'}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Pricing and Action */}
                          <div className='mt-auto pt-2 flex items-center justify-between'>
                            <div>
                              {hasDiscount && (
                                <span className='text-xs text-neutral-400 line-through block -mb-0.5'>
                                  ${regularPrice}
                                </span>
                              )}
                              <div className='flex items-baseline gap-1'>
                                <span className='text-lg font-black text-neutral-900'>
                                  {currency === 'USD' ? '$' : `${currency} `}
                                  {effectivePrice.toLocaleString()}
                                </span>
                                <span className='text-xs text-neutral-500 font-normal'>
                                  {' '}/ {priceUnit}
                                </span>
                              </div>
                            </div>

                            <Link
                              to={`/listing/${listing.id}`}
                              className='px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-700 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1 shadow-xs'
                            >
                              <span>View Deal</span>
                              <span>→</span>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </SwiperSlide>
                  );
                })}
              </Swiper>
            </div>
          </section>
        )}

        {/* Section 1: Guest Houses */}
        <section className='space-y-6'>
          <div className='flex items-end justify-between border-b border-neutral-200 pb-4'>
            <div className='flex items-center gap-3'>
              <span className='w-9 h-9 flex items-center justify-center border border-neutral-200 text-neutral-900 rounded-full text-sm'>
                <FaHome />
              </span>
              <div>
                <h2 className='text-2xl sm:text-3xl font-medium tracking-tight text-neutral-900'>Boutique Guest Houses</h2>
                <p className='text-xs text-neutral-500 mt-0.5'>Relaxing retreats, fully furnished studios, and villas</p>
              </div>
            </div>
            <Link
              to='/search?type=guesthouse'
              className='text-xs font-medium text-neutral-900 border border-neutral-200 hover:border-neutral-900 px-4 py-2 rounded-md transition whitespace-nowrap'
            >
              Show more guest houses →
            </Link>
          </div>

          {loading ? (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
              {[1, 2, 3].map((n) => (
                <div key={n} className='h-80 bg-neutral-100 rounded-2xl animate-pulse' />
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
            <div className='bg-neutral-50 border border-dashed border-neutral-300 rounded-2xl p-8 sm:p-12 text-center space-y-3'>
              <div className='w-12 h-12 rounded-full bg-white border border-neutral-200 text-neutral-900 flex items-center justify-center mx-auto text-xl'>
                <FaHome />
              </div>
              <h3 className='text-base font-medium text-neutral-900'>No guest house listings yet</h3>
              <p className='text-xs text-neutral-500 max-w-md mx-auto leading-relaxed'>
                There are currently no approved guest houses listed. Be the first host to list your property for travelers!
              </p>
              <div className='pt-2'>
                <Link
                  to='/create-listing'
                  className='inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-900 hover:bg-neutral-700 text-white rounded-md text-xs font-medium transition'
                >
                  <FaPlus className='text-xs' />
                  <span>List a Guest House</span>
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Section 2: Car Leasing & Private Drivers */}
        <section className='space-y-6'>
          <div className='flex items-end justify-between border-b border-neutral-200 pb-4'>
            <div className='flex items-center gap-3'>
              <span className='w-9 h-9 flex items-center justify-center border border-neutral-200 text-neutral-900 rounded-full text-sm'>
                <FaCar />
              </span>
              <div>
                <h2 className='text-2xl sm:text-3xl font-medium tracking-tight text-neutral-900'>Car Leasing &amp; Chauffeur Rides</h2>
                <p className='text-xs text-neutral-500 mt-0.5'>City sedans, safari SUVs, and executive cars with drivers</p>
              </div>
            </div>
            <Link
              to='/search?type=car'
              className='text-xs font-medium text-neutral-900 border border-neutral-200 hover:border-neutral-900 px-4 py-2 rounded-md transition whitespace-nowrap'
            >
              Show more vehicles →
            </Link>
          </div>

          {loading ? (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
              {[1, 2, 3].map((n) => (
                <div key={n} className='h-80 bg-neutral-100 rounded-2xl animate-pulse' />
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
            <div className='bg-neutral-50 border border-dashed border-neutral-300 rounded-2xl p-8 sm:p-12 text-center space-y-3'>
              <div className='w-12 h-12 rounded-full bg-white border border-neutral-200 text-neutral-900 flex items-center justify-center mx-auto text-xl'>
                <FaCar />
              </div>
              <h3 className='text-base font-medium text-neutral-900'>No car leasing listings yet</h3>
              <p className='text-xs text-neutral-500 max-w-md mx-auto leading-relaxed'>
                There are currently no approved vehicles listed. Operators and private chauffeurs can list vehicles for lease now.
              </p>
              <div className='pt-2'>
                <Link
                  to='/create-listing'
                  className='inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-900 hover:bg-neutral-700 text-white rounded-md text-xs font-medium transition'
                >
                  <FaPlus className='text-xs' />
                  <span>List a Vehicle</span>
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Platform Trust & Safety Pillars */}
        <section className='border-t border-neutral-200 pt-14'>
          <div className='grid grid-cols-1 lg:grid-cols-12 gap-10'>
            <div className='lg:col-span-4'>
              <h2 className='text-3xl sm:text-4xl font-medium tracking-tighter text-neutral-900 leading-tight'>
                Why Choose chento 100?
              </h2>
              <p className='text-xs text-neutral-500 mt-3 max-w-xs leading-relaxed'>
                A trustworthy marketplace built for hospitality and mobility
              </p>
            </div>

            <div className='lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-8'>
              <div className='space-y-2 sm:border-l sm:border-neutral-200 sm:pl-6'>
                <div className='text-sm font-medium text-neutral-400'>1</div>
                <h3 className='font-medium text-neutral-900 text-base'>Pre-moderated Quality</h3>
                <p className='text-xs text-neutral-500 leading-relaxed'>
                  Every listing is verified by our administration team before appearing publicly. No fake spam or duplicate listings.
                </p>
              </div>

              <div className='space-y-2 sm:border-l sm:border-neutral-200 sm:pl-6'>
                <div className='text-sm font-medium text-neutral-400'>2</div>
                <h3 className='font-medium text-neutral-900 text-base'>Direct Owner Contact</h3>
                <p className='text-xs text-neutral-500 leading-relaxed'>
                  Connect straight with property managers and private chauffeurs via phone, WhatsApp, or email with zero intermediary markup.
                </p>
              </div>

              <div className='space-y-2 sm:border-l sm:border-neutral-200 sm:pl-6'>
                <div className='text-sm font-medium text-neutral-400'>3</div>
                <h3 className='font-medium text-neutral-900 text-base'>Verified Profiles</h3>
                <p className='text-xs text-neutral-500 leading-relaxed'>
                  Hosts and drivers must confirm their email and credentials before submitting listings to protect guests and renters.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}