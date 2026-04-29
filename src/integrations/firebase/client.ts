import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAH0YKHGBr6GG5uI98SiXkZBQ0ra-Czqoc",
  authDomain: "incidentwatch-2eead.firebaseapp.com",
  projectId: "incidentwatch-2eead",
  storageBucket: "incidentwatch-2eead.firebasestorage.app",
  messagingSenderId: "796340199706",
  appId: "1:796340199706:web:4c66c3613109681e97cca3",
  measurementId: "G-Y3SM8XE48N",
};

// Prevent duplicate app initialization (e.g. HMR)
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
