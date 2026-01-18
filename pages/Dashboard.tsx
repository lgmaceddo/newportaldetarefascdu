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
    const { user } = useAuth();
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
    const [myAllocations, setMyAllocations] = useState<any[]>([]);
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

            // 1. Fetch Rooms and Allocations
            const { data: roomsData } = await supabase.from('rooms').select('*');
            const { data: allocsData } = await supabase.from('daily_map_allocations').select('*, profiles(name, specialty)');

            // 2. Fetch Tasks and Notes for summary
            const savedTasks: Task[] = JSON.parse(localStorage.getItem('mediportal_tasks') || '[]');
            const savedNotes: Note[] = JSON.parse(localStorage.getItem('mediportal_notes') || '[]');

            const localAllocs: any[] = JSON.parse(localStorage.getItem('mediportal_allocations') || '[]');
            const localRooms: any[] = JSON.parse(localStorage.getItem('mediportal_rooms') || '[]');

            const combinedAllocs = [...(allocsData || []), ...localAllocs];
            const combinedRooms = [...(roomsData || []), ...localRooms];

            setRooms(combinedRooms);
            setAllocations(combinedAllocs);

            // Calculate Doctor Stats (Global for the day)
            const dayAllAllocs = combinedAllocs.filter(a => a.date === todayDateKey);
            const morningDocs = new Set(dayAllAllocs.filter(a => (a.shift?.toLowerCase() === 'morning' || a.shift === 'Manhã')).map(a => a.doctor_id || a.doctorId)).size;
            const afternoonDocs = new Set(dayAllAllocs.filter(a => (a.shift?.toLowerCase() === 'afternoon' || a.shift === 'Tarde')).map(a => a.doctor_id || a.doctorId)).size;
            const totalDocs = new Set(dayAllAllocs.map(a => a.doctor_id || a.doctorId)).size;

            // Calculate Individual Stats based on Profile
            if (user?.role === 'doctor') {
                const myPendingTasks = savedTasks.filter(t => t.assignedTo === user.id && t.status !== TaskStatus.DONE);
                const myPendingNotes = savedNotes.filter(n => n.to === user.id && n.status !== 'completed');

                setStats({
                    pendingTasks: myPendingTasks.length,
                    highPriorityTasks: myPendingTasks.filter(t => t.priority === Priority.HIGH).length,
                    pendingNotes: myPendingNotes.length,
                    urgentNotes: myPendingNotes.filter(n => n.category === 'urgent').length,
                    morningDoctors: morningDocs,
                    afternoonDoctors: afternoonDocs,
                    totalDoctors: totalDocs
                });

                const dayAllocs = combinedAllocs.filter(a => {
                    const docId = a.doctor_id || a.doctorId;
                    return docId === user.id && a.date === todayDateKey;
                });

                const formattedMyAllocs = dayAllocs.map(a => {
                    const rId = a.room_id || a.roomId;
                    const room = combinedRooms.find(r => r.id === rId);
                    const shift = (a.shift || '').toLowerCase();
                    return {
                        ...a,
                        roomName: room?.name || 'Sala Desconhecida',
                        extension: room?.extension || '-',
                        shiftLabel: shift === 'morning' ? 'Manhã' : 'Tarde',
                        timeRange: shift === 'morning' ? '07:00 - 13:00' : '13:00 - 19:00'
                    };
                }).sort((a, b) => (a.shift || '').toLowerCase() === 'morning' ? -1 : 1);

                setMyAllocations(formattedMyAllocs);
            } else {
                const allPendingTasks = savedTasks.filter(t => t.status !== TaskStatus.DONE);
                const allPendingNotes = savedNotes.filter(n => n.status !== 'completed');

                setStats({
                    pendingTasks: allPendingTasks.length,
                    highPriorityTasks: allPendingTasks.filter(t => t.priority === Priority.HIGH).length,
                    pendingNotes: allPendingNotes.length,
                    urgentNotes: allPendingNotes.filter(n => n.category === 'urgent').length,
                    morningDoctors: morningDocs,
                    afternoonDoctors: afternoonDocs,
                    totalDoctors: totalDocs
                });
            }

        } catch (error) {
            console.error("Error loading dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRealtimeData();
        const channel = supabase.channel('dashboard_restore_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_map_allocations' }, () => fetchRealtimeData())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [user]);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Bom dia';
        if (hour < 18) return 'Boa tarde';
        return 'Boa noite';
    };

    const getFormattedUserName = () => {
        if (!user) return 'Usuário';
        if (user.role === 'doctor') return user.name;
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
        <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto px-1 sm:px-4 py-2 animate-in fade-in duration-700">

            {/* --- Premium Top Header --- */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 border-b border-gray-100 pb-8">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-8 h-1 bg-[#00995D] rounded-full"></span>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00995D]">Portal de Atendimento</span>
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight leading-none mb-2">
                        {getGreeting()}, <span className="text-[#00995D]">{getFormattedUserName()}</span>
                    </h1>
                    <p className="text-gray-500 font-medium text-lg">
                        {user?.role === 'doctor'
                            ? 'Bem-vindo ao seu painel clínico integrado.'
                            : 'Gestão de fluxo e alocação de salas em tempo real.'}
                    </p>
                </div>
                <div className="hidden sm:flex flex-col items-end">
                    <div className="bg-white shadow-sm border border-gray-100 rounded-2xl px-6 py-3 flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hoje</p>
                            <p className="text-sm font-black text-gray-800">
                                {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-[#00995D]/5 flex items-center justify-center text-[#00995D]">
                            <span className="material-symbols-outlined font-bold">calendar_month</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Hero Section: Allocation & Stats --- */}
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden flex flex-col lg:flex-row min-h-[400px]">

                {/* Left Panel: Status Summary */}
                <div className="lg:w-1/3 bg-[#004729] p-10 flex flex-col justify-between text-white relative overflow-hidden">
                    <div className="absolute -right-16 -bottom-16 opacity-5 rotate-12">
                        <span className="material-symbols-outlined text-[20rem]">medical_information</span>
                    </div>

                    <div className="relative z-10">
                        <div className="bg-[#00995D]/30 text-[#00E68A] border border-[#00995D]/30 rounded-xl px-4 py-2 w-fit mb-8">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em]">Alocação Confirmada</p>
                        </div>
                        <h3 className="text-4xl font-black tracking-tight leading-tight mb-4">
                            Status do Dia
                        </h3>
                        <p className="text-gray-300 font-medium text-lg leading-relaxed mb-10">
                            {user?.role === 'doctor' ? (
                                myAllocations.length > 0
                                    ? `Você possui ${myAllocations.length} ${myAllocations.length === 1 ? 'sala designada' : 'salas designadas'} para atendimento hoje.`
                                    : 'Sua escala está sendo finalizada pela recepção central.'
                            ) : (
                                'Acompanhe a ocupação das salas e gerencie as pendências do setor em tempo real.'
                            )}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-auto">
                            <NavLink to="/tarefas" className="bg-[#005F37] hover:bg-[#007D49] transition-all p-5 rounded-[2rem] border border-white/5 flex flex-col gap-1 items-start group">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-sm text-[#00E68A]">assignment</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-[#00E68A]">Tarefas</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-black tracking-tighter">{stats.pendingTasks}</span>
                                    <span className="text-xs font-bold text-white/50">{stats.highPriorityTasks > 0 ? `(${stats.highPriorityTasks} urg.)` : 'pendentes'}</span>
                                </div>
                            </NavLink>
                            <NavLink to="/recados" className="bg-[#005F37] hover:bg-[#007D49] transition-all p-5 rounded-[2rem] border border-white/5 flex flex-col gap-1 items-start group">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-sm text-[#00E68A]">mail</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-[#00E68A]">Recados</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-black tracking-tighter">{stats.pendingNotes}</span>
                                    <span className="text-xs font-bold text-white/50">{stats.urgentNotes > 0 ? `(${stats.urgentNotes} urg.)` : 'novos'}</span>
                                </div>
                            </NavLink>
                            {/* NEW: Médicos Summary */}
                            <NavLink to="/profissionais" className="bg-[#005F37] hover:bg-[#007D49] transition-all p-5 rounded-[2rem] border border-white/5 flex flex-col gap-1 items-start group sm:col-span-2">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-sm text-[#00E68A]">groups</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-[#00E68A]">Corpo Clínico (Hoje)</span>
                                </div>
                                <div className="flex w-full items-center justify-between">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-black tracking-tighter">{stats.totalDoctors}</span>
                                        <span className="text-xs font-bold text-white/50">médicos total</span>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[8px] font-black text-[#00E68A] uppercase tracking-tighter">Manhã</span>
                                            <span className="text-lg font-black leading-none">{stats.morningDoctors}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-[8px] font-black text-[#00E68A] uppercase tracking-tighter">Tarde</span>
                                            <span className="text-lg font-black leading-none">{stats.afternoonDoctors}</span>
                                        </div>
                                    </div>
                                </div>
                            </NavLink>
                        </div>
                    </div>

                    <div className="relative z-10 mt-10 flex items-center gap-2">
                        <div className="size-2 bg-[#00E68A] rounded-full animate-pulse shadow-[0_0_8px_#00E68A]"></div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Conectado ao Sistema</span>
                    </div>
                </div>

                {/* Right Panel: Detailed Allocations */}
                <div className="lg:w-2/3 p-10 flex flex-col justify-center bg-gray-50/30">
                    {user?.role === 'doctor' ? (
                        <div className="space-y-6">
                            <div className="mb-4">
                                <h4 className="text-xs font-black text-[#00995D] uppercase tracking-[0.2em] mb-1">Mapa de Atendimento</h4>
                                <h2 className="text-2xl font-black text-gray-900">Você está alocado na:</h2>
                            </div>

                            {myAllocations.length > 0 ? (
                                <div className="grid grid-cols-1 gap-4">
                                    {myAllocations.map((alloc, idx) => (
                                        <div key={idx} className="group bg-white rounded-3xl p-6 border border-gray-100 hover:border-[#00995D]/30 hover:shadow-2xl hover:shadow-[#00995D]/10 transition-all duration-300 flex items-center justify-between gap-6">
                                            <div className="flex items-center gap-6">
                                                <div className="size-16 rounded-2xl bg-[#00995D]/5 flex items-center justify-center text-[#00995D] group-hover:bg-[#00995D] group-hover:text-white transition-all transform group-hover:scale-105">
                                                    <span className="material-symbols-outlined text-3xl font-bold">meeting_room</span>
                                                </div>
                                                <div>
                                                    <p className="text-2xl font-black text-gray-900 tracking-tight">{alloc.roomName}</p>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${alloc.shiftLabel === 'Manhã' ? 'bg-[#00995D]/10 text-[#00995D]' : 'bg-[#004729]/10 text-[#004729]'}`}>
                                                            {alloc.shiftLabel}
                                                        </span>
                                                        <span className="text-sm font-bold text-gray-400 tracking-tight">{alloc.timeRange}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-8">
                                                <div className="text-right hidden sm:block">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ramal</p>
                                                    <p className="text-2xl font-black text-[#00995D] leading-none">{alloc.extension}</p>
                                                </div>
                                                <NavLink to="/mapa" className="size-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-[#00995D] hover:bg-[#00995D]/5 transition-all">
                                                    <span className="material-symbols-outlined font-bold">map</span>
                                                </NavLink>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-center py-20 bg-white rounded-[2rem] border-2 border-dashed border-gray-100">
                                    <div className="size-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-200 mb-4">
                                        <span className="material-symbols-outlined text-5xl">event_busy</span>
                                    </div>
                                    <h5 className="text-lg font-black text-gray-800">Escala não definida</h5>
                                    <p className="text-gray-400 font-medium max-w-xs mx-auto">Sua alocação para hoje ainda não foi publicada pela recepção central.</p>
                                </div>
                            )}

                            <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                                <NavLink to="/mapa" className="text-[#00995D] font-black text-sm flex items-center gap-2 hover:translate-x-1 transition-transform">
                                    Ver Mapa Geral do Setor <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                </NavLink>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h4 className="text-xs font-black text-[#00995D] uppercase tracking-[0.2em] mb-1">Status Operacional</h4>
                                    <h2 className="text-2xl font-black text-gray-900">Ocupação das Salas</h2>
                                </div>
                                <NavLink to="/mapa" className="bg-[#00995D] text-white px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-[#004729] shadow-lg shadow-[#00995D]/20 transition-all">
                                    Abrir Mapa
                                </NavLink>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                {rooms.slice(0, 6).map(room => {
                                    const am = allocations.find(a => (a.room_id === room.id || a.roomId === room.id) && a.date === todayDateKey && (a.shift || '').toLowerCase() === 'morning');
                                    const pm = allocations.find(a => (a.room_id === room.id || a.roomId === room.id) && a.date === todayDateKey && (a.shift || '').toLowerCase() === 'afternoon');

                                    return (
                                        <div key={room.id} className="bg-white p-5 rounded-[1.5rem] border border-gray-100 flex flex-col gap-4 shadow-sm hover:shadow-xl hover:shadow-gray-200/50 transition-all group">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{room.name}</span>
                                                <div className={`size-2 rounded-full ${(am || pm) ? 'bg-[#00E68A]' : 'bg-gray-200'}`}></div>
                                            </div>
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`size-7 rounded-lg flex items-center justify-center text-[9px] font-black ${am ? 'bg-[#00995D] text-white' : 'bg-gray-100 text-gray-400'}`}>M</div>
                                                    <p className={`text-[11px] font-bold truncate ${am ? 'text-gray-800' : 'text-gray-300'}`}>
                                                        {am ? (am.profiles?.name || am.doctorName) : 'Vago'}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className={`size-7 rounded-lg flex items-center justify-center text-[9px] font-black ${pm ? 'bg-[#004729] text-white' : 'bg-gray-100 text-gray-400'}`}>T</div>
                                                    <p className={`text-[11px] font-bold truncate ${pm ? 'text-gray-800' : 'text-gray-300'}`}>
                                                        {pm ? (pm.profiles?.name || pm.doctorName) : 'Vago'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Subtle Footer */}
            <div className="flex justify-between items-center px-6 opacity-30 mt-auto pt-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]">MediPortal Unimed v2.0</p>
                <div className="flex gap-4">
                    <span className="size-1 bg-[#00995D] rounded-full"></span>
                    <span className="size-1 bg-[#00995D] rounded-full"></span>
                    <span className="size-1 bg-[#00995D] rounded-full"></span>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
