import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  FaArrowLeft,
  FaCamera,
  FaUpload,
  FaTrashAlt,
  FaHome,
  FaCar,
  FaCheck,
  FaShieldAlt,
} from 'react-icons/fa';
import { getListingById, updateListing } from '../services/listingService';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { compressImage } from '../utils/imageCompressor';
import CameraCaptureModal from '../components/CameraCaptureModal';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { app } from '../firebase';

export default function UpdateListing() {
  const { listingId } = useParams();
  const { t } = useLanguage();
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    type: 'guesthouse',
    title: '',
    description: '',
    price: 50,
    priceUnit: 'night',
    currency: 'USD',
    city: '',
    area: '',
    address: '',
    contactPhone: '',
    images: [],
    // Guesthouse
    bedrooms: 1,
    bathrooms: 1,
    maxGuests: 2,
    amenities: ['WiFi', 'Air Conditioning'],
    checkIn: '14:00',
    checkOut: '11:00',
    houseRules: '',
    // Car
    make: '',
    model: '',
    year: new Date().getFullYear(),
    transmission: 'automatic',
    fuel: 'Petrol',
    seats: 4,
    mileageLimit: '200 km / day',
    deposit: 0,
    minLeaseTerm: '1 day',
    driverIncluded: false,
    status: 'pending',
    rejectionReason: '',
  });

  const [uploadingImage, setUploadingImage] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraNotice, setCameraNotice] = useState('');

  // Load listing data
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const item = await getListingById(listingId);
        if (!item) {
          if (isMounted) setError('Listing not found or has been deleted.');
          return;
        }

        // Verify authorization
        const isOwner = currentUser && (currentUser.uid === item.ownerId || currentUser._id === item.ownerId);
        if (!isOwner && !isAdmin) {
          if (isMounted) setError('You do not have permission to edit this listing.');
          return;
        }

        if (isMounted) {
          setFormData({
            type: item.type || (item.category === 'car_service' ? 'car' : 'guesthouse'),
            title: item.title || item.name || '',
            description: item.description || '',
            price: Number(item.price || item.regularPrice) || 50,
            priceUnit: item.priceUnit || (item.type === 'car' ? 'day' : 'night'),
            currency: item.currency || 'USD',
            city: item.city || item.location || '',
            area: item.area || '',
            address: item.address || item.location || '',
            contactPhone: item.contactPhone || '',
            images: Array.isArray(item.images) && item.images.length > 0
              ? item.images
              : Array.isArray(item.imageUrls) ? item.imageUrls : [],
            bedrooms: Number(item.bedrooms) || 1,
            bathrooms: Number(item.bathrooms) || 1,
            maxGuests: Number(item.maxGuests) || 2,
            amenities: Array.isArray(item.amenities) ? item.amenities : ['WiFi'],
            checkIn: item.checkIn || '14:00',
            checkOut: item.checkOut || '11:00',
            houseRules: item.houseRules || '',
            make: item.make || '',
            model: item.model || '',
            year: Number(item.year) || new Date().getFullYear(),
            transmission: item.transmission || 'automatic',
            fuel: item.fuel || 'Petrol',
            seats: Number(item.seats) || 4,
            mileageLimit: item.mileageLimit || '200 km / day',
            deposit: Number(item.deposit) || 0,
            minLeaseTerm: item.minLeaseTerm || '1 day',
            driverIncluded: Boolean(item.driverIncluded),
            status: item.status || 'pending',
            rejectionReason: item.rejectionReason || '',
          });
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load listing.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [listingId, currentUser, isAdmin]);

  // Image Upload helper
  const storeImage = async (file) => {
    const optimizedDataUrl = await compressImage(file, {
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 0.85,
    });

    return new Promise((resolve) => {
      try {
        const storage = getStorage(app);
        const userId = currentUser?.uid || 'user';
        const fileName = `${Date.now()}_${(file.name || 'photo').replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const storageRef = ref(storage, `listings/${userId}/${fileName}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on(
          'state_changed',
          null,
          (err) => {
            console.warn('Storage fallback:', err);
            resolve(optimizedDataUrl);
          },
          () => {
            getDownloadURL(uploadTask.snapshot.ref)
              .then((url) => resolve(url))
              .catch(() => resolve(optimizedDataUrl));
          }
        );
      } catch {
        resolve(optimizedDataUrl);
      }
    });
  };

  // Camera photo process
  const handleProcessCameraPhoto = async (file) => {
    if (!file) return;
    if (formData.images.length >= 8) {
      alert('You can upload up to 8 images per listing.');
      return;
    }

    setUploadingImage(true);
    setCameraNotice('Uploading photo taken with camera...');
    try {
      const url = await storeImage(file);
      if (url) {
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, url].slice(0, 8),
        }));
        setCameraNotice('Photo captured and added!');
        setTimeout(() => setCameraNotice(''), 3000);
      }
    } catch (err) {
      alert('Failed to upload camera photo: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  // File picker handler
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (formData.images.length + files.length > 8) {
      alert('You can only have up to 8 images per listing.');
      return;
    }

    setUploadingImage(true);
    try {
      const urls = await Promise.all(files.map((f) => storeImage(f)));
      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, ...urls.filter(Boolean)].slice(0, 8),
      }));
    } catch (err) {
      alert('Failed to upload image: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = (index) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleChange = (e) => {
    const { id, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setFormData((prev) => ({ ...prev, [id]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [id]: value }));
    }
  };

  const handleAmenitiesToggle = (item) => {
    setFormData((prev) => {
      const current = prev.amenities || [];
      const updated = current.includes(item)
        ? current.filter((a) => a !== item)
        : [...current, item];
      return { ...prev, amenities: updated };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      return setError('Title is required.');
    }
    if (formData.images.length === 0) {
      return setError('Please provide at least 1 photo.');
    }
    if (Number(formData.price) <= 0) {
      return setError('Price must be greater than 0.');
    }

    setSaving(true);
    setError(null);
    setSuccessNotice(null);

    try {
      const updates = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        price: Number(formData.price),
        priceUnit: formData.priceUnit,
        currency: formData.currency,
        city: formData.city.trim(),
        area: formData.area.trim(),
        address: formData.address.trim(),
        contactPhone: formData.contactPhone.trim(),
        images: formData.images,
      };

      if (formData.type === 'guesthouse') {
        updates.bedrooms = Number(formData.bedrooms);
        updates.bathrooms = Number(formData.bathrooms);
        updates.maxGuests = Number(formData.maxGuests);
        updates.amenities = formData.amenities;
        updates.checkIn = formData.checkIn;
        updates.checkOut = formData.checkOut;
        updates.houseRules = formData.houseRules;
      } else {
        updates.make = formData.make.trim();
        updates.model = formData.model.trim();
        updates.year = Number(formData.year);
        updates.transmission = formData.transmission;
        updates.fuel = formData.fuel;
        updates.seats = Number(formData.seats);
        updates.mileageLimit = formData.mileageLimit;
        updates.deposit = Number(formData.deposit);
        updates.minLeaseTerm = formData.minLeaseTerm;
        updates.driverIncluded = Boolean(formData.driverIncluded);
      }

      await updateListing(listingId, updates, isAdmin);
      setSuccessNotice('Listing updated successfully!');
      setTimeout(() => {
        navigate(`/listing/${listingId}`);
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to update listing.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className='min-h-[70vh] flex flex-col items-center justify-center space-y-3'>
        <div className='w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin' />
        <p className='text-xs text-slate-500'>Loading listing details...</p>
      </div>
    );
  }

  if (error && !formData.title) {
    return (
      <div className='min-h-[60vh] flex flex-col items-center justify-center p-4 text-center space-y-4'>
        <div className='w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-xl'>
          <FaShieldAlt />
        </div>
        <h2 className='text-xl font-bold text-slate-900'>Cannot Edit Listing</h2>
        <p className='text-xs text-slate-600 max-w-sm'>{error}</p>
        <Link
          to='/profile'
          className='px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800'
        >
          Return to My Listings
        </Link>
      </div>
    );
  }

  const isGuestHouse = formData.type === 'guesthouse';

  return (
    <div className='max-w-4xl mx-auto px-4 py-8 space-y-6 text-slate-800'>
      <div className='flex items-center justify-between'>
        <button
          type='button'
          onClick={() => navigate(-1)}
          className='inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition py-1 cursor-pointer'
        >
          <FaArrowLeft />
          <span>Back</span>
        </button>

        <span className='px-3 py-1 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-full uppercase'>
          {isGuestHouse ? 'Guest House' : 'Car Leasing'}
        </span>
      </div>

      <div className='bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6'>
        <div>
          <h1 className='text-2xl font-black text-slate-900'>Edit Listing</h1>
          <p className='text-xs text-slate-500 mt-1'>
            Update your property specifications, photos, and rental rates.
          </p>
        </div>

        {/* Moderation Status Reminder */}
        <div className='p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1'>
          <p className='font-bold text-slate-700'>
            Current Status: <span className='uppercase'>{formData.status}</span>
          </p>
          <p className='text-slate-500'>
            Changes to your listing details are saved directly. Moderation status is maintained according to platform policies.
          </p>
          {formData.status === 'rejected' && formData.rejectionReason && (
            <p className='text-rose-700 font-semibold pt-1'>
              Feedback: {formData.rejectionReason}
            </p>
          )}
        </div>

        {error && (
          <div className='p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold'>
            {error}
          </div>
        )}

        {successNotice && (
          <div className='p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold'>
            {successNotice}
          </div>
        )}

        <form onSubmit={handleSubmit} className='space-y-6'>
          {/* General Information */}
          <div className='space-y-4'>
            <h3 className='text-sm font-bold uppercase tracking-wider text-slate-400'>
              General Information
            </h3>

            <div>
              <label className='block text-xs font-bold text-slate-700 mb-1'>Listing Title</label>
              <input
                type='text'
                id='title'
                value={formData.title}
                onChange={handleChange}
                required
                className='w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden'
              />
            </div>

            <div>
              <label className='block text-xs font-bold text-slate-700 mb-1'>Description</label>
              <textarea
                id='description'
                rows={4}
                value={formData.description}
                onChange={handleChange}
                required
                className='w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden'
              />
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
              <div>
                <label className='block text-xs font-bold text-slate-700 mb-1'>Price</label>
                <input
                  type='number'
                  id='price'
                  min='1'
                  value={formData.price}
                  onChange={handleChange}
                  required
                  className='w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden'
                />
              </div>

              <div>
                <label className='block text-xs font-bold text-slate-700 mb-1'>Price Unit</label>
                <select
                  id='priceUnit'
                  value={formData.priceUnit}
                  onChange={handleChange}
                  className='w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden bg-white'
                >
                  <option value='night'>Per Night</option>
                  <option value='day'>Per Day</option>
                  <option value='month'>Per Month</option>
                </select>
              </div>

              <div>
                <label className='block text-xs font-bold text-slate-700 mb-1'>Currency</label>
                <select
                  id='currency'
                  value={formData.currency}
                  onChange={handleChange}
                  className='w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden bg-white'
                >
                  <option value='USD'>USD ($)</option>
                  <option value='EUR'>EUR (€)</option>
                  <option value='ERN'>ERN (Nkf)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Location & Contact */}
          <div className='space-y-4 pt-4 border-t border-slate-100'>
            <h3 className='text-sm font-bold uppercase tracking-wider text-slate-400'>
              Location &amp; Host Contact
            </h3>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              <div>
                <label className='block text-xs font-bold text-slate-700 mb-1'>City</label>
                <input
                  type='text'
                  id='city'
                  value={formData.city}
                  onChange={handleChange}
                  required
                  placeholder='e.g. Asmara'
                  className='w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden'
                />
              </div>

              <div>
                <label className='block text-xs font-bold text-slate-700 mb-1'>Area / Neighborhood</label>
                <input
                  type='text'
                  id='area'
                  value={formData.area}
                  onChange={handleChange}
                  placeholder='e.g. Downtown or Tiravolo'
                  className='w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden'
                />
              </div>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              <div>
                <label className='block text-xs font-bold text-slate-700 mb-1'>Full Address</label>
                <input
                  type='text'
                  id='address'
                  value={formData.address}
                  onChange={handleChange}
                  className='w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden'
                />
              </div>

              <div>
                <label className='block text-xs font-bold text-slate-700 mb-1'>Contact Phone / WhatsApp</label>
                <input
                  type='tel'
                  id='contactPhone'
                  value={formData.contactPhone}
                  onChange={handleChange}
                  required
                  placeholder='+291 1 123456'
                  className='w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden'
                />
              </div>
            </div>
          </div>

          {/* Type-Specific Fields */}
          {isGuestHouse ? (
            <div className='space-y-4 pt-4 border-t border-slate-100'>
              <h3 className='text-sm font-bold uppercase tracking-wider text-slate-400'>
                Guest House Amenities &amp; Rules
              </h3>

              <div className='grid grid-cols-3 gap-3'>
                <div>
                  <label className='block text-xs font-bold text-slate-700 mb-1'>Bedrooms</label>
                  <input
                    type='number'
                    id='bedrooms'
                    min='1'
                    value={formData.bedrooms}
                    onChange={handleChange}
                    className='w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden'
                  />
                </div>
                <div>
                  <label className='block text-xs font-bold text-slate-700 mb-1'>Bathrooms</label>
                  <input
                    type='number'
                    id='bathrooms'
                    min='1'
                    value={formData.bathrooms}
                    onChange={handleChange}
                    className='w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden'
                  />
                </div>
                <div>
                  <label className='block text-xs font-bold text-slate-700 mb-1'>Max Guests</label>
                  <input
                    type='number'
                    id='maxGuests'
                    min='1'
                    value={formData.maxGuests}
                    onChange={handleChange}
                    className='w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden'
                  />
                </div>
              </div>

              <div>
                <label className='block text-xs font-bold text-slate-700 mb-2'>Amenities Included</label>
                <div className='grid grid-cols-2 sm:grid-cols-4 gap-2'>
                  {['WiFi', 'Air Conditioning', 'Kitchen', 'Free Parking', 'Balcony', 'Pool', 'Generator Backup'].map(
                    (am) => (
                      <button
                        key={am}
                        type='button'
                        onClick={() => handleAmenitiesToggle(am)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between cursor-pointer transition ${
                          formData.amenities.includes(am)
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span>{am}</span>
                        {formData.amenities.includes(am) && <FaCheck className='text-amber-400 text-xs' />}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                <div>
                  <label className='block text-xs font-bold text-slate-700 mb-1'>Check-In Time</label>
                  <input
                    type='text'
                    id='checkIn'
                    value={formData.checkIn}
                    onChange={handleChange}
                    placeholder='14:00'
                    className='w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden'
                  />
                </div>
                <div>
                  <label className='block text-xs font-bold text-slate-700 mb-1'>Check-Out Time</label>
                  <input
                    type='text'
                    id='checkOut'
                    value={formData.checkOut}
                    onChange={handleChange}
                    placeholder='11:00'
                    className='w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden'
                  />
                </div>
              </div>

              <div>
                <label className='block text-xs font-bold text-slate-700 mb-1'>House Rules</label>
                <input
                  type='text'
                  id='houseRules'
                  value={formData.houseRules}
                  onChange={handleChange}
                  placeholder='e.g. No smoking, quiet hours after 10 PM'
                  className='w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden'
                />
              </div>
            </div>
          ) : (
            <div className='space-y-4 pt-4 border-t border-slate-100'>
              <h3 className='text-sm font-bold uppercase tracking-wider text-slate-400'>
                Vehicle Specifications
              </h3>

              <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
                <div>
                  <label className='block text-xs font-bold text-slate-700 mb-1'>Make</label>
                  <input
                    type='text'
                    id='make'
                    value={formData.make}
                    onChange={handleChange}
                    placeholder='e.g. Toyota'
                    className='w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden'
                  />
                </div>
                <div>
                  <label className='block text-xs font-bold text-slate-700 mb-1'>Model</label>
                  <input
                    type='text'
                    id='model'
                    value={formData.model}
                    onChange={handleChange}
                    placeholder='e.g. Land Cruiser Prado'
                    className='w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden'
                  />
                </div>
                <div>
                  <label className='block text-xs font-bold text-slate-700 mb-1'>Year</label>
                  <input
                    type='number'
                    id='year'
                    value={formData.year}
                    onChange={handleChange}
                    className='w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden'
                  />
                </div>
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
                <div>
                  <label className='block text-xs font-bold text-slate-700 mb-1'>Transmission</label>
                  <select
                    id='transmission'
                    value={formData.transmission}
                    onChange={handleChange}
                    className='w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden bg-white'
                  >
                    <option value='automatic'>Automatic</option>
                    <option value='manual'>Manual</option>
                  </select>
                </div>
                <div>
                  <label className='block text-xs font-bold text-slate-700 mb-1'>Fuel</label>
                  <select
                    id='fuel'
                    value={formData.fuel}
                    onChange={handleChange}
                    className='w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden bg-white'
                  >
                    <option value='Petrol'>Petrol</option>
                    <option value='Diesel'>Diesel</option>
                    <option value='Hybrid'>Hybrid</option>
                    <option value='Electric'>Electric</option>
                  </select>
                </div>
                <div>
                  <label className='block text-xs font-bold text-slate-700 mb-1'>Passenger Seats</label>
                  <input
                    type='number'
                    id='seats'
                    min='1'
                    value={formData.seats}
                    onChange={handleChange}
                    className='w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden'
                  />
                </div>
              </div>

              <div className='flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl'>
                <input
                  type='checkbox'
                  id='driverIncluded'
                  checked={formData.driverIncluded}
                  onChange={handleChange}
                  className='w-4 h-4 rounded-sm text-slate-900 focus:ring-slate-900'
                />
                <label htmlFor='driverIncluded' className='text-xs font-bold text-slate-800 cursor-pointer'>
                  Private Chauffeur / Driver Included with vehicle
                </label>
              </div>
            </div>
          )}

          {/* Photo Management */}
          <div className='space-y-4 pt-4 border-t border-slate-100'>
            <div className='flex items-center justify-between'>
              <div>
                <h3 className='text-sm font-bold uppercase tracking-wider text-slate-400'>
                  Photos ({formData.images.length}/8)
                </h3>
                <p className='text-xs text-slate-500'>
                  The first image will be used as the listing cover thumbnail.
                </p>
              </div>

              <div className='flex items-center gap-2'>
                <button
                  type='button'
                  onClick={() => setIsCameraOpen(true)}
                  disabled={uploadingImage || formData.images.length >= 8}
                  className='inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-300 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50'
                >
                  <FaCamera />
                  <span>Take Photo</span>
                </button>

                <label className='inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer'>
                  <FaUpload />
                  <span>Upload Files</span>
                  <input
                    type='file'
                    multiple
                    accept='image/*'
                    onChange={handleFileChange}
                    className='hidden'
                  />
                </label>
              </div>
            </div>

            {cameraNotice && (
              <div className='p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs font-medium'>
                {cameraNotice}
              </div>
            )}

            {/* Gallery Grid */}
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
              {formData.images.map((url, idx) => (
                <div key={idx} className='relative group rounded-xl overflow-hidden border border-slate-200 aspect-4/3 bg-slate-100'>
                  <img src={url} alt={`Listing ${idx + 1}`} className='w-full h-full object-cover' />
                  {idx === 0 && (
                    <span className='absolute bottom-2 left-2 px-2 py-0.5 bg-slate-900/90 text-amber-300 text-[10px] font-bold rounded-md'>
                      Cover
                    </span>
                  )}
                  <button
                    type='button'
                    onClick={() => handleRemoveImage(idx)}
                    className='absolute top-2 right-2 p-1.5 bg-rose-600/90 text-white rounded-lg opacity-90 group-hover:opacity-100 hover:bg-rose-700 transition shadow-xs cursor-pointer'
                  >
                    <FaTrashAlt className='text-xs' />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            type='submit'
            disabled={saving || uploadingImage}
            className='w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition shadow-sm disabled:opacity-50 cursor-pointer'
          >
            {saving ? 'Saving Changes...' : 'Save & Update Listing'}
          </button>
        </form>
      </div>

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleProcessCameraPhoto}
        maxAllowed={8}
        currentCount={formData.images.length}
      />
    </div>
  );
}
