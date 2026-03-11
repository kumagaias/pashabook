import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  initializeApp,
  getApps,
  FirebaseApp,
} from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  Auth,
  User as FirebaseUser,
} from "firebase/auth";
import { firebaseConfig, API_BASE_URL } from "./firebase";

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_TOKEN_KEY = "@pashabook_token";
const AUTH_USER_KEY = "@pashabook_user";

let firebaseApp: FirebaseApp;
let auth: Auth;

// Convert Firebase error codes to user-friendly messages
function getAuthErrorMessage(error: any): string {
  const errorCode = error?.code || "";
  
  switch (errorCode) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Invalid email or password. Please try again.";
    case "auth/email-already-in-use":
      return "This email is already registered. Please login instead.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please try again later.";
    case "auth/network-request-failed":
      return "Network error. Please check your connection and try again.";
    default:
      return error?.message || "An error occurred. Please try again.";
  }
}

// Initialize Firebase
if (getApps().length === 0) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApps()[0];
}
auth = getAuth(firebaseApp);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Listen to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await handleFirebaseUser(firebaseUser);
      } else {
        await clearUserData();
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleFirebaseUser = async (firebaseUser: FirebaseUser) => {
    try {
      // Get ID token
      const token = await firebaseUser.getIdToken();
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);

      // Get user profile from Firestore via backend API
      const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const profile = await response.json();
        const userData: User = {
          id: profile.userId,
          name: profile.name,
          email: profile.email,
        };
        await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
        setUser(userData);
      } else {
        // Profile doesn't exist yet, use Firebase user data
        const userData: User = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
          email: firebaseUser.email || "",
        };
        await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
        setUser(userData);
      }
    } catch (error) {
      console.error("Error handling Firebase user:", error);
      await clearUserData();
    }
  };

  const clearUserData = async () => {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    await AsyncStorage.removeItem(AUTH_USER_KEY);
    setUser(null);
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      // Validate inputs
      if (!email || !password || password.length < 6) {
        throw new Error("Email and password (min 6 characters) are required");
      }

      // Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Get ID token
      const token = await userCredential.user.getIdToken();

      // Create user profile in Firestore via backend API
      const response = await fetch(`${API_BASE_URL}/api/user/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          email,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create user profile");
      }

      // User state will be updated by onAuthStateChanged
    } catch (error: any) {
      console.error("Registration error:", error);
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const login = async (email: string, password: string) => {
    try {
      // Validate inputs
      if (!email || !password) {
        throw new Error("Email and password are required");
      }

      // Sign in with Firebase
      await signInWithEmailAndPassword(auth, email, password);

      // User state will be updated by onAuthStateChanged
    } catch (error: any) {
      console.error("Login error:", error);
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      await clearUserData();
    } catch (error) {
      console.error("Logout error:", error);
      throw new Error("Logout failed");
    }
  };

  const getIdToken = async (): Promise<string | null> => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        return await currentUser.getIdToken();
      }
      return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    } catch (error) {
      console.error("Error getting ID token:", error);
      return null;
    }
  };

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      getIdToken,
    }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
