import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { Task, Note, TaskStatus, Priority } from '../types';

interface DashboardStats {
    pendingTasks: number;
    highPriorityTasks: number;
    pendingNotes: number;
    urgentNotes: number;
    morningDoctors: number;
    afternoonDoctors: number;
    totalDoctors: number;
}

const Dashboard: React.FC = () => {
    const { user, selectedFloor } = useAuth();
    const [rooms, setRooms] = useState<any[]>([]);
    const [allocations, setAllocations] = useState<any[]>([]);
    const [stats, setStats] = useState<DashboardStats>({
        pendingTasks: 0,
        highPriorityTasks: 0,
        pendingNotes: 0,
        urgentNotes: 0,
        morningDoctors: 0,
        afternoonDoctors: 0,
        totalDoctors: 0
    });
    const [loading, setLoading] = useState(true);

    const getLocalDateKey = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const todayDateKey = getLocalDateKey();

    const fetchRealtimeData = async () => {
        try {
            setLoading(true);

            // 1. Fetch Rooms for selected floor
            const { data: roomsData } = await supabase
                .from('rooms')
                .select('*')
                .eq('sector', selectedFloor)
                .order('order', { ascending: true });

            // 2. Fetch Allocations for these rooms today
            const roomIds = (roomsData || []).map(r => r.id);
            let allocsData: any[] = [];
            if (roomIds.length > 0) {
                const { data } = await supabase
                    .from('room_allocations')
                    .select('*, profiles(name, specialty)')
                    .eq('date', todayDateKey)
                    .in('room_id', roomIds);
                allocsData = data || [];
            }

            // 3. Fetch Tasks and Notes for summary
            const savedTasks: Task[] = JSON.parse(localStorage.getItem('mediportal_tasks') || '[]');
            const savedNotes: Note[] = JSON.parse(localStorage.getItem('mediportal_notes') || '[]');

            setRooms(roomsData || []);
            setAllocations(allocsData);

            // Calculate Doctor Stats for the selected floor/sector
            const morningDocs = new Set(allocsData.filter(a => a.shift === 'morning').map(a => a.doctor_id)).size;
            const afternoonDocs = new Set(allocsData.filter(a => a.shift === 'afternoon').map(a => a.doctor_id)).size;
            const totalDocs = new Set(allocsData.map(a => a.doctor_id)).size;

            // Calculate Task/Note Stats
            const myPendingTasks = user?.role === 'doctor'
                ? savedTasks.filter(t => t.assignedTo === user.id && t.status !== TaskStatus.DONE)
                : savedTasks.filter(t => t.status !== TaskStatus.DONE);

            const myPendingNotes = user?.role === 'doctor'
                ? savedNotes.filter(n => n.to === user.id && n.status !== 'completed')
                : savedNotes.filter(n => n.status !== 'completed');

            setStats({
                pendingTasks: myPendingTasks.length,
                highPriorityTasks: myPendingTasks.filter(t => t.priority === Priority.HIGH).length,
                pendingNotes: myPendingNotes.length,
                urgentNotes: myPendingNotes.filter(n => n.category === 'urgent').length,
                morningDoctors: morningDocs,
                afternoonDoctors: afternoonDocs,
                totalDoctors: totalDocs
            });

        } catch (error) {
            console.error("Error loading dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRealtimeData();
        const roomsChannel = supabase.channel('dashboard_rooms')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `sector=eq.${selectedFloor}` }, () => fetchRealtimeData())
            .subscribe();

        const allocsChannel = supabase.channel('dashboard_allocs')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'room_allocations' }, () => fetchRealtimeData())
            .subscribe();

        return () => {
            supabase.removeChannel(roomsChannel);
            supabase.removeChannel(allocsChannel);
        };
    }, [user, selectedFloor]);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Bom dia';
        if (hour < 18) return 'Boa tarde';
        return 'Boa noite';
    };

    const getFormattedUserName = () => {
        if (!user) return 'Usuário';
        return user.name.split(' ')[0];
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <div className="size-14 border-[5px] border-[#00995D]/20 border-t-[#00995D] rounded-full animate-spin"></div>
                    <p className="text-[#00995D] font-bold tracking-tight animate-pulse">Sincronizando portal...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 h-full animate-in fade-in duration-700">

            {/* --- Compact Premium Header --- */}
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3 shrink-0">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="w-6 h-1 bg-[#00995D] rounded-full"></span>
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#00995D]">{selectedFloor}</span>
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-none">
                        {getGreeting()}, <span className="text-[#00995D]">{getFormattedUserName()}</span>
                    </h1>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex bg-white shadow-sm border border-gray-100 rounded-xl px-4 py-2 items-center gap-3">
                        <div className="text-right">
                            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest leading-none">Hoje</p>
                            <p className="text-xs font-black text-gray-800 leading-none mt-1">
                                {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </p>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-[#00995D]/5 flex items-center justify-center text-[#00995D]">
                            <span className="material-symbols-outlined text-lg font-bold">calendar_month</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-12 gap-6">

                {/* Left Panel: Operational Status (Ocupação das Salas) - More Compact */}
                <div className="col-span-12 lg:col-span-8 flex flex-col gap-3 min-h-0">
                    <div className="flex justify-between items-center mb-1 shrink-0">
                        <h2 className="text-xs font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
                            <span className="material-symbols-outlined text-base text-[#00995D]">meeting_room</span>
                            Mapa de Ocupação Atual
                        </h2>
                        <NavLink to="/mapa" className="text-[9px] font-black uppercase tracking-widest text-[#00995D] hover:underline">
                            Ver Mapa Completo →
                        </NavLink>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {rooms.map(room => {
                            const am = allocations.find(a => a.room_id === room.id && a.shift === 'morning');
                            const pm = allocations.find(a => a.room_id === room.id && a.shift === 'afternoon');

                            return (
                                <div key={room.id} className="bg-white p-3 rounded-2xl border border-gray-100 flex flex-col gap-2 shadow-sm hover:border-[#00995D]/20 transition-all group">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest truncate">{room.name}</span>
                                        <div className={`size-1.5 rounded-full ${(am || pm) ? 'bg-[#00E68A]' : 'bg-gray-200'}`}></div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <div className={`size-5 rounded flex items-center justify-center text-[7px] font-black ${am ? 'bg-[#00995D] text-white shadow-sm shadow-[#00995D]/20' : 'bg-gray-50 text-gray-300'}`}>M</div>
                                            <p className={`text-[10px] font-bold truncate ${am ? 'text-gray-800' : 'text-gray-300 italic'}`}>
                                                {am ? (am.profiles?.name || 'Médico') : 'Vago'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className={`size-5 rounded flex items-center justify-center text-[7px] font-black ${pm ? 'bg-[#004729] text-white shadow-sm shadow-[#004729]/20' : 'bg-gray-50 text-gray-300'}`}>T</div>
                                            <p className={`text-[10px] font-bold truncate ${pm ? 'text-gray-800' : 'text-gray-300 italic'}`}>
                                                {pm ? (pm.profiles?.name || 'Médico') : 'Vago'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {rooms.length === 0 && (
                            <div className="col-span-full h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                                <span className="material-symbols-outlined text-4xl opacity-20">meeting_room</span>
                                <p className="italic text-xs">Nenhuma sala cadastrada no setor.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Integrated Stats Cards */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 shrink-0">
                    {/* Doctor Info Card (Summary of the floor) */}
                    <div className="bg-[#004729] rounded-[2rem] p-6 text-white flex flex-col justify-between h-[160px] shadow-lg shadow-[#004729]/20 group relative overflow-hidden">
                        <div className="absolute -right-8 -top-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
                            <span className="material-symbols-outlined text-9xl">health_and_safety</span>
                        </div>

                        <div className="relative z-10 flex justify-between items-start">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#00E68A] mb-1">Status Profissional</span>
                                <h3 className="text-xl font-black">Escala Ativa</h3>
                            </div>
                        </div>

                        <div className="relative z-10 flex justify-between items-end">
                            <div className="flex flex-col">
                                <span className="text-4xl font-black tracking-tighter leading-none">{stats.totalDoctors}</span>
                                <span className="text-[9px] font-bold text-[#00E68A] uppercase tracking-wide mt-1">Médicos no Setor</span>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex flex-col items-end">
                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Manhã</span>
                                    <span className="text-lg font-black leading-none">{stats.morningDoctors}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Tarde</span>
                                    <span className="text-lg font-black leading-none">{stats.afternoonDoctors}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Pending Items Cards - Vertical Stack */}
                    <div className="flex-1 flex flex-col gap-3 min-h-0">
                        <NavLink to="/tarefas" className="bg-white hover:border-[#00995D]/30 transition-all p-5 rounded-[2rem] border border-gray-100 flex items-center gap-4 group shadow-sm flex-1">
                            <div className="size-12 rounded-2xl bg-[#00995D]/5 flex items-center justify-center text-[#00995D] group-hover:bg-[#00995D] group-hover:text-white transition-all shrink-0">
                                <span className="material-symbols-outlined font-bold">assignment</span>
                            </div>
                            <div className="flex-1">
                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Minhas Tarefas</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-gray-800 tracking-tighter">{stats.pendingTasks}</span>
                                    <span className="text-[10px] font-bold text-gray-400">{stats.highPriorityTasks > 0 ? `(${stats.highPriorityTasks} urgentes)` : 'em aberto'}</span>
                                </div>
                            </div>
                            <span className="material-symbols-outlined text-gray-300 group-hover:text-[#00995D] group-hover:translate-x-1 transition-all">arrow_forward</span>
                        </NavLink>

                        <NavLink to="/recados" className="bg-white hover:border-[#00995D]/30 transition-all p-5 rounded-[2rem] border border-gray-100 flex items-center gap-4 group shadow-sm flex-1">
                            <div className="size-12 rounded-2xl bg-[#00995D]/5 flex items-center justify-center text-[#00995D] group-hover:bg-[#00995D] group-hover:text-white transition-all shrink-0">
                                <span className="material-symbols-outlined font-bold">mail</span>
                            </div>
                            <div className="flex-1">
                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Recados</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-gray-800 tracking-tighter">{stats.pendingNotes}</span>
                                    <span className="text-[10px] font-bold text-gray-400">{stats.urgentNotes > 0 ? `(${stats.urgentNotes} urgentes)` : 'recebidos'}</span>
                                </div>
                            </div>
                            <span className="material-symbols-outlined text-gray-300 group-hover:text-[#00995D] group-hover:translate-x-1 transition-all">arrow_forward</span>
                        </NavLink>
                    </div>
                </div>
            </div>

            {/* Subtle Compact Footer */}
            <div className="flex justify-between items-center px-1 opacity-20 shrink-0 py-1">
                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-[0.4em]">MediPortal CDU • Operação Integrada</p>
                <div className="flex gap-2">
                    <span className="size-0.5 bg-[#00995D] rounded-full"></span>
                    <span className="size-0.5 bg-[#00995D] rounded-full"></span>
                    <span className="size-0.5 bg-[#00995D] rounded-full"></span>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
