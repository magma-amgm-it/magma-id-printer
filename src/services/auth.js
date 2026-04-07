import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';

const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    redirectUri: window.location.origin + import.meta.env.BASE_URL,
    postLogoutRedirectUri: window.location.origin + import.meta.env.BASE_URL,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: ['Sites.ReadWrite.All', 'User.Read'],
};

export const msalInstance = new PublicClientApplication(msalConfig);

// Session expired flag — components can check this to show re-login UI
let sessionExpired = false;
const sessionExpiredListeners = new Set();

export function isSessionExpired() {
  return sessionExpired;
}

export function onSessionExpired(callback) {
  sessionExpiredListeners.add(callback);
  return () => sessionExpiredListeners.delete(callback);
}

function notifySessionExpired() {
  sessionExpired = true;
  sessionExpiredListeners.forEach((cb) => cb());
}

// Must be called before any MSAL operations
export async function initializeMsal() {
  await msalInstance.initialize();
  await msalInstance.handleRedirectPromise();
}

export async function login() {
  sessionExpired = false;
  try {
    await msalInstance.loginRedirect(loginRequest);
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

export async function logout() {
  try {
    await msalInstance.logoutPopup({
      postLogoutRedirectUri: window.location.origin + import.meta.env.BASE_URL,
    });
  } catch (error) {
    console.error('Logout failed:', error);
    throw error;
  }
}

export async function getAccessToken() {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) {
    notifySessionExpired();
    throw new Error('No authenticated account found. Please sign in.');
  }

  const silentRequest = {
    ...loginRequest,
    account: accounts[0],
  };

  try {
    const response = await msalInstance.acquireTokenSilent(silentRequest);
    return response.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      // Silent failed — try popup first
      try {
        const response = await msalInstance.acquireTokenPopup(loginRequest);
        return response.accessToken;
      } catch (popupError) {
        console.warn('Popup failed, falling back to redirect:', popupError.message);
        // Popup blocked or failed — use redirect as last resort
        try {
          await msalInstance.acquireTokenRedirect(loginRequest);
          // Won't reach here — page redirects
        } catch (redirectError) {
          console.error('All token acquisition methods failed:', redirectError);
          notifySessionExpired();
          throw redirectError;
        }
      }
    }
    console.error('Token acquisition failed:', error);
    notifySessionExpired();
    throw error;
  }
}

export function getActiveAccount() {
  const accounts = msalInstance.getAllAccounts();
  return accounts.length > 0 ? accounts[0] : null;
}
