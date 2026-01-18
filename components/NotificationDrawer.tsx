import React, { useState, useEffect } from 'react';
import { Note, NoteStatus, NoteHistory } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

interface NotificationDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onNotesUpdate?: (unreadCount: number) => void;
}

const CATEGORIES = [
    { id: 'urgent', label: 'URGENTE', icon: '🚨', color: 'bg-red-600', borderColor: 'border-red-200', textColor: 'text-red-600' },
    { id: 'process', label: 'Fluxo / Processo', icon: '🔄', color: 'bg-blue-600', borderColor: 'border-blue-200', textColor: 'text-blue-600' },
    { id: 'system', label: 'Sistema / TI', icon: '💻', color: 'bg-slate-700', borderColor: 'border-slate-200', textColor: 'text-slate-700' },
    { id: 'training', label: 'Treinamento', icon: '📚', color: 'bg-green-600', borderColor: 'border-green-200', textColor: 'text-green-600' },
    { id: 'general', label: 'Geral', icon: '📢', color: 'bg-gray-500', borderColor: 'border-gray-200', textColor: 'text-gray-500' },
];

const AUDIENCES = [
    { id: 'all', label: 'Todos', icon: 'groups' },
    { id: 'reception', label: 'Equipe Recepção', icon: 'desk' },
    { id: 'doctor', label: 'Médicos', icon: 'medical_services' },
];

