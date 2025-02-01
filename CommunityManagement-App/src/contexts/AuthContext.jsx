import {createContext, useContext, useEffect, useState} from 'react';
import {onAuthStateChanged, signInWithEmailAndPassword, signOut} from 'firebase/auth';
import {doc, getDoc} from 'firebase/firestore';
import {auth, db} from '../firebase.js';

const AuthContext = createContext(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}

// eslint-disable-next-line react/prop-types
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  async function login(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));

    if (!userDoc.exists()) {
      throw new Error("User document not found");
    }

    const role = userDoc.data().role;
    setUserRole(role); // Update role state
    return role; // Return the role directly
  }

  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role);
        }
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });
  }, []);

  const value = {
    currentUser,
    userRole,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
);
}