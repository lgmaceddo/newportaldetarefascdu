import React, { useState, useEffect } from 'react';
import { Receptionist } from '../types';
import { supabase } from '../services/supabase';

const Receptionists: React.FC = () => {
    const [receptionists, setReceptionists] = useState<Receptionist[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Fetch Data
    const fetchReceptionists = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'reception');

            if (error) throw error;

            if (data) {
                const mapped: Receptionist[] = data.map(p => ({
                    id: p.id,
                    name: p.name || 'Sem Nome',
                    sector: p.specialty || 'Geral', // Map specialty to sector
                    phone: p.phone || '',
                    avatar: p.avatar || '',
                    status: (p.status as any) || 'active',
                }));
                setReceptionists(mapped);
            }
        } catch (error) {
            console.error('Error fetching receptionists:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReceptionists();

        const channel = supabase
            .channel('public:profiles:reception')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: 'role=eq.reception' }, (payload) => {
                fetchReceptionists();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        }
    }, []);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
    };

    const filtered = receptionists.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.sector.toLowerCase().includes(search.toLowerCase())
    );

    const getInitials = (name: string) => {
        const cleanName = name.trim();
        const parts = cleanName.split(' ');
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    const getStatusDotColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-500';
            case 'inactive': return 'bg-gray-300';
            case 'vacation': return 'bg-yellow-400';
            default: return 'bg-gray-300';
        }
    };

    return (
        <div className="flex flex-col gap-6 h-full">
            <div className="flex flex-col md:flex-row justify-between items-end gap-3 shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 leading-none mb-1">Equipe de Recepção</h2>
                    <p className="text-gray-500 text-sm">Gestão de colaboradores e setores.</p>
                </div>

                <div className="relative w-full md:w-64">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                    <input
                        type="text"
                        placeholder="Buscar colaborador..."
                        value={search}
                        onChange={handleSearch}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white text-sm"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4 pb-6 overflow-y-auto pr-1">
                {filtered.map(receptionist => (
                    <div
                        key={receptionist.id}
                        className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all group relative overflow-hidden flex flex-col border border-gray-100 border-l-[6px] border-l-secondary min-h-[140px] h-full"
                    >
                        <div className="p-4 flex flex-col gap-3 h-full">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="size-11 shrink-0 rounded-full flex items-center justify-center font-bold text-sm tracking-widest bg-orange-50 text-orange-600 relative">
                                        {receptionist.avatar ? (
                                            <img src={receptionist.avatar} alt={receptionist.name} className="w-full h-full object-cover rounded-full" />
                                        ) : (
                                            getInitials(receptionist.name)
                                        )}
                                        <div className={`absolute bottom-0 right-0 size-3 rounded-full border-2 border-white ${getStatusDotColor(receptionist.status)}`}></div>
                                    </div>

                                    <div className="min-w-0">
                                        <h3 className="font-bold text-gray-800 text-sm leading-tight truncate" title={receptionist.name}>
                                            {receptionist.name}
                                        </h3>
                                        <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide mt-0.5 truncate">
                                            {receptionist.sector}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-auto pt-3 border-t border-gray-50 flex items-center justify-between">
                                {receptionist.phone ? (
                                    <a
                                        href={`tel:${receptionist.phone}`}
                                        className="flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-secondary transition-colors bg-gray-50 px-2 py-1.5 rounded-lg w-full truncate"
                                    >
                                        <span className="material-symbols-outlined text-sm text-secondary">call</span>
                                        {receptionist.phone}
                                    </a>
                                ) : (
                                    <span className="text-[10px] text-gray-400 italic px-2 py-1.5 w-full bg-gray-25/50 rounded flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm">phone_disabled</span>
                                        Sem contato
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filtered.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                    <span className="material-symbols-outlined text-5xl mb-2 opacity-20">person_search</span>
                    <p>Nenhum colaborador encontrado.</p>
                </div>
            )}
        </div>
    );
};

export default Receptionists;