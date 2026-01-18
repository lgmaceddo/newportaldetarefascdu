import React, { useState, useEffect } from 'react';
import { useAuth, FLOOR_OPTIONS } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';

// Unified interface for display
interface UnifiedUser {
    id: string;
    name: string;
    roleType: 'doctor' | 'reception';
    roleDisplay: string;
    phone: string;
    avatar: string;
    status: string;
    isAdmin: boolean;
    email?: string;
    gender?: 'male' | 'female';
    originalData: any;
}

const Users: React.FC = () => {
    const { user: currentUser } = useAuth();

    // Data State
    const [users, setUsers] = useState<UnifiedUser[]>([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [activeTab, setActiveTab] = useState<'all' | 'doctor' | 'reception'>('all');
    const [search, setSearch] = useState('');
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UnifiedUser | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        role: 'reception' as 'doctor' | 'reception',
        roleDisplay: '', // Specialty or Sector
        email: '',
        gender: 'male' as 'male' | 'female',
        isAdmin: false
    });

    // --- Load Data ---
    const fetchUsers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('*');

            if (error) throw error;

            if (data) {
                const mappedUsers: UnifiedUser[] = data.map(p => ({
                    id: p.id,
                    name: p.name || 'Sem Nome',
                    roleType: p.role as 'doctor' | 'reception',
                    roleDisplay: p.specialty || (p.role === 'reception' ? 'Recepção' : 'Médico'),
                    phone: p.phone || '',
                    avatar: p.avatar || '',
                    status: p.status || 'offline',
                    isAdmin: !!p.is_admin,
                    email: p.email,
                    gender: p.gender as 'male' | 'female',
                    originalData: p
                }));
                setUsers(mappedUsers);
            }
        } catch (err) {
            console.error("Error loading users:", err);
            showToast("Erro ao carregar usuários.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();

        const channel = supabase
            .channel('public:profiles:users')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                fetchUsers();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // --- Handlers ---

    const toggleAdmin = async (userId: string, currentStatus: boolean) => {
        if (userId === currentUser?.id) {
            alert("Você não pode alterar seu próprio status de administrador por aqui.");
            return;
        }

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ is_admin: !currentStatus })
                .eq('id', userId);

            if (error) throw error;

            showToast(!currentStatus ? 'Usuário promovido a Admin!' : 'Status de Admin removido.');
        } catch (err) {
            console.error("Error toggling admin:", err);
            showToast("Erro ao alterar permissão.");
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (userId === currentUser?.id) {
            alert("Você não pode excluir seu próprio usuário.");
            return;
        }

        if (window.confirm("ATENÇÃO: Isso removerá o usuário do sistema. Deseja continuar?")) {
            try {
                const { error } = await supabase.from('profiles').delete().eq('id', userId);
                if (error) throw error;
                showToast('Usuário removido com sucesso.');
                fetchUsers();
            } catch (err) {
                console.error("Error deleting user:", err);
                showToast("Erro ao remover usuário.");
            }
        }
    };

    const openCreateModal = () => {
        setEditingUser(null);
        setFormData({
            name: '',
            phone: '',
            role: 'reception',
            roleDisplay: FLOOR_OPTIONS[0],
            email: '',
            gender: 'male',
            isAdmin: false
        });
        setIsModalOpen(true);
    };

    const openEditModal = (user: UnifiedUser) => {
        setEditingUser(user);
        setFormData({
            name: user.name,
            phone: user.phone,
            role: user.roleType,
            roleDisplay: user.roleDisplay,
            email: user.email || '',
            gender: user.gender || 'male',
            isAdmin: user.isAdmin
        });
        setIsModalOpen(true);
    };

    const handleSaveUser = async () => {
        if (!formData.name || !formData.roleDisplay) {
            alert("Nome e Setor/Especialidade são obrigatórios.");
            return;
        }

        const profileData = {
            name: formData.name,
            phone: formData.phone,
            role: formData.role,
            specialty: formData.roleDisplay,
            email: formData.email,
            gender: formData.gender,
            is_admin: formData.isAdmin,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=${formData.role === 'reception' ? 'f97316' : '10605B'}&color=fff`
        };

        try {
            if (editingUser) {
                const { error } = await supabase
                    .from('profiles')
                    .update(profileData)
                    .eq('id', editingUser.id);
                if (error) throw error;
                showToast("Usuário atualizado com sucesso!");
            } else {
                // Insert with a generated ID if not provided (mocking if auth is not coupled)
                const { error } = await supabase
                    .from('profiles')
                    .insert([{ ...profileData, id: crypto.randomUUID() }]);
                if (error) throw error;
                showToast("Novo usuário criado!");
            }
            setIsModalOpen(false);
            fetchUsers();
        } catch (err) {
            console.error("Error saving user:", err);
            showToast("Erro ao salvar usuário.");
        }
    };

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    // --- Helpers ---
    const getInitials = (name: string) => {
        const cleanName = name.replace(/^(dr|dra|dr\.|dra\.|drº|drª)\s+/i, '').trim();
        const parts = cleanName.split(' ');
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    const getStyleByRole = (role: 'doctor' | 'reception', name: string, gender?: string) => {
        if (role === 'reception') {
            return {
                bg: 'bg-orange-50',
                text: 'text-orange-600',
                borderLeft: 'border-l-orange-400',
                iconText: 'text-orange-600'
            };
        }
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

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
            u.roleDisplay.toLowerCase().includes(search.toLowerCase());
        const matchesTab = activeTab === 'all' ? true : u.roleType === activeTab;
        return matchesSearch && matchesTab;
    });

    const isUserAdmin = currentUser?.isAdmin;

    return (
        <div className="flex flex-col gap-6 h-full relative">
            {/* Toast */}
            {toastMessage && (
                <div className="fixed top-20 right-10 z-[100] animate-in fade-in slide-in-from-top-2">
                    <div className="bg-gray-800 text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-3">
                        <span className="material-symbols-outlined text-green-400">check_circle</span>
                        <span className="text-sm font-bold">{toastMessage}</span>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Gerenciamento de Usuários</h2>
                    <p className="text-gray-500">Controle de acesso e permissões do sistema.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 flex items-center gap-3 shadow-sm">
                        <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined">shield_person</span>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-bold uppercase">Staff Ativo</p>
                            <p className="text-xl font-bold text-gray-800 leading-none">{users.length}</p>
                        </div>
                    </div>
                    {isUserAdmin && (
                        <button
                            onClick={openCreateModal}
                            className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/20 active:scale-95"
                        >
                            <span className="material-symbols-outlined">add_circle</span>
                            Novo Usuário
                        </button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex p-1 bg-gray-100 rounded-lg w-full md:w-auto">
                    {[
                        { id: 'all', label: 'Todos', icon: 'group' },
                        { id: 'doctor', label: 'Corpo Clínico', icon: 'stethoscope' },
                        { id: 'reception', label: 'Recepção', icon: 'support_agent' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === tab.id
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>

                <div className="relative w-full md:w-64">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                    <input
                        type="text"
                        placeholder="Buscar usuário..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm border-none bg-transparent outline-none focus:ring-0 placeholder-gray-400"
                    />
                </div>
            </div>

            {/* Users List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4 pb-10">
                {filteredUsers.map(u => {
                    const style = getStyleByRole(u.roleType, u.name, u.gender);

                    return (
                        <div
                            key={u.id}
                            className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-all group relative overflow-hidden flex flex-col border border-gray-100 border-l-[6px] ${style.borderLeft}`}
                        >
                            {u.isAdmin && (
                                <div className="absolute top-0 right-0 bg-primary text-white px-2 py-0.5 rounded-bl-lg text-[9px] font-bold uppercase tracking-widest z-10 shadow-sm flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[10px]">verified_user</span>
                                    Admin
                                </div>
                            )}

                            <div className="p-4 flex flex-col gap-3 h-full pt-6">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3 overflow-hidden w-full">
                                        <div className={`size-11 shrink-0 rounded-full flex items-center justify-center font-bold text-sm tracking-widest ${style.bg} ${style.text} relative`}>
                                            {u.avatar ? (
                                                <img src={u.avatar} alt={u.name} className="w-full h-full object-cover rounded-full" />
                                            ) : (
                                                getInitials(u.name)
                                            )}
                                            <div className={`absolute bottom-0 right-0 size-3 rounded-full border-2 border-white ${getStatusDotColor(u.status)}`}></div>
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-bold text-gray-800 text-sm leading-tight truncate" title={u.name}>
                                                {u.name}
                                            </h3>
                                            <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide mt-0.5 truncate">
                                                {u.roleDisplay}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {isUserAdmin && (
                                    <div className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border border-gray-100">
                                        <span className="text-[10px] uppercase font-bold text-gray-400">Acesso Admin</span>
                                        <label className="relative inline-flex items-center cursor-pointer scale-75">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={u.isAdmin}
                                                onChange={() => toggleAdmin(u.id, u.isAdmin)}
                                                disabled={u.id === currentUser?.id}
                                            />
                                            <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                        </label>
                                    </div>
                                )}

                                <div className="mt-auto pt-3 border-t border-gray-50 flex items-center gap-2">
                                    {u.phone ? (
                                        <a
                                            href={`tel:${u.phone}`}
                                            className="flex-1 flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-primary transition-colors bg-gray-50 px-2 py-1.5 rounded-lg truncate"
                                            title={u.phone}
                                        >
                                            <span className={`material-symbols-outlined text-sm ${style.iconText}`}>call</span>
                                            <span className="truncate">{u.phone}</span>
                                        </a>
                                    ) : (
                                        <span className="flex-1 text-[10px] text-gray-400 italic px-2 py-1.5">Sem contato</span>
                                    )}

                                    {isUserAdmin && (
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                onClick={() => openEditModal(u)}
                                                className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors border border-transparent hover:border-primary/20"
                                                title="Editar"
                                            >
                                                <span className="material-symbols-outlined text-lg">edit</span>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(u.id)}
                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Excluir"
                                                disabled={u.id === currentUser?.id}
                                            >
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal de Criação / Edição */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">
                                {editingUser ? 'Editar Usuário' : 'Novo Usuário Atendente'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-3 mb-2">
                                <div
                                    onClick={() => setFormData({ ...formData, role: 'reception' })}
                                    className={`cursor-pointer p-3 rounded-xl border-2 text-center transition-all ${formData.role === 'reception' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-50 text-gray-400'}`}
                                >
                                    <span className="material-symbols-outlined">support_agent</span>
                                    <p className="text-xs font-bold">RECEPÇÃO</p>
                                </div>
                                <div
                                    onClick={() => setFormData({ ...formData, role: 'doctor' })}
                                    className={`cursor-pointer p-3 rounded-xl border-2 text-center transition-all ${formData.role === 'doctor' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-50 text-gray-400'}`}
                                >
                                    <span className="material-symbols-outlined">stethoscope</span>
                                    <p className="text-xs font-bold">MÉDICO</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div
                                    onClick={() => setFormData({ ...formData, gender: 'male' })}
                                    className={`cursor-pointer border-2 rounded-xl p-3 flex flex-col items-center gap-1 transition-all ${formData.gender === 'male' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 text-gray-400'}`}
                                >
                                    <span className="material-symbols-outlined">male</span>
                                    <span className="text-[10px] font-bold">MASCULINO</span>
                                </div>
                                <div
                                    onClick={() => setFormData({ ...formData, gender: 'female' })}
                                    className={`cursor-pointer border-2 rounded-xl p-3 flex flex-col items-center gap-1 transition-all ${formData.gender === 'female' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 text-gray-400'}`}
                                >
                                    <span className="material-symbols-outlined">female</span>
                                    <span className="text-[10px] font-bold">FEMININO</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nome Completo</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full p-3 border border-gray-200 rounded-xl focus:border-primary outline-none transition-all"
                                    placeholder="Nome do usuário..."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                                    {formData.role === 'doctor' ? 'Especialidade' : 'Setor de Alocação'}
                                </label>
                                {formData.role === 'reception' ? (
                                    <select
                                        value={formData.roleDisplay}
                                        onChange={(e) => setFormData({ ...formData, roleDisplay: e.target.value })}
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:border-primary outline-none bg-white transition-all"
                                    >
                                        {FLOOR_OPTIONS.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={formData.roleDisplay}
                                        onChange={(e) => setFormData({ ...formData, roleDisplay: e.target.value })}
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:border-primary outline-none transition-all"
                                        placeholder="Ex: Cardiologia"
                                    />
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Email <span className="normal-case font-normal">(Para Login)</span></label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full p-3 border border-gray-200 rounded-xl focus:border-primary outline-none transition-all"
                                    placeholder="exemplo@unimedbauru.com.br"
                                />
                            </div>

                            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                                <span className="text-xs font-bold text-gray-500 uppercase flex-1">Permissão de Administrador</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={formData.isAdmin}
                                        onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })}
                                    />
                                    <div className="w-10 h-6 bg-gray-200 rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                                </label>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveUser}
                                    className="flex-1 py-3 bg-primary text-white font-bold hover:bg-primary-dark rounded-xl transition-colors shadow-lg shadow-primary/30"
                                >
                                    {editingUser ? 'Salvar Alterações' : 'Criar Conta'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Users;