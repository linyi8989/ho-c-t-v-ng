import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  User as FirebaseUser,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithCustomToken,
  ConfirmationResult,
  updateProfile,
  linkWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import {
  LOCAL_AUTH_BYPASS_TOKEN,
  LOCAL_AUTH_BYPASS_USER,
  isLocalBrowserAuthBypassEnabled,
} from '../lib/localAuthBypass';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  phoneVerified?: boolean;
  role: 'super_admin' | 'teacher' | 'student';
  status: 'active' | 'pending' | 'blocked' | 'deleted';
  createdAt: string;
}

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  token: string | null;
  registerWithEmail: (email: string, pass: string, name: string, phone?: string, otpCode?: string) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  loginWithPhonePassword: (phone: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  sendPhoneOtp: (phone: string, containerId: string) => Promise<void>;
  verifyPhoneOtp: (otp: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const AUTH_OPERATION_TIMEOUT_MS = 8000;
const LOCAL_AUTH_BYPASS_ENABLED = isLocalBrowserAuthBypassEnabled(
  import.meta.env.VITE_LOCAL_AUTH_BYPASS_ENABLED,
  typeof window === 'undefined' ? '' : window.location.hostname
);
const LOCAL_AUTH_USER: UserProfile = { ...LOCAL_AUTH_BYPASS_USER };

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), AUTH_OPERATION_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function getDefaultRole(email: string): UserProfile['role'] {
  if (email === "linyi8901@gmail.com" || email === "admin@vocabulary.edu.vn") {
    return "super_admin";
  }

  return "student";
}

function normalizePhoneForFirebase(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  let compact = raw.replace(/[^\d+]/g, "");
  if (compact.startsWith("00")) compact = `+${compact.slice(2)}`;
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("0")) return `+84${compact.slice(1)}`;
  if (compact.startsWith("84")) return `+${compact}`;
  return `+84${compact}`;
}

