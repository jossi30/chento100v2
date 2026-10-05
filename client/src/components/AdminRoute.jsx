import { useSelector } from 'react-redux';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute() {
  const { currentUser: reduxUser } = useSelector((state) => state.user);
  const { currentUser: firebaseUser, isAdmin: authIsAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-slate-900'>
        <div className='w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin' />
      </div>
    );
  }

  const user = firebaseUser || reduxUser;
  if (!user) {
    return <Navigate to='/sign-in' replace />;
  }

  // Check if authenticated user has admin privileges
  const isAdmin =
    authIsAdmin === true ||
    user.isAdmin === true ||
    user.role === 'admin' ||
    (typeof user.email === 'string' &&
      (user.email.toLowerCase() === 'jossvision11@gmail.com' ||
        user.email.toLowerCase() === 'joepatriot30@gmail.com' ||
        user.email.toLowerCase() === 'admin@chento100.com' ||
        user.email.toLowerCase().includes('admin')));

  return isAdmin ? <Outlet /> : <Navigate to='/' replace />;
}
