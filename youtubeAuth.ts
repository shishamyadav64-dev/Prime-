import {getApps, initializeApp} from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
];

export const GOOGLE_WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
];

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of GOOGLE_WORKSPACE_SCOPES) {
  provider.addScope(scope);
}

let isSigningIn = false;
// Strictly in-memory OAuth access token cache (never stored in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;

export function initYouTubeAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthRequired?: () => void,
): () => void {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthRequired?.();
      }
    } else {
      cachedAccessToken = null;
      onAuthRequired?.();
    }
  });
}

export async function signInWithYouTubeGoogle(): Promise<{
  user: User;
  accessToken: string;
}> {
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google sign-in completed, but no YouTube access token was returned.');
    }
    cachedAccessToken = credential.accessToken;
    return {user: result.user, accessToken: cachedAccessToken};
  } finally {
    isSigningIn = false;
  }
}

export function initAppUserListener(
  onUserChange: (user: User | null) => void,
): () => void {
  return onAuthStateChanged(auth, (user) => {
    onUserChange(user);
  });
}

export async function getFirebaseIdToken(): Promise<string | null> {
  if (!auth.currentUser) return null;
  return auth.currentUser.getIdToken();
}

export function getCachedYouTubeToken(): string | null {
  return cachedAccessToken;
}

export async function signOutYouTubeGoogle(): Promise<void> {
  await auth.signOut();
  cachedAccessToken = null;
}
