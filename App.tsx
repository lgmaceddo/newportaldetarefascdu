import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import AgendaAI from './pages/AgendaAI';
import Tasks from './pages/Tasks';
import DailyMap from './pages/DailyMap';
import Professionals from './pages/Professionals';
import Receptionists from './pages/Receptionists';
import Scripts from './pages/Scripts';
import Settings from './pages/Settings';
import Users from './pages/Users';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user?.isAdmin) return <Navigate to="/mapa" replace />;
  return children;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <NotificationProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/mapa" replace />} />
              
              {/* Reusing AgendaAI with different types */}
              <Route path="agenda/reagendamento" element={<AgendaAI type="reschedule" />} />
              <Route path="agenda/confirmacao" element={<AgendaAI type="confirmation" />} />
              <Route path="agenda/confirmar-procedimento" element={<AgendaAI type="procedure_confirmation" />} />
              <Route path="agenda/espelho-diario" element={<AgendaAI type="daily_summary" />} />
              
              <Route path="scripts" element={<Scripts />} />
              <Route path="recados" element={<Tasks />} />
              <Route path="mapa" element={<DailyMap />} />
              <Route path="profissionais" element={<Professionals />} />
              <Route path="recepcao" element={<Receptionists />} />
              
              <Route path="usuarios" element={
                <AdminRoute>
                  <Users />
                </AdminRoute>
              } />
              
              <Route path="configuracoes" element={
                <AdminRoute>
                  <Settings />
                </AdminRoute>
              } />
              
              <Route path="*" element={<Navigate to="/mapa" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </NotificationProvider>
    </AuthProvider>
  );
};

export default App;