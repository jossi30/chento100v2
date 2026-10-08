import { useState } from 'react';
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from 'firebase/storage';
import { app } from '../firebase';
import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { createListing } from '../services/listingService';
import { compressImage } from '../utils/imageCompressor';
import CameraCaptureModal from '../components/CameraCaptureModal';

export default function CreateListing() {
  const { t } = useLanguage();
  const reduxUser = useSelector((state) => state.user.currentUser);
  const { currentUser: authUser, isEmailVerified } = useAuth();
  const currentUser = authUser || reduxUser;
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    imageUrls: [],
    title: '',
    name: '',
    description: '',
    location: '',
    address: '',
    category: 'guesthouse', // 'guesthouse' or 'car_service'
    price: 50,
    regularPrice: 50,
    discountPrice: 0,
    discountedPrice: 0,
    offer: false,
    // Guesthouse fields
    bedrooms: 1,
    bathrooms: 1,
    furnished: false,
    parking: false,
    amenities: '',
    maxGuests: 2,
    // Car Service fields
    make: '',
    model: '',
    year: new Date().getFullYear(),
    transmission: 'automatic',
    seats: 4,
    driverIncluded: true,
    driverName: '',
    driverContact: '',
  });

  const [imageUploadError, setImageUploadError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submittedListing, setSubmittedListing] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraNotice, setCameraNotice] = useState('');

  const handleCategoryToggle = (categoryKey) => {
    setFormData((prev) => ({
      ...prev,
      category: categoryKey,
    }));
  };

  const handleProcessCameraPhoto = async (file) => {
    if (!file) return;

    if (formData.imageUrls.length >= 6) {
      setImageUploadError('You can only have up to 6 images per listing');
      return;
    }

    setUploading(true);
    setImageUploadError(false);
    setCameraNotice('Uploading photo taken with camera...');

    try {
      const url = await storeImage(file);
      if (url) {
        setFormData((prev) => ({
          ...prev,
          imageUrls: Array.from(new Set([...prev.imageUrls, url])).slice(0, 6),
        }));
        setCameraNotice('Photo captured and added to your listing!');
        setTimeout(() => setCameraNotice(''), 3500);
      }
    } catch (err) {
      console.error('Camera photo upload error:', err);
      setImageUploadError('Could not process photo captured with camera. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleProcessLocalFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const incomingFiles = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (incomingFiles.length === 0) {
      setImageUploadError('Please select valid image files (.jpg, .png, .webp)');
      return;
    }

    if (incomingFiles.length + formData.imageUrls.length > 6) {
      setImageUploadError('You can only have up to 6 images per listing');
      return;
    }

    setUploading(true);
    setImageUploadError(false);

    try {
      const promises = incomingFiles.map((file) => storeImage(file));
      const urls = await Promise.all(promises);
      const validUrls = urls.filter(Boolean);

      setFormData((prev) => ({
        ...prev,
        imageUrls: Array.from(new Set([...prev.imageUrls, ...validUrls])).slice(0, 6),
      }));
    } catch (err) {
      console.error('Local image upload error:', err);
      setImageUploadError('Could not process images from local system. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const storeImage = async (file) => {
    // Process and compress image so any size image can be smoothly uploaded
    const optimizedDataUrl = await compressImage(file, {
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 0.85,
    });

    return new Promise((resolve) => {
      try {
        const storage = getStorage(app);
        const userId = currentUser?.uid || currentUser?._id || 'user';
        const sanitizedName = (file.name || 'photo').replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${Date.now()}_${sanitizedName}`;
        const storageRef = ref(storage, `listings/${userId}/${fileName}`);
        const uploadTask = uploadBytesResumable(storageRef, file);
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress =
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Upload is ${progress}% done`);
          },
          (error) => {
            console.warn(
              'Firebase storage upload fallback to optimized image:',
              error
            );
            resolve(optimizedDataUrl);
          },
          () => {
            getDownloadURL(uploadTask.snapshot.ref)
              .then((downloadURL) => resolve(downloadURL))
              .catch(() => {
                resolve(optimizedDataUrl);
              });
          }
        );
      } catch (err) {
        console.warn(
          'Firebase storage initialization fallback to optimized image:',
          err
        );
        resolve(optimizedDataUrl);
      }
    });
  };

  const handleRemoveImage = (index) => {
    setFormData({
      ...formData,
      imageUrls: formData.imageUrls.filter((_, i) => i !== index),
    });
  };

  const handleChange = (e) => {
    const { id, value, type, checked } = e.target;

    if (type === 'checkbox') {
      setFormData((prev) => ({
        ...prev,
        [id]: checked,
      }));
      return;
    }

    if (
      type === 'number' ||
      type === 'text' ||
      type === 'textarea' ||
      e.target.tagName === 'SELECT'
    ) {
      const updates = { [id]: value };

      if (id === 'title' || id === 'name') {
        updates.title = value;
        updates.name = value;
      } else if (id === 'location' || id === 'address') {
        updates.location = value;
        updates.address = value;
      } else if (id === 'price' || id === 'regularPrice') {
        updates.price = value;
        updates.regularPrice = value;
      }

      setFormData((prev) => ({
        ...prev,
        ...updates,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentUser) {
      return setError('You must be signed in to create a listing.');
    }

    if (!isEmailVerified) {
      return setError('Email verification required: You must verify your email address before publishing listings.');
    }

    try {
      if (formData.imageUrls.length < 1) {
        return setError('You must upload at least one image');
      }

      const listingPrice = +formData.price || +formData.regularPrice;
      if (!listingPrice || listingPrice <= 0) {
        return setError('Price must be greater than 0');
      }

      setLoading(true);
      setError(false);

      const resolvedTitle = formData.title || formData.name;
      const resolvedLocation = formData.location || formData.address;

      const payload = {
        type: formData.category === 'guesthouse' ? 'guesthouse' : 'car',
        title: resolvedTitle,
        description: formData.description,
        price: listingPrice,
        priceUnit: formData.priceUnit || (formData.category === 'guesthouse' ? 'night' : 'day'),
        currency: formData.currency || 'USD',
        city: formData.city || resolvedLocation,
        area: formData.area || '',
        address: formData.address || resolvedLocation,
        contactPhone: formData.contactPhone || '',
        images: formData.imageUrls,
      };

      if (formData.category === 'guesthouse') {
        payload.bedrooms = +formData.bedrooms || 1;
        payload.bathrooms = +formData.bathrooms || 1;
        payload.maxGuests = +formData.maxGuests || 2;
        payload.amenities = Array.isArray(formData.amenities)
          ? formData.amenities
          : typeof formData.amenities === 'string' && formData.amenities.trim()
          ? formData.amenities.split(',').map((item) => item.trim()).filter(Boolean)
          : ['WiFi', 'Air Conditioning'];
        payload.checkIn = formData.checkIn || '14:00';
        payload.checkOut = formData.checkOut || '11:00';
        payload.houseRules = formData.houseRules || 'No smoking, quiet hours after 10 PM';
      } else {
        payload.make = formData.make || '';
        payload.model = formData.model || '';
        payload.year = +formData.year || new Date().getFullYear();
        payload.transmission = formData.transmission || 'automatic';
        payload.fuel = formData.fuel || 'Petrol';
        payload.seats = +formData.seats || 4;
        payload.mileageLimit = formData.mileageLimit || '200 km / day';
        payload.deposit = +formData.deposit || 0;
        payload.minLeaseTerm = formData.minLeaseTerm || '1 day';
        payload.driverIncluded = Boolean(formData.driverIncluded);
      }

      const created = await createListing(payload, currentUser);
      setLoading(false);
      setSubmittedListing(created);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || 'An error occurred while saving the listing');
      setLoading(false);
    }
  };

  const handleResetForm = () => {
    setSubmittedListing(null);
    setFormData({
      imageUrls: [],
      title: '',
      name: '',
      description: '',
      location: '',
      address: '',
      category: 'guesthouse',
      price: 50,
      regularPrice: 50,
      discountPrice: 0,
      discountedPrice: 0,
      offer: false,
      bedrooms: 1,
      bathrooms: 1,
      furnished: false,
      parking: false,
      amenities: '',
      maxGuests: 2,
      make: '',
      model: '',
      year: new Date().getFullYear(),
      transmission: 'automatic',
      seats: 4,
      driverIncluded: true,
      driverName: '',
      driverContact: '',
    });
  };

  return (
    <main className='p-4 max-w-4xl mx-auto'>
      <h1 className='text-3xl font-bold text-center my-6 text-slate-800'>
        {t('create.title') || 'Create a New Listing'}
      </h1>

      {/* Partner Portal Shortcut Banner */}
      <div className='mb-6 p-4 bg-black text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md'>
        <div>
          <p className='font-bold text-sm text-white'>New: Partner with Us Host Portal</p>
          <p className='text-xs text-neutral-300'>Manage live calendar availability, instant WhatsApp sharing, and register properties or vehicles.</p>
        </div>
        <Link
          to='/partner'
          className='px-4 py-2 bg-white text-black hover:bg-neutral-100 rounded-xl text-xs font-bold transition shrink-0'
        >
          Open Partner Portal →
        </Link>
      </div>

      {/* Email Verification Required Warning Banner */}
      {!isEmailVerified && (
        <div className='mb-6 p-4 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs'>
          <div>
            <p className='font-bold text-sm text-amber-950 mb-0.5'>Email Verification Required</p>
            <p className='text-amber-800'>
              You must verify your email address ({currentUser?.email}) before publishing guest houses or car leasing listings.
            </p>
          </div>
          <Link
            to='/verify-email'
            className='shrink-0 inline-flex items-center justify-center px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition shadow-xs'
          >
            Verify Email Now →
          </Link>
        </div>
      )}

      {/* 4. SUCCESS NOTIFICATION: Pending Admin Review */}
      {submittedListing && (
        <div
          id='success-submission-banner'
          className='mb-8 p-6 bg-emerald-50 border border-emerald-300 rounded-2xl shadow-sm text-slate-800 animate-fadeIn'
        >
          <div className='flex items-start gap-4'>
            <div className='p-3 bg-emerald-100 text-emerald-700 rounded-full flex-shrink-0 mt-1'>
              <svg
                className='w-6 h-6'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M5 13l4 4L19 7'
                />
              </svg>
            </div>
            <div className='flex-1'>
              <div className='flex flex-wrap items-center gap-2 mb-1'>
                <h2 className='text-xl font-bold text-emerald-900'>
                  Listing Submitted Successfully!
                </h2>
                <span className='px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-300'>
                  Pending Admin Review
                </span>
              </div>
              <p className='text-slate-700 text-sm md:text-base leading-relaxed mb-4'>
                Thank you! Your listing{' '}
                <strong className='text-slate-900 font-semibold'>
                  &ldquo;{submittedListing.title || submittedListing.name}&rdquo;
                </strong>{' '}
                has been submitted and is currently pending admin review. Our
                moderation team will review and approve your submission before it
                appears publicly in search and listings.
              </p>

              <div className='flex flex-wrap gap-3 pt-2'>
                <Link
                  to={`/listing/${submittedListing._id}`}
                  className='px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg shadow-sm transition'
                >
                  Preview Listing
                </Link>
                <Link
                  to='/profile'
                  className='px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg shadow-sm transition'
                >
                  Go to My Profile
                </Link>
                <button
                  type='button'
                  onClick={handleResetForm}
                  className='px-5 py-2.5 text-emerald-800 hover:text-emerald-900 hover:bg-emerald-100/50 text-sm font-medium rounded-lg transition'
                >
                  + Submit Another Listing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className='flex flex-col sm:flex-row gap-6'>
        <div className='flex flex-col gap-4 flex-1'>
          {/* 1. Category Toggle Selector at the Top */}
          <div className='flex flex-col gap-2'>
            <label className='font-semibold text-slate-800 text-sm tracking-wide uppercase'>
              Listing Category
            </label>
            <div className='grid grid-cols-2 gap-3 p-1.5 bg-slate-100 rounded-xl border border-slate-200'>
              <button
                type='button'
                id='toggle-category-guesthouse'
                onClick={() => handleCategoryToggle('guesthouse')}
                className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer ${
                  formData.category === 'guesthouse'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200 ring-2 ring-slate-900/10'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <svg
                  className='w-5 h-5 text-indigo-600'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
                  />
                </svg>
                <span>Guest House</span>
              </button>

              <button
                type='button'
                id='toggle-category-car-service'
                onClick={() => handleCategoryToggle('car_service')}
                className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer ${
                  formData.category === 'car_service' || formData.category === 'car'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200 ring-2 ring-slate-900/10'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <svg
                  className='w-5 h-5 text-emerald-600'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4'
                  />
                </svg>
                <span>Car & Driver</span>
              </button>
            </div>
          </div>

          {/* Common General Fields */}
          <div className='flex flex-col gap-1'>
            <label htmlFor='title' className='text-xs font-semibold text-slate-600 uppercase'>
              {formData.category === 'guesthouse'
                ? 'Guest House Title'
                : 'Service / Vehicle Title'}
            </label>
            <input
              type='text'
              placeholder={
                formData.category === 'guesthouse'
                  ? 'e.g. Modern Downtown Studio Airbnb'
                  : 'e.g. Toyota Corolla City Sedan with Driver'
              }
              className='border border-slate-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400'
              id='title'
              maxLength='70'
              minLength='5'
              required
              onChange={handleChange}
              value={formData.title}
            />
          </div>

          <div className='flex flex-col gap-1'>
            <label htmlFor='description' className='text-xs font-semibold text-slate-600 uppercase'>
              Description
            </label>
            <textarea
              placeholder={
                formData.category === 'guesthouse'
                  ? 'Describe property layout, features, atmosphere, and neighborhood...'
                  : 'Describe car features, luggage space, driver background, airport pickups...'
              }
              rows='4'
              className='border border-slate-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400'
              id='description'
              required
              onChange={handleChange}
              value={formData.description}
            />
          </div>

          <div className='flex flex-col gap-1'>
            <label htmlFor='location' className='text-xs font-semibold text-slate-600 uppercase'>
              {formData.category === 'guesthouse' ? 'Property Address / City' : 'Base Location / Service Area'}
            </label>
            <input
              type='text'
              placeholder={
                formData.category === 'guesthouse'
                  ? 'e.g. 742 Ocean Ave, Santa Monica, CA'
                  : 'e.g. Los Angeles International Airport & Greater LA'
              }
              className='border border-slate-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400'
              id='location'
              required
              onChange={handleChange}
              value={formData.location}
            />
          </div>

          {/* 2. CONDITIONAL FORM FIELDS: Guest House */}
          {formData.category === 'guesthouse' && (
            <div className='flex flex-col gap-4 border-t border-b border-slate-200 py-4 bg-slate-50/50 p-4 rounded-xl'>
              <h3 className='font-semibold text-sm text-slate-800 uppercase tracking-wide'>
                Guest House Specifications
              </h3>

              <div className='grid grid-cols-2 sm:grid-cols-3 gap-4'>
                <div className='flex flex-col gap-1'>
                  <label htmlFor='bedrooms' className='text-xs font-medium text-slate-700'>
                    Bedrooms
                  </label>
                  <input
                    type='number'
                    id='bedrooms'
                    min='1'
                    max='50'
                    required
                    className='p-3 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-400'
                    onChange={handleChange}
                    value={formData.bedrooms}
                  />
                </div>

                <div className='flex flex-col gap-1'>
                  <label htmlFor='bathrooms' className='text-xs font-medium text-slate-700'>
                    Bathrooms
                  </label>
                  <input
                    type='number'
                    id='bathrooms'
                    min='1'
                    max='50'
                    required
                    className='p-3 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-400'
                    onChange={handleChange}
                    value={formData.bathrooms}
                  />
                </div>

                <div className='flex flex-col gap-1'>
                  <label htmlFor='maxGuests' className='text-xs font-medium text-slate-700'>
                    Max Guests
                  </label>
                  <input
                    type='number'
                    id='maxGuests'
                    min='1'
                    max='100'
                    required
                    className='p-3 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-400'
                    onChange={handleChange}
                    value={formData.maxGuests}
                  />
                </div>
              </div>

              {/* Furnishing & Parking toggles */}
              <div className='flex flex-wrap gap-6 pt-2'>
                <label className='flex items-center gap-2 cursor-pointer'>
                  <input
                    type='checkbox'
                    id='furnished'
                    className='w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer'
                    onChange={handleChange}
                    checked={formData.furnished}
                  />
                  <span className='font-medium text-sm text-slate-800'>Furnished</span>
                </label>

                <label className='flex items-center gap-2 cursor-pointer'>
                  <input
                    type='checkbox'
                    id='parking'
                    className='w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer'
                    onChange={handleChange}
                    checked={formData.parking}
                  />
                  <span className='font-medium text-sm text-slate-800'>Parking Spot Included</span>
                </label>
              </div>

              <div className='flex flex-col gap-1'>
                <label htmlFor='amenities' className='text-xs font-medium text-slate-700'>
                  Amenities
                </label>
                <input
                  type='text'
                  placeholder='e.g. WiFi, Air Conditioning, Kitchenette, Garden Patio, Washer'
                  className='border border-slate-300 p-3 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-400'
                  id='amenities'
                  onChange={handleChange}
                  value={formData.amenities}
                />
              </div>
            </div>
          )}

          {/* 2. CONDITIONAL FORM FIELDS: Car Services */}
          {(formData.category === 'car_service' || formData.category === 'car') && (
            <div className='flex flex-col gap-4 border-t border-b border-slate-200 py-4 bg-slate-50/50 p-4 rounded-xl'>
              <h3 className='font-semibold text-sm text-slate-800 uppercase tracking-wide'>
                Vehicle & Driver Details
              </h3>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <div className='flex flex-col gap-1'>
                  <label htmlFor='make' className='text-xs font-medium text-slate-700'>
                    Car Make
                  </label>
                  <input
                    type='text'
                    placeholder='e.g. Toyota, Honda, Hyundai, Volkswagen'
                    className='border border-slate-300 p-3 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-400'
                    id='make'
                    required
                    onChange={handleChange}
                    value={formData.make}
                  />
                </div>

                <div className='flex flex-col gap-1'>
                  <label htmlFor='model' className='text-xs font-medium text-slate-700'>
                    Car Model
                  </label>
                  <input
                    type='text'
                    placeholder='e.g. Corolla, Civic, Camry, Elantra'
                    className='border border-slate-300 p-3 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-400'
                    id='model'
                    required
                    onChange={handleChange}
                    value={formData.model}
                  />
                </div>
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
                <div className='flex flex-col gap-1'>
                  <label htmlFor='year' className='text-xs font-medium text-slate-700'>
                    Model Year
                  </label>
                  <input
                    type='number'
                    id='year'
                    min='1990'
                    max={new Date().getFullYear() + 1}
                    required
                    className='p-3 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-400'
                    onChange={handleChange}
                    value={formData.year}
                  />
                </div>

                <div className='flex flex-col gap-1'>
                  <label htmlFor='seats' className='text-xs font-medium text-slate-700'>
                    Seating Capacity
                  </label>
                  <input
                    type='number'
                    id='seats'
                    min='1'
                    max='60'
                    required
                    className='p-3 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-400'
                    onChange={handleChange}
                    value={formData.seats}
                  />
                </div>

                <div className='flex flex-col gap-1'>
                  <label htmlFor='transmission' className='text-xs font-medium text-slate-700'>
                    Transmission
                  </label>
                  <select
                    id='transmission'
                    className='p-3 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-400'
                    onChange={handleChange}
                    value={formData.transmission}
                  >
                    <option value='automatic'>Automatic</option>
                    <option value='manual'>Manual</option>
                  </select>
                </div>
              </div>

              {/* Driver Details */}
              <div className='mt-2 pt-3 border-t border-slate-200'>
                <label className='flex items-center gap-2 cursor-pointer mb-3'>
                  <input
                    type='checkbox'
                    id='driverIncluded'
                    className='w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer'
                    onChange={handleChange}
                    checked={formData.driverIncluded}
                  />
                  <span className='font-medium text-sm text-slate-800'>
                    Professional Driver Included
                  </span>
                </label>

                {formData.driverIncluded && (
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-3 rounded-lg border border-slate-200'>
                    <div className='flex flex-col gap-1'>
                      <label htmlFor='driverName' className='text-xs font-medium text-slate-700'>
                        Driver Full Name
                      </label>
                      <input
                        type='text'
                        placeholder='e.g. Marcus Vance'
                        className='border border-slate-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400'
                        id='driverName'
                        onChange={handleChange}
                        value={formData.driverName}
                      />
                    </div>

                    <div className='flex flex-col gap-1'>
                      <label htmlFor='driverContact' className='text-xs font-medium text-slate-700'>
                        Driver Phone / WhatsApp
                      </label>
                      <input
                        type='text'
                        placeholder='e.g. +1 (555) 019-2834'
                        className='border border-slate-300 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400'
                        id='driverContact'
                        onChange={handleChange}
                        value={formData.driverContact}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pricing Section */}
          <div className='flex flex-wrap gap-6 items-center pt-2'>
            <div className='flex items-center gap-3'>
              <input
                type='number'
                id='price'
                min='1'
                max='10000000'
                required
                className='p-3 border border-slate-300 rounded-lg w-32 focus:outline-none focus:ring-2 focus:ring-slate-400'
                onChange={handleChange}
                value={formData.price}
              />
              <div className='flex flex-col'>
                <p className='font-medium text-slate-800'>
                  {formData.category === 'guesthouse' ? 'Price per Night' : 'Daily Rate (with Driver)'}
                </p>
                <span className='text-xs text-slate-500'>
                  {formData.category === 'guesthouse' ? '($ / night)' : '($ / day)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Media & Submission Section */}
        <div className='flex flex-col flex-1 gap-4'>
          <div className='flex flex-col gap-3'>
            <div className='flex items-center justify-between'>
              <p className='font-semibold text-slate-800 text-sm'>
                Listing Images ({formData.imageUrls.length}/6)
              </p>
              <span className='font-normal text-slate-500 text-xs'>
                The first image will be the cover
              </span>
            </div>

            {/* Camera & Local File Action Cards */}
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              {/* Option 1: Live Device Camera Capture */}
              <button
                type='button'
                onClick={() => {
                  if (formData.imageUrls.length >= 6) {
                    setImageUploadError('You can only have up to 6 images per listing');
                    return;
                  }
                  setImageUploadError(false);
                  setIsCameraOpen(true);
                }}
                disabled={uploading || formData.imageUrls.length >= 6}
                id='open-device-camera-btn'
                className='flex flex-col items-center justify-center p-4 border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/50 hover:bg-indigo-50/90 rounded-xl transition cursor-pointer group text-center disabled:opacity-60 disabled:cursor-not-allowed shadow-xs'
              >
                <div className='w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center mb-1.5 group-hover:scale-110 transition'>
                  <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z'
                    />
                    <circle cx='12' cy='13' r='3' strokeWidth='2' />
                  </svg>
                </div>
                <span className='text-xs font-bold text-indigo-950 group-hover:text-indigo-900 flex items-center gap-1.5'>
                  {t('form.takePhoto') || 'Take Photo with Camera'}
                  <span className='text-[10px] bg-indigo-200/80 text-indigo-800 px-1.5 py-0.5 rounded-full font-medium'>
                    Live
                  </span>
                </span>
                <span className='text-[11px] text-slate-500 mt-0.5'>
                  Snap photos with your phone camera or laptop webcam
                </span>
              </button>

              {/* Option 2: Choose Images from Local Device */}
              <div className='relative'>
                <input
                  onChange={(e) => {
                    handleProcessLocalFiles(e.target.files);
                    e.target.value = '';
                  }}
                  className='hidden'
                  type='file'
                  id='local-system-images'
                  accept='image/*'
                  multiple
                />
                <label
                  htmlFor='local-system-images'
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer?.files) {
                      handleProcessLocalFiles(e.dataTransfer.files);
                    }
                  }}
                  className='flex flex-col items-center justify-center p-4 border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/80 rounded-xl transition cursor-pointer group text-center h-full'
                >
                  <div className='w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-1.5 group-hover:scale-110 transition'>
                    <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' />
                    </svg>
                  </div>
                  <span className='text-xs font-bold text-emerald-950 group-hover:text-emerald-900'>
                    Choose Images from Device
                  </span>
                  <span className='text-[11px] text-slate-500 mt-0.5'>
                    Browse local files or drag &amp; drop photos
                  </span>
                </label>
              </div>
            </div>

            {/* Direct Mobile Camera Input (Instant system shutter shortcut) */}
            <div className='flex items-center justify-between px-3 py-2 bg-slate-100/80 rounded-lg text-xs text-slate-600 border border-slate-200'>
              <span className='flex items-center gap-1.5 text-[11px] font-medium text-slate-700'>
                <svg className='w-3.5 h-3.5 text-slate-500' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z' />
                </svg>
                Mobile quick camera trigger:
              </span>
              <input
                type='file'
                accept='image/*'
                capture='environment'
                id='direct-mobile-camera-capture'
                className='hidden'
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleProcessCameraPhoto(e.target.files[0]);
                    e.target.value = '';
                  }
                }}
              />
              <label
                htmlFor='direct-mobile-camera-capture'
                className='text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline text-[11px]'
              >
                Open Native Camera App
              </label>
            </div>

            {uploading && (
              <div className='p-2.5 bg-emerald-100/90 text-emerald-900 rounded-lg text-xs flex items-center justify-center gap-2 font-medium animate-pulse'>
                <span className='w-3.5 h-3.5 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin' />
                <span>Optimizing &amp; uploading photo...</span>
              </div>
            )}

            {cameraNotice && (
              <div className='p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs flex items-center gap-2 font-medium'>
                <svg className='w-4 h-4 text-emerald-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M5 13l4 4L19 7' />
                </svg>
                <span>{cameraNotice}</span>
              </div>
            )}
          </div>

          {/* Curated Sample Photo Presets */}
          <div className='p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex flex-col gap-2'>
            <div className='flex items-center justify-between'>
              <span className='text-xs font-semibold text-blue-900'>
                {formData.category === 'guesthouse'
                  ? 'Sample Apartment Airbnb Photos'
                  : 'Sample City Cars & Driver Photos'}
              </span>
              <span className='text-[10px] text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full font-medium'>
                Click to Add
              </span>
            </div>
            <div className='grid grid-cols-3 gap-2'>
              {formData.category === 'guesthouse' ? (
                <>
                  <button
                    type='button'
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        imageUrls: Array.from(
                          new Set([
                            ...prev.imageUrls,
                            '/images/airbnb_apartment_living.jpg',
                            'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
                          ])
                        ).slice(0, 6),
                      }))
                    }
                    className='flex flex-col items-center gap-1 p-1.5 bg-white border border-blue-200 rounded-lg hover:border-blue-400 hover:shadow-xs text-center transition cursor-pointer'
                  >
                    <img
                      src='/images/airbnb_apartment_living.jpg'
                      alt='Modern Studio Airbnb'
                      className='w-full h-12 object-cover rounded'
                    />
                    <span className='text-[10px] font-medium text-slate-700 truncate w-full'>
                      Modern Studio
                    </span>
                  </button>
                  <button
                    type='button'
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        imageUrls: Array.from(
                          new Set([
                            ...prev.imageUrls,
                            '/images/airbnb_apartment_bed.jpg',
                            'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
                          ])
                        ).slice(0, 6),
                      }))
                    }
                    className='flex flex-col items-center gap-1 p-1.5 bg-white border border-blue-200 rounded-lg hover:border-blue-400 hover:shadow-xs text-center transition cursor-pointer'
                  >
                    <img
                      src='/images/airbnb_apartment_bed.jpg'
                      alt='Cozy Bedroom Airbnb'
                      className='w-full h-12 object-cover rounded'
                    />
                    <span className='text-[10px] font-medium text-slate-700 truncate w-full'>
                      Cozy Bedroom
                    </span>
                  </button>
                  <button
                    type='button'
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        imageUrls: Array.from(
                          new Set([
                            ...prev.imageUrls,
                            'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
                            'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80',
                          ])
                        ).slice(0, 6),
                      }))
                    }
                    className='flex flex-col items-center gap-1 p-1.5 bg-white border border-blue-200 rounded-lg hover:border-blue-400 hover:shadow-xs text-center transition cursor-pointer'
                  >
                    <img
                      src='https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=300&q=80'
                      alt='Urban Loft'
                      className='w-full h-12 object-cover rounded'
                    />
                    <span className='text-[10px] font-medium text-slate-700 truncate w-full'>
                      Urban Loft
                    </span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type='button'
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        imageUrls: Array.from(
                          new Set([
                            ...prev.imageUrls,
                            '/images/city_regular_sedan.jpg',
                            'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1200&q=80',
                          ])
                        ).slice(0, 6),
                      }))
                    }
                    className='flex flex-col items-center gap-1 p-1.5 bg-white border border-blue-200 rounded-lg hover:border-blue-400 hover:shadow-xs text-center transition cursor-pointer'
                  >
                    <img
                      src='/images/city_regular_sedan.jpg'
                      alt='City Sedan (Corolla)'
                      className='w-full h-12 object-cover rounded'
                    />
                    <span className='text-[10px] font-medium text-slate-700 truncate w-full'>
                      City Sedan
                    </span>
                  </button>
                  <button
                    type='button'
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        imageUrls: Array.from(
                          new Set([
                            ...prev.imageUrls,
                            '/images/city_driver_car.jpg',
                            'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80',
                          ])
                        ).slice(0, 6),
                      }))
                    }
                    className='flex flex-col items-center gap-1 p-1.5 bg-white border border-blue-200 rounded-lg hover:border-blue-400 hover:shadow-xs text-center transition cursor-pointer'
                  >
                    <img
                      src='/images/city_driver_car.jpg'
                      alt='City Car & Driver'
                      className='w-full h-12 object-cover rounded'
                    />
                    <span className='text-[10px] font-medium text-slate-700 truncate w-full'>
                      Car & Driver
                    </span>
                  </button>
                  <button
                    type='button'
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        imageUrls: Array.from(
                          new Set([
                            ...prev.imageUrls,
                            'https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=1200&q=80',
                            'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=1200&q=80',
                          ])
                        ).slice(0, 6),
                      }))
                    }
                    className='flex flex-col items-center gap-1 p-1.5 bg-white border border-blue-200 rounded-lg hover:border-blue-400 hover:shadow-xs text-center transition cursor-pointer'
                  >
                    <img
                      src='https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=300&q=80'
                      alt='Executive Sedan (Camry)'
                      className='w-full h-12 object-cover rounded'
                    />
                    <span className='text-[10px] font-medium text-slate-700 truncate w-full'>
                      Executive Sedan
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>

          {imageUploadError && (
            <p className='text-red-600 text-sm bg-red-50 p-2.5 rounded-lg border border-red-200'>
              {imageUploadError}
            </p>
          )}

          {formData.imageUrls.length > 0 && (
            <div className='flex flex-col gap-2 max-h-80 overflow-y-auto pr-1'>
              {formData.imageUrls.map((url, index) => (
                <div
                  key={url + index}
                  className='flex justify-between p-3 border border-slate-200 rounded-lg items-center bg-white shadow-xs'
                >
                  <img
                    src={url}
                    alt='listing preview'
                    className='w-20 h-16 object-cover rounded-md'
                  />
                  <span className='text-xs text-slate-500'>
                    {index === 0 ? 'Cover Photo' : `Photo ${index + 1}`}
                  </span>
                  <button
                    type='button'
                    onClick={() => handleRemoveImage(index)}
                    className='p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg text-xs font-semibold uppercase transition'
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type='submit'
            disabled={loading || uploading || !isEmailVerified}
            className='p-3.5 bg-black text-white rounded-lg uppercase hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold tracking-wide transition shadow-sm cursor-pointer'
          >
            {!isEmailVerified ? 'Verify Email to Submit Listing' : loading ? 'Submitting...' : 'Submit Listing for Review'}
          </button>

          {error && (
            <p className='text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200'>
              {error}
            </p>
          )}

          <div className='p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed'>
            <p className='font-semibold text-slate-700 mb-1'>Moderation Notice:</p>
            All submitted guest houses and chauffeured car listings are held in
            a pending state for administrator moderation. Once verified, your
            listing will appear on the homepage and search catalog.
          </div>
        </div>
      </form>

      {/* Interactive Device Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleProcessCameraPhoto}
        maxAllowed={6}
        currentCount={formData.imageUrls.length}
      />
    </main>
  );
}
