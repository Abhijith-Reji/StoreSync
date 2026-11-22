import React from 'react';
import { AuthProvider } from './core/auth/AuthContext';
import { ThemeProvider } from './core/theme/ThemeContext';
import { AppRouter } from './routes/AppRouter';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
