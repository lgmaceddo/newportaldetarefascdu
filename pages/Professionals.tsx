import React, { useState, useEffect } from 'react';
import { Doctor } from '../types';
import { supabase } from '../services/supabase';
import { useAuth, FLOOR_OPTIONS, MEDICAL_SPECIALTIES } from '../contexts/AuthContext';

const Professionals: React.FC = () => {
    const { user: currentUser, selectedFloor } = useAuth();
    const [professionals, setProfessionals] = useState<Doctor[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProfessional, setEditingProfessional] = useState<Doctor | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        specialty: '',
        phone: '',
        gender: 'male' as 'male' | 'female',
        sector: FLOOR_OPTIONS[0],
        status: 'active' as 'active' | 'inactive' | 'vacation'
    });

    // Fetch Data from Supabase
    const fetchProfessionals = async () => {
        try {
            setLoading(true);
            // Explicitly select common columns plus the new ones to be sure
            const { data, error } = await supabase
                .from('profiles')
                .select('id, name, email, role, avatar, specialty, status, is_admin, phone, gender')
                .eq('role', 'doctor');

            if (error) {
                console.error('Supabase error fetching professionals:', error);
                throw error;
            }

            if (data) {
                const mappedDoctors: Doctor[] = data.map((p: any) => {
                    // specialty stores "Specialty | Sector"
                    const parts = (p.specialty || '').split(' | ');
                    return {
                        id: p.id,
                        name: p.name || 'Sem Nome',
                        specialty: (parts[0] || 'Geral').trim(),
                        sector: (parts[1] || '').trim(),
                        phone: p.phone || '',
                        avatar: p.avatar || '',
                        status: (p.status as any) || 'active',
                        color: '',
                        gender: (p.gender as any) || 'male',
                        isAdmin: !!p.is_admin
                    };
                });
                setProfessionals(mappedDoctors);
            }
        } catch (error: any) {
            console.error('Catch error fetching professionals:', error);
            showToast(`Erro ao carregar profissionais: ${error.message || 'Erro desconhecido'}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfessionals();

        const channel = supabase
            .channel('public:profiles:doctor')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: 'role=eq.doctor' }, () => {
                fetchProfessionals();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        }
    }, [selectedFloor]); // Re-fetch or re-filter when floor changes

    // Handlers
    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
    };

    const filtered = professionals.filter((p: any) => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.specialty.toLowerCase().includes(search.toLowerCase());

        // Filter by the user's currently selected floor
        // If the doctor has no sector assigned, they show everywhere? 
        // User asked: "lista... disponível APENAS os cadastrados naquele setor"
        const matchesSector = p.sector === selectedFloor;

        return matchesSearch && matchesSector;
    });

    const openModal = (prof: any | null = null) => {
        if (prof) {
            setEditingProfessional(prof);
            // Extract title if exists
            let name = prof.name;
            let gender: 'male' | 'female' = prof.gender as any || (name.toLowerCase().startsWith('dra') ? 'female' : 'male');

            setFormData({
                name: name.replace(/^(dr|dra|dr\.|dra\.|drº|drª)\s+/i, '').trim(),
                specialty: prof.specialty,
                phone: prof.phone,
                gender: gender,
                sector: prof.sector || selectedFloor || FLOOR_OPTIONS[0], // Assuming sector is stored in specialty for doctors or we use specialty as label
                status: prof.status as any
            });
        } else {
            setEditingProfessional(null);
            setFormData({
                name: '',
                specialty: '',
                phone: '',
                gender: 'male',
                sector: selectedFloor || FLOOR_OPTIONS[0],
                status: 'active'
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name) {
            alert("Nome é obrigatório.");
            return;
        }

        // Auto title
        const title = formData.gender === 'male' ? 'Drº' : 'Drª';
        const fullName = `${title} ${formData.name}`;

        // Store specialty and sector joined by a delimiter
        const combinedSpecialty = `${formData.specialty} | ${formData.sector}`;

        const profData = {
            name: fullName,
            specialty: combinedSpecialty,
            phone: formData.phone,
            gender: formData.gender,
            status: formData.status,
            role: 'doctor'
        };

        try {
            if (editingProfessional) {
                const { error } = await supabase
                    .from('profiles')
                    .update(profData)
                    .eq('id', editingProfessional.id);
                if (error) throw error;
                showToast("Profissional atualizado com sucesso!");
            } else {
                // For 'create', we usually need to create an auth user or just a profile?
                // The user asked to "add, edit and delete". In a real app 'create' requires email/password.
                // For clinical staff, we might just be managing profiles even if they don't login.
                // But Supabase profiles are linked to auth.users.
                // IF we want to JUST add to profiles without auth (for display only), 
                // we'd need a separate table or allow NULL id? Profiles usually has id as FK to auth.users.

                // USER REQUEST: "add, edit, exclude". 
                // Strategy: Update profiles. If we need to create a new one without auth, 
                // it might fail if ID is mandatory and not generated. 
                // I'll check if I can insert without ID (letting DB generate it if possible) or use a random UUID.

                const { error } = await supabase
                    .from('profiles')
                    .insert([{
                        ...profData,
                        id: (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : undefined
                    }]);

                if (error) throw error;
                showToast("Profissional criado com sucesso!");
            }
            setIsModalOpen(false);
            fetchProfessionals();
        } catch (err) {
            console.error("Error saving professional:", err);
            showToast("Erro ao salvar profissional.");
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Deseja realmente excluir este profissional?")) return;

        try {
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', id);
            if (error) throw error;
            showToast("Profissional excluído.");
            fetchProfessionals();
        } catch (err) {
            console.error("Error deleting professional:", err);
            showToast("Erro ao excluir profissional.");
        }
    };

    const getInitials = (name: string) => {
        const cleanName = name.replace(/^(dr|dra|dr\.|dra\.|drº|drª)\s+/i, '').trim();
        const parts = cleanName.split(' ');
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    const getStyleByName = (name: string, gender?: string) => {
        const isFemale = gender === 'female' || name.toLowerCase().includes('dra');
        if (isFemale) {
            return {
                bg: 'bg-purple-50',
                text: 'text-purple-700',
                borderLeft: 'border-l-purple-400',
                iconText: 'text-purple-600'
            };
        }
        return {
            bg: 'bg-primary-light',
            text: 'text-primary-dark',
            borderLeft: 'border-l-primary',
            iconText: 'text-primary'
        };
    };

    const getStatusDotColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-500';
            case 'inactive': return 'bg-gray-300';
            case 'vacation': return 'bg-yellow-400';
            default: return 'bg-gray-300';
        }
    };

    const canManage = currentUser?.isAdmin || currentUser?.role === 'reception';

    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="flex flex-col gap-6 h-full relative">
            {/* Toast */}
            {toastMessage && (
                <div className="fixed top-20 right-10 z-[100] animate-in fade-in slide-in-from-top-2">
                    <div className="bg-gray-800 text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-3 border border-white/10">
                        <span className="material-symbols-outlined text-green-400">check_circle</span>
                        <span className="text-sm font-bold">{toastMessage}</span>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight">Corpo Clínico</h2>
                    <p className="text-gray-500 font-medium tracking-tight">Quadro médico especializado (Setor: <span className="text-primary font-bold">{selectedFloor}</span>)</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-72 group">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors">search</span>
                        <input
                            type="text"
                            placeholder="Buscar médico ou especialidade..."
                            value={search}
                            onChange={handleSearch}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 bg-white transition-all shadow-sm"
                        />
                    </div>
                    {canManage && (
                        <button
                            onClick={() => openModal()}
                            className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/20 active:scale-95 whitespace-nowrap"
                        >
                            <span className="material-symbols-outlined">person_add</span>
                            Novo Cadastro
                        </button>
                    )}
                </div>
            </div>

            {/* LIST HEADER */}
            <div className="hidden lg:grid grid-cols-12 gap-4 px-8 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">
                <div className="col-span-5">Profissional / Identificação</div>
                <div className="col-span-3">Especialidade / Título</div>
                <div className="col-span-2">Contato / WhatsApp</div>
                <div className="col-span-2 text-right">Gestão</div>
            </div>

            <div className="flex flex-col gap-2 pb-10">
                {sorted.map(professional => {
                    const style = getStyleByName(professional.name, professional.gender);

                    return (
                        <div
                            key={professional.id}
                            className={`bg-white rounded-2xl shadow-sm hover:shadow-md transition-all group overflow-hidden border border-gray-100 border-l-[6px] ${style.borderLeft}`}
                        >
                            <div className="px-5 py-4 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                                {/* Info Principal */}
                                <div className="col-span-1 lg:col-span-5 flex items-center gap-4">
                                    <div className={`size-12 shrink-0 rounded-xl flex items-center justify-center font-bold text-sm tracking-widest ${style.bg} ${style.text} relative shadow-inner border border-gray-100/50`}>
                                        {getInitials(professional.name)}
                                        <div className={`absolute -bottom-1 -right-1 size-3.5 rounded-full border-2 border-white ${getStatusDotColor(professional.status)} shadow-sm`}></div>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-black text-gray-900 text-sm lg:text-base leading-tight truncate group-hover:text-primary transition-colors">
                                            {professional.name}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${professional.gender === 'female' ? 'bg-purple-100 text-purple-600' : 'bg-primary/10 text-primary'}`}>
                                                {professional.gender === 'female' ? 'DRA' : 'DR'}
                                            </span>
                                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight flex items-center gap-1 opacity-70">
                                                <span className="material-symbols-outlined text-[12px]">location_on</span>
                                                {professional.sector}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Especialidade */}
                                <div className="col-span-1 lg:col-span-3">
                                    <div className="inline-flex items-center px-3 py-1 rounded-lg bg-gray-50 text-[10px] text-primary-dark font-black uppercase tracking-wider border border-primary/5">
                                        {professional.specialty}
                                    </div>
                                </div>

                                {/* Contato */}
                                <div className="col-span-1 lg:col-span-2">
                                    {professional.phone ? (
                                        <a
                                            href={`tel:${professional.phone}`}
                                            className="inline-flex items-center gap-2 text-xs font-black text-gray-600 hover:text-primary transition-colors bg-gray-25 px-2 py-1.5 rounded-lg border border-transparent hover:border-primary/10"
                                        >
                                            <span className={`material-symbols-outlined text-base ${style.iconText}`}>call</span>
                                            {professional.phone}
                                        </a>
                                    ) : (
                                        <span className="text-[10px] text-gray-400 italic font-medium opacity-50 px-2">Sem cadastro</span>
                                    )}
                                </div>

                                {/* Ações */}
                                <div className="col-span-1 lg:col-span-2 flex items-center justify-end gap-2">
                                    {canManage && (
                                        <>
                                            <button
                                                onClick={() => openModal(professional)}
                                                className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                                                title="Editar Registro"
                                            >
                                                <span className="material-symbols-outlined text-lg">edit</span>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(professional.id)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                title="Remover"
                                            >
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            </button>
                                        </>
                                    )}
                                    <span className="material-symbols-outlined text-gray-200 select-none hidden lg:block">drag_indicator</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filtered.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100 shadow-sm">
                    <div className="size-24 bg-gray-50 rounded-3xl flex items-center justify-center mb-6 border border-gray-100">
                        <span className="material-symbols-outlined text-5xl opacity-20">person_search</span>
                    </div>
                    <h4 className="font-black text-gray-600 text-lg">Nenhum profissional encontrado</h4>
                    <p className="text-sm text-gray-400 mt-2 max-w-xs text-center">Não existem médicos cadastrados no setor <span className="text-primary font-extrabold">{selectedFloor}</span> com estes critérios.</p>
                    {canManage && (
                        <button
                            onClick={() => openModal()}
                            className="mt-8 bg-primary/10 text-primary hover:bg-primary hover:text-white px-8 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 border border-primary/20"
                        >
                            <span className="material-symbols-outlined">add</span>
                            Cadastrar Profissional Agora
                        </button>
                    )}
                </div>
            )}

            {/* Modal de Criação/Edição */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        <div className="px-8 py-6 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="size-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                                    <span className="material-symbols-outlined text-2xl">medical_services</span>
                                </div>
                                <div>
                                    <h3 className="font-black text-xl text-gray-900 leading-none">{editingProfessional ? 'Editar' : 'Novo'} Profissional</h3>
                                    <p className="text-[10px] text-gray-400 uppercase font-black tracking-[0.2em] mt-1.5">Cadastro do Corpo Clínico</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="size-10 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-8 space-y-7">
                            <div className="grid grid-cols-2 gap-5">
                                <div
                                    onClick={() => setFormData({ ...formData, gender: 'male' })}
                                    className={`cursor-pointer p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${formData.gender === 'male' ? 'border-primary bg-primary/5 ring-4 ring-primary/5' : 'border-gray-50 hover:border-gray-200 bg-gray-50/50'}`}
                                >
                                    <div className={`size-12 rounded-xl flex items-center justify-center transition-colors ${formData.gender === 'male' ? 'bg-primary text-white' : 'bg-white text-gray-400 shadow-sm'}`}>
                                        <span className="material-symbols-outlined text-2xl">male</span>
                                    </div>
                                    <div className="text-center">
                                        <p className={`font-black text-sm ${formData.gender === 'male' ? 'text-primary' : 'text-gray-500'}`}>Masculino</p>
                                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-0.5">Título: DRº</p>
                                    </div>
                                </div>
                                <div
                                    onClick={() => setFormData({ ...formData, gender: 'female' })}
                                    className={`cursor-pointer p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${formData.gender === 'female' ? 'border-purple-400 bg-purple-50 ring-4 ring-purple-100' : 'border-gray-50 hover:border-gray-200 bg-gray-50/50'}`}
                                >
                                    <div className={`size-12 rounded-xl flex items-center justify-center transition-colors ${formData.gender === 'female' ? 'bg-purple-500 text-white' : 'bg-white text-gray-400 shadow-sm'}`}>
                                        <span className="material-symbols-outlined text-2xl">female</span>
                                    </div>
                                    <div className="text-center">
                                        <p className={`font-black text-sm ${formData.gender === 'female' ? 'text-purple-700' : 'text-gray-500'}`}>Feminino</p>
                                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-0.5">Título: DRª</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest ml-1">Nome do Profissional (Nome Completo)</label>
                                    <div className="relative group">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors">person</span>
                                        <input
                                            type="text"
                                            placeholder="Ex: Ricardo de Oliveira Silva"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-2xl focus:border-primary focus:ring-8 focus:ring-primary/5 outline-none transition-all font-bold text-gray-800 shadow-sm"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest ml-1">Especialidade Principal</label>
                                        <div className="relative group">
                                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary z-10">stethoscope</span>
                                            <select
                                                value={formData.specialty}
                                                onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                                                className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-2xl focus:border-primary focus:ring-8 focus:ring-primary/5 outline-none transition-all font-bold text-gray-700 bg-white appearance-none cursor-pointer relative"
                                            >
                                                <option value="">Selecione Especialidade...</option>
                                                {MEDICAL_SPECIALTIES.map(spec => (
                                                    <option key={spec} value={spec}>{spec}</option>
                                                ))}
                                            </select>
                                            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none">expand_more</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest ml-1">Setor de Atendimento</label>
                                        <div className="relative group">
                                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary z-10">business</span>
                                            <select
                                                value={formData.sector}
                                                onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                                                className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-2xl focus:border-primary focus:ring-8 focus:ring-primary/5 outline-none transition-all font-bold text-gray-700 bg-white appearance-none cursor-pointer"
                                            >
                                                {FLOOR_OPTIONS.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none">expand_more</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest ml-1">Telefone de Contato (WhatsApp)</label>
                                    <div className="relative group">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors">call</span>
                                        <input
                                            type="text"
                                            placeholder="(XX) XXXXX-XXXX"
                                            value={formData.phone}
                                            onChange={(e) => {
                                                let v = e.target.value.replace(/\D/g, '').slice(0, 11);
                                                if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
                                                if (v.length > 9) v = `${v.slice(0, 9)}-${v.slice(9)}`;
                                                setFormData({ ...formData, phone: v });
                                            }}
                                            className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-2xl focus:border-primary focus:ring-8 focus:ring-primary/5 outline-none transition-all font-bold text-gray-800 shadow-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-4">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-4 text-gray-500 font-extrabold hover:bg-gray-50 rounded-2xl transition-all border border-transparent hover:border-gray-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex-2 py-4 bg-primary text-white font-black hover:bg-primary-dark rounded-2xl transition-all shadow-xl shadow-primary/30 transform active:scale-95 px-8"
                                >
                                    {editingProfessional ? 'Atualizar Registro' : 'Finalizar Cadastro'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Professionals;