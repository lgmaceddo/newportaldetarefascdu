import React, { useState, useEffect } from 'react';
import { useAuth, FLOOR_OPTIONS } from '../contexts/AuthContext';

// --- Types ---
type ContactType = 'address' | 'phone' | 'whatsapp' | 'email' | 'text';

interface ContactItem {
    id: string;
    type: ContactType;
    label?: string;
    value: string;
}

interface UnitData {
    id: string;
    title: string;
    items: ContactItem[];
}

interface NavbarProps {
    unitsData: Record<string, UnitData>;
    onEditUnitClick: (unitKey: string) => void;
    isDarkMode: boolean;
    toggleDarkMode: () => void;
    onLogoutClick: () => void;
    onToggleNotifications: () => void;
    unreadCount: number;
}

const Navbar: React.FC<NavbarProps> = ({
    unitsData,
    onEditUnitClick,
    isDarkMode,
    toggleDarkMode,
    onLogoutClick,
    onToggleNotifications,
    unreadCount
}) => {
    const { user, selectedFloor, setSelectedFloor } = useAuth();
    const [time, setTime] = useState(new Date());

    // Clock Effect
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // --- Icon Helper ---
    const getIconForType = (type: ContactType) => {
        switch (type) {
            case 'address': return 'location_on';
            case 'phone': return 'call';
            case 'whatsapp': return 'chat';
            case 'email': return 'mail';
            default: return 'info';
        }
    };

    const isWhatsApp = (type: ContactType) => type === 'whatsapp';

    return (
        <>
            {/* --- HEADER PART 1: Brand & Identity (Dark Green) --- */}
            <header className="bg-primary-dark h-20 flex items-center justify-between px-4 lg:px-6 shrink-0 z-30 shadow-md">
                <div className="flex flex-col -gap-0.5">
                    <h1 className="text-white font-bold text-lg leading-none tracking-tight">PORTAL DE TAREFAS CDU</h1>
                    <span className="text-[10px] text-white/60 font-bold uppercase tracking-widest mt-1">Gestão Unificada de Atendimento</span>
                </div>

                {/* Clock in Header */}
                <div className="flex items-center gap-2 text-white/90 bg-white/5 px-4 py-1.5 rounded-xl border border-white/10 select-none shadow-inner" title="Horário Atual">
                    <div className="flex flex-col items-center">
                        <span className="font-mono text-xl font-bold tracking-[0.15em] tabular-nums leading-none">
                            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-[10px] uppercase font-bold tracking-tighter text-[#75CEBF] opacity-80 leading-none mt-1 min-w-[60px] text-center">
                            {time.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}
                        </span>
                    </div>
                </div>
            </header>

            {/* --- HEADER PART 2: Actions Bar (Teal Green) --- */}
            <div className="bg-primary h-14 flex items-center justify-between px-4 lg:px-6 shrink-0 z-50 shadow-sm relative transition-colors duration-200">

                {/* Left Container with Alignment Logic */}
                <div className="flex items-center gap-4">

                    {/* User Capsule */}
                    <div className="bg-white/10 hover:bg-white/20 transition-all cursor-default rounded-lg px-4 py-1.5 flex flex-col justify-center border border-white/10 backdrop-blur-md shadow-sm min-w-[160px]">
                        <span className="text-white font-bold text-sm leading-tight truncate">
                            {(() => {
                                if (!user) return 'Usuário';
                                if (user.role === 'doctor') {
                                    const lower = user.name.toLowerCase();
                                    if (lower.startsWith('dr') || lower.startsWith('dra')) return user.name;
                                    const firstName = user.name.split(' ')[0].toLowerCase();
                                    const isFemale = firstName.endsWith('a') || ['alice', 'beatriz', 'raquel', 'isabel', 'liz'].includes(firstName);
                                    return isFemale ? `Drª ${user.name}` : `Drº ${user.name}`;
                                }
                                return user.name;
                            })()}
                        </span>
                        <div className="flex items-center gap-1.5">
                            <span className={`size-2 rounded-full ${user?.status === 'offline' ? 'bg-gray-400' : 'bg-green-400 animate-pulse'}`}></span>
                            <span className="text-white/70 text-[10px] uppercase font-bold tracking-wider leading-tight">
                                {user?.role === 'reception' ? 'Recepção' : (user?.specialty || 'Médico Cooperado')}
                            </span>
                        </div>
                    </div>

                    {/* Floor Selector - Premium UI (Now next to user) */}
                    <div className="flex flex-col gap-0.5 ml-2">
                        <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest ml-1">Meu Andar Atual</span>
                        <div className="relative group">
                            <select
                                value={selectedFloor}
                                onChange={(e) => setSelectedFloor(e.target.value)}
                                className="appearance-none bg-white/10 hover:bg-white/20 text-white font-bold text-sm py-1.5 pl-3 pr-10 rounded-lg border border-white/10 transition-all outline-none cursor-pointer min-w-[280px] shadow-sm backdrop-blur-md"
                            >
                                {FLOOR_OPTIONS.map(option => (
                                    <option key={option} value={option} className="bg-primary-dark text-white">{option}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none text-lg group-hover:text-white/70 transition-colors">
                                unfold_more
                            </span>
                        </div>
                    </div>

                </div>

                {/* Context Buttons & Tools (Right) */}
                <div className="flex items-center gap-2">

                    {/* --- INTERACTIVE UNITS DROPDOWNS --- */}
                    <div className="hidden md:flex items-center gap-2 mr-4">
                        {
                            ['CDU', 'SEDE', 'GERENCIA'].map(unitKey => {
                                const data = unitsData[unitKey];
                                if (!data) return null; // Safety check
                                return (
                                    <div key={unitKey} className="relative group">
                                        {/* Trigger Button */}
                                        <button className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded transition-colors uppercase border border-white/5 cursor-pointer">
                                            {unitKey}
                                        </button>

                                        {/* Hover Popover (Card) */}
                                        <div className="absolute right-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ease-out z-50 w-[320px]">
                                            <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden relative">

                                                {/* Header of Card */}
                                                <div className="bg-[#f0fdf4] p-4 border-b border-gray-100 flex justify-between items-start gap-2">
                                                    <h4 className="text-[#10605B] font-bold text-xs uppercase tracking-wide leading-relaxed">
                                                        {data.title}
                                                    </h4>
                                                    <button
                                                        onClick={() => onEditUnitClick(unitKey)}
                                                        className="text-gray-400 hover:text-[#10605B] transition-colors"
                                                        title="Editar Informações"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">edit</span>
                                                    </button>
                                                </div>

                                                {/* Body of Card */}
                                                <div className="p-4 space-y-4">
                                                    {data.items.map(item => (
                                                        <div key={item.id} className="flex gap-3 items-start">
                                                            <div className={`p-1.5 rounded-md shrink-0 flex items-center justify-center ${isWhatsApp(item.type) ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
                                                                }`}>
                                                                <span className="material-symbols-outlined text-sm">
                                                                    {isWhatsApp(item.type) ? 'chat' : getIconForType(item.type)}
                                                                </span>
                                                            </div>
                                                            <div className="flex-1">
                                                                {item.label && (
                                                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">
                                                                        {item.label}
                                                                    </p>
                                                                )}
                                                                <p className="text-xs text-gray-700 font-medium break-words leading-snug">
                                                                    {item.value}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {data.items.length === 0 && (
                                                        <p className="text-xs text-gray-400 text-center italic">Nenhuma informação cadastrada.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        }
                    </div>

                    <div className="h-6 w-px bg-white/20 hidden md:block mx-1"></div>

                    <button
                        onClick={toggleDarkMode}
                        className="size-9 flex items-center justify-center rounded text-white hover:bg-white/10 transition-colors"
                        title={isDarkMode ? "Modo Claro" : "Modo Escuro"}
                    >
                        <span className="material-symbols-outlined text-xl">
                            {isDarkMode ? 'light_mode' : 'dark_mode'}
                        </span>
                    </button>

                    <button
                        onClick={onToggleNotifications}
                        className="size-9 flex items-center justify-center rounded text-white hover:bg-white/10 transition-colors relative"
                        title="Mural de Avisos"
                    >
                        <span className="material-symbols-outlined text-xl">notifications</span>
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 size-5 bg-red-600 text-white text-[10px] font-black rounded-full border-2 border-primary flex items-center justify-center shadow-lg animate-in zoom-in duration-300">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={onLogoutClick}
                        className="size-9 flex items-center justify-center rounded text-white hover:bg-white/10 hover:text-red-200 transition-colors"
                        title="Sair"
                    >
                        <span className="material-symbols-outlined text-xl">logout</span>
                    </button>
                </div>
            </div>
        </>
    );
};

export default Navbar;
