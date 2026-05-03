import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCSM2uxRN2EsiJ3gCALSJOveXM_KGh9GCY",
  authDomain: "splitcheck-f77d6.firebaseapp.com",
  projectId: "splitcheck-f77d6",
  storageBucket: "splitcheck-f77d6.firebasestorage.app",
  messagingSenderId: "671027897917",
  appId: "1:671027897917:web:96d592b0cd586c98c02c54",
  measurementId: "G-4L65063848"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
