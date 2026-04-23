"use client";

import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
} from "firebase/auth";
import {
  Firestore,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

export type UserRole = "admin" | "cashier";

const DEFAULT_STORE_ID = process.env.NEXT_PUBLIC_DEFAULT_STORE_ID ?? "default";

type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
};

function getClientConfig(): FirebaseClientConfig {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;

  if (!apiKey || !authDomain || !projectId || !appId) {
    throw new Error(
      "Missing Firebase web config. Set NEXT_PUBLIC_FIREBASE_* values in .env.local.",
    );
  }

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    storageBucket,
    messagingSenderId,
  };
}

export function getFirebaseClientApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(getClientConfig());
}

export function getFirebaseClientDb(): Firestore {
  return getFirestore(getFirebaseClientApp());
}

export function getFirebaseClientAuth(): Auth {
  return getAuth(getFirebaseClientApp());
}

export async function signUpWithRole(
  email: string,
  password: string,
  role: UserRole,
  storeId = DEFAULT_STORE_ID,
): Promise<User> {
  const auth = getFirebaseClientAuth();
  const db = getFirebaseClientDb();
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const { user } = credential;

  await setDoc(
    doc(db, "users", user.uid),
    {
      email: user.email,
      primaryStoreId: storeId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await setDoc(
    doc(db, "users", user.uid, "stores", storeId),
    {
      role,
      storeId,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return user;
}

export async function getUserStoreRole(
  uid: string,
  storeId = DEFAULT_STORE_ID,
): Promise<UserRole | null> {
  const db = getFirebaseClientDb();
  const membership = await getDoc(doc(db, "users", uid, "stores", storeId));

  if (!membership.exists()) {
    return null;
  }

  const role = membership.data()?.role;

  if (role !== "admin" && role !== "cashier") {
    return null;
  }

  return role;
}

export async function signInWithRole(
  email: string,
  password: string,
  expectedRole: UserRole,
  storeId = DEFAULT_STORE_ID,
): Promise<User> {
  const auth = getFirebaseClientAuth();
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const role = await getUserStoreRole(credential.user.uid, storeId);

  if (role !== expectedRole) {
    await signOut(auth);
    throw new Error(`This account is not registered as ${expectedRole}.`);
  }

  return credential.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(getFirebaseClientAuth());
}

export async function ensureAnonymousUser(): Promise<User> {
  const auth = getFirebaseClientAuth();

  if (auth.currentUser) {
    return auth.currentUser;
  }

  await signInAnonymously(auth);

  return await new Promise<User>((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (!user) {
          return;
        }

        unsubscribe();
        resolve(user);
      },
      (error) => {
        unsubscribe();
        reject(error);
      },
    );
  });
}
