import React, { useState, useEffect } from 'react';
import { Script, ScriptCategory } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';

// Static Data for Seeding (only used for new users)
const INITIAL_CATEGORIES = [
    { name: 'APRESENTAÇÃO', order: 1 },
    { name: 'QUESTIONÁRIOS', order: 2 },
    { name: 'FINALIZAÇÕES', order: 3 },
    { name: 'GUIAS', order: 4 },
    { name: 'CADASTRO', order: 5 },
    { name: 'ATESTADO', order: 6 },
    { name: 'CONVÊNIOS', order: 7 },
    { name: 'HORÁRIOS', order: 8 },
];

const INITIAL_SCRIPTS_SEED: any[] = [
    { catIndex: 0, title: 'ATENDIMENTO INICIAL', content: 'Olá! Eu sou [MEU_NOME] da Central de Agendamento da Unimed Bauru. Para agilizar seu atendimento, por favor, informe seu Nome Completo e o número da sua carteirinha.', order: 1 },
    { catIndex: 0, title: 'CONFIRMAÇÃO DE DADOS', content: 'Poderia confirmar, por favor, sua data de nascimento e um telefone para contato atualizado?', order: 2 },
    { catIndex: 0, title: 'CADASTRO NÃO LOCALIZADO', content: 'Não localizei seu cadastro em nosso sistema. Poderia me enviar uma foto da sua carteirinha e do pedido médico?', order: 3 },
    { catIndex: 0, title: 'EXAMES IDENTIFICADOS', content: 'Localizei os exames solicitados. Vou verificar a disponibilidade na agenda.', order: 4 },
    { catIndex: 0, title: 'PREFERÊNCIAS (Profissional/Período)', content: 'Você tem preferência por algum médico específico ou período (manhã/tarde)?', order: 5 },
    { catIndex: 0, title: 'GUIA NÃO LOCALIZADA / AUTORIZADA', content: 'Não localizei a autorização da guia no sistema. Por favor, entre em contato com o setor de autorizações ou envie a guia autorizada.', order: 6 },
    { catIndex: 1, title: 'QUESTIONÁRIO RESSONÂNCIA', content: 'Para o exame de Ressonância, preciso fazer algumas perguntas de segurança. Você possui marcapasso, clipes de aneurisma ou implantes metálicos?', order: 1 },
];

