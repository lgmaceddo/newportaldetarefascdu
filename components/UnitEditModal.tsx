import React, { useState, useEffect } from 'react';

type ContactType = 'address' | 'phone' | 'whatsapp' | 'email' | 'text';

interface ContactItem {
    id: string;
    type: ContactType;
    label?: string;
    value: string;
}

interface UnitData {
    id: string;
    title: string;
    items: ContactItem[];
}

interface UnitEditModalProps {
    unitData: UnitData;
    onSave: (updatedUnit: UnitData) => void;
    onCancel: () => void;
}

const UnitEditModal: React.FC<UnitEditModalProps> = ({ unitData, onSave, onCancel }) => {
    const [editForm, setEditForm] = useState<UnitData | null>(null);

    // Initialize form state when unitData changes
    useEffect(() => {
        setEditForm(JSON.parse(JSON.stringify(unitData))); // Deep copy
    }, [unitData]);

    if (!editForm) return null;

    const handleAddItem = () => {
        setEditForm({
            ...editForm,
            items: [...editForm.items, { id: Date.now().toString(), type: 'text', label: 'Novo Item', value: '' }]
        });
    };

    const handleRemoveItem = (itemId: string) => {
        setEditForm({
            ...editForm,
            items: editForm.items.filter(i => i.id !== itemId)
        });
    };

    const handleItemChange = (itemId: string, field: keyof ContactItem, value: string) => {
        setEditForm({
            ...editForm,
            items: editForm.items.map(item =>
                item.id === itemId ? { ...item, [field]: value } : item
            )
        });
    };

    const handleSave = () => {
        onSave(editForm);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="px-6 py-4 bg-primary text-white border-b border-white/10 flex justify-between items-center">
                    <h3 className="font-bold text-lg">Editar Quadro: {unitData.id}</h3>
                    <button onClick={onCancel} className="text-white hover:bg-white/20 p-1 rounded-full transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    {/* Title Edit */}
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título do Quadro</label>
                        <input
                            type="text"
                            value={editForm.title}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-primary outline-none uppercase font-bold text-primary-dark"
                        />
                    </div>

                    {/* Items List */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase">Informações de Contato</label>
                            <button
                                onClick={handleAddItem}
                                className="text-primary font-bold text-xs flex items-center gap-1 hover:bg-primary-light px-2 py-1 rounded transition-colors"
                            >
                                <span className="material-symbols-outlined text-sm">add</span>
                                Adicionar
                            </button>
                        </div>

                        {editForm.items.map((item) => (
                            <div key={item.id} className="flex gap-2 items-start bg-gray-50 p-2 rounded-lg border border-gray-200 group">
                                {/* Type Select */}
                                <div className="w-28 shrink-0">
                                    <select
                                        value={item.type}
                                        onChange={(e) => handleItemChange(item.id, 'type', e.target.value as ContactType)}
                                        className="w-full p-2 border border-gray-300 rounded text-xs focus:border-primary outline-none"
                                    >
                                        <option value="text">Texto</option>
                                        <option value="address">Endereço</option>
                                        <option value="phone">Telefone</option>
                                        <option value="whatsapp">WhatsApp</option>
                                        <option value="email">Email</option>
                                    </select>
                                </div>

                                {/* Content Inputs */}
                                <div className="flex-1 space-y-2">
                                    <input
                                        type="text"
                                        value={item.label || ''}
                                        onChange={(e) => handleItemChange(item.id, 'label', e.target.value)}
                                        placeholder="Rótulo (ex: CONSULTAS)"
                                        className="w-full p-2 border border-gray-300 rounded text-xs focus:border-primary outline-none uppercase font-bold"
                                    />
                                    <input
                                        type="text"
                                        value={item.value}
                                        onChange={(e) => handleItemChange(item.id, 'value', e.target.value)}
                                        placeholder="Valor (ex: (14) 9999-9999)"
                                        className="w-full p-2 border border-gray-300 rounded text-xs focus:border-primary outline-none"
                                    />
                                </div>

                                {/* Delete Button */}
                                <button
                                    onClick={() => handleRemoveItem(item.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                    title="Remover item"
                                >
                                    <span className="material-symbols-outlined text-lg">delete</span>
                                </button>
                            </div>
                        ))}
                        {editForm.items.length === 0 && <p className="text-xs text-gray-400 italic text-center py-2">Sem itens adicionados.</p>}
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end">
                    <button onClick={onCancel} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded-lg transition-colors text-sm">Cancelar</button>
                    <button onClick={handleSave} className="px-6 py-2 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg transition-colors shadow-sm text-sm">Salvar Alterações</button>
                </div>
            </div>
        </div>
    );
};

export default UnitEditModal;
