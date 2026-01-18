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

    const isAdmin = currentUser?.isAdmin;

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
                    <h2 className="text-2xl font-bold text-gray-900">Corpo Clínico</h2>
                    <p className="text-gray-500">Gestão dos médicos e especialistas do setor.</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                        <input
                            type="text"
                            placeholder="Buscar médico..."
                            value={search}
                            onChange={handleSearch}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white transition-all shadow-sm"
                        />
                    </div>
                    {isAdmin && (
                        <button
                            onClick={() => openModal()}
                            className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/20 active:scale-95 whitespace-nowrap"
                        >
                            <span className="material-symbols-outlined">person_add</span>
                            Novo Médico
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-6">
                {filtered.map(professional => {
                    const style = getStyleByName(professional.name, professional.gender);

                    return (
                        <div
                            key={professional.id}
                            className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-all group relative overflow-hidden flex flex-col border border-gray-100 border-l-[6px] ${style.borderLeft} min-h-[140px] h-full`}
                        >
                            <div className="p-4 flex flex-col gap-3 h-full">
                                <div className="flex items-start gap-3">
                                    <div className="flex items-start gap-3 w-full">
                                        <div className={`size-11 shrink-0 rounded-full flex items-center justify-center font-bold text-sm tracking-widest ${style.bg} ${style.text} relative`}>
                                            {getInitials(professional.name)}
                                            <div className={`absolute bottom-0 right-0 size-3 rounded-full border-2 border-white ${getStatusDotColor(professional.status)}`}></div>
                                        </div>

                                        <div className="min-w-0 flex-1 flex flex-col">
                                            <h3 className="font-black text-gray-800 text-sm leading-tight whitespace-normal break-words" title={professional.name}>
                                                {professional.name}
                                            </h3>
                                            <div className="flex flex-col gap-1 mt-1">
                                                <p className="text-[10px] text-primary-dark font-bold uppercase tracking-wide whitespace-normal break-words opacity-80">
                                                    {professional.specialty}
                                                </p>
                                                <p className="text-[9px] text-gray-400 font-bold uppercase flex items-center gap-1 whitespace-normal break-words">
                                                    <span className="material-symbols-outlined text-[11px]">location_on</span>
                                                    {professional.sector}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-auto flex flex-col gap-2">
                                    <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
                                        {professional.phone ? (
                                            <a
                                                href={`tel:${professional.phone}`}
                                                className="flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-primary transition-colors bg-gray-50 px-2 py-1.5 rounded-lg flex-1 border border-transparent hover:border-primary/10"
                                            >
                                                <span className={`material-symbols-outlined text-sm ${style.iconText}`}>call</span>
                                                {professional.phone}
                                            </a>
                                        ) : (
                                            <span className="text-[10px] text-gray-400 italic px-2 py-1.5 flex-1 bg-gray-25/50 rounded flex items-center gap-1">
                                                <span className="material-symbols-outlined text-sm">phone_disabled</span>
                                                Sem contato
                                            </span>
                                        )}
                                    </div>

                                    {isAdmin && (
                                        <div className="flex items-center justify-end gap-1.5 border-t border-gray-50/50 pt-2">
                                            <button
                                                onClick={() => openModal(professional)}
                                                className="flex items-center gap-1 px-3 py-1 text-[10px] font-bold text-gray-500 hover:text-primary hover:bg-primary-light rounded-md transition-all uppercase tracking-wider"
                                            >
                                                <span className="material-symbols-outlined text-base">edit</span>
                                                Editar
                                            </button>
                                            <button
                                                onClick={() => handleDelete(professional.id)}
                                                className="flex items-center gap-1 px-3 py-1 text-[10px] font-bold text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-md transition-all uppercase tracking-wider"
                                            >
                                                <span className="material-symbols-outlined text-base">delete</span>
                                                Excluir
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filtered.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                    <div className="size-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-4xl opacity-20">person_search</span>
                    </div>
                    <p className="font-bold text-gray-500">Nenhum profissional cadastrado para este setor.</p>
                    <p className="text-xs text-gray-400 mt-1">Setor atual: <span className="text-primary font-bold">{selectedFloor}</span></p>
                    {isAdmin && (
                        <button
                            onClick={() => openModal()}
                            className="mt-6 text-primary font-bold text-sm hover:underline flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined">add</span>
                            Cadastrar o primeiro médico aqui
                        </button>
                    )}
                </div>
            )}

            {/* Modal de Criação/Edição */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col scale-in">
                        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                    <span className="material-symbols-outlined">medical_services</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900">{editingProfessional ? 'Editar' : 'Novo'} Profissional</h3>
                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Identificação no Sistema</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div
                                    onClick={() => setFormData({ ...formData, gender: 'male' })}
                                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${formData.gender === 'male' ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-200'}`}
                                >
                                    <span className="material-symbols-outlined text-3xl text-primary">male</span>
                                    <div className="text-center">
                                        <p className="font-bold text-sm">Masculino</p>
                                        <p className="text-[10px] text-gray-400 font-bold">DRº</p>
                                    </div>
                                </div>
                                <div
                                    onClick={() => setFormData({ ...formData, gender: 'female' })}
                                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${formData.gender === 'female' ? 'border-purple-400 bg-purple-50' : 'border-gray-100 hover:border-gray-200'}`}
                                >
                                    <span className="material-symbols-outlined text-3xl text-purple-500">female</span>
                                    <div className="text-center">
                                        <p className="font-bold text-sm">Feminino</p>
                                        <p className="text-[10px] text-gray-400 font-bold">DRª</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 tracking-wider">Nome do Profissional (Sem título)</label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">person</span>
                                        <input
                                            type="text"
                                            placeholder="Ex: Ricardo Silva"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 tracking-wider">Especialidade</label>
                                        <select
                                            value={formData.specialty}
                                            onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all text-sm bg-white"
                                        >
                                            <option value="">Selecione...</option>
                                            {MEDICAL_SPECIALTIES.map(spec => (
                                                <option key={spec} value={spec}>{spec}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 tracking-wider">Setor que Atende</label>
                                        <select
                                            value={formData.sector}
                                            onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all text-sm bg-white"
                                        >
                                            {FLOOR_OPTIONS.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 tracking-wider">Telefone / Contato</label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">call</span>
                                        <input
                                            type="text"
                                            placeholder="(XX) XXXXX-XXXX"
                                            value={formData.phone}
                                            onChange={(e) => {
                                                let v = e.target.value.replace(/\D/g, '');
                                                if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
                                                if (v.length > 9) v = `${v.slice(0, 9)}-${v.slice(9, 13)}`;
                                                setFormData({ ...formData, phone: v });
                                            }}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:border-primary outline-none text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex-1 py-3 bg-primary text-white font-bold hover:bg-primary-dark rounded-xl transition-colors shadow-lg shadow-primary/30 transform active:scale-95"
                                >
                                    {editingProfessional ? 'Salvar Alterações' : 'Criar Profissional'}
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