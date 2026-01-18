import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AgendaAI from './pages/AgendaAI';
import Tasks from './pages/Tasks';
import DailyMap from './pages/DailyMap';
import Professionals from './pages/Professionals';
import Receptionists from './pages/Receptionists';
import Scripts from './pages/Scripts';
import Settings from './pages/Settings';
import Users from './pages/Users';
import Login from './pages/Login';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <NotificationProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              {/* Reusing AgendaAI with different types */}
              <Route path="agenda/reagendamento" element={<AgendaAI type="reschedule" />} />
              <Route path="agenda/confirmacao" element={<AgendaAI type="confirmation" />} />
              <Route path="agenda/confirmar-procedimento" element={<AgendaAI type="procedure_confirmation" />} />
              <Route path="agenda/espelho-diario" element={<AgendaAI type="daily_summary" />} />
              <Route path="scripts" element={<Scripts />} />
              <Route path="tarefas" element={<Tasks />} />
              <Route path="mapa" element={<DailyMap />} />
              <Route path="profissionais" element={<Professionals />} />
              <Route path="recepcao" element={<Receptionists />} />
              <Route path="usuarios" element={<Users />} />
              <Route path="configuracoes" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </NotificationProvider>
    </AuthProvider>
  );
};

export default App;