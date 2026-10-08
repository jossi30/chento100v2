import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { signInSuccess } from '../redux/user/userSlice';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import OAuth from '../components/OAuth';
import { FaUser, FaEnvelope, FaLock, FaPhone } from 'react-icons/fa';

export default function SignUp() {
  const { t } = useLanguage();
  const { signUp } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(true);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username.trim()) {
      setError('Please provide your full name or company name.');
      return;
    }
    if (!formData.email.trim()) {
      setError('Please provide a valid email address.');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!agreed) {
      setError('Please accept the Terms of Service to create an account.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const user = await signUp(
        formData.email.trim(),
        formData.password,
        formData.username.trim(),
        formData.phone.trim()
      );

      dispatch(
        signInSuccess({
          _id: user.uid,
          uid: user.uid,
          email: user.email,
          displayName: formData.username.trim(),
          avatar: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png',
          isAdmin: user.email?.toLowerCase() === 'jossvision11@gmail.com',
          role: user.email?.toLowerCase() === 'jossvision11@gmail.com' ? 'admin' : 'user',
          emailVerified: user.emailVerified,
        })
      );

      navigate('/verify-email');
    } catch (err) {
      let msg = err.message || 'Failed to create account.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'This email is already registered. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'The password is too weak. Please choose a stronger password.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Invalid email address format.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-[75vh] flex items-center justify-center px-4 py-12'>
      <div className='w-full max-w-md bg-white p-8 rounded-2xl border border-slate-200 shadow-sm'>
        <div className='text-center mb-6'>
          <h1 className='text-2xl font-extrabold text-slate-900'>{t('signup.title') || 'Create an Account'}</h1>
          <p className='text-xs text-slate-500 mt-1'>
            Join the verified marketplace for guest houses &amp; car rentals
          </p>
        </div>

        {error && (
          <div className='mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium'>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className='space-y-3.5'>
          <div>
            <label className='block text-xs font-semibold text-slate-700 mb-1'>Full Name / Business Name</label>
            <div className='relative'>
              <FaUser className='absolute left-3.5 top-3.5 text-slate-400 text-xs' />
              <input
                type='text'
                required
                id='username'
                value={formData.username}
                onChange={handleChange}
                placeholder='Jane Doe'
                className='w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900'
              />
            </div>
          </div>

          <div>
            <label className='block text-xs font-semibold text-slate-700 mb-1'>Email Address</label>
            <div className='relative'>
              <FaEnvelope className='absolute left-3.5 top-3.5 text-slate-400 text-xs' />
              <input
                type='email'
                required
                id='email'
                value={formData.email}
                onChange={handleChange}
                placeholder='you@example.com'
                className='w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900'
              />
            </div>
          </div>

          <div>
            <label className='block text-xs font-semibold text-slate-700 mb-1'>Contact Phone / WhatsApp</label>
            <div className='relative'>
              <FaPhone className='absolute left-3.5 top-3.5 text-slate-400 text-xs' />
              <input
                type='tel'
                id='phone'
                value={formData.phone}
                onChange={handleChange}
                placeholder='+1 (555) 019-2834'
                className='w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900'
              />
            </div>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            <div>
              <label className='block text-xs font-semibold text-slate-700 mb-1'>Password</label>
              <div className='relative'>
                <FaLock className='absolute left-3.5 top-3.5 text-slate-400 text-xs' />
                <input
                  type='password'
                  required
                  id='password'
                  value={formData.password}
                  onChange={handleChange}
                  placeholder='Min 6 chars'
                  className='w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900'
                />
              </div>
            </div>

            <div>
              <label className='block text-xs font-semibold text-slate-700 mb-1'>Confirm Password</label>
              <div className='relative'>
                <FaLock className='absolute left-3.5 top-3.5 text-slate-400 text-xs' />
                <input
                  type='password'
                  required
                  id='confirmPassword'
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder='Repeat password'
                  className='w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900'
                />
              </div>
            </div>
          </div>

          <div className='pt-1'>
            <label className='flex items-start gap-2 cursor-pointer text-xs text-slate-600'>
              <input
                type='checkbox'
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className='mt-0.5 rounded text-slate-900 focus:ring-slate-900 cursor-pointer'
              />
              <span>
                I agree to the{' '}
                <Link to='/terms' className='text-amber-600 underline font-medium' target='_blank'>
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to='/privacy' className='text-amber-600 underline font-medium' target='_blank'>
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
          </div>

          <button
            type='submit'
            disabled={loading}
            className='w-full py-3 bg-black hover:bg-neutral-800 text-white font-bold rounded-lg text-sm transition shadow-sm disabled:opacity-50 cursor-pointer'
          >
            {loading ? 'Creating account...' : t('signup.submitButton') || 'Sign Up'}
          </button>

          <div className='relative my-3'>
            <div className='absolute inset-0 flex items-center'>
              <div className='w-full border-t border-slate-200'></div>
            </div>
            <div className='relative flex justify-center text-xs uppercase'>
              <span className='bg-white px-2 text-slate-400 font-semibold'>Or</span>
            </div>
          </div>

          <OAuth />
        </form>

        <div className='mt-5 text-center text-xs text-slate-600'>
          {t('signup.haveAccount') || 'Already have an account?'}{' '}
          <Link to='/sign-in' className='text-amber-600 hover:underline font-bold'>
            {t('signup.signInLink') || 'Sign in'}
          </Link>
        </div>
      </div>
    </div>
  );
}
