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
  ConfirmationResult,
  updateProfile,
  linkWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
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
  loginWithGoogle: () => Promise<void>;
  sendPhoneOtp: (phone: string, containerId: string) => Promise<void>;
  verifyPhoneOtp: (otp: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const AUTH_OPERATION_TIMEOUT_MS = 8000;

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

function createDefaultProfile(firebaseUserInstance: FirebaseUser, phone?: string): UserProfile {
  const email = firebaseUserInstance.email || "";

  return {
    id: firebaseUserInstance.uid,
    name: firebaseUserInstance.displayName || email.split("@")[0] || "Hoc sinh moi",
    email,
    phone,
    role: getDefaultRole(email),
    status: "active",
    createdAt: new Date().toISOString()
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [phoneConfirmation, setPhoneConfirmation] = useState<ConfirmationResult | null>(null);

  const syncProfileFromStores = async (
    firebaseUserInstance: FirebaseUser,
    idToken: string,
    fallbackProfile: UserProfile
  ) => {
    let profile: UserProfile | null = null;

    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const userDocRef = doc(db, 'users', firebaseUserInstance.uid);
      const docSnap = await withTimeout(
        getDoc(userDocRef),
        "Timed out while loading user profile from Firestore."
      );

      if (docSnap.exists()) {
        profile = docSnap.data() as UserProfile;
        console.log("Profile fetched successfully via direct Client-Side Firestore SDK.");
      }
    } catch (clientErr) {
      console.warn("Could not fetch profile via Client-Side SDK directly:", clientErr);
    }

    try {
      const res = await withTimeout(
        fetch('/api/me', {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        }),
        "Timed out while loading user profile from backend."
      );

      if (res.ok) {
        profile = await res.json();
        console.log("Profile verified and fetched via Backend API /api/me.");
      }
    } catch (apiErr) {
      console.warn("Backend API /api/me unreachable or failed:", apiErr);
    }

    if (profile) {
      setUser(profile);
      return;
    }

    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const userDocRef = doc(db, 'users', firebaseUserInstance.uid);
      await withTimeout(
        setDoc(userDocRef, fallbackProfile),
        "Timed out while creating user profile in Firestore."
      );
      console.log("Initialized default profile document directly in Firestore.");
    } catch (createErr) {
      console.warn("Could not create profile document. Keeping Firebase-authenticated local profile.", createErr);
    }
  };

  const fetchProfile = async (firebaseUserInstance: FirebaseUser, phone?: string) => {
    const idToken = await withTimeout(
      firebaseUserInstance.getIdToken(),
      "Timed out while getting Firebase ID token."
    );
    const fallbackProfile = createDefaultProfile(firebaseUserInstance, phone);

    setToken(idToken);
    setUser(fallbackProfile);
    void syncProfileFromStores(firebaseUserInstance, idToken, fallbackProfile);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      setLoading(true);
      try {
        if (fUser) {
          setFirebaseUser(fUser);
          await fetchProfile(fUser);
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
    if (firebaseUser) {
      await fetchProfile(firebaseUser);
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
      const clientProfile: UserProfile = {
        ...createDefaultProfile(credential.user, phone),
        name,
        email,
        phone: phone || undefined
      };

      setToken(idToken);
      setUser(clientProfile);
      setFirebaseUser(credential.user);

      try {
        const { doc, setDoc } = await import('firebase/firestore');
        const { db } = await import('../lib/firebase');
        const userDocRef = doc(db, 'users', credential.user.uid);
        await withTimeout(
          setDoc(userDocRef, clientProfile),
          "Timed out while saving registration profile to Firestore."
        );
        console.log("Registration profile saved directly to Firestore via Client SDK.");
      } catch (clientCreateErr) {
        console.warn("Direct Firestore write failed during registration, keeping local profile.", clientCreateErr);
      }

      try {
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

        if (res.ok) {
          const profile = await res.json();
          setUser(profile);
        }
      } catch (err) {
        console.warn("Backend /api/register notification failed, using client profile.", err);
      }
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
      await fetchProfile(credential.user);
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
      await fetchProfile(credential.user);
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const sendPhoneOtp = async (phone: string, containerId: string) => {
    try {
      const verifier = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible',
      });

      const confirmation = await signInWithPhoneNumber(auth, phone, verifier);
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
      await fetchProfile(result.user);
    } catch (err) {
      console.error("OTP Verification failed:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
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
