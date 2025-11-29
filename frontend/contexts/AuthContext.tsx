import React, { createContext, useContext, useEffect, useState } from 'react';

const API_BASE = 'http://localhost:5001';

// Check if we're in dev mode (Firebase not configured)
const isDevMode = () => {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  return !apiKey || apiKey === 'YOUR_API_KEY_HERE' || apiKey === '';
};

// Frontend user (from Firebase or dev mode)
interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// Backend user (from our database)
interface BackendUser {
  id: string;
  email: string;
  name: string;
  active: boolean;
  preferences: string[];
  watchlist: string[];
  created_at: string;
  updated_at: string;
  created?: boolean; // True if this user was just created
}

const DEFAULT_DEV_USER: AuthUser = {
  uid: 'dev-user-123',
  email: 'dev@prism.local',
  displayName: 'Dev User',
  photoURL: null,
};

interface AuthContextType {
  user: AuthUser | null;
  backendUser: BackendUser | null;
  loading: boolean;
  error: string | null;
  isDevMode: boolean;
  isNewUser: boolean; // True if user just signed up and needs to set preferences
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  clearError: () => void;
  updatePreferences: (preferences: string[]) => Promise<void>;
  dismissNewUserFlag: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [backendUser, setBackendUser] = useState<BackendUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const devMode = isDevMode();

  // Sync user with backend
  const syncWithBackend = async (email: string, name?: string): Promise<BackendUser | null> => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: name || '' }),
      });

      if (!response.ok) {
        console.error('Failed to sync with backend:', response.statusText);
        return null;
      }

      const data = await response.json();
      setBackendUser(data);
      
      // If this is a newly created user, flag them
      if (data.created) {
        setIsNewUser(true);
      }
      
      return data;
    } catch (err) {
      console.error('Backend sync error:', err);
      return null;
    }
  };

  useEffect(() => {
    if (devMode) {
      // In dev mode, check localStorage for persisted session
      const savedUser = localStorage.getItem('prism_dev_user');
      const savedBackendUser = localStorage.getItem('prism_backend_user');
      
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        
        if (savedBackendUser) {
          setBackendUser(JSON.parse(savedBackendUser));
        } else if (parsedUser.email) {
          // Sync with backend if we don't have backend user data
          syncWithBackend(parsedUser.email, parsedUser.displayName).then(bu => {
            if (bu) localStorage.setItem('prism_backend_user', JSON.stringify(bu));
          });
        }
      }
      setLoading(false);
    } else {
      // Production mode: use Firebase
      import('firebase/auth').then(({ onAuthStateChanged }) => {
        import('../lib/firebase').then(({ auth }) => {
          const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
              const authUser = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
              };
              setUser(authUser);
              
              // Sync with backend
              if (firebaseUser.email) {
                await syncWithBackend(firebaseUser.email, firebaseUser.displayName || undefined);
              }
            } else {
              setUser(null);
              setBackendUser(null);
            }
            setLoading(false);
          });
          return () => unsubscribe();
        });
      });
    }
  }, [devMode]);

  const clearError = () => setError(null);
  
  const dismissNewUserFlag = () => setIsNewUser(false);

  const signIn = async (email: string, password: string) => {
    if (devMode) {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const devUser = { ...DEFAULT_DEV_USER, email };
      setUser(devUser);
      localStorage.setItem('prism_dev_user', JSON.stringify(devUser));
      
      // Sync with backend
      const bu = await syncWithBackend(email);
      if (bu) localStorage.setItem('prism_backend_user', JSON.stringify(bu));
      
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const { auth } = await import('../lib/firebase');
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(getErrorMessage(err.code));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    if (devMode) {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const devUser = { ...DEFAULT_DEV_USER, email, displayName: name || 'Dev User' };
      setUser(devUser);
      localStorage.setItem('prism_dev_user', JSON.stringify(devUser));
      
      // Sync with backend
      const bu = await syncWithBackend(email, name);
      if (bu) localStorage.setItem('prism_backend_user', JSON.stringify(bu));
      
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);
      const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
      const { auth } = await import('../lib/firebase');
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      if (name && result.user) {
        await updateProfile(result.user, { displayName: name });
      }
    } catch (err: any) {
      setError(getErrorMessage(err.code));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (devMode) {
      setUser(null);
      setBackendUser(null);
      setIsNewUser(false);
      localStorage.removeItem('prism_dev_user');
      localStorage.removeItem('prism_backend_user');
      return;
    }

    try {
      setError(null);
      const { signOut: firebaseSignOut } = await import('firebase/auth');
      const { auth } = await import('../lib/firebase');
      await firebaseSignOut(auth);
      setBackendUser(null);
      setIsNewUser(false);
    } catch (err: any) {
      setError(getErrorMessage(err.code));
      throw err;
    }
  };

  const signInWithGoogle = async () => {
    if (devMode) {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setUser(DEFAULT_DEV_USER);
      localStorage.setItem('prism_dev_user', JSON.stringify(DEFAULT_DEV_USER));
      
      // Sync with backend
      const bu = await syncWithBackend(DEFAULT_DEV_USER.email!, DEFAULT_DEV_USER.displayName || undefined);
      if (bu) localStorage.setItem('prism_backend_user', JSON.stringify(bu));
      
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);
      const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
      const { auth } = await import('../lib/firebase');
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(getErrorMessage(err.code));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    if (devMode) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return;
    }

    try {
      setError(null);
      const { sendPasswordResetEmail } = await import('firebase/auth');
      const { auth } = await import('../lib/firebase');
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      setError(getErrorMessage(err.code));
      throw err;
    }
  };

  const updatePreferences = async (preferences: string[]) => {
    if (!backendUser) {
      setError('No user logged in');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/users/${backendUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      });

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      const updatedUser = await response.json();
      setBackendUser(updatedUser);
      
      if (devMode) {
        localStorage.setItem('prism_backend_user', JSON.stringify(updatedUser));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update preferences');
      throw err;
    }
  };

  const value = {
    user,
    backendUser,
    loading,
    error,
    isDevMode: devMode,
    isNewUser,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    resetPassword,
    clearError,
    updatePreferences,
    dismissNewUserFlag,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper to convert Firebase error codes to user-friendly messages
function getErrorMessage(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Try signing in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/operation-not-allowed':
      return 'Email/password accounts are not enabled. Contact support.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed. Please try again.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection.';
    default:
      return 'An error occurred. Please try again.';
  }
}
