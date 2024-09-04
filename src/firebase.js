import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCuStm0kUlpc3Y1ZmDJpnKMVi24mYqnLQ8",
  authDomain: "controlpaste-app.firebaseapp.com",
  projectId: "controlpaste-app",
  storageBucket: "controlpaste-app.appspot.com",
  messagingSenderId: "212014792155",
  appId: "1:212014792155:web:24da7674ccf52997bbfbfe",
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
const database = getDatabase(app);

export { storage, database };
