import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ContactPoint {
    id: string;
    entity_id: string;
    name: string;
    address: string;
    ramal?: string;
    telefone?: string;
    whatsapp?: string;
    created_at?: string;
}

interface ContactEntity {
    id: string;
    name: string;
    category: string;
    points: ContactPoint[];
    created_at?: string;
}

const CATEGORIES = [
    'CLÍNICAS EXTERNAS',
    'FARMÁCIA UNIMED',
    'PRÉDIO CONSULTAS',
    'PRÉDIO EXAMES',
    'SEDE'
];

const Contacts: React.FC = () => {
    const { user } = useAuth();
    const canEdit = !!user?.isAdmin;

    const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);
    const [searchQuery, setSearchQuery] = useState('');
    const [entities, setEntities] = useState<ContactEntity[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedEntities, setExpandedEntities] = useState<string[]>([]);

    // Modals
    const [isEntityModalOpen, setIsEntityModalOpen] = useState(false);
    const [isPointModalOpen, setIsPointModalOpen] = useState(false);
    const [editingEntity, setEditingEntity] = useState<ContactEntity | null>(null);
    const [editingPoint, setEditingPoint] = useState<ContactPoint | null>(null);
    const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

    const [entityFormData, setEntityFormData] = useState({ name: '', category: CATEGORIES[0] });
    const [pointFormData, setPointFormData] = useState({ name: '', address: '', ramal: '', telefone: '', whatsapp: '' });

    const fetchContacts = async () => {
        setLoading(true);
        try {
            const { data: entitiesData, error: entitiesError } = await supabase
                .from('contact_entities')
                .select('*')
                .order('name');
            
            if (entitiesError) throw entitiesError;

            const { data: pointsData, error: pointsError } = await supabase
                .from('contact_points')
                .select('*');
            
            if (pointsError) throw pointsError;

            const mapped = (entitiesData || []).map(ent => ({
                ...ent,
                points: (pointsData || []).filter(p => p.entity_id === ent.id)
            }));

            setEntities(mapped);
        } catch (err) {
            console.error('Error fetching contacts:', err);
            setEntities([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContacts();
    }, []);

    const toggleExpand = (id: string) => {
        setExpandedEntities(prev => 
            prev.includes(id) ? [] : [id]
        );
    };

    const handleSaveEntity = async () => {
        try {
            if (editingEntity) {
                await supabase.from('contact_entities').update(entityFormData).eq('id', editingEntity.id);
            } else {
                await supabase.from('contact_entities').insert([entityFormData]);
            }
            setIsEntityModalOpen(false);
            fetchContacts();
        } catch (err) {
            alert('Erro ao salvar grupo.');
        }
    };

    const handleSavePoint = async () => {
        try {
            const data = { ...pointFormData, entity_id: selectedEntityId };
            if (editingPoint) {
                await supabase.from('contact_points').update(pointFormData).eq('id', editingPoint.id);
            } else {
                await supabase.from('contact_points').insert([data]);
            }
            setIsPointModalOpen(false);
            fetchContacts();
        } catch (err) {
            alert('Erro ao salvar ponto.');
        }
    };

    const deleteEntity = async (id: string) => {
        if (!window.confirm('Excluir este grupo e todos os seus pontos?')) return;
        try {
            await supabase.from('contact_entities').delete().eq('id', id);
            fetchContacts();
        } catch (err) {
            alert('Erro ao excluir.');
        }
    };

    const deletePoint = async (id: string) => {
        if (!window.confirm('Excluir este ponto de contato?')) return;
        try {
            await supabase.from('contact_points').delete().eq('id', id);
            fetchContacts();
        } catch (err) {
            alert('Erro ao excluir.');
        }
    };

    const filteredEntities = entities.filter(ent => {
        const matchesCategory = searchQuery.trim() !== '' || ent.category === activeCategory;
        const matchesSearch = ent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ent.points.some(p => 
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                (p.ramal || '').includes(searchQuery) ||
                (p.telefone || '').includes(searchQuery) ||
                (p.whatsapp || '').includes(searchQuery) ||
                (p.address || '').toLowerCase().includes(searchQuery.toLowerCase())
            );
        return matchesCategory && matchesSearch;
    });

    return (
        <div className="flex flex-col gap-6 p-2 lg:p-6 animate-in fade-in duration-500">
            {/* Header section with categories */}
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Agenda de Contatos</h2>
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">Gerencie grupos e pontos de contato hierárquicos.</p>
                    </div>
                    {canEdit && (
                        <button 
                            onClick={() => {
                                setEditingEntity(null);
                                setEntityFormData({ name: '', category: activeCategory });
                                setIsEntityModalOpen(true);
                            }}
                            className="bg-primary text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 active:scale-95"
                        >
                            <span className="material-symbols-outlined">add_circle</span>
                            Novo Contato
                        </button>
                    )}
                </div>

                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => {
                                setActiveCategory(cat);
                                setExpandedEntities([]);
                            }}
                            className={`px-6 py-3 rounded-xl text-xs font-black whitespace-nowrap border-2 transition-all ${
                                activeCategory === cat 
                                    ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                                    : 'bg-white border-transparent text-gray-400 hover:bg-gray-50'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative group max-w-2xl px-2 lg:px-0">
                <span className="material-symbols-outlined absolute left-4 lg:left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors">search</span>
                <input 
                    type="text" 
                    placeholder="Buscar por grupo, setor, ramal ou telefone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 lg:pl-16 pr-6 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-8 focus:ring-primary/5 focus:border-primary outline-none transition-all font-bold text-gray-700"
                />
            </div>

            {/* Entities List */}
            <div className="space-y-3">
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-gray-300 gap-4">
                        <span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span>
                        <p className="font-bold text-sm uppercase tracking-widest">Carregando contatos...</p>
                    </div>
                ) : filteredEntities.length > 0 ? (
                    filteredEntities.map(ent => (
                        <div key={ent.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md hover:border-primary/20 group/entity cursor-pointer" onClick={() => toggleExpand(ent.id)}>
                            <div className="p-2.5 lg:p-3.5 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="size-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 shrink-0 group-hover/entity:bg-primary/5 group-hover/entity:text-primary transition-all">
                                        <span className="material-symbols-outlined text-lg">groups</span>
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-xs lg:text-sm font-black text-primary uppercase tracking-tight truncate">{ent.name}</h3>
                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{ent.points.length} pontos</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                    {canEdit && (
                                        <>
                                            <button 
                                                onClick={() => {
                                                    setSelectedEntityId(ent.id);
                                                    setEditingPoint(null);
                                                    setPointFormData({ name: '', address: '', ramal: '', telefone: '', whatsapp: '' });
                                                    setIsPointModalOpen(true);
                                                }}
                                                className="bg-gray-50 text-gray-600 px-2 py-1 rounded-md text-[8px] font-black uppercase flex items-center gap-1 hover:bg-gray-100 transition-colors border border-gray-100"
                                            >
                                                <span className="material-symbols-outlined text-xs">add</span>
                                                Ponto
                                            </button>
                                            <button onClick={() => { setEditingEntity(ent); setEntityFormData({ name: ent.name, category: ent.category }); setIsEntityModalOpen(true); }} className="p-1 text-gray-300 hover:text-primary transition-colors"><span className="material-symbols-outlined text-base">edit_square</span></button>
                                            <button onClick={() => deleteEntity(ent.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors"><span className="material-symbols-outlined text-base">delete</span></button>
                                        </>
                                    )}
                                    <div className={`p-1 rounded transition-all ${expandedEntities.includes(ent.id) ? 'text-primary rotate-180' : 'text-gray-300'}`}>
                                        <span className="material-symbols-outlined text-lg">expand_more</span>
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Points - Minimalist List Style */}
                            <div className={`transition-all duration-300 ease-in-out border-t border-gray-50 bg-gray-50/5 ${expandedEntities.includes(ent.id) ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 invisible'}`}>
                                <div className="p-1 lg:p-2 divide-y divide-gray-50">
                                    {ent.points.map(point => (
                                        <div key={point.id} className="p-3 lg:p-4 hover:bg-white transition-colors flex flex-col gap-2 group/point relative" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-[12px] lg:text-[14px] font-black text-gray-700 uppercase tracking-tight">
                                                        {point.name}
                                                    </h4>
                                                    
                                                    {point.address && (
                                                        <div className="flex items-center gap-1.5 text-gray-500 mt-1.5">
                                                            <div className="flex items-center text-primary/50">
                                                                <span className="material-symbols-outlined text-[16px]">location_on</span>
                                                            </div>
                                                            <span className="text-[10px] lg:text-[11px] font-black uppercase tracking-tight text-gray-500">
                                                                ENDEREÇO: {point.address}
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {point.ramal && (
                                                            <div className="bg-[#f0f4f4] text-[#2d5a57] px-3 py-1 rounded-full flex items-center gap-1.5 border border-[#e0e8e8]">
                                                                <span className="material-symbols-outlined text-[15px]">dialpad</span>
                                                                <span className="text-[11px] lg:text-[13px] font-black tracking-tight uppercase">Ramal {point.ramal}</span>
                                                            </div>
                                                        )}
                                                        {point.telefone && (
                                                            <div className="bg-[#f0f4f4] text-[#2d5a57] px-3 py-1 rounded-full flex items-center gap-1.5 border border-[#e0e8e8]">
                                                                <span className="material-symbols-outlined text-[15px]">call</span>
                                                                <span className="text-[11px] lg:text-[13px] font-black tracking-tight uppercase">{point.telefone}</span>
                                                            </div>
                                                        )}
                                                        {point.whatsapp && (
                                                            <div className="bg-[#e7f6ed] text-[#128c7e] px-3 py-1 rounded-full flex items-center gap-1.5 border-[#cfebdb] border">
                                                                <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.171.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.984-.365-1.739-.757-2.871-2.526-2.958-2.641-.087-.114-.708-.941-.708-1.797 0-.856.446-1.275.606-1.446.16-.171.346-.214.463-.214.114 0 .229.003.328.006.104.004.244-.038.382.296.14.338.477 1.163.518 1.247.041.084.068.182.012.294-.055.114-.083.185-.166.282-.083.097-.174.218-.247.291-.082.08-.168.167-.073.332.095.165.421.696.903 1.127.621.556 1.143.729 1.309.812.165.084.262.062.359-.049.098-.111.417-.487.53-.654.114-.167.228-.14.382-.083.155.058.981.463 1.15.548.169.084.281.127.322.197.041.07.041.405-.103.811z"/></svg>
                                                                <span className="text-[11px] lg:text-[13px] font-black tracking-tight uppercase">{point.whatsapp}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {canEdit && (
                                                    <div className="flex items-center gap-0.5 opacity-0 group-hover/point:opacity-100 transition-opacity">
                                                        <button onClick={() => { 
                                                            setSelectedEntityId(ent.id);
                                                            setEditingPoint(point); 
                                                            setPointFormData({ 
                                                                name: point.name, 
                                                                address: point.address || '', 
                                                                ramal: point.ramal || '', 
                                                                telefone: point.telefone || '', 
                                                                whatsapp: point.whatsapp || '' 
                                                            });
                                                            setIsPointModalOpen(true); 
                                                        }} className="p-1.5 text-gray-300 hover:text-primary transition-colors bg-gray-50 rounded-md"><span className="material-symbols-outlined text-sm">edit</span></button>
                                                        <button onClick={() => deletePoint(point.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors bg-gray-50 rounded-md"><span className="material-symbols-outlined text-sm">delete</span></button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {ent.points.length === 0 && (
                                        <div className="text-center py-10">
                                            <p className="text-sm font-bold text-gray-400 italic">Nenhum ponto de contato cadastrado para este grupo.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="py-32 flex flex-col items-center justify-center text-center bg-white rounded-[3rem] border-2 border-dashed border-gray-100 shadow-inner">
                        <div className="size-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 border border-gray-100">
                             <span className="material-symbols-outlined text-4xl text-gray-300">contact_page</span>
                        </div>
                        <h4 className="text-xl font-black text-gray-800 tracking-tight">Nenhum contato encontrado</h4>
                        <p className="text-gray-400 mt-2 font-bold uppercase text-[10px] tracking-[0.2em]">Tente uma busca diferente ou selecione outra categoria.</p>
                    </div>
                )}
            </div>

            {/* Entity Modal */}
            {isEntityModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                        <div className="bg-gray-50 px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">{editingEntity ? 'Editar Grupo' : 'Novo Grupo'}</h3>
                            <button onClick={() => setIsEntityModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><span className="material-symbols-outlined text-2xl">close</span></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Nome do Grupo</label>
                                <input 
                                    type="text" 
                                    value={entityFormData.name}
                                    onChange={(e) => setEntityFormData({ ...entityFormData, name: e.target.value })}
                                    className="w-full p-4 border border-gray-200 rounded-2xl focus:border-primary focus:ring-8 focus:ring-primary/5 outline-none transition-all font-bold"
                                    placeholder="Ex: CLINICA DE MEDICINA NUCLEAR"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Categoria Principal</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {CATEGORIES.map(cat => (
                                        <button 
                                            key={cat}
                                            onClick={() => setEntityFormData({ ...entityFormData, category: cat })}
                                            className={`p-3 rounded-xl text-[9px] font-black uppercase text-center border-2 transition-all ${entityFormData.category === cat ? 'bg-primary border-primary text-white' : 'border-gray-50 text-gray-400 hover:bg-gray-50'}`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button onClick={() => setIsEntityModalOpen(false)} className="flex-1 py-4 font-black uppercase tracking-widest text-gray-400 hover:bg-gray-50 rounded-2xl transition-all">Cancelar</button>
                                <button onClick={handleSaveEntity} className="flex-[2] bg-primary text-white py-4 font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all">Salvar Grupo</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Point Modal */}
            {isPointModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                        <div className="bg-gray-50 px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">{editingPoint ? 'Editar Ponto' : 'Novo Ponto de Contato'}</h3>
                            <button onClick={() => setIsPointModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><span className="material-symbols-outlined text-2xl">close</span></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Identificação / Setor</label>
                                <input 
                                    type="text" 
                                    value={pointFormData.name}
                                    onChange={(e) => setPointFormData({ ...pointFormData, name: e.target.value })}
                                    className="w-full p-4 border border-gray-200 rounded-2xl focus:border-primary focus:ring-8 focus:ring-primary/5 outline-none transition-all font-bold"
                                    placeholder="Ex: RECEPÇÃO CENTRAL"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Endereço (Opcional)</label>
                                <input 
                                    type="text" 
                                    value={pointFormData.address}
                                    onChange={(e) => setPointFormData({ ...pointFormData, address: e.target.value })}
                                    className="w-full p-4 border border-gray-200 rounded-2xl focus:border-primary focus:ring-8 focus:ring-primary/5 outline-none transition-all font-bold"
                                    placeholder="Ex: RUA MONSENHOR CLARO, 7-70"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Ramal</label>
                                    <input 
                                        type="text" 
                                        value={pointFormData.ramal}
                                        onChange={(e) => setPointFormData({ ...pointFormData, ramal: e.target.value })}
                                        className="w-full p-4 border border-gray-200 rounded-2xl focus:border-primary focus:ring-8 focus:ring-primary/5 outline-none transition-all font-bold"
                                        placeholder="Ex: 201"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Telefone</label>
                                    <input 
                                        type="text" 
                                        value={pointFormData.telefone}
                                        onChange={(e) => setPointFormData({ ...pointFormData, telefone: e.target.value })}
                                        className="w-full p-4 border border-gray-200 rounded-2xl focus:border-primary focus:ring-8 focus:ring-primary/5 outline-none transition-all font-bold"
                                        placeholder="Ex: (14) 3235"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">WhatsApp</label>
                                <input 
                                    type="text" 
                                    value={pointFormData.whatsapp}
                                    onChange={(e) => setPointFormData({ ...pointFormData, whatsapp: e.target.value })}
                                    className="w-full p-4 border border-gray-200 rounded-2xl focus:border-primary focus:ring-8 focus:ring-primary/5 outline-none transition-all font-bold"
                                    placeholder="Ex: (14) 99999-9999"
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button onClick={() => setIsPointModalOpen(false)} className="flex-1 py-4 font-black uppercase tracking-widest text-gray-400 hover:bg-gray-50 rounded-2xl transition-all">Cancelar</button>
                                <button onClick={handleSavePoint} className="flex-[2] bg-primary text-white py-4 font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all">Salvar Ponto</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Contacts;
