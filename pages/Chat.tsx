import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Doctor, Receptionist } from '../types';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { useAuth } from '../contexts/AuthContext';

interface Contact {
    id: string;
    name: string;
    role: string;
    avatar: string;
    status: 'online' | 'offline';
    lastSeen?: string;
    type: 'doctor' | 'reception'; // Categoria para filtro
    unreadCount: number; // Contador de não lidas
}

// Initial Messages (preserved for demo purposes)
const initialMessages: Record<string, ChatMessage[]> = {
    // Empty initially, populated as user interacts
};

// Dados Mockados Iniciais (Para garantir consistência caso o localStorage esteja vazio na primeira execução)
const FALLBACK_DOCTORS: Doctor[] = [
    { id: 'd1', name: 'Dr. Ricardo Silva', specialty: 'Cardiologia', phone: '', avatar: '', color: '', status: 'active' },
    { id: 'd2', name: 'Dra. Ana Souza', specialty: 'Pediatria', phone: '', avatar: '', color: '', status: 'active' },
    { id: 'd3', name: 'Dr. Paulo Mendes', specialty: 'Ultrassom', phone: '', avatar: '', color: '', status: 'active' },
    { id: 'd4', name: 'Dra. Carla Diaz', specialty: 'Dermatologia', phone: '', avatar: '', color: '', status: 'active' },
    { id: 'd5', name: 'Dr. Roberto Cruz', specialty: 'Ortopedia', phone: '', avatar: '', color: '', status: 'active' },
    { id: 'd6', name: 'Dra. Fernanda Lima', specialty: 'Ginecologia', phone: '', avatar: '', color: '', status: 'active' },
];

const FALLBACK_RECEPTIONISTS: Receptionist[] = [
    { id: 'r1', name: 'Ana Souza', sector: 'Recepção Central', phone: '', avatar: '', status: 'online' },
    { id: 'r2', name: 'Carla Dias', sector: 'Call Center', phone: '', avatar: '', status: 'offline' },
    { id: 'r3', name: 'Bruna Lima', sector: 'Autorizações', phone: '', avatar: '', status: 'online' },
];

type ChatFilter = 'all' | 'unread' | 'doctor' | 'reception';

interface ChatProps {
    isWidget?: boolean;
}

