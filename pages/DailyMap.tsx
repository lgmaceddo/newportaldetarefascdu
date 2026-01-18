import React, { useState, useEffect, useRef } from 'react';
import { Doctor, Room, DBAllocation } from '../types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';

const DailyMap: React.FC = () => {
    const { user, selectedFloor } = useAuth();
    const canEdit = user?.role !== 'doctor';

    const [activeTab, setActiveTab] = useState<'map' | 'rooms'>('map');
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [rooms, setRooms] = useState<Room[]>([]);
    const [allocations, setAllocations] = useState<DBAllocation[]>([]);
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [doctorSearch, setDoctorSearch] = useState('');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [printPeriod, setPrintPeriod] = useState<'morning' | 'afternoon' | 'both'>('both');

    const reportRef = useRef<HTMLDivElement>(null);

    // --- Data Fetching ---

    // Improved fetchRooms to be more robust
    const fetchRooms = React.useCallback(async () => {
        try {
            const floorToFetch = selectedFloor;
            console.log('Fetching rooms for floor:', floorToFetch);
            const { data, error } = await supabase
                .from('rooms')
                .select('*')
                .eq('sector', floorToFetch)
                .order('order', { ascending: true });

            if (error) throw error;
            console.log('Rooms fetched:', data?.length);
            setRooms(data || []);
            return data || [];
        } catch (error) {
            console.error('Error fetching rooms:', error);
            return [];
        }
    }, [selectedFloor]);

    // Fetch Doctors from Supabase (showing doctors for the current floor)
    const fetchDoctors = React.useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'doctor');

            if (error) throw error;

            if (data) {
                const mapped: Doctor[] = data.map((p: any) => {
                    const specialtyParts = (p.specialty || '').split(' | ');
                    return {
                        id: p.id,
                        name: p.name || 'Sem Nome',
                        specialty: (specialtyParts[0] || 'Médico').trim(),
                        phone: p.phone || '',
                        avatar: p.avatar || '',
                        color: p.color || '',
                        status: (p.status as any) || 'active',
                        isAdmin: p.is_admin,
                        sector: (specialtyParts[1] || '').trim() // Sector is stored after the pipe
                    };
                });
                setDoctors(mapped);
            }
        } catch (error) {
            console.error('Error fetching doctors:', error);
        }
    }, []);

    // Simplified fetchRooms to use the robust one defined above

    // Fetch Allocations for the selected date and floor
    const fetchAllocations = React.useCallback(async (passedRooms?: Room[]) => {
        const dateKey = formatDateKey(currentDate);
        const roomsToUse = passedRooms || rooms;

        try {
            const roomIds = roomsToUse.map(r => r.id);
            if (roomIds.length === 0) {
                setAllocations([]);
                return;
            }

            const { data, error } = await supabase
                .from('room_allocations')
                .select('*')
                .eq('date', dateKey)
                .in('room_id', roomIds);

            if (error) throw error;
            setAllocations(data || []);
        } catch (error) {
            console.error('Error fetching allocations:', error);
        }
    }, [currentDate, rooms]);

    useEffect(() => {
        fetchDoctors();
        fetchRooms();
    }, [selectedFloor]);

    useEffect(() => {
        if (rooms.length > 0) {
            fetchAllocations();
        }
    }, [currentDate, rooms]);

    // Subscribe to Realtime Changes
    useEffect(() => {
        const roomsSubscription = supabase
            .channel('rooms_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
                fetchRooms();
            })
            .subscribe();

        const allocationsSubscription = supabase
            .channel('allocations_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'room_allocations' }, () => {
                fetchAllocations();
            })
            .subscribe();

        const doctorsSubscription = supabase
            .channel('doctors_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: 'role=eq.doctor' }, () => {
                fetchDoctors();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(roomsSubscription);
            supabase.removeChannel(allocationsSubscription);
            supabase.removeChannel(doctorsSubscription);
        };
    }, [fetchRooms, fetchAllocations, fetchDoctors]);

    // Modals State
    const [showRoomModal, setShowRoomModal] = useState(false);
    const [showAllocationModal, setShowAllocationModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{ roomId: string, shift: 'morning' | 'afternoon' } | null>(null);

    // --- Helpers ---
    const formatDateKey = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    const formatDisplayDate = (date: Date) => {
        return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    };

    const getAllocation = (roomId: string, shift: 'morning' | 'afternoon') => {
        return allocations.find(a => a.room_id === roomId && a.shift === shift);
    };

    const getDoctor = (doctorId: string) => doctors.find(d => d.id === doctorId);

    const getDoctorStyle = (name: string) => {
        const isFemale = name.toLowerCase().startsWith('dra');
        if (isFemale) return { bg: 'bg-purple-50', text: 'text-purple-900', border: 'border-purple-200' };
        return { bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-200' };
    };

    const changeDate = (days: number) => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + days);
        setCurrentDate(newDate);
    };

    // --- PDF Handler ---
    const handleDownloadPDF = async () => {
        const element = reportRef.current;
        if (!element) return;
        setIsGeneratingPdf(true);
        setTimeout(async () => {
            try {
                await document.fonts.ready;
                const canvas = await html2canvas(element, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    width: 794,
                    height: 1123,
                    windowWidth: 794,
                    windowHeight: 1123,
                });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
                pdf.save(`mapa_${selectedFloor}_${formatDateKey(currentDate)}.pdf`);
            } catch (error) {
                console.error(error);
                alert('Erro ao gerar PDF');
            } finally {
                setIsGeneratingPdf(false);
            }
        }, 100);
    };

    // --- Handlers ---
    const [roomForm, setRoomForm] = useState({ name: '', extension: '' });
    const [editingRoomId, setEditingRoomId] = useState<string | null>(null);

    const handleSaveRoom = async () => {
        if (!roomForm.name.trim()) return;
        try {
            if (editingRoomId) {
                const { error } = await supabase.from('rooms').update({
                    name: roomForm.name,
                    extension: roomForm.extension
                }).eq('id', editingRoomId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('rooms').insert({
                    name: roomForm.name,
                    extension: roomForm.extension,
                    sector: selectedFloor,
                    order: rooms.length
                });
                if (error) throw error;
            }

            console.log('Room saved, fetching all rooms again...');
            await fetchRooms();
            setRoomForm({ name: '', extension: '' });
            setEditingRoomId(null);
        } catch (error) {
            console.error('Error saving room:', error);
            alert('Erro ao salvar sala: ' + (error as any).message);
        }
    };

    const handleDeleteRoom = async (id: string) => {
        if (window.confirm('Excluir esta sala e suas alocações?')) {
            await supabase.from('rooms').delete().eq('id', id);
            fetchRooms();
        }
    };

    const handleAssignDoctor = async (doctorId: string) => {
        if (!selectedSlot) return;
        const { roomId, shift } = selectedSlot;
        try {
            const dateKey = formatDateKey(currentDate);
            console.log('Finalizing allocation:', { doctorId, roomId, dateKey, shift });

            // Ensure we are sending the correct values
            const { error } = await supabase.from('room_allocations').upsert({
                room_id: roomId,
                doctor_id: doctorId,
                date: dateKey,
                shift: shift, // This is explicitly 'morning' or 'afternoon'
                created_by: user?.id
            }, {
                onConflict: 'room_id,date,shift'
            });

            if (error) throw error;

            // Close modal first for better UX
            setShowAllocationModal(false);

            // Refresh allocations
            await fetchAllocations();
        } catch (error) {
            console.error('Failed to assign doctor:', error);
            alert('Erro ao realizar alocação: ' + (error as any).message);
        }
    };

    const handleClearSlot = async () => {
        if (!selectedSlot) return;
        try {
            const dateKey = formatDateKey(currentDate);
            const { error } = await supabase.from('room_allocations').delete()
                .eq('room_id', selectedSlot.roomId)
                .eq('date', dateKey)
                .eq('shift', selectedSlot.shift);

            if (error) throw error;

            await fetchAllocations();
            setShowAllocationModal(false);
        } catch (error) {
            console.error('Error clearing slot:', error);
            alert('Erro ao remover alocação: ' + (error as any).message);
        }
    };

    // --- Render Content ---
    const ReportContent = ({ isPdf = false }: { isPdf?: boolean }) => (
        <div className="w-full h-full bg-white font-sans flex flex-col p-6 box-border relative text-gray-900">
            {isPdf && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none">
                    <span className="material-symbols-outlined text-[400px]">local_hospital</span>
                </div>
            )}
            <div className={`mb-6 flex justify-between items-center shrink-0 border-b-2 pb-4 ${isPdf ? 'border-primary' : 'border-gray-200'}`}>
                <div className="flex items-center gap-3">
                    <div className="bg-primary text-white p-1.5 rounded-lg">
                        <span className="material-symbols-outlined text-2xl">local_hospital</span>
                    </div>
                    <h1 className="font-bold leading-none tracking-tight text-gray-800 whitespace-nowrap text-xl">
                        Mapa Diário - {selectedFloor}
                    </h1>
                </div>
                <div className="text-right">
                    <p className="font-bold capitalize leading-none whitespace-nowrap text-primary text-base">
                        {formatDisplayDate(currentDate)}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3 content-start relative z-10">
                {rooms.map((room) => {
                    const morning = getAllocation(room.id, 'morning');
                    const afternoon = getAllocation(room.id, 'afternoon');
                    const docMorning = morning ? getDoctor(morning.doctor_id) : null;
                    const docAfternoon = afternoon ? getDoctor(afternoon.doctor_id) : null;
                    const styleMorning = docMorning ? getDoctorStyle(docMorning.name) : { text: 'text-gray-900' };
                    const styleAfternoon = docAfternoon ? getDoctorStyle(docAfternoon.name) : { text: 'text-gray-900' };

                    return (
                        <div key={room.id} className="border rounded-lg overflow-hidden flex flex-col bg-white shadow-sm h-[140px] border-gray-200">
                            <div className="px-2.5 py-1.5 border-b flex justify-between items-center shrink-0 bg-gray-50 border-gray-200">
                                <span className="font-bold text-[10px] uppercase text-gray-700 truncate">{room.name}</span>
                                {room.extension && <span className="text-[9px] font-bold text-gray-400">EXT: {room.extension}</span>}
                            </div>
                            <div className="flex-1 flex flex-col divide-y divide-gray-100">
                                {(printPeriod === 'morning' || printPeriod === 'both') && (
                                    <div className="flex-1 px-2.5 py-1.5 flex flex-col justify-center bg-white relative">
                                        <div className="flex justify-between items-center mb-0.5">
                                            <span className="text-[8px] font-bold uppercase tracking-wider text-primary">Manhã</span>
                                            {!docMorning && <span className="text-[8px] text-gray-300 italic">Livre</span>}
                                        </div>
                                        {docMorning && (
                                            <div className="w-full mt-1">
                                                <p className={`font-bold uppercase leading-normal whitespace-nowrap ${printPeriod === 'both' ? 'text-[9px]' : 'text-[11px]'} ${styleMorning.text}`}>{docMorning.name}</p>
                                                <p className={`font-medium text-gray-500 leading-normal ${printPeriod === 'both' ? 'text-[8px]' : 'text-[10px]'}`}>{docMorning.specialty}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {(printPeriod === 'afternoon' || printPeriod === 'both') && (
                                    <div className="flex-1 px-2.5 py-2 flex flex-col justify-center relative bg-gray-50/50">
                                        <div className="flex justify-between items-center mb-0.5">
                                            <span className="text-[8px] font-bold uppercase tracking-wider text-primary">Tarde</span>
                                            {!docAfternoon && <span className="text-[8px] text-gray-300 italic">Livre</span>}
                                        </div>
                                        {docAfternoon && (
                                            <div className="w-full mt-1">
                                                <p className={`font-bold uppercase leading-normal whitespace-nowrap ${printPeriod === 'both' ? 'text-[9px]' : 'text-[11px]'} ${styleAfternoon.text}`}>{docAfternoon.name}</p>
                                                <p className={`font-medium text-gray-500 leading-normal ${printPeriod === 'both' ? 'text-[8px]' : 'text-[10px]'}`}>{docAfternoon.specialty}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-6 h-full relative">
            {/* --- TAB NAVIGATION (NEW) --- */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('map')}
                    className={`px-6 py-3 font-bold text-sm flex items-center gap-2 transition-all relative ${activeTab === 'map' ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <span className="material-symbols-outlined text-lg">grid_view</span>
                    Mapa de Alocação
                    {activeTab === 'map' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-in fade-in slide-in-from-bottom-1" />}
                </button>
                {canEdit && (
                    <button
                        onClick={() => setActiveTab('rooms')}
                        className={`px-6 py-3 font-bold text-sm flex items-center gap-2 transition-all relative ${activeTab === 'rooms' ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <span className="material-symbols-outlined text-lg">meeting_room</span>
                        Gerenciar Salas
                        {activeTab === 'rooms' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-in fade-in slide-in-from-bottom-1" />}
                    </button>
                )}
            </div>

            {/* --- HEADER --- */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 mt-2">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                        {activeTab === 'map' ? 'Mapa Diário de Alocação' : 'Configuração de Salas'}
                    </h2>
                    <p className="text-gray-500">{selectedFloor} • {rooms.length} Salas cadastradas.</p>
                </div>
                {activeTab === 'map' && (
                    <button onClick={() => setShowReportModal(true)} className="bg-secondary text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-gray-700 transition-colors flex items-center gap-2 shadow-sm">
                        <span className="material-symbols-outlined text-lg">print</span>
                        Imprimir / PDF
                    </button>
                )}
            </div>

            {activeTab === 'map' ? (
                <>
                    {/* Date Nav */}
                    <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between max-w-md mx-auto w-full">
                        <button onClick={() => changeDate(-1)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <div className="flex flex-col items-center">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{currentDate.getFullYear()}</span>
                            <span className="text-lg font-bold text-primary capitalize">{formatDisplayDate(currentDate).split(',')[0]}</span>
                            <span className="text-xs text-gray-500">{formatDisplayDate(currentDate).split(',')[1]}</span>
                        </div>
                        <button onClick={() => changeDate(1)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>

                    {/* Grid Screen */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 pb-10">
                        {rooms.length > 0 ? (
                            rooms.map((room) => {
                                const morning = getAllocation(room.id, 'morning');
                                const afternoon = getAllocation(room.id, 'afternoon');
                                const docMorning = morning ? getDoctor(morning.doctor_id) : null;
                                const docAfternoon = afternoon ? getDoctor(afternoon.doctor_id) : null;
                                const styleMorning = docMorning ? getDoctorStyle(docMorning.name) : { text: 'text-gray-900' };
                                const styleAfternoon = docAfternoon ? getDoctorStyle(docAfternoon.name) : { text: 'text-gray-900' };

                                return (
                                    <div key={room.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col transition-all hover:shadow-md h-full">
                                        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex justify-between items-center h-10">
                                            <span className="font-bold text-gray-800 text-xs truncate">{room.name}</span>
                                            {room.extension && <span className="text-gray-500 text-[10px] font-bold">RAMAL: {room.extension}</span>}
                                        </div>
                                        <div className="divide-y divide-gray-100 flex-1 flex flex-col">
                                            <div onClick={() => canEdit && (setSelectedSlot({ roomId: room.id, shift: 'morning' }), setShowAllocationModal(true))} className={`p-2 relative flex-1 min-h-[70px] flex flex-col justify-center ${canEdit ? 'cursor-pointer hover:bg-gray-50' : ''}`}>
                                                <span className="absolute top-1 right-1 text-[8px] font-bold text-primary-dark uppercase bg-primary-light/50 px-1 rounded">Manhã</span>
                                                {docMorning ? (
                                                    <div className="mt-1">
                                                        <p className={`font-bold text-xs uppercase truncate ${styleMorning.text}`}>{docMorning.name}</p>
                                                        <p className="text-[10px] text-gray-500 truncate">{docMorning.specialty}</p>
                                                    </div>
                                                ) : (canEdit && <div className="text-center text-gray-200"><span className="material-symbols-outlined text-lg">add</span></div>)}
                                            </div>
                                            <div onClick={() => canEdit && (setSelectedSlot({ roomId: room.id, shift: 'afternoon' }), setShowAllocationModal(true))} className={`p-2 relative flex-1 min-h-[70px] flex flex-col justify-center ${canEdit ? 'cursor-pointer hover:bg-gray-50' : ''}`}>
                                                <span className="absolute top-1 right-1 text-[8px] font-bold text-primary-dark uppercase bg-primary-light/50 px-1 rounded">Tarde</span>
                                                {docAfternoon ? (
                                                    <div className="mt-1">
                                                        <p className={`font-bold text-xs uppercase truncate ${styleAfternoon.text}`}>{docAfternoon.name}</p>
                                                        <p className="text-[10px] text-gray-500 truncate">{docAfternoon.specialty}</p>
                                                    </div>
                                                ) : (canEdit && <div className="text-center text-gray-200"><span className="material-symbols-outlined text-lg">add</span></div>)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="col-span-full py-20 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">meeting_room</span>
                                <p className="text-gray-400 font-medium">Nenhuma sala cadastrada no {selectedFloor}.</p>
                                <button
                                    onClick={() => setActiveTab('rooms')}
                                    className="mt-4 text-primary font-bold text-sm hover:underline"
                                >
                                    Cadastrar salas agora
                                </button>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col max-w-4xl mx-auto w-full p-6 animate-in fade-in slide-in-from-top-2">
                    <div className="flex gap-4 mb-8 items-end bg-gray-50 p-6 rounded-xl border border-gray-100 shadow-inner">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Nome da Sala</label>
                            <input
                                type="text"
                                placeholder="Ex: Sala 01, Consultório..."
                                value={roomForm.name}
                                onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                                className="w-full border border-gray-300 p-3 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            />
                        </div>
                        <div className="w-32">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Ramal</label>
                            <input
                                type="text"
                                placeholder="Ex: 201"
                                value={roomForm.extension}
                                onChange={(e) => setRoomForm({ ...roomForm, extension: e.target.value })}
                                className="w-full border border-gray-300 p-3 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            />
                        </div>
                        <button
                            onClick={handleSaveRoom}
                            disabled={!roomForm.name.trim()}
                            className="bg-primary text-white h-[46px] px-6 rounded-lg font-bold flex items-center gap-2 hover:bg-primary-dark transition-colors disabled:bg-gray-300 shadow-lg shadow-primary/20"
                        >
                            <span className="material-symbols-outlined">{editingRoomId ? 'save' : 'add'}</span>
                            {editingRoomId ? 'Salvar' : 'Criar Sala'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {rooms.map(room => (
                            <div key={room.id} className="flex justify-between items-center p-4 rounded-xl border border-gray-100 bg-white hover:border-primary/30 transition-all group shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="bg-primary/10 p-2 rounded-lg text-primary">
                                        <span className="material-symbols-outlined text-xl">meeting_room</span>
                                    </div>
                                    <div>
                                        <span className="font-bold text-gray-800 block text-base">{room.name}</span>
                                        <span className="text-xs text-gray-500 font-bold bg-gray-50 px-2 py-0.5 rounded border border-gray-100">Ramal: {room.extension || '-'}</span>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => (setRoomForm({ name: room.name, extension: room.extension || '' }), setEditingRoomId(room.id))} className="text-gray-400 hover:text-blue-500 p-2 hover:bg-blue-50 rounded-lg transition-colors"><span className="material-symbols-outlined">edit</span></button>
                                    <button onClick={() => handleDeleteRoom(room.id)} className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"><span className="material-symbols-outlined">delete</span></button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {rooms.length === 0 && (
                        <div className="text-center py-20 text-gray-400 italic">
                            Nenhuma sala cadastrada para este setor.
                        </div>
                    )}
                </div>
            )}

            {/* PREVIEW MODAL */}
            {showReportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-gray-200 rounded-xl shadow-2xl w-full max-w-[1200px] h-[90vh] flex flex-col overflow-hidden">
                        <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">print</span>
                                Impressão - {selectedFloor}
                            </h3>
                            <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
                                {['morning', 'afternoon', 'both'].map(p => (
                                    <button key={p} onClick={() => setPrintPeriod(p as any)} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${printPeriod === p ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}>
                                        {p === 'morning' ? 'Manhã' : p === 'afternoon' ? 'Tarde' : 'Ambos'}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setShowReportModal(false)} className="px-4 py-2 text-gray-500 font-bold text-sm hover:bg-gray-100 rounded-lg">Fechar</button>
                                <button onClick={handleDownloadPDF} disabled={isGeneratingPdf} className="bg-primary text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                                    {isGeneratingPdf ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : <span className="material-symbols-outlined">download</span>}
                                    {isGeneratingPdf ? 'Gerando...' : 'Baixar PDF'}
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-8 flex justify-center bg-gray-500/10">
                            <div ref={reportRef} className="bg-white shadow-lg mx-auto" style={{ width: '794px', height: '1123px', minWidth: '794px', minHeight: '1123px' }}>
                                <ReportContent isPdf={true} />
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* ALLOCATION MODAL */}
            {showAllocationModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
                        <div className="p-4 border-b bg-primary text-white">
                            <h3 className="font-bold">Alocar Médico</h3>
                            <p className="text-xs opacity-80">{rooms.find(r => r.id === selectedSlot?.roomId)?.name} • {selectedSlot?.shift === 'morning' ? 'Manhã' : 'Tarde'}</p>
                        </div>
                        <div className="p-2 max-h-[60vh] overflow-y-auto">
                            <input type="text" placeholder="Buscar..." value={doctorSearch} onChange={(e) => setDoctorSearch(e.target.value)} className="w-full text-sm p-2 border rounded-lg mb-2" />
                            {doctors
                                .filter(d =>
                                    d.name.toLowerCase().includes(doctorSearch.toLowerCase()) &&
                                    d.sector === selectedFloor
                                )
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(doctor => (
                                    <button key={doctor.id} onClick={() => handleAssignDoctor(doctor.id)} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg text-left border-l-4 border-primary bg-primary/5 mb-1 transition-all">
                                        <div className="size-8 rounded-full bg-primary-light flex items-center justify-center font-bold text-[10px] text-primary">
                                            {doctor.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-sm">{doctor.name}</p>
                                            <p className="text-[10px] text-gray-500">{doctor.specialty}</p>
                                        </div>
                                    </button>
                                ))}
                            {doctors.filter(d => d.sector === selectedFloor).length === 0 && (
                                <div className="text-center py-8 text-gray-400 italic text-sm">
                                    Nenhum profissional cadastrado para o {selectedFloor}.
                                </div>
                            )}
                            {selectedSlot && getAllocation(selectedSlot.roomId, selectedSlot.shift) && (
                                <button onClick={handleClearSlot} className="w-full mt-2 p-2 text-red-500 font-bold text-sm hover:bg-red-50 rounded-lg">Remover Alocação</button>
                            )}
                        </div>
                        <div className="p-3 bg-gray-50 text-center">
                            <button onClick={() => setShowAllocationModal(false)} className="text-gray-500 text-sm font-bold">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DailyMap;