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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [phoneConfirmation, setPhoneConfirmation] = useState<ConfirmationResult | null>(null);

  // Function to fetch the user profile from the backend
  const fetchProfile = async (firebaseUserInstance: FirebaseUser, throwOnError = false) => {
    try {
      const idToken = await firebaseUserInstance.getIdToken();
      setToken(idToken);
      
      const res = await fetch('/api/me', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      
      if (res.ok) {
        const profile = await res.json();
        setUser(profile);
      } else {
        let errorMsg = "Không thể tải hồ sơ người dùng từ máy chủ.";
        try {
          const errorData = await res.json();
          errorMsg = errorData.error || errorMsg;
        } catch (e) {}
        console.error("Failed to fetch profile:", errorMsg);
        setUser(null);
        if (throwOnError) {
          throw new Error(errorMsg);
        }
      }
    } catch (err: any) {
      console.error("Error fetching user profile:", err);
      setUser(null);
      if (throwOnError) {
        throw err;
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      setLoading(true);
      if (fUser) {
        setFirebaseUser(fUser);
        await fetchProfile(fUser);
      } else {
        setFirebaseUser(null);
        setUser(null);
        setToken(null);
      }
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
          throw new Error("Không tìm thấy yêu cầu gửi mã OTP. Vui lòng gửi lại mã.");
        }
        const phoneResult = await phoneConfirmation.confirm(otpCode);
        
        // Link with Email & Password
        const emailCred = EmailAuthProvider.credential(email, pass);
        credential = await linkWithCredential(phoneResult.user, emailCred);
      } else {
        credential = await createUserWithEmailAndPassword(auth, email, pass);
      }
      
      await updateProfile(credential.user, { displayName: name });
      
      // 2. Fetch or trigger profile creation on the server
      const idToken = await credential.user.getIdToken();
      setToken(idToken);

      // We send a POST request to register user profile explicitly
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ name, phone })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to save user profile on server.");
      }

      const profile = await res.json();
      setUser(profile);
      setFirebaseUser(credential.user);
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
      await fetchProfile(credential.user, true);
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
      await fetchProfile(credential.user, true);
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const sendPhoneOtp = async (phone: string, containerId: string) => {
    try {
      // Check recaptcha verifier
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