const Chat: React.FC<ChatProps> = ({ isWidget = false }) => {
    const { user } = useAuth(); // Hook para pegar o usuário logado

    // State for contacts list
    const [allContacts, setAllContacts] = useState<Contact[]>([]);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

    // Access Control State
    const [pendingContact, setPendingContact] = useState<Contact | null>(null);
    const [showAccessModal, setShowAccessModal] = useState(false);

    const [conversations, setConversations] = useState<Record<string, ChatMessage[]>>(initialMessages);
    const [input, setInput] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Filter State
    const [activeFilter, setActiveFilter] = useState<ChatFilter>('all');

    // Emoji State
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Menus State (For Messages)
    const [activeMessageMenuId, setActiveMessageMenuId] = useState<string | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [showChatOptions, setShowChatOptions] = useState(false); // Header menu

    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // --- Load Contacts (Doctors + Receptionists) from LocalStorage ---
    useEffect(() => {
        const loadContacts = () => {
            let mergedContacts: Contact[] = [];

            // 1. Load Doctors (From LocalStorage or Fallback)
            const savedDocs = localStorage.getItem('mediportal_professionals');
            const doctors: Doctor[] = savedDocs ? JSON.parse(savedDocs) : FALLBACK_DOCTORS;

            const doctorContacts: Contact[] = doctors.map(doc => {
                // Determine status based on doctor availability or random for demo
                let chatStatus: 'online' | 'offline' = 'offline';
                if (doc.status === 'active') chatStatus = 'online'; // Simplificação: Ativo = Online no chat

                return {
                    id: doc.id,
                    name: doc.name,
                    role: doc.specialty, // Exibe a especialidade
                    avatar: doc.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(doc.name)}&background=00965e&color=fff`,
                    status: chatStatus,
                    lastSeen: chatStatus === 'offline' ? 'Visto por último recentemente' : undefined,
                    type: 'doctor',
                    unreadCount: 0
                };
            });
            mergedContacts = [...mergedContacts, ...doctorContacts];

            // 2. Load Receptionists (From LocalStorage or Fallback)
            const savedRec = localStorage.getItem('mediportal_receptionists');
            const receptionists: Receptionist[] = savedRec ? JSON.parse(savedRec) : FALLBACK_RECEPTIONISTS;

            const recContacts: Contact[] = receptionists.map(rec => ({
                id: rec.id,
                name: rec.name,
                role: rec.sector, // Exibe o setor
                avatar: rec.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(rec.name)}&background=ef4444&color=fff`,
                status: rec.status,
                lastSeen: rec.status === 'offline' ? 'Visto por último recentemente' : undefined,
                type: 'reception',
                unreadCount: 0
            }));
            mergedContacts = [...mergedContacts, ...recContacts];

            // 3. Filter out CURRENT USER (Don't show myself in the list)
            if (user) {
                mergedContacts = mergedContacts.filter(c => c.id !== user.id);
            }

            // 4. Update State preserving unread counts if reloading
            setAllContacts(prev => {
                if (prev.length === 0) return mergedContacts;

                // Map existing states (like unreadCount) to the reloaded list to avoid reset on refresh
                return mergedContacts.map(c => {
                    const existing = prev.find(p => p.id === c.id);
                    return existing ? { ...c, unreadCount: existing.unreadCount } : c;
                });
            });
        };

        loadContacts();
        // Listen for storage events (in case user registers in another tab or updates profile)
        window.addEventListener('storage', loadContacts);
        return () => window.removeEventListener('storage', loadContacts);
    }, [user]); // Re-run if user logs out/in

    // Auto-scroll to bottom
    useEffect(() => {
        if (selectedContact) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [conversations, selectedContact, editingMessageId]);

    // Handle Contact Click (Open Confirmation Modal)
    const handleContactClick = (contact: Contact) => {
        // If clicking the same contact already open, do nothing
        if (selectedContact?.id === contact.id) return;

        setPendingContact(contact);
        setShowAccessModal(true);
    };

    // Confirm Entry Logic
    const confirmAccessChat = () => {
        if (!pendingContact) return;

        const contact = pendingContact;
        setSelectedContact(contact);
        setShowChatOptions(false);

        // Zera contador de não lidas ao CONFIRMAR a entrada
        if (contact.unreadCount > 0) {
            setAllContacts(prev => prev.map(c =>
                c.id === contact.id ? { ...c, unreadCount: 0 } : c
            ));
        }

        setShowAccessModal(false);
        setPendingContact(null);
    };

    const cancelAccessChat = () => {
        setShowAccessModal(false);
        setPendingContact(null);
    };

    // Handle click outside to close menus
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;

            if (emojiPickerRef.current && !emojiPickerRef.current.contains(target)) {
                setShowEmojiPicker(false);
            }

            // Close Message specific menu
            if (activeMessageMenuId) {
                if (!target.closest('.message-menu-trigger') && !target.closest('.message-menu-dropdown')) {
                    setActiveMessageMenuId(null);
                }
            }

            // Close Chat Header menu
            if (showChatOptions) {
                if (!target.closest('.chat-options-trigger') && !target.closest('.chat-options-dropdown')) {
                    setShowChatOptions(false);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [activeMessageMenuId, showChatOptions]);

    const currentMessages = selectedContact ? (conversations[selectedContact.id] || []) : [];

    // --- Filtering Logic ---
    const filteredContacts = allContacts.filter(contact => {
        const matchesSearch = contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            contact.role.toLowerCase().includes(searchQuery.toLowerCase());

        let matchesCategory = true;
        if (activeFilter === 'unread') matchesCategory = contact.unreadCount > 0;
        if (activeFilter === 'doctor') matchesCategory = contact.type === 'doctor';
        if (activeFilter === 'reception') matchesCategory = contact.type === 'reception';

        return matchesSearch && matchesCategory;
    });

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setAttachment(e.target.files[0]);
        }
    };

    const clearAttachment = () => {
        setAttachment(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const onEmojiClick = (emojiData: EmojiClickData) => {
        setInput((prev) => prev + emojiData.emoji);
    };

    const handleSend = () => {
        if ((!input.trim() && !attachment) || !selectedContact) return;

        if (editingMessageId) {
            setConversations(prev => ({
                ...prev,
                [selectedContact.id]: prev[selectedContact.id].map(msg =>
                    msg.id === editingMessageId
                        ? { ...msg, text: input, isEdited: true }
                        : msg
                )
            }));
            setEditingMessageId(null);
            setInput('');
            return;
        }

        const newMessage: ChatMessage = {
            id: Date.now().toString(),
            senderId: 'u1',
            text: input,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isMe: true,
            attachment: attachment ? {
                name: attachment.name,
                type: attachment.type.startsWith('image/') ? 'image' : 'file',
                url: URL.createObjectURL(attachment),
                size: (attachment.size / 1024).toFixed(1) + ' KB'
            } : undefined
        };

        setConversations(prev => ({
            ...prev,
            [selectedContact.id]: [...(prev[selectedContact.id] || []), newMessage]
        }));

        // Move contact to top
        setAllContacts(prev => {
            const others = prev.filter(c => c.id !== selectedContact.id);
            const current = prev.find(c => c.id === selectedContact.id);
            return current ? [current, ...others] : prev;
        });

        setInput('');
        clearAttachment();
        setShowEmojiPicker(false);
    };

    const handleEditMessage = (msg: ChatMessage) => {
        setInput(msg.text);
        setEditingMessageId(msg.id);
        setActiveMessageMenuId(null);
    };

    const cancelEdit = () => {
        setEditingMessageId(null);
        setInput('');
    };

    const handleDeleteMessage = (msgId: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!selectedContact) return;

        if (window.confirm("Deseja apagar esta mensagem?")) {
            setConversations(prev => ({
                ...prev,
                [selectedContact.id]: prev[selectedContact.id].filter(msg => msg.id !== msgId)
            }));
        }
        setActiveMessageMenuId(null);
    };

    const handleClearChat = () => {
        if (!selectedContact) return;
        if (window.confirm("Deseja limpar todas as mensagens desta conversa?")) {
            setConversations(prev => ({
                ...prev,
                [selectedContact.id]: []
            }));
        }
        setShowChatOptions(false);
    };

    const tabs: { id: ChatFilter, label: string }[] = [
        { id: 'all', label: 'Todos' },
        { id: 'unread', label: 'Não lidas' },
        { id: 'doctor', label: 'Médicos' },
        { id: 'reception', label: 'Recepção' },
    ];

    // --- LAYOUT LOGIC (Whatsapp Web Style) ---

    // Outer container: Full height minus header
    const outerContainerClass = isWidget
        ? "flex flex-col h-full bg-white relative" // Widget: Compact
        : "flex h-[calc(100vh-8rem)] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"; // Desktop: Card-like

    // Sidebar Visibility
    // Desktop: Always Show. Mobile: Show ONLY if no contact selected.
    const sidebarClass = isWidget
        ? (!selectedContact ? 'flex' : 'hidden')
        : `flex flex-col w-full md:w-[35%] lg:w-[30%] border-r border-gray-200 bg-white z-10 ${selectedContact ? 'hidden md:flex' : 'flex'}`;

    // Chat Area Visibility
    // Desktop: Always Show. Mobile: Show ONLY if contact selected.
    const chatAreaClass = isWidget
        ? (selectedContact ? 'flex' : 'hidden')
        : `flex flex-col flex-1 bg-[#efeae2] relative ${selectedContact ? 'flex' : 'hidden md:flex'}`;

    return (
        <div className={outerContainerClass}>

            {/* --- LEFT SIDEBAR (User List) --- */}
            <div className={sidebarClass}>

                {/* Sidebar Header */}
                <div className="h-16 px-4 bg-[#f0f2f5] border-b border-gray-200 flex items-center justify-between shrink-0">
                    {/* User Avatar (Me) */}
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-gray-300 overflow-hidden border border-gray-300 cursor-pointer">
                            {user?.avatar ? (
                                <img src={user.avatar} alt="Me" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-primary text-white font-bold">
                                    {user?.name?.charAt(0)}
                                </div>
                            )}
                        </div>
                        {isWidget && <span className="font-bold text-gray-700 text-sm">Conversas</span>}
                    </div>

                    <div className="flex gap-2 text-gray-500">
                        <button
                            onClick={() => { }}
                            className="size-10 rounded-full hover:bg-gray-200 flex items-center justify-center transition-colors"
                            title="Nova Conversa"
                        >
                            <span className="material-symbols-outlined text-xl">add_comment</span>
                        </button>
                        <button
                            className="size-10 rounded-full hover:bg-gray-200 flex items-center justify-center transition-colors"
                            title="Mais opções"
                        >
                            <span className="material-symbols-outlined text-xl">more_vert</span>
                        </button>
                    </div>
                </div>

                {/* Search & Filter Bar */}
                <div className="p-3 border-b border-gray-100 bg-white">
                    <div className="relative mb-3">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
                        <input
                            type="text"
                            placeholder="Pesquisar ou começar uma nova conversa"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#f0f2f5] border-none pl-10 pr-4 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary/50 transition-all placeholder-gray-500"
                        />
                    </div>

                    {/* Filter Chips */}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveFilter(tab.id)}
                                className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors border ${activeFilter === tab.id
                                    ? 'bg-[#e7fce3] text-[#008069] border-transparent'
                                    : 'bg-[#f0f2f5] text-gray-500 border-transparent hover:bg-gray-200'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Contacts List (Scrollable) */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
                    {filteredContacts.length > 0 ? (
                        <div className="divide-y divide-gray-50">
                            {filteredContacts.map((contact) => (
                                <div
                                    key={contact.id}
                                    onClick={() => handleContactClick(contact)}
                                    className={`px-3 py-3 flex items-center gap-3 cursor-pointer transition-all hover:bg-[#f5f6f6] relative group ${selectedContact?.id === contact.id
                                        ? 'bg-[#f0f2f5]'
                                        : 'bg-white'
                                        }`}
                                >
                                    <div className="relative size-12 flex-shrink-0">
                                        <img src={contact.avatar} className="w-full h-full rounded-full object-cover border border-gray-100" alt={contact.name} />
                                        {/* Status Indicator */}
                                        {contact.status === 'online' && (
                                            <span className="absolute bottom-0 right-0 size-3 border-2 border-white rounded-full bg-green-500"></span>
                                        )}
                                    </div>

                                    <div className="overflow-hidden flex-1 relative pr-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <h4 className="font-medium text-gray-900 text-sm truncate">
                                                {contact.name}
                                            </h4>
                                            <span className={`text-[10px] ${contact.unreadCount > 0 ? 'text-[#25d366] font-bold' : 'text-gray-400'}`}>
                                                10:30
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center">
                                            <p className={`text-xs truncate flex-1 ${contact.unreadCount > 0 ? 'text-gray-800 font-semibold' : 'text-gray-500'}`}>
                                                {contact.unreadCount > 0 ? 'Nova mensagem recebida...' : contact.role}
                                            </p>

                                            {/* Unread Badge */}
                                            {contact.unreadCount > 0 && (
                                                <span className="ml-2 bg-[#25d366] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm">
                                                    {contact.unreadCount}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-gray-400 flex flex-col items-center mt-10">
                            <span className="material-symbols-outlined text-4xl mb-2 opacity-30">filter_list_off</span>
                            <p className="text-sm">Nenhum contato encontrado.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* --- RIGHT CHAT AREA --- */}
            <div className={chatAreaClass}>
                {selectedContact ? (
                    <>
                        {/* Chat Header */}
                        <div className="h-16 px-4 py-2 border-b border-gray-200 flex items-center justify-between bg-[#f0f2f5] z-10 shrink-0">
                            <div className="flex items-center gap-4 cursor-pointer" onClick={() => { }}>
                                {/* Back Button for Mobile */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedContact(null); }}
                                    className={`${isWidget ? 'flex' : 'md:hidden'} -ml-2 p-2 text-gray-500 hover:text-gray-700`}
                                >
                                    <span className="material-symbols-outlined">arrow_back</span>
                                </button>

                                <img src={selectedContact.avatar} className="size-10 rounded-full object-cover border border-gray-200" alt="" />
                                <div className="flex flex-col justify-center">
                                    <h3 className="font-medium text-gray-800 text-sm leading-tight">{selectedContact.name}</h3>
                                    <span className="text-[11px] text-gray-500 truncate">
                                        {selectedContact.status === 'online' ? 'online' : (selectedContact.lastSeen || 'visto por último hoje às 09:00')}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 text-gray-500">
                                <button className="p-2 hover:bg-gray-200 rounded-full transition-colors hidden sm:block">
                                    <span className="material-symbols-outlined text-xl">search</span>
                                </button>
                                <div className="relative">
                                    <button
                                        onClick={() => setShowChatOptions(!showChatOptions)}
                                        className={`p-2 hover:bg-gray-200 rounded-full transition-colors chat-options-trigger ${showChatOptions ? 'bg-gray-200' : ''}`}
                                    >
                                        <span className="material-symbols-outlined text-xl">more_vert</span>
                                    </button>
                                    {/* Options Dropdown */}
                                    {showChatOptions && (
                                        <div className="chat-options-dropdown absolute top-12 right-0 bg-white rounded-lg shadow-xl py-2 w-48 z-30 border border-gray-100 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                            <button className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50">Dados do contato</button>
                                            <button className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50">Selecionar mensagens</button>
                                            <button className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50">Silenciar notificações</button>
                                            <button onClick={handleClearChat} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50">Limpar mensagens</button>
                                            <button onClick={() => setSelectedContact(null)} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50">Fechar conversa</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Messages Container */}
                        {/* Background Pattern: Standard WhatsApp-like doodle pattern */}
                        <div
                            ref={chatContainerRef}
                            className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col gap-2 bg-[#efeae2] bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat"
                        >
                            {/* Encryption Notice */}
                            <div className="flex justify-center mb-4">
                                <div className="bg-[#ffeecd] text-[#54656f] text-[10px] px-3 py-1.5 rounded-lg shadow-sm text-center max-w-xs flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[10px]">lock</span>
                                    As mensagens são protegidas com criptografia de ponta a ponta.
                                </div>
                            </div>

                            {currentMessages.length > 0 ? (
                                currentMessages.map((msg, index) => {
                                    const isSequence = index > 0 && currentMessages[index - 1].senderId === msg.senderId;

                                    return (
                                        <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'} ${isSequence ? 'mt-0.5' : 'mt-2'} group`}>
                                            <div className={`relative max-w-[85%] md:max-w-[65%] rounded-lg shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] text-sm leading-relaxed ${msg.isMe
                                                ? 'bg-[#d9fdd3] text-[#111b21] rounded-tr-none'
                                                : 'bg-white text-[#111b21] rounded-tl-none'
                                                }`}>

                                                {/* Message Options Arrow (Visible on hover) */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setActiveMessageMenuId(activeMessageMenuId === msg.id ? null : msg.id); }}
                                                    className={`message-menu-trigger absolute top-0 right-0 m-1 w-6 h-6 flex items-center justify-center text-gray-500 hover:bg-black/5 rounded-full transition-all opacity-0 group-hover:opacity-100 ${activeMessageMenuId === msg.id ? 'opacity-100 bg-black/5' : ''} z-10`}
                                                >
                                                    <span className="material-symbols-outlined text-lg">keyboard_arrow_down</span>
                                                </button>

                                                {/* Dropdown Menu */}
                                                {activeMessageMenuId === msg.id && (
                                                    <div className="message-menu-dropdown absolute top-8 right-2 bg-white rounded-md shadow-xl py-1 w-32 z-20 border border-gray-100 animate-in fade-in zoom-in-95 duration-75">
                                                        {msg.isMe && (
                                                            <button onClick={() => handleEditMessage(msg)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Editar</button>
                                                        )}
                                                        <button onClick={(e) => handleDeleteMessage(msg.id, e)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Apagar</button>
                                                    </div>
                                                )}

                                                <div className="px-3 pt-2 pb-1 relative">
                                                    {/* Deleted State */}
                                                    {msg.isDeleted ? (
                                                        <div className="flex items-center gap-2 text-gray-500 italic py-1 select-none">
                                                            <span className="material-symbols-outlined text-sm">block</span>
                                                            <span>Mensagem apagada</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {/* Attachments */}
                                                            {msg.attachment && (
                                                                <div className="mb-1">
                                                                    {msg.attachment.type === 'image' ? (
                                                                        <div className="rounded-lg overflow-hidden cursor-pointer mb-1">
                                                                            <img src={msg.attachment.url} alt="Attachment" className="max-w-full max-h-64 object-cover" />
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-3 p-2 rounded-lg bg-black/5 border border-black/5">
                                                                            <div className="bg-white p-2 rounded text-primary">
                                                                                <span className="material-symbols-outlined text-2xl">description</span>
                                                                            </div>
                                                                            <div className="overflow-hidden min-w-[120px]">
                                                                                <p className="text-sm font-bold truncate">{msg.attachment.name}</p>
                                                                                <p className="text-[10px] opacity-60 uppercase">{msg.attachment.type} • {msg.attachment.size}</p>
                                                                            </div>
                                                                            <a href={msg.attachment.url} download={msg.attachment.name} className="ml-auto p-1.5 hover:bg-black/10 rounded-full transition-colors">
                                                                                <span className="material-symbols-outlined text-lg">download</span>
                                                                            </a>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Text */}
                                                            <div className="whitespace-pre-wrap pr-8 break-words pb-2">
                                                                {msg.text}
                                                            </div>

                                                            {/* Meta (Time + Check) */}
                                                            <div className="absolute bottom-1 right-2 flex items-center gap-1 select-none">
                                                                {msg.isEdited && <span className="text-[10px] text-gray-500 mr-1">Editada</span>}
                                                                <span className="text-[10px] text-[#667781]">{msg.timestamp}</span>
                                                                {msg.isMe && (
                                                                    <span className="material-symbols-outlined text-[14px] text-[#53bdeb]">done_all</span>
                                                                )}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                // Empty Chat State (Inside Chat)
                                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                                    {/* Typically handled by the parent Empty State, but good for robust logic */}
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* --- INPUT AREA --- */}
                        {/* Editing Banner */}
                        {editingMessageId && (
                            <div className="px-4 py-2 bg-[#f0f2f5] border-l-4 border-l-primary flex justify-between items-center animate-in slide-in-from-bottom-2">
                                <div>
                                    <p className="text-xs font-bold text-primary">Editando mensagem</p>
                                    <p className="text-xs text-gray-500 truncate max-w-xs">{conversations[selectedContact.id]?.find(m => m.id === editingMessageId)?.text}</p>
                                </div>
                                <button onClick={cancelEdit} className="text-gray-500 hover:text-red-500">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                        )}

                        {/* Attachment Preview Banner */}
                        {attachment && (
                            <div className="px-4 py-3 bg-[#f0f2f5] border-t border-gray-200 flex items-center gap-3 animate-in slide-in-from-bottom-2">
                                <div className="bg-white p-2 rounded-lg border border-gray-200 flex items-center gap-3 shadow-sm pr-4">
                                    <div className="bg-gray-100 p-2 rounded">
                                        <span className="material-symbols-outlined text-primary">
                                            {attachment.type.startsWith('image/') ? 'image' : 'description'}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-700 max-w-[200px] truncate">{attachment.name}</p>
                                        <p className="text-xs text-gray-400">{(attachment.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                    <button onClick={clearAttachment} className="ml-2 text-gray-400 hover:text-red-500 p-1 hover:bg-gray-100 rounded-full transition-colors">
                                        <span className="material-symbols-outlined text-lg">close</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="min-h-[62px] px-4 py-2 bg-[#f0f2f5] flex items-center gap-2 relative z-20">
                            <div className="flex gap-1 text-[#54656f]" ref={emojiPickerRef}>
                                {showEmojiPicker && (
                                    <div className="absolute bottom-16 left-4 z-50 shadow-2xl rounded-2xl animate-in slide-in-from-bottom-5 fade-in duration-200">
                                        <EmojiPicker
                                            onEmojiClick={onEmojiClick}
                                            width={300}
                                            height={400}
                                            skinTonesDisabled
                                            searchDisabled={false}
                                            previewConfig={{ showPreview: false }}
                                        />
                                    </div>
                                )}
                                <button
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    className={`p-2 rounded-full hover:bg-gray-200 transition-colors ${showEmojiPicker ? 'text-primary' : ''}`}
                                >
                                    <span className="material-symbols-outlined text-2xl">sentiment_satisfied</span>
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`p-2 rounded-full hover:bg-gray-200 transition-colors ${attachment ? 'text-primary' : ''}`}
                                    title="Anexar"
                                    disabled={!!editingMessageId}
                                >
                                    <span className="material-symbols-outlined text-2xl transform rotate-45">attach_file</span>
                                </button>
                            </div>

                            <div className="flex-1 bg-white rounded-lg py-2 px-4 border border-white focus-within:border-white shadow-sm flex items-center">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder={editingMessageId ? "Edite sua mensagem..." : "Digite uma mensagem"}
                                    className="w-full bg-transparent outline-none text-sm text-[#111b21] placeholder-gray-500"
                                />
                            </div>

                            <button
                                onClick={handleSend}
                                className={`p-2 rounded-full flex items-center justify-center transition-all ${input.trim() || attachment
                                    ? 'text-primary hover:bg-gray-200'
                                    : 'text-[#54656f] hover:bg-gray-200'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-2xl">
                                    {editingMessageId ? 'check' : (input.trim() || attachment ? 'send' : 'mic')}
                                </span>
                            </button>
                        </div>
                    </>
                ) : (
                    /* --- EMPTY STATE (WhatsApp Web Style) --- */
                    /* ONLY SHOW IF NOT IN WIDGET MODE (or adapt widget mode to handle empty) */
                    <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-[#f0f2f5] border-b-[6px] border-[#25d366] text-center p-10 select-none">
                        <div className="mb-10 opacity-80">
                            <img
                                src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
                                alt="Logo"
                                className="w-24 h-24 opacity-20 mx-auto grayscale"
                            />
                        </div>
                        <h1 className="text-3xl font-light text-[#41525d] mb-4">MediPortal Web</h1>
                        <p className="text-[#667781] text-sm leading-relaxed max-w-md">
                            Envie e receba mensagens sem precisar manter seu celular conectado.<br />
                            Use o MediPortal em até 4 dispositivos vinculados e 1 celular.
                        </p>
                        <div className="mt-10 flex items-center gap-2 text-[#8696a0] text-xs">
                            <span className="material-symbols-outlined text-sm">lock</span>
                            Protegido com criptografia de ponta a ponta
                        </div>
                    </div>
                )}
            </div>

            {/* --- ACCESS CONFIRMATION MODAL --- */}
            {showAccessModal && pendingContact && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="bg-primary px-6 py-4 flex items-center justify-between border-b border-white/10">
                            <h3 className="font-bold text-white text-lg">Iniciar Atendimento?</h3>
                            <button onClick={cancelAccessChat} className="text-white hover:bg-white/20 rounded-full p-1 transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-6 flex flex-col items-center text-center">
                            <div className="size-20 rounded-full p-1 border-2 border-gray-100 shadow-sm mb-4 relative">
                                <img
                                    src={pendingContact.avatar}
                                    alt={pendingContact.name}
                                    className="w-full h-full rounded-full object-cover"
                                />
                                {pendingContact.status === 'online' && (
                                    <div className="absolute bottom-1 right-1 size-4 bg-green-500 border-2 border-white rounded-full"></div>
                                )}
                            </div>

                            <h4 className="text-xl font-bold text-gray-800">{pendingContact.name}</h4>
                            <p className="text-sm text-gray-500 font-medium mb-1">{pendingContact.role}</p>

                            {pendingContact.unreadCount > 0 && (
                                <div className="mt-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">mark_chat_unread</span>
                                    {pendingContact.unreadCount} novas mensagens
                                </div>
                            )}

                            <p className="mt-4 text-xs text-gray-400 max-w-[240px]">
                                Ao acessar, as mensagens pendentes serão marcadas como lidas e você aparecerá como ativo nesta conversa.
                            </p>
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={cancelAccessChat}
                                className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-600 font-bold hover:bg-gray-100 transition-colors text-sm"
                            >
                                Manter Offline
                            </button>
                            <button
                                onClick={confirmAccessChat}
                                className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white font-bold transition-colors shadow-sm text-sm"
                            >
                                Acessar Conversa
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Chat;