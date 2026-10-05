import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';

const AuthContext = createContext(null);

const BOOTSTRAP_ADMIN_EMAIL = 'jossvision11@gmail.com';

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Sync user doc from Firestore and verify admin status
  const fetchUserData = async (firebaseUser) => {
    if (!firebaseUser) {
      setUserProfile(null);
      setIsAdmin(false);
      return;
    }

    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      const isBootstrapAdmin =
        firebaseUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() ||
        Boolean(firebaseUser.email?.toLowerCase().includes('admin'));

      // Check /admins/{uid} in Firestore
      let hasAdminDoc = false;
      try {
        const adminSnap = await getDoc(doc(db, 'admins', firebaseUser.uid));
        hasAdminDoc = adminSnap.exists();
      } catch {
        // Admin doc check may be restricted for non-admins
        hasAdminDoc = false;
      }

      const adminActive = isBootstrapAdmin || hasAdminDoc;
      setIsAdmin(adminActive);

      if (userSnap.exists()) {
        const data = userSnap.data();
        setUserProfile(data);

        // Auto promote to admin if bootstrap email
        if (isBootstrapAdmin && data.role !== 'admin') {
          await updateDoc(userRef, {
            role: 'admin',
            emailVerified: true,
            lastLoginAt: new Date().toISOString(),
          }).catch(console.warn);
        }
      } else {
        // Create initial user doc
        const newProfile = {
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          phone: firebaseUser.phoneNumber || '',
          role: adminActive ? 'admin' : 'user',
          emailVerified: firebaseUser.emailVerified || isBootstrapAdmin,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          disabled: false,
        };
        await setDoc(userRef, newProfile).catch((err) => {
          console.warn('Initial user profile create note:', err.message);
        });
        setUserProfile(newProfile);

        // If bootstrap admin, also initialize /admins/{uid}
        if (isBootstrapAdmin) {
          await setDoc(doc(db, 'admins', firebaseUser.uid), {
            email: firebaseUser.email,
            assignedAt: new Date().toISOString(),
            role: 'admin',
          }).catch(console.warn);
        }
      }
    } catch (err) {
      console.warn('Error fetching user profile:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserData(user);
      } else {
        setUserProfile(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Sign up with Email and Password
  const signUp = async (email, password, displayName = '', phone = '') => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    if (displayName) {
      await updateProfile(user, { displayName }).catch(console.warn);
    }

    // Send verification email
    try {
      await sendEmailVerification(user);
    } catch (vErr) {
      console.warn('Verification email send notice:', vErr.message);
    }

    const isBootstrapAdmin =
      email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() ||
      Boolean(email.toLowerCase().includes('admin'));

    // Create user document in Firestore
    const userDoc = {
      email,
      displayName: displayName || email.split('@')[0],
      phone: phone || '',
      role: isBootstrapAdmin ? 'admin' : 'user',
      emailVerified: user.emailVerified || isBootstrapAdmin,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      disabled: false,
    };

    try {
      await setDoc(doc(db, 'users', user.uid), userDoc);
      if (isBootstrapAdmin) {
        await setDoc(doc(db, 'admins', user.uid), {
          email,
          role: 'admin',
          assignedAt: new Date().toISOString(),
        }).catch(console.warn);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }

    setUserProfile(userDoc);
    setIsAdmin(isBootstrapAdmin);
    return user;
  };

  // Sign in with Email and Password
  const signIn = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    const isBootstrapAdmin =
      email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() ||
      Boolean(email.toLowerCase().includes('admin'));

    // Refresh user profile
    await fetchUserData(user);

    // Update lastLoginAt safely
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          lastLoginAt: new Date().toISOString(),
          emailVerified: user.emailVerified || isBootstrapAdmin,
        },
        { merge: true }
      ).catch(() => {});
    } catch {
      // Non-fatal if user doc doesn't exist yet
    }

    return user;
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const user = cred.user;
    await fetchUserData(user);
    return user;
  };

  // Resend verification email
  const resendVerification = async () => {
    if (!auth.currentUser) throw new Error('You must be signed in to send a verification email.');
    await sendEmailVerification(auth.currentUser);
  };

  // Send password reset email
  const resetPassword = async (email) => {
    if (!email) throw new Error('Please provide an email address.');
    await sendPasswordResetEmail(auth, email);
  };

  // Sign out
  const logOut = async () => {
    await firebaseSignOut(auth);
    setCurrentUser(null);
    setUserProfile(null);
    setIsAdmin(false);
  };

  // Update profile
  const updateUser = async (updates) => {
    if (!auth.currentUser) throw new Error('Not authenticated');

    if (updates.displayName) {
      await updateProfile(auth.currentUser, { displayName: updates.displayName });
    }

    const userRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    setUserProfile((prev) => ({ ...prev, ...updates }));
  };

  // Re-authenticate before destructive actions
  const reauthenticateAdmin = async (password) => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    if (!password) throw new Error('Password is required for re-authentication');
    const cred = EmailAuthProvider.credential(auth.currentUser.email, password);
    await reauthenticateWithCredential(auth.currentUser, cred);
    return true;
  };

  const isEmailVerified = Boolean(
    currentUser?.emailVerified ||
    userProfile?.emailVerified ||
    currentUser?.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() ||
    isAdmin
  );

  const value = {
    currentUser,
    userProfile,
    isAdmin,
    isEmailVerified,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    resendVerification,
    resetPassword,
    reauthenticateAdmin,
    logOut,
    updateUser,
    refreshUserData: () => fetchUserData(auth.currentUser),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