function createDefaultProfile(firebaseUserInstance: FirebaseUser, phone?: string): UserProfile {
  const email = firebaseUserInstance.email || "";

  return {
    id: firebaseUserInstance.uid,
    name: firebaseUserInstance.displayName || email.split("@")[0] || "Hoc sinh moi",
    email,
    phone,
    phoneVerified: Boolean(phone),
    role: getDefaultRole(email),
    status: "active",
    createdAt: new Date().toISOString()
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(() => (
    LOCAL_AUTH_BYPASS_ENABLED ? LOCAL_AUTH_USER : null
  ));
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(!LOCAL_AUTH_BYPASS_ENABLED);
  const [token, setToken] = useState<string | null>(() => (
    LOCAL_AUTH_BYPASS_ENABLED ? LOCAL_AUTH_BYPASS_TOKEN : null
  ));
  const [phoneConfirmation, setPhoneConfirmation] = useState<ConfirmationResult | null>(null);

  const syncProfileFromStores = async (
    firebaseUserInstance: FirebaseUser,
    idToken: string
  ): Promise<UserProfile> => {
    const res = await withTimeout(
      fetch('/api/me', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }),
      "Timed out while loading user profile from backend."
    );

    if (!res.ok) {
      throw new Error(`Backend profile verification failed with HTTP ${res.status}.`);
    }

    const profile = await res.json();
    console.log("Profile verified and fetched via Backend API /api/me.");
    return profile;
  };

  const fetchProfile = async (
    firebaseUserInstance: FirebaseUser,
    phone?: string,
    forceRefreshToken = false,
    waitForProfileSync = false
  ) => {
    const idToken = await withTimeout(
      firebaseUserInstance.getIdToken(forceRefreshToken),
      "Timed out while getting Firebase ID token."
    );
    setToken(idToken);
    const syncPromise = syncProfileFromStores(firebaseUserInstance, idToken);
    if (waitForProfileSync) {
      setUser(await syncPromise);
    } else {
      void syncPromise.then(setUser).catch((err) => {
        console.error("Backend profile verification failed:", err);
        setUser(null);
      });
    }
  };

  useEffect(() => {
    if (LOCAL_AUTH_BYPASS_ENABLED) return;
    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      setLoading(true);
      try {
        if (fUser) {
          setFirebaseUser(fUser);
          await fetchProfile(fUser, undefined, false, false);
        } else {
          setFirebaseUser(null);
          setUser(null);
          setToken(null);
        }
      } catch (err) {
        console.error("Failed to restore authenticated session:", err);
        setFirebaseUser(null);
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    }, (err) => {
      console.error("Firebase auth state listener failed:", err);
      setFirebaseUser(null);
      setUser(null);
      setToken(null);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const refreshProfile = async () => {
    if (LOCAL_AUTH_BYPASS_ENABLED) {
      setUser(LOCAL_AUTH_USER);
      setToken(LOCAL_AUTH_BYPASS_TOKEN);
      return;
    }
    if (firebaseUser) {
      await fetchProfile(firebaseUser, undefined, true, true);
    }
  };

  const registerWithEmail = async (email: string, pass: string, name: string, phone?: string, otpCode?: string) => {
    setLoading(true);
    try {
      let credential;
      if (phone && otpCode) {
        if (!phoneConfirmation) {
          throw new Error("Khong tim thay yeu cau gui ma OTP. Vui long gui lai ma.");
        }
        const phoneResult = await phoneConfirmation.confirm(otpCode);
        const emailCred = EmailAuthProvider.credential(email, pass);
        credential = await linkWithCredential(phoneResult.user, emailCred);
      } else {
        credential = await createUserWithEmailAndPassword(auth, email, pass);
      }

      await updateProfile(credential.user, { displayName: name });

      const idToken = await withTimeout(
        credential.user.getIdToken(),
        "Timed out while getting Firebase ID token."
      );
      setToken(idToken);
      setFirebaseUser(credential.user);

      const res = await withTimeout(
        fetch('/api/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ name, phone })
        }),
        "Timed out while notifying backend registration endpoint."
      );

      if (!res.ok) {
        throw new Error(`Backend /api/register failed with HTTP ${res.status}.`);
      }

      const profile = await res.json();
      setUser(profile);
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, pass);
      setFirebaseUser(credential.user);
      await fetchProfile(credential.user, undefined, true, true);
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginWithPhonePassword = async (phone: string, pass: string) => {
    setLoading(true);
    try {
      const res = await withTimeout(
        fetch('/api/auth/login-by-phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, password: pass })
        }),
        "Timed out while verifying phone login."
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.customToken) {
        throw new Error(data.error || 'So dien thoai hoac mat khau khong chinh xac.');
      }

      const credential = await signInWithCustomToken(auth, data.customToken);
      setFirebaseUser(credential.user);
      await fetchProfile(credential.user, undefined, true, true);
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      setFirebaseUser(credential.user);
      await fetchProfile(credential.user, undefined, true, true);
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const sendPhoneOtp = async (phone: string, containerId: string) => {
    try {
      const normalizedPhone = normalizePhoneForFirebase(phone);
      if (!normalizedPhone) throw new Error("Invalid phone number.");
      const verifier = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible',
      });

      const confirmation = await signInWithPhoneNumber(auth, normalizedPhone, verifier);
      setPhoneConfirmation(confirmation);
    } catch (err) {
      console.error("Error sending OTP:", err);
      throw err;
    }
  };

  const verifyPhoneOtp = async (otp: string) => {
    if (!phoneConfirmation) {
      throw new Error("No pending phone verification. Please request OTP first.");
    }
    setLoading(true);
    try {
      const result = await phoneConfirmation.confirm(otp);
      setFirebaseUser(result.user);
      await fetchProfile(result.user, undefined, true, true);
    } catch (err) {
      console.error("OTP Verification failed:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (LOCAL_AUTH_BYPASS_ENABLED) {
      setUser(LOCAL_AUTH_USER);
      setFirebaseUser(null);
      setToken(LOCAL_AUTH_BYPASS_TOKEN);
      setPhoneConfirmation(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setFirebaseUser(null);
      setToken(null);
      setPhoneConfirmation(null);
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      firebaseUser,
      loading,
      token,
      registerWithEmail,
      loginWithEmail,
      loginWithPhonePassword,
      loginWithGoogle,
      sendPhoneOtp,
      verifyPhoneOtp,
      logout,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
