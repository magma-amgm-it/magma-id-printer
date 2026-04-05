import { useState, useEffect, useCallback } from 'react';
import {
  msalInstance,
  initializeMsal,
  login as msalLogin,
  logout as msalLogout,
  getActiveAccount,
  getAccessToken,
} from '../services/auth';

const GRAPH_ME_ENDPOINT = 'https://graph.microsoft.com/v1.0/me';
const GRAPH_PHOTO_ENDPOINT = 'https://graph.microsoft.com/v1.0/me/photo/$value';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile from Graph API
  const fetchUserProfile = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch basic profile
      const profileRes = await fetch(GRAPH_ME_ENDPOINT, { headers });
      const profile = await profileRes.json();

      // Try to fetch photo URL (may 404 if no photo set)
      let photoUrl = null;
      try {
        const photoRes = await fetch(GRAPH_PHOTO_ENDPOINT, { headers });
        if (photoRes.ok) {
          const blob = await photoRes.blob();
          photoUrl = URL.createObjectURL(blob);
        }
      } catch {
        // No photo available — that's fine
      }

      setUser({
        name: profile.displayName,
        email: profile.mail || profile.userPrincipalName,
        photoUrl,
      });
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    }
  }, []);

  // Initialize MSAL and attempt silent login
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        await initializeMsal();
        const account = getActiveAccount();
        if (account && mounted) {
          setIsAuthenticated(true);
          await fetchUserProfile();
        }
      } catch (err) {
        console.error('MSAL initialization error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();
    return () => { mounted = false; };
  }, [fetchUserProfile]);

  const login = useCallback(async () => {
    try {
      setLoading(true);
      await msalLogin();
      // loginRedirect navigates away, so we won't reach here
      // Auth state is picked up on return via initializeMsal()
    } catch (err) {
      console.error('Login error:', err);
      setLoading(false);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await msalLogout();
      setIsAuthenticated(false);
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
      throw err;
    }
  }, []);

  return { isAuthenticated, user, login, logout, loading };
}