const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ isOpen, onClose, onNotesUpdate }) => {
    const { user } = useAuth();

    const [notes, setNotes] = useState<Note[]>(() => {
        const saved = localStorage.getItem('mediportal_notes');
        return saved ? JSON.parse(saved) : [];
    });

    const [isCreating, setIsCreating] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Note>>({
        title: '',
        category: 'general',
        content: '',
        audience: 'all'
    });

    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

    useEffect(() => {
        localStorage.setItem('mediportal_notes', JSON.stringify(notes));

        // Filter notes visible to the user before calculating unread
        const visibleNotes = notes.filter(n => {
            if (n.status === 'completed') return false;
            if (n.audience === 'all') return true;
            return n.audience === user?.role;
        });

        const unreadCount = visibleNotes.filter(n => !n.isRead).length;
        if (onNotesUpdate) onNotesUpdate(unreadCount);
    }, [notes, onNotesUpdate, user?.role]);

    const handleSaveNote = () => {
        if (!formData.title || !formData.content) return;

        if (editingNoteId) {
            // Edit existing
            setNotes(prev => prev.map(n => n.id === editingNoteId ? {
                ...n,
                title: formData.title!,
                category: formData.category as any,
                content: formData.content!,
                audience: formData.audience as any,
                history: [...n.history, {
                    id: Date.now().toString(),
                    actor: user?.role === 'doctor' ? 'doctor' : 'reception',
                    actorName: user?.name || 'Usuário',
                    action: 'reply', // Using reply as update indicator
                    content: 'Aviso atualizado',
                    timestamp: new Date().toISOString()
                }]
            } : n));
        } else {
            // Create New
            const newNote: Note = {
                id: Date.now().toString(),
                title: formData.title!,
                type: 'general',
                category: formData.category as any,
                from: user?.id || '',
                to: 'all',
                authorName: user?.name,
                audience: formData.audience as any,
                content: formData.content || '',
                createdAt: new Date().toISOString(),
                status: 'pending',
                isRead: false,
                history: [{
                    id: Date.now().toString(),
                    actor: user?.role === 'doctor' ? 'doctor' : 'reception',
                    actorName: user?.name || 'Usuário',
                    action: 'create',
                    content: formData.content || '',
                    timestamp: new Date().toISOString()
                }]
            };
            setNotes(prev => [newNote, ...prev]);
        }

        setIsCreating(false);
        setEditingNoteId(null);
        setFormData({ title: '', category: 'general', content: '', audience: 'all' });
    };

    const handleEditInitiate = (e: React.MouseEvent, note: Note) => {
        e.stopPropagation();
        setEditingNoteId(note.id);
        setFormData({
            title: note.title,
            category: note.category,
            content: note.content,
            audience: note.audience || 'all'
        });
        setIsCreating(true);
    };

    const markAsRead = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setNotes(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    };

    const initiateDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setConfirmingDeleteId(id);
    };

    const confirmDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setNotes(prev => prev.filter(n => n.id !== id));
        setConfirmingDeleteId(null);
    };

    const cancelDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setConfirmingDeleteId(null);
    };

    if (!isOpen) return null;

    // Filter notes visible to the current user
    const filteredNotes = notes.filter(n => {
        if (n.status === 'completed') return false;
        if (n.audience === 'all') return true;
        // The user who created the note can always see it
        if (n.from === user?.id) return true;
        return n.audience === user?.role;
    });

    return (
        <div className="fixed inset-0 z-[100] overflow-hidden">
            <div
                className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
                onClick={onClose}
            />

            <div className={`absolute top-0 right-0 h-full w-full max-w-lg bg-[#f8fafc] shadow-2xl flex flex-col transform transition-transform duration-300 ease-out animate-in slide-in-from-right overflow-hidden`}>

                {/* Header */}
                <div className="bg-white p-6 border-b border-gray-100 relative shrink-0">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                    <h2 className="text-2xl font-bold text-[#10605B]">Mural de Avisos</h2>
                    <p className="text-gray-500 text-sm mt-1 font-medium">Comunique atualizações importantes para a equipe.</p>
                </div>

                {/* Create Trigger */}
                <div className="px-6 py-4 shrink-0">
                    <button
                        onClick={() => {
                            if (isCreating) {
                                setIsCreating(false);
                                setEditingNoteId(null);
                                setFormData({ title: '', category: 'general', content: '', audience: 'all' });
                            } else {
                                setIsCreating(true);
                            }
                        }}
                        className={`w-full flex items-center justify-center gap-3 p-3 rounded-xl border-2 transition-all font-bold text-sm ${isCreating
                            ? 'bg-primary-light border-primary text-primary-dark'
                            : 'bg-white border-[#10605B]/20 text-[#10605B] hover:border-[#10605B]/40'
                            }`}
                    >
                        <span className="material-symbols-outlined text-lg">{isCreating ? 'remove' : 'add'}</span>
                        {editingNoteId ? 'Editando Aviso' : 'Criar Novo Aviso'}
                        <span className={`material-symbols-outlined transition-transform duration-200 ml-auto ${isCreating ? 'rotate-180' : ''}`}>expand_more</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4 no-scrollbar">
                    {/* Form Section */}
                    {isCreating && (
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xl animate-in slide-in-from-top-4 duration-300 space-y-5">
                            <div className="flex gap-4">
                                <div className="flex-1 space-y-1.5">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">Título do Aviso</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Atualização do Sistema"
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    />
                                </div>
                                <div className="w-[180px] space-y-1.5">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">Categoria (Tag)</label>
                                    <select
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value as any })}
                                    >
                                        {CATEGORIES.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-1 space-y-1.5">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">Público-Alvo</label>
                                    <div className="flex gap-2">
                                        {AUDIENCES.map(aud => (
                                            <button
                                                key={aud.id}
                                                onClick={() => setFormData({ ...formData, audience: aud.id as any })}
                                                className={`flex-1 flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-[11px] font-bold transition-all ${formData.audience === aud.id
                                                    ? 'bg-primary border-primary text-white'
                                                    : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'
                                                    }`}
                                            >
                                                <span className="material-symbols-outlined text-sm">{aud.icon}</span>
                                                {aud.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5 relative group">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Conteúdo</label>
                                    <div className="flex flex-wrap gap-1 justify-end max-w-[280px]">
                                        {['📢', '🚨', '✅', '⚠️', '💡', '🗓️', '💉', '🩺', '💊', '🤝', '❤️', '🙏', '✨', '🔥', '📌', '❓', '💬', '👀'].map(emoji => (
                                            <button
                                                key={emoji}
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, content: (prev.content || '') + emoji }))}
                                                className="hover:scale-125 transition-transform p-1 grayscale hover:grayscale-0 text-lg"
                                                title="Adicionar emoji"
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <textarea
                                    placeholder="Descreva o aviso aqui..."
                                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm h-32 resize-none focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
                                    value={formData.content}
                                    onChange={e => setFormData({ ...formData, content: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-3 justify-end pt-2">
                                <button
                                    onClick={() => {
                                        setIsCreating(false);
                                        setEditingNoteId(null);
                                        setFormData({ title: '', category: 'general', content: '', audience: 'all' });
                                    }}
                                    className="px-6 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors text-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveNote}
                                    disabled={!formData.title || !formData.content}
                                    className="px-8 py-2.5 bg-[#00665C] text-white rounded-xl font-bold text-sm hover:bg-[#004d45] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                                >
                                    {editingNoteId ? 'Salvar Alterações' : 'Criar Aviso'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Notice List */}
                    {filteredNotes.length > 0 ? (
                        filteredNotes.map(note => {
                            const category = CATEGORIES.find(c => c.id === note.category) || CATEGORIES[4];
                            const isConfirming = confirmingDeleteId === note.id;
                            const isAuthor = note.from === user?.id;

                            return (
                                <div
                                    key={note.id}
                                    className={`bg-white border ${note.isRead ? 'border-gray-100' : 'border-red-100 bg-red-50/5'} rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group relative overflow-hidden`}
                                >
                                    {isConfirming ? (
                                        <div className="absolute inset-0 bg-red-600/95 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-white p-4 text-center animate-in fade-in duration-200">
                                            <span className="material-symbols-outlined text-3xl mb-1">delete_forever</span>
                                            <p className="font-bold text-sm mb-3">Excluir este aviso permanentemente?</p>
                                            <div className="flex gap-2 w-full max-w-[240px]">
                                                <button onClick={cancelDelete} className="flex-1 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-colors">Cancelar</button>
                                                <button onClick={(e) => confirmDelete(e, note.id)} className="flex-1 py-2 bg-white text-red-600 hover:bg-red-50 rounded-lg text-xs font-bold transition-colors shadow-lg">Confirmar</button>
                                            </div>
                                        </div>
                                    ) : null}

                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <h4 className="font-bold text-gray-800 text-base">{note.title}</h4>
                                                    <span className={`${category.color} text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter`}>
                                                        {category.label}
                                                    </span>
                                                    {note.audience !== 'all' && (
                                                        <span className="bg-gray-100 text-gray-500 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 uppercase">
                                                            <span className="material-symbols-outlined text-[10px]">
                                                                {note.audience === 'doctor' ? 'medical_services' : 'desk'}
                                                            </span>
                                                            {note.audience === 'doctor' ? 'Médicos' : 'Recepção'}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {isAuthor && (
                                                        <>
                                                            <button onClick={(e) => handleEditInitiate(e, note)} className="p-1 hover:bg-gray-100 rounded text-gray-400 transition-colors" title="Editar"><span className="material-symbols-outlined text-sm">edit</span></button>
                                                            <button onClick={(e) => initiateDelete(e, note.id)} className="p-1 hover:bg-red-50 rounded text-red-400 transition-colors" title="Excluir"><span className="material-symbols-outlined text-sm">delete</span></button>
                                                        </>
                                                    )}
                                                    {!note.isRead && (
                                                        <button onClick={(e) => markAsRead(e, note.id)} className="p-1 hover:bg-blue-50 rounded text-blue-500 transition-colors" title="Marcar como lida"><span className="material-symbols-outlined text-sm">done_all</span></button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">
                                                    {new Date(note.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                                </p>
                                                <span className="size-1 bg-gray-300 rounded-full"></span>
                                                <p className="text-[10px] text-primary font-bold uppercase tracking-wide">
                                                    Por: {note.authorName || 'Sistema'}
                                                </p>
                                            </div>
                                            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                                                {note.content}
                                            </p>

                                            {!note.isRead && (
                                                <div className="mt-4 flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => markAsRead(e, note.id)}
                                                        className="text-[10px] font-bold text-primary-dark uppercase tracking-widest hover:underline flex items-center gap-1"
                                                    >
                                                        <span className="material-symbols-outlined text-xs">check_circle</span>
                                                        Marcar como lida
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {!note.isRead && (
                                        <div className="absolute top-5 right-5 size-2 bg-red-500 rounded-full ring-4 ring-red-50 animate-pulse"></div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div className="py-20 flex flex-col items-center justify-center text-center opacity-30 select-none">
                            <span className="material-symbols-outlined text-7xl mb-4">dashboard_customize</span>
                            <p className="font-bold text-lg">Mural Vazio</p>
                            <p className="text-sm">Nenhuma atualização visível para seu perfil.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationDrawer;
