import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabase';
import { Session } from '@supabase/supabase-js';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'doctor' | 'reception';
  avatar?: string;
  specialty?: string;
  status?: 'online' | 'offline';
  isAdmin?: boolean;
}

export const FLOOR_OPTIONS = [
  '10º Andar ( CENTRO CIRÚRGICO )',
  '9º Andar ( OFTALMOLOGIA )',
  '8º Andar ( CLÍNICA MÉDICA / CARDIOLOGIA )',
  '7º Andar ( PEDIATRIA / OTORRINO )',
  '6º Andar ( GINECOLOGIA / OBSTETRÍCIA )',
  '5º Andar ( ORTOPEDIA / VASCULAR )',
  '4º Andar ( ESP CIRÚRGICAS / DERMATOLOGIA )',
  '3º Andar ( SARA )',
  '2º Andar ( PSIQUISTRIA )',
  'CDU - CENTRO DE DIAGNÓSTICO UNIMED',
  'Térreo ( RECEPÇÃO / TRIAGEM )'
];

export const MEDICAL_SPECIALTIES = [
  'Alergia e Imunologia',
  'Anestesiologia',
  'Angiologia',
  'Cardiologia',
  'Cirurgia Cardiovascular',
  'Cirurgia da Mão',
  'Cirurgia de Cabeça e Pescoço',
  'Cirurgia do Aparelho Digestivo',
  'Cirurgia Geral',
  'Cirurgia Pediátrica',
  'Cirurgia Plástica',
  'Cirurgia Torácica',
  'Cirurgia Vascular',
  'Clínica Médica',
  'Coloproctologia',
  'Dermatologia',
  'Endocrinologia e Metabologia',
  'Endoscopia',
  'Gastroenterologia',
  'Genética Médica',
  'Geriatria',
  'Ginecologia e Obstetrícia',
  'Hematologia e Hemoterapia',
  'Homeopatia',
  'Infectologia',
  'Mastologia',
  'Medicina de Emergência',
  'Medicina do Trabalho',
  'Medicina de Tráfego',
  'Medicina Esportiva',
  'Medicina Física e Reabilitação',
  'Medicina Intensiva',
  'Medicina Legal e Perícia Médica',
  'Medicina Nuclear',
  'Medicina Preventiva e Social',
  'Nefrologia',
  'Neurocirurgia',
  'Neurologia',
  'Nutrologia',
  'Oftalmologia',
  'Oncologia Clínica',
  'Ortopedia e Traumatologia',
  'Otorrinolaringologia',
  'Patologia',
  'Patologia Clínica/Medicina Laboratorial',
  'Pediatria',
  'Pneumologia',
  'Psiquiatria',
  'Radiologia e Diagnóstico por Imagem',
  'Radioterapia',
  'Reumatologia',
  'Urologia'
].sort();

interface AuthContextType {
  user: User | null;
  session: Session | null;
  selectedFloor: string;
  setSelectedFloor: (floor: string) => void;
  // We keep these for compatibility but they will now trigger Supabase actions internally or be used by the Login page directly
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
  updateStatus: (status: 'online' | 'offline') => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFloor, setSelectedFloorState] = useState<string>(() => {
    return localStorage.getItem('mediportal_selected_floor') || "9º Andar ( OFTALMOLOGIA )";
  });

  const setSelectedFloor = (floor: string) => {
    setSelectedFloorState(floor);
    localStorage.setItem('mediportal_selected_floor', floor);
  };

  // Fetch the user's profile from the 'profiles' table
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
      } else if (data) {
        // Auto-promote specific user to admin as requested
        if (data.name === 'Luiz Gustavo Macedo Segura' && !data.is_admin) {
          await supabase.from('profiles').update({ is_admin: true }).eq('id', userId);
          data.is_admin = true;
        }

        // Ensure proper mapping of snake_case DB to camelCase Interface
        const mappedUser: User = {
          id: data.id,
          name: data.name || '',
          email: data.email || '',
          role: data.role || 'reception',
          avatar: data.avatar,
          specialty: data.specialty,
          status: data.status,
          isAdmin: !!data.is_admin
        };

        setUser(mappedUser);
      }
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
    }
  };

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (session?.user) {
      await fetchProfile(session.user.id);
    }
  };

  const logout = async () => {
    // Set status to offline before logging out
    if (user?.id) {
      await supabase.from('profiles').update({ status: 'offline' }).eq('id', user.id);
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const updateStatus = async (status: 'online' | 'offline') => {
    if (user && user.id) {
      // Optimistic update
      setUser({ ...user, status });

      // DB update
      const { error } = await supabase
        .from('profiles')
        .update({ status })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating status:', error);
        // Revert on error if needed, but for status it might be fine to just log
      }
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      selectedFloor,
      setSelectedFloor,
      refreshProfile,
      logout,
      updateStatus,
      isAuthenticated: !!session?.user, // Relies on session being present
      loading
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};