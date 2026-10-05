import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { signInStart, signInSuccess, signInFailure } from '../redux/user/userSlice';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import OAuth from '../components/OAuth';
import { FaLock, FaEnvelope } from 'react-icons/fa';

export default function SignIn() {
  const { t } = useLanguage();
  const { signIn } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  const from = location.state?.from?.pathname || '/';

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      setError('Please fill in both email and password.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      dispatch(signInStart());

      const user = await signIn(formData.email.trim(), formData.password);

      const userPayload = {
        _id: user.uid,
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        avatar: user.photoURL || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png',
        isAdmin:
          user.email?.toLowerCase() === 'jossvision11@gmail.com' ||
          user.email?.toLowerCase() === 'joepatriot30@gmail.com' ||
          user.email?.toLowerCase() === 'admin@chento100.com' ||
          Boolean(user.email?.toLowerCase().includes('admin')),
        role:
          user.email?.toLowerCase() === 'jossvision11@gmail.com' ||
          user.email?.toLowerCase() === 'joepatriot30@gmail.com' ||
          user.email?.toLowerCase() === 'admin@chento100.com' ||
          user.email?.toLowerCase().includes('admin')
            ? 'admin'
            : 'user',
        emailVerified: user.emailVerified,
      };

      dispatch(signInSuccess(userPayload));
      navigate(from, { replace: true });
    } catch (err) {
      let msg = err.message || 'Failed to sign in. Please verify your credentials.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        msg = 'Invalid email or password. Please check your credentials and try again.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many failed login attempts. Please reset your password or try again later.';
      }
      setError(msg);
      dispatch(signInFailure(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-[75vh] flex items-center justify-center px-4 py-12'>
      <div className='w-full max-w-md bg-white p-8 rounded-2xl border border-slate-200 shadow-sm'>
        <div className='text-center mb-6'>
          <h1 className='text-2xl font-extrabold text-slate-900'>{t('signin.title') || 'Welcome Back'}</h1>
          <p className='text-xs text-slate-500 mt-1'>
            Sign in to manage your guest house or car listings
          </p>
        </div>

        {error && (
          <div className='mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium'>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className='space-y-4'>
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
            <div className='flex justify-between items-center mb-1'>
              <label className='block text-xs font-semibold text-slate-700'>Password</label>
              <Link to='/forgot-password' className='text-xs text-amber-600 hover:underline font-medium'>
                Forgot password?
              </Link>
            </div>
            <div className='relative'>
              <FaLock className='absolute left-3.5 top-3.5 text-slate-400 text-xs' />
              <input
                type='password'
                required
                id='password'
                value={formData.password}
                onChange={handleChange}
                placeholder='••••••••'
                className='w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900'
              />
            </div>
          </div>

          <button
            type='submit'
            disabled={loading}
            className='w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-sm transition shadow-sm disabled:opacity-50 cursor-pointer'
          >
            {loading ? 'Signing in...' : t('signin.submitButton') || 'Sign In'}
          </button>

          <div className='relative my-4'>
            <div className='absolute inset-0 flex items-center'>
              <div className='w-full border-t border-slate-200'></div>
            </div>
            <div className='relative flex justify-center text-xs uppercase'>
              <span className='bg-white px-2 text-slate-400 font-semibold'>Or</span>
            </div>
          </div>

          <OAuth />
        </form>

        <div className='mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-600'>
          {t('signin.noAccount') || "Don't have an account?"}{' '}
          <Link to='/sign-up' className='text-amber-600 hover:underline font-bold'>
            {t('signin.signUpLink') || 'Sign up now'}
          </Link>
        </div>
      </div>
    </div>
  );
}
