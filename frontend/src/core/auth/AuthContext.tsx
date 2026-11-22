import React, { createContext, useState, useEffect, useCallback } from 'react';
import { User, DEFAULT_COUNTER_ID } from '../../config/constants';
import { tokenStorage } from './storage';
import { apiClient } from '../api/client';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  counterId: string;
  setCounterId: (counter: string) => void;
  login: (username: string, password: string, counterId?: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => tokenStorage.getUser());
  const [counterId, setCounterIdState] = useState<string>(
    () => tokenStorage.getUser()?.counterId || localStorage.getItem('storesync_counter') || DEFAULT_COUNTER_ID
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const setCounterId = (counter: string) => {
    setCounterIdState(counter);
    localStorage.setItem('storesync_counter', counter);
  };

  // Rehydrate session from /api/auth/me on app boot
  const refreshProfile = useCallback(async () => {
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data } = await apiClient.get('/auth/me');
      if (data?.user) {
        setUser(data.user);
        tokenStorage.setUser(data.user);
        if (data.user.counterId) {
          setCounterIdState(data.user.counterId);
        }
      }
    } catch (err) {
      console.warn('[Auth] Session rehydration failed or token expired:', err);
      tokenStorage.clearTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const login = async (username: string, password: string, counter?: string): Promise<User> => {
    const activeCounter = counter || counterId;
    const { data } = await apiClient.post('/auth/login', {
      username,
      password,
      counterId: activeCounter,
    });

    const { accessToken, refreshToken, user: loggedInUser } = data;
    tokenStorage.setTokens(accessToken, refreshToken);
    tokenStorage.setUser(loggedInUser);
    setUser(loggedInUser);
    setCounterIdState(loggedInUser.counterId || activeCounter);
    return loggedInUser;
  };

  const logout = async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      tokenStorage.clearTokens();
      setUser(null);
      window.location.hash = '#/login';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        counterId,
        setCounterId,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
