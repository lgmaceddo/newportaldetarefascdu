import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import LogoutModal from './LogoutModal';
import UnitEditModal from './UnitEditModal';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// --- Types for Unit Info ---
// NOTE: I am duplicating these types here temporarily or I should move them to types.ts.
// For now I will redefine them to ensure the state defined here matches the logic.
// Ideally, move to a shared types file.
type ContactType = 'address' | 'phone' | 'whatsapp' | 'email' | 'text';

interface ContactItem {
    id: string;
    type: ContactType;
    label?: string; // e.g., "CONSULTAS", "EXAMES"
    value: string;  // e.g., "(14) 3235-3350"
}

interface UnitData {
    id: string;
    title: string;
    items: ContactItem[];
}

// --- Default Data (Initial Seed) ---
const INITIAL_UNITS: Record<string, UnitData> = {
    CDU: {
        id: 'CDU',
        title: 'CDU – CENTRO DE DIAGNÓSTICO UNIMED',
        items: [
            { id: '1', type: 'address', value: 'Rua Agenor Meira, 12-34 - Centro, Bauru/SP' },
            { id: '2', type: 'phone', label: 'CONSULTAS', value: '(14) 3235-3350 / 2106-3350' },
            { id: '3', type: 'phone', label: 'EXAMES', value: '(14) 3235-3360 / 2106-3360' },
            { id: '4', type: 'whatsapp', label: 'WHATSAPP ANESTESIA / CASSI', value: '(14) 99796-2690' },
            { id: '5', type: 'whatsapp', label: 'WHATSAPP GERAL', value: '(14) 99648-4958' }
        ]
    },
    SEDE: {
        id: 'SEDE',
        title: 'SEDE ADMINISTRATIVA',
        items: [
            { id: '1', type: 'address', value: 'Av. Dr. Arnaldo, 456 - Vila Nova' },
            { id: '2', type: 'phone', label: 'RECEPÇÃO GERAL', value: '(14) 3100-0000' },
            { id: '3', type: 'email', label: 'RH MÉDICO', value: 'rh.medico@unimedbauru.com.br' }
        ]
    },
    GERENCIA: {
        id: 'GERENCIA',
        title: 'GERÊNCIA DE ATENDIMENTO',
        items: [
            { id: '1', type: 'phone', label: 'COORDENAÇÃO', value: 'Ramal 5544' },
            { id: '2', type: 'whatsapp', label: 'SUPORTE TI', value: '(14) 99999-8888' },
            { id: '3', type: 'text', label: 'HORÁRIO', value: 'Seg-Sex: 08h às 18h' }
        ]
    }
};

import NotificationDrawer from './NotificationDrawer';

const Layout: React.FC = () => {
    const { isAuthenticated, logout } = useAuth();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // --- Unit Info State ---
    const [unitsData, setUnitsData] = useState<Record<string, UnitData>>(() => {
        const saved = localStorage.getItem('mediportal_units_info');
        return saved ? JSON.parse(saved) : INITIAL_UNITS;
    });

    // --- Edit Modal State ---
    const [editingUnitId, setEditingUnitId] = useState<string | null>(null);

    // Persist units data
    useEffect(() => {
        localStorage.setItem('mediportal_units_info', JSON.stringify(unitsData));
    }, [unitsData]);

    // Dark Mode Logic
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            return savedTheme === 'dark';
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    const toggleDarkMode = () => {
        setIsDarkMode(!isDarkMode);
    };

    const handleLogoutClick = () => {
        setShowLogoutConfirm(true);
    };

    const confirmLogout = () => {
        logout();
        setShowLogoutConfirm(false);
    };

    // --- Edit Modal Handlers ---
    const openEditModal = (unitKey: string) => {
        setEditingUnitId(unitKey);
    };

    const closeEditModal = () => {
        setEditingUnitId(null);
    };

    const handleSaveUnit = (updatedUnit: UnitData) => {
        if (editingUnitId) {
            setUnitsData(prev => ({
                ...prev,
                [editingUnitId]: updatedUnit
            }));
            closeEditModal();
        }
    };

    if (!isAuthenticated) {
        return <Navigate to="/login" />;
    }

    return (
        <div className="flex flex-col h-screen w-full bg-[#f1f5f9] overflow-hidden font-sans transition-colors duration-200">

            {/* Extracted Navbar */}
            <Navbar
                unitsData={unitsData}
                onEditUnitClick={openEditModal}
                isDarkMode={isDarkMode}
                toggleDarkMode={toggleDarkMode}
                onLogoutClick={handleLogoutClick}
                onToggleNotifications={() => setIsNotificationsOpen(!isNotificationsOpen)}
                unreadCount={unreadCount}
            />

            {/* --- MIDDLE BODY (Sidebar + Content) --- */}
            <div className="flex-1 flex overflow-hidden relative">
                <Sidebar />

                <main className="flex-1 overflow-y-auto p-2 lg:p-3 relative flex flex-col min-w-0">
                    {/* Main Content Area Wrapper */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex-1 flex flex-col p-4 animate-in fade-in duration-300 transition-colors duration-200">
                        <Outlet />
                    </div>
                </main>
            </div>

            {/* --- FULL WIDTH FOOTER --- */}
            <footer className="bg-primary-dark text-white py-2 px-6 text-center text-[10px] font-bold tracking-wide uppercase shrink-0 z-40 shadow-[0_-4px_10px_rgba(0,0,0,0.1)] border-t border-white/10">
                &copy; 2026 Unimed Bauru. Todos os direitos reservados.
            </footer>

            {/* --- MODALS & DRAWERS --- */}
            <NotificationDrawer
                isOpen={isNotificationsOpen}
                onClose={() => setIsNotificationsOpen(false)}
                onNotesUpdate={(count) => setUnreadCount(count)}
            />
            {showLogoutConfirm && (
                <LogoutModal
                    onConfirm={confirmLogout}
                    onCancel={() => setShowLogoutConfirm(false)}
                />
            )}

            {editingUnitId && unitsData[editingUnitId] && (
                <UnitEditModal
                    unitData={unitsData[editingUnitId]}
                    onSave={handleSaveUnit}
                    onCancel={closeEditModal}
                />
            )}
        </div>
    );
};

export default Layout;