const Scripts: React.FC = () => {
    const { user } = useAuth();

    // State
    const [categories, setCategories] = useState<ScriptCategory[]>([]);
    const [scripts, setScripts] = useState<Script[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal States
    const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [viewScript, setViewScript] = useState<Script | null>(null);
    const [editingScript, setEditingScript] = useState<Script | null>(null);

    // Category Editing State
    const [editingCategory, setEditingCategory] = useState<ScriptCategory | null>(null);

    // Feedback State
    const [showCopyToast, setShowCopyToast] = useState(false);

    // Forms
    const [scriptForm, setScriptForm] = useState({ title: '', content: '', categoryId: '', order: 1 });
    const [newCategoryName, setNewCategoryName] = useState('');

    // Fetch and Seeding Logic
    const fetchData = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            // 1. Fetch Categories
            let { data: catData, error: catError } = await supabase
                .from('script_categories')
                .select('*')
                .order('order', { ascending: true });

            if (catError) throw catError;

            // 2. Seeding if no categories exist
            if (!catData || catData.length === 0) {
                console.log('Seeding initial scripts for user:', user.id);
                const seededCats: ScriptCategory[] = [];
                for (const cat of INITIAL_CATEGORIES) {
                    const { data, error } = await supabase
                        .from('script_categories')
                        .insert({ ...cat, user_id: user.id })
                        .select();
                    if (error) throw error;
                    if (data) seededCats.push(data[0]);
                }

                for (const script of INITIAL_SCRIPTS_SEED) {
                    const parentCat = seededCats[script.catIndex];
                    if (parentCat) {
                        const { error } = await supabase
                            .from('scripts')
                            .insert({
                                title: script.title,
                                content: script.content,
                                order: script.order,
                                category_id: parentCat.id,
                                user_id: user.id
                            });
                        if (error) throw error;
                    }
                }

                // Re-fetch after seeding
                const { data: finalCats } = await supabase.from('script_categories').select('*').order('order', { ascending: true });
                catData = finalCats;
            }

            setCategories(catData || []);
            if (catData && catData.length > 0 && !selectedCategory) {
                setSelectedCategory(catData[0].id);
            }

            // 3. Fetch Scripts
            const { data: scriptData, error: scriptError } = await supabase
                .from('scripts')
                .select('*, categoryId:category_id') // Alias for TS interface compatibility
                .order('order', { ascending: true });

            if (scriptError) throw scriptError;
            setScripts(scriptData?.map(s => ({ ...s, categoryId: s.category_id })) || []);

        } catch (error) {
            console.error('Error fetching script data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Realtime Subscriptions
        const catSub = supabase.channel('scripts_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'script_categories' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scripts' }, () => fetchData())
            .subscribe();

        return () => {
            supabase.removeChannel(catSub);
        };
    }, [user?.id]);

    useEffect(() => {
        // Ensure a category is selected on load
        if (!selectedCategory && categories.length > 0) {
            setSelectedCategory(categories[0].id);
        }
    }, [categories, selectedCategory]);

    // --- Handlers: Scripts ---

    const handleOpenScriptModal = (script?: Script) => {
        if (script) {
            setEditingScript(script);
            setScriptForm({
                title: script.title,
                content: script.content,
                categoryId: script.categoryId,
                order: script.order
            });
        } else {
            // Calculate next order for current category
            const catScripts = scripts.filter(s => s.categoryId === selectedCategory);
            const nextOrder = catScripts.length > 0 ? Math.max(...catScripts.map(s => s.order)) + 1 : 1;

            setEditingScript(null);
            setScriptForm({
                title: '',
                content: '',
                categoryId: selectedCategory, // Default to current category
                order: nextOrder
            });
        }
        setIsScriptModalOpen(true);
    };

    const handleSaveScript = async () => {
        if (!scriptForm.title || !scriptForm.content || !scriptForm.categoryId || !user) return;

        try {
            if (editingScript) {
                const { error } = await supabase
                    .from('scripts')
                    .update({
                        title: scriptForm.title,
                        content: scriptForm.content,
                        category_id: scriptForm.categoryId,
                        order: scriptForm.order
                    })
                    .eq('id', editingScript.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('scripts')
                    .insert({
                        title: scriptForm.title,
                        content: scriptForm.content,
                        category_id: scriptForm.categoryId,
                        order: scriptForm.order,
                        user_id: user.id
                    });
                if (error) throw error;
            }
            setIsScriptModalOpen(false);
            fetchData();
        } catch (error) {
            console.error('Error saving script:', error);
            alert('Erro ao salvar script.');
        }
    };

    const handleDeleteScript = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm("Excluir este script?")) {
            try {
                const { error } = await supabase.from('scripts').delete().eq('id', id);
                if (error) throw error;
                fetchData();
            } catch (error) {
                console.error('Error deleting script:', error);
            }
        }
    };

    // Helper to extract first two names
    const getUserShortName = () => {
        if (!user || !user.name) return '';
        const parts = user.name.trim().split(/\s+/);
        return parts.slice(0, 2).join(' ');
    };

    const handleCopy = (text: string) => {
        // Automatic Name Injection Logic
        let finalText = text;

        // 1. Replace explicit placeholder [MEU_NOME] if it exists
        if (text.includes('[MEU_NOME]')) {
            finalText = text.replace(/\[MEU_NOME\]/g, getUserShortName());
        }

        navigator.clipboard.writeText(finalText);
        setShowCopyToast(true);
        setTimeout(() => setShowCopyToast(false), 2000);
    };

    // --- Handlers: Categories ---

    const handleSaveCategory = async () => {
        if (!newCategoryName.trim() || !user) return;

        try {
            if (editingCategory) {
                const { error } = await supabase
                    .from('script_categories')
                    .update({ name: newCategoryName.toUpperCase() })
                    .eq('id', editingCategory.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('script_categories')
                    .insert({
                        name: newCategoryName.toUpperCase(),
                        order: categories.length + 1,
                        user_id: user.id
                    });
                if (error) throw error;
            }
            setNewCategoryName('');
            setEditingCategory(null);
            fetchData();
        } catch (error) {
            console.error('Error saving category:', error);
        }
    };

    const handleEditCategoryStart = (cat: ScriptCategory) => {
        setEditingCategory(cat);
        setNewCategoryName(cat.name);
    };

    const handleCancelCategoryEdit = () => {
        setEditingCategory(null);
        setNewCategoryName('');
    };

    const handleDeleteCategory = async (id: string) => {
        if (window.confirm("Excluir esta categoria? Todos os scripts nela serão perdidos.")) {
            try {
                const { error } = await supabase.from('script_categories').delete().eq('id', id);
                if (error) throw error;

                if (selectedCategory === id) setSelectedCategory('');
                fetchData();
            } catch (error) {
                console.error('Error deleting category:', error);
            }
        }
    };

    // --- Filtering ---
    const filteredScripts = scripts
        .filter(s => {
            const matchesCategory = s.categoryId === selectedCategory;
            const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.content.toLowerCase().includes(searchQuery.toLowerCase());

            return matchesCategory && matchesSearch;
        })
        .sort((a, b) => a.order - b.order);

    if (isLoading && scripts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-primary gap-4">
                <span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span>
                <p className="font-bold">Carregando seus scripts personalizados...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full gap-6 relative">

            {/* Copy Toast Notification */}
            {showCopyToast && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3">
                        <span className="material-symbols-outlined text-[#25D366]">check_circle</span>
                        <span className="text-sm font-bold">Copiado! Nome inserido automaticamente.</span>
                    </div>
                </div>
            )}

            {/* --- STANDARDIZED HEADER (Matches Tasks.tsx) --- */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Scripts de Atendimento</h2>
                    <p className="text-gray-500">Padronização e agilidade na comunicação.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => { setIsCategoryModalOpen(true); handleCancelCategoryEdit(); }}
                        className="bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-lg">settings</span>
                        Categorias
                    </button>
                    <button
                        onClick={() => handleOpenScriptModal()}
                        className="bg-secondary text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-sm hover:shadow-md"
                    >
                        <span className="material-symbols-outlined">add</span>
                        Novo Script
                    </button>
                </div>
            </div>

            {/* --- SEARCH & CATEGORY FILTERS (Standardized) --- */}
            <div className="flex flex-col gap-4">
                {/* Search Bar */}
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar no conteúdo dos scripts..."
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none text-sm bg-white shadow-sm placeholder-gray-400"
                    />
                </div>

                {/* Categories Horizontal Scroll - Pill Style */}
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`px-4 py-2 rounded-full text-sm font-bold uppercase whitespace-nowrap transition-all border ${selectedCategory === cat.id
                                ? 'bg-primary text-white border-primary shadow-md'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            {cat.name}
                        </button>
                    ))}
                    {categories.length === 0 && (
                        <p className="text-sm text-gray-400 italic">Nenhuma categoria criada.</p>
                    )}
                </div>
            </div>

            {/* Scripts Grid (Up to 6 columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 pb-10">
                {filteredScripts.length > 0 ? (
                    filteredScripts.map((script) => (
                        <div
                            key={script.id}
                            onClick={() => handleCopy(script.content)}
                            className="bg-white border border-[#CCFBF1] rounded-xl overflow-hidden flex flex-col hover:shadow-lg transition-all cursor-pointer group relative select-none"
                        >
                            {/* Header (No Content Preview) */}
                            <div className="bg-[#F0FDF9] p-4 border-b border-[#CCFBF1] flex-1 flex items-center justify-center text-center">
                                <h4 className="font-bold text-sm text-[#115E59] uppercase leading-tight">
                                    {script.title}
                                </h4>
                            </div>

                            {/* Footer Actions */}
                            <div className="bg-white p-3 flex items-center justify-between">
                                {/* Order Number */}
                                <div className="size-7 rounded-full border-2 border-[#115E59] text-[#115E59] flex items-center justify-center text-xs font-bold bg-white shrink-0">
                                    {script.order}
                                </div>

                                <div className="flex items-center gap-2">
                                    <div className="flex gap-1 text-gray-400">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleOpenScriptModal(script); }}
                                            className="hover:text-[#115E59] p-1.5 rounded hover:bg-gray-100 transition-colors"
                                            title="Editar"
                                        >
                                            <span className="material-symbols-outlined text-lg">edit_square</span>
                                        </button>
                                        <button
                                            onClick={(e) => handleDeleteScript(script.id, e)}
                                            className="hover:text-red-500 p-1.5 rounded hover:bg-gray-100 transition-colors"
                                            title="Excluir"
                                        >
                                            <span className="material-symbols-outlined text-lg">delete</span>
                                        </button>
                                    </div>

                                    <button
                                        onClick={(e) => { e.stopPropagation(); setViewScript(script); }}
                                        className="bg-[#115E59] hover:bg-[#0F504B] text-white text-[10px] font-bold uppercase px-3 py-1.5 rounded flex items-center gap-1 transition-colors shadow-sm"
                                    >
                                        <span className="material-symbols-outlined text-sm">visibility</span>
                                        Ver
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                        <span className="material-symbols-outlined text-4xl mb-2 opacity-50">description</span>
                        <p className="text-sm font-medium">Nenhum script encontrado nesta categoria.</p>
                    </div>
                )}
            </div>

            {/* --- MODAL: CREATE / EDIT SCRIPT --- */}
            {isScriptModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden">
                        <div className="px-6 py-4 bg-primary-dark text-white border-b border-white/10 flex justify-between items-center">
                            <h3 className="font-bold text-lg">
                                {editingScript ? 'Editar Script' : 'Novo Script'}
                            </h3>
                            <button onClick={() => setIsScriptModalOpen(false)} className="text-white hover:text-gray-300">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-4 gap-4">
                                <div className="col-span-3">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoria</label>
                                    <select
                                        value={scriptForm.categoryId}
                                        onChange={(e) => setScriptForm({ ...scriptForm, categoryId: e.target.value })}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-primary outline-none bg-white"
                                    >
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ordem</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={scriptForm.order}
                                        onChange={(e) => setScriptForm({ ...scriptForm, order: parseInt(e.target.value) || 1 })}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-primary outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título do Script *</label>
                                <input
                                    type="text"
                                    value={scriptForm.title}
                                    onChange={(e) => setScriptForm({ ...scriptForm, title: e.target.value.toUpperCase() })}
                                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-primary outline-none"
                                    placeholder="EX: ATENDIMENTO INICIAL"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Conteúdo da Mensagem *</label>
                                <p className="text-[10px] text-gray-400 mb-1">Dica: Use <b>[MEU_NOME]</b> para o sistema inserir seu nome automaticamente ao copiar.</p>
                                <textarea
                                    value={scriptForm.content}
                                    onChange={(e) => setScriptForm({ ...scriptForm, content: e.target.value })}
                                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:border-primary outline-none min-h-[120px] resize-none"
                                    placeholder="Ex: Olá! Eu sou [MEU_NOME] da Central de Agendamento..."
                                />
                            </div>

                            <div className="pt-2 flex justify-end gap-2">
                                <button
                                    onClick={() => setIsScriptModalOpen(false)}
                                    className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveScript}
                                    className="px-6 py-2 bg-primary-dark text-white font-bold rounded-lg hover:bg-[#0d504c] transition-colors"
                                >
                                    Salvar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL: MANAGE CATEGORIES --- */}
            {isCategoryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
                        <div className="px-6 py-4 bg-primary-dark text-white border-b border-white/10 flex justify-between items-center">
                            <h3 className="font-bold text-lg">Gerenciar Categorias</h3>
                            <button onClick={() => setIsCategoryModalOpen(false)} className="text-white hover:text-gray-300">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="flex gap-2 mb-4">
                                <input
                                    type="text"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    placeholder={editingCategory ? "Editar nome da categoria..." : "Nova Categoria..."}
                                    className="flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:border-primary outline-none uppercase"
                                />
                                {editingCategory ? (
                                    <>
                                        <button
                                            onClick={handleSaveCategory}
                                            disabled={!newCategoryName.trim()}
                                            className="bg-green-600 hover:bg-green-700 text-white px-3 rounded-lg disabled:bg-gray-300 transition-colors"
                                            title="Salvar Edição"
                                        >
                                            <span className="material-symbols-outlined">check</span>
                                        </button>
                                        <button
                                            onClick={handleCancelCategoryEdit}
                                            className="bg-gray-400 hover:bg-gray-500 text-white px-3 rounded-lg transition-colors"
                                            title="Cancelar Edição"
                                        >
                                            <span className="material-symbols-outlined">close</span>
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={handleSaveCategory}
                                        disabled={!newCategoryName.trim()}
                                        className="bg-primary hover:bg-primary-dark text-white px-3 rounded-lg disabled:bg-gray-300 transition-colors"
                                        title="Adicionar Categoria"
                                    >
                                        <span className="material-symbols-outlined">add</span>
                                    </button>
                                )}
                            </div>

                            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                                {categories.map((cat) => (
                                    <div key={cat.id} className={`flex justify-between items-center p-3 rounded-lg border transition-colors ${editingCategory?.id === cat.id ? 'bg-primary-light border-primary' : 'bg-gray-50 border-gray-100'
                                        }`}>
                                        <span className="text-sm font-bold text-gray-700 uppercase">{cat.name}</span>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => handleEditCategoryStart(cat)}
                                                className="text-gray-400 hover:text-primary p-1 rounded hover:bg-white transition-colors"
                                                title="Editar"
                                            >
                                                <span className="material-symbols-outlined text-lg">edit</span>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCategory(cat.id)}
                                                className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-white transition-colors"
                                                title="Excluir"
                                            >
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL: VIEW / COPY SCRIPT --- */}
            {viewScript && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                    <div className="bg-[#f8fafb] rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col border border-white">
                        {/* Header */}
                        <div className="px-8 pt-8 pb-4 flex justify-between items-center">
                            <h3 className="font-extrabold text-xl text-gray-800 uppercase tracking-tight">
                                {viewScript.title}
                            </h3>
                            <button
                                onClick={() => setViewScript(null)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <span className="material-symbols-outlined text-2xl">close</span>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="px-8 pb-8">
                            <div className="text-gray-700 text-lg leading-relaxed whitespace-pre-wrap font-medium">
                                {viewScript.content.replace(/\[MEU_NOME\]/g, getUserShortName() || '[Seu Nome]')}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-6 bg-transparent flex justify-end gap-3">
                            <button
                                onClick={() => setViewScript(null)}
                                className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition-all border border-gray-200/50"
                            >
                                Fechar
                            </button>
                            <button
                                onClick={() => { handleCopy(viewScript.content); setViewScript(null); }}
                                className="px-6 py-2.5 bg-[#00665C] hover:bg-[#004D46] text-white font-bold rounded-lg transition-all flex items-center gap-2 shadow-sm"
                            >
                                <span className="material-symbols-outlined text-xl">content_copy</span>
                                Copiar
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Scripts;