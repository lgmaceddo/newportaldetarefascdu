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

    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="flex flex-col gap-6 h-full">
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 shrink-0">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight leading-none mb-1">Equipe de Recepção</h2>
                    <p className="text-gray-500 font-medium">Gestão de colaboradores e alocação por setores.</p>
                </div>

                <div className="relative w-full md:w-72 group">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-secondary transition-colors">search</span>
                    <input
                        type="text"
                        placeholder="Buscar colaborador ou setor..."
                        value={search}
                        onChange={handleSearch}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-secondary focus:ring-4 focus:ring-secondary/10 bg-white transition-all shadow-sm font-medium"
                    />
                </div>
            </div>

            {/* LIST HEADER */}
            <div className="hidden lg:grid grid-cols-12 gap-4 px-8 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">
                <div className="col-span-6">Colaborador / Nome</div>
                <div className="col-span-3">Setor / Localização</div>
                <div className="col-span-3 text-right">Contato / Ramal</div>
            </div>

            <div className="flex flex-col gap-2 pb-10 overflow-y-auto pr-1">
                {sorted.map(receptionist => (
                    <div
                        key={receptionist.id}
                        className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all group overflow-hidden border border-gray-100 border-l-[6px] border-l-secondary"
                    >
                        <div className="px-5 py-4 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                            {/* Info Principal */}
                            <div className="col-span-1 lg:col-span-6 flex items-center gap-4">
                                <div className="size-11 shrink-0 rounded-xl flex items-center justify-center font-bold text-sm tracking-widest bg-orange-50 text-orange-600 relative border border-orange-100 shadow-inner">
                                    {receptionist.avatar ? (
                                        <img src={receptionist.avatar} alt={receptionist.name} className="w-full h-full object-cover rounded-xl" />
                                    ) : (
                                        getInitials(receptionist.name)
                                    )}
                                    <div className={`absolute -bottom-1 -right-1 size-3.5 rounded-full border-2 border-white ${getStatusDotColor(receptionist.status)} shadow-sm`}></div>
                                </div>

                                <div className="min-w-0 flex-1">
                                    <h3 className="font-black text-gray-900 text-sm lg:text-base leading-tight truncate group-hover:text-secondary transition-colors" title={receptionist.name}>
                                        {receptionist.name}
                                    </h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight mt-0.5 opacity-70">Colaborador Unimed</p>
                                </div>
                            </div>

                            {/* Setor */}
                            <div className="col-span-1 lg:col-span-3 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-secondary text-base">location_on</span>
                                <span className="text-[10px] text-gray-600 font-black uppercase tracking-wider bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                                    {receptionist.sector}
                                </span>
                            </div>

                            {/* Contato */}
                            <div className="col-span-1 lg:col-span-3 flex justify-end">
                                {receptionist.phone ? (
                                    <a
                                        href={`tel:${receptionist.phone}`}
                                        className="inline-flex items-center gap-2 text-xs font-black text-gray-600 hover:text-white hover:bg-secondary transition-all bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 shadow-sm"
                                    >
                                        <span className="material-symbols-outlined text-base">call</span>
                                        {receptionist.phone}
                                    </a>
                                ) : (
                                    <span className="text-[10px] text-gray-400 italic font-medium bg-gray-25/50 px-4 py-2 rounded-xl border border-dashed border-gray-100">
                                        Sem ramal
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filtered.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100 shadow-sm">
                    <div className="size-24 bg-gray-50 rounded-3xl flex items-center justify-center mb-6 border border-gray-100">
                        <span className="material-symbols-outlined text-5xl opacity-20">person_search</span>
                    </div>
                    <h4 className="font-black text-gray-600 text-lg">Nenhum colaborador encontrado</h4>
                    <p className="text-sm text-gray-400 mt-2">Tente ajustar sua busca ou filtros.</p>
                </div>
            )}

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