import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";



const firebaseConfig = {
    apiKey: "AIzaSyBg5jYQAOfXhcA--mrYWvn__gPr95cQxx4",
    authDomain: "community-app-19351.firebaseapp.com",
    projectId: "community-app-19351",
    storageBucket: "community-app-19351.firebasestorage.app",
    messagingSenderId: "176997594728",
    appId: "1:176997594728:web:985f0be28452b58bfb2ddd",
    measurementId: "G-22ZBQJDVK6"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);