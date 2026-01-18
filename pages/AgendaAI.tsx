import React, { useState, useRef, useEffect } from 'react';
import { processDocumentLocally } from '../services/localDocumentService';
import { ExtractedData, DocumentAnalysisResult, Preparation } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface AgendaAIProps {
    type?: 'reschedule' | 'confirmation' | 'procedure_confirmation' | 'daily_summary';
}

const AgendaAI: React.FC<AgendaAIProps> = ({ type = 'reschedule' }) => {
    const { user, selectedFloor } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [mode, setMode] = useState<'individual' | 'batch'>('individual');

    // Preparation Management State
    const [preparations, setPreparations] = useState<Preparation[]>([]);
    const [selectedPrepId, setSelectedPrepId] = useState<string>('');
    const [showPrepModal, setShowPrepModal] = useState(false);
    const [viewingPrep, setViewingPrep] = useState<Preparation | null>(null);

    // Prep Form State
    const [newPrep, setNewPrep] = useState({ title: '', text: '' });
    const [editingPrepId, setEditingPrepId] = useState<string | null>(null);

    // Load preparations from localStorage on mount
    useEffect(() => {
        const savedPreps = localStorage.getItem('mediportal_preparations');
        if (savedPreps) {
            setPreparations(JSON.parse(savedPreps));
        } else {
            // Default mocks if empty
            const defaults: Preparation[] = [
                { id: '1', title: 'Jejum 8h', text: 'Necessário jejum absoluto de 8 horas (inclusive água).' },
                { id: '2', title: 'Bexiga Cheia', text: 'Tomar 4 copos de água 1 hora antes do exame e não urinar.' },
                { id: '3', title: 'Chegar com Antecedência', text: 'Chegar com 30 minutos de antecedência para dilatação da pupila.' }
            ];
            setPreparations(defaults);
            localStorage.setItem('mediportal_preparations', JSON.stringify(defaults));
        }
    }, []);

    // Save preparations when updated
    useEffect(() => {
        if (preparations.length > 0) {
            localStorage.setItem('mediportal_preparations', JSON.stringify(preparations));
        }
    }, [preparations]);

    // Helper to reset internal state
    const resetState = () => {
        setFile(null);
        setIndividualResult(null);
        setBatchResults([]);
        setSelectedBatchIndex(null);
        setManualForm({
            patientName: '',
            doctorName: '',
            date: '',
            time: '',
            contact: '',
            procedure: ''
        });
        setContext('');
        setProgress(0);
        setSelectedPrepId('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Reset state when type changes
    useEffect(() => {
        resetState();

        // Logic to enforce specific modes based on type
        if (type === 'procedure_confirmation') {
            setMode('individual');
        } else if (type === 'daily_summary') {
            setMode('batch');
        }
    }, [type]);

    // Helper to get user's short name (First 2 names)
    const getUserShortName = () => {
        if (!user || !user.name) return '';
        const parts = user.name.trim().split(/\s+/);
        return parts.slice(0, 2).join(' ');
    };

    const userSignatureName = getUserShortName();

    let title = '';
    switch (type) {
        case 'reschedule': title = 'Reagendamento'; break;
        case 'confirmation': title = 'Confirmar Consulta'; break;
        case 'procedure_confirmation': title = 'Confirmar Procedimento'; break;
        case 'daily_summary': title = 'Espelho Diário'; break;
    }

    // State for Individual Mode (Manual Input)
    const [manualForm, setManualForm] = useState<ExtractedData>({
        patientName: '',
        doctorName: '',
        date: '',
        time: '',
        contact: '',
        procedure: ''
    });

    const [individualResult, setIndividualResult] = useState<DocumentAnalysisResult | null>(null);
    const [batchResults, setBatchResults] = useState<DocumentAnalysisResult[]>([]);
    // Index of the currently selected patient in batch mode
    const [selectedBatchIndex, setSelectedBatchIndex] = useState<number | null>(null);

    const [context, setContext] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Check if manual form is valid
    const isManualFormValid =
        manualForm.patientName.trim() !== '' &&
        manualForm.doctorName.trim() !== '' &&
        manualForm.date.trim() !== '' &&
        manualForm.time.trim() !== '' &&
        manualForm.contact.trim() !== '' &&
        (type !== 'procedure_confirmation' || manualForm.procedure.trim() !== '');

    // Intelligent check to see if there is data to clear (more robust check)
    const hasData =
        file !== null ||
        batchResults.length > 0 ||
        individualResult !== null ||
        manualForm.patientName !== '' ||
        manualForm.doctorName !== '' ||
        manualForm.date !== '';

    const handleClear = () => {
        // Direct reset without confirmation for fluidity
        resetState();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setBatchResults([]);
            setIndividualResult(null); // Clear summary result
            setSelectedBatchIndex(null);
            setProgress(0);
        }
    };

    const handleManualInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setManualForm(prev => ({ ...prev, [name]: value }));
    };

    // --- PREPARATION HANDLERS ---

    const handleSavePreparation = () => {
        if (!newPrep.title.trim() || !newPrep.text.trim()) return;

        if (editingPrepId) {
            // Update existing
            setPreparations(prev => prev.map(p =>
                p.id === editingPrepId ? { ...p, title: newPrep.title, text: newPrep.text } : p
            ));
            setEditingPrepId(null);
        } else {
            // Create new
            const newItem: Preparation = {
                id: Date.now().toString(),
                title: newPrep.title,
                text: newPrep.text
            };
            setPreparations([...preparations, newItem]);
            // Auto select the new one
            setSelectedPrepId(newItem.id);
        }
        // Reset form
        setNewPrep({ title: '', text: '' });
    };

    const handleEditPreparation = (prep: Preparation) => {
        setNewPrep({ title: prep.title, text: prep.text });
        setEditingPrepId(prep.id);
    };

    const handleCancelEditPrep = () => {
        setNewPrep({ title: '', text: '' });
        setEditingPrepId(null);
    };

    const handleDeletePreparation = (id: string) => {
        if (window.confirm('Tem certeza que deseja excluir este preparo?')) {
            setPreparations(preparations.filter(p => p.id !== id));
            if (selectedPrepId === id) setSelectedPrepId('');
            if (editingPrepId === id) handleCancelEditPrep();
        }
    };

    // --- GENERATION LOGIC ---

    const generateManualMessage = () => {
        // Only used for individual mode types, not daily summary
        setLoading(true);
        setTimeout(() => {
            // Formatar Data (YYYY-MM-DD -> DD/MM/YYYY)
            const dateObj = manualForm.date ? manualForm.date.split('-').reverse().join('/') : manualForm.date;

            // Automatizar Dr./Dra.
            let formattedDoctor = manualForm.doctorName.trim();
            // Verifica se já não tem prefixo
            if (!/^(dr|dra|dr\.|dra\.)/i.test(formattedDoctor)) {
                const firstWord = formattedDoctor.split(' ')[0];
                // Se terminar em 'a' (ex: Ana, Maria), assume Dra., senão Dr.
                const prefix = firstWord.slice(-1).toLowerCase() === 'a' ? 'Dra.' : 'Dr.';
                formattedDoctor = `${prefix} ${formattedDoctor}`;
            }

            let message = '';
            let prepText = '';
            if (selectedPrepId) {
                const prep = preparations.find(p => p.id === selectedPrepId);
                if (prep) {
                    prepText = `\n📝 *Preparo Necessário:*\n${prep.text}\n`;
                }
            }

            // Automatic signature logic
            // Requested change: Remove "Atendimento Unimed" if user name is present.
            const signature = userSignatureName
                ? `Atenciosamente,\n${userSignatureName}`
                : `Atenciosamente,\nAtendimento Unimed`;

            // User Request: Use only the FIRST name for patient
            const displayPatientName = manualForm.patientName.trim().split(/\s+/)[0] || manualForm.patientName;

            if (type === 'reschedule') {
                message = `Olá, ${displayPatientName}, este contato refere-se à sua consulta no Centro de Diagnóstico Unimed (CDU), ${selectedFloor}. Tentamos o contato telefônico, mas não conseguimos falar com você.
 
 Devido a um imprevisto na agenda do médico, sua consulta com o(a) ${formattedDoctor} precisou ser remarcada.
 
 ✅ Novo Agendamento: 
 📅 Data: ${dateObj} 
 ⏰ Hora: ${manualForm.time}${prepText}
 ⚠️ Importante: Apresentar Documento com foto e Carteirinha da Unimed.
 
 ❌ Caso não seja possível a nova data agendada, por favor, entre em contato através da Central de Agendamento: 
 
 📞 Telefone: (14) 3235-3350 
 📱 WhatsApp: (14) 99648-4958
 
 Pedimos desculpas pelo transtorno e agradecemos a compreensão.
 
 ${signature}`;
            } else if (type === 'procedure_confirmation') {
                // Requested change: Move "Podemos confirmar?" to the end (before signature)
                message = `Olá, ${displayPatientName}, este contato é para confirmar seu agendamento no Centro de Diagnóstico Unimed (CDU), ${selectedFloor}, referente ao procedimento/Exame de *${manualForm.procedure}*.
 
 🩺 ${formattedDoctor}
 📅 Data: ${dateObj}
 ⏰ Hora: ${manualForm.time}${prepText}
 ⚠️ Importante: Apresentar Documento com foto e Carteirinha da Unimed.
 
 Em caso de dúvidas ou necessidade de reagendar, entre em contato através da Central de Agendamento: (14) 3235-3350 ou WhatsApp (14) 99648-4958.
 
 Podemos confirmar?
 
 ${signature}`;
            } else {
                // Confirmation Type
                // Requested change: Move "Podemos confirmar?" to the end (before signature)
                message = `Olá, ${displayPatientName}, este contato refere-se à sua consulta no Centro de Diagnóstico Unimed (CDU), ${selectedFloor}.
 
 🩺 ${formattedDoctor}
 📅 Data: ${dateObj}
 ⏰ Hora: ${manualForm.time}${prepText}
 ⚠️ Importante: Apresentar Documento com foto e Carteirinha da Unimed.
 
 Em caso de dúvidas ou necessidade de reagendar, entre em contato através da Central de Agendamento: (14) 3235-3350 ou WhatsApp (14) 99648-4958.
 
 Podemos confirmar?
 
 ${signature}`;
            }

            setIndividualResult({
                extractedData: { ...manualForm },
                generatedMessage: message
            });
            setLoading(false);
        }, 400);
    };

    const convertToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                let encoded = reader.result?.toString().replace(/^data:(.*,)?/, '');
                if (encoded) {
                    if ((encoded.length % 4) > 0) {
                        encoded += '='.repeat(4 - (encoded.length % 4));
                    }
                    resolve(encoded);
                } else {
                    reject("Error encoding file");
                }
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const handleBatchAnalyze = async () => {
        if (!file) return;

        setLoading(true);
        setBatchResults([]);
        setIndividualResult(null);
        setSelectedBatchIndex(null);
        setProgress(0);

        const progressInterval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 90) return prev;
                return prev + Math.floor(Math.random() * 10);
            });
        }, 300); // Faster progress for local

        try {
            let prepText = '';
            if (selectedPrepId) {
                const prep = preparations.find(p => p.id === selectedPrepId);
                if (prep) prepText = prep.text;
            }

            // Cast type
            const serviceType = (type === 'procedure_confirmation' ? 'confirmation' : type) as 'reschedule' | 'confirmation' | 'daily_summary' | 'procedure_confirmation';

            // Use Local Service with File Object
            const result = await processDocumentLocally(file, serviceType, prepText, userSignatureName, selectedFloor);

            clearInterval(progressInterval);
            setProgress(100);

            setTimeout(() => {
                if (type === 'daily_summary') {
                    if (!Array.isArray(result)) {
                        setIndividualResult(result as DocumentAnalysisResult);
                    } else if (result.length > 0) {
                        setIndividualResult(result[0]);
                    }
                } else {
                    if (Array.isArray(result)) {
                        setBatchResults(result);
                        if (result.length > 0) setSelectedBatchIndex(0);
                    }
                }
                setLoading(false);
            }, 500);

        } catch (error: any) {
            console.error(error);
            clearInterval(progressInterval);
            setLoading(false);
            setProgress(0);
            alert(`Erro ao processar arquivo: ${error.message || 'Erro desconhecido'}`);
        }
    };

    const handleIndividualMessageChange = (text: string) => {
        if (individualResult) {
            setIndividualResult({ ...individualResult, generatedMessage: text });
        }
    };

    const handleBatchMessageChange = (text: string) => {
        if (selectedBatchIndex !== null && batchResults[selectedBatchIndex]) {
            const newResults = [...batchResults];
            newResults[selectedBatchIndex] = {
                ...newResults[selectedBatchIndex],
                generatedMessage: text
            };
            setBatchResults(newResults);
        }
    };

    const copyToClipboard = (text: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        navigator.clipboard.writeText(text);
    };

    // Helper to get the active result/data regardless of mode for the editor view
    // For Daily Summary, we always look at individualResult (since it's a single summary)
    const activeResult = type === 'daily_summary'
        ? individualResult
        : (mode === 'individual' ? individualResult : (selectedBatchIndex !== null ? batchResults[selectedBatchIndex] : null));

    const sendToWhatsapp = () => {
        if (activeResult) {
            const phoneRaw = activeResult.extractedData.contact.replace(/\D/g, '');
            const phone = phoneRaw.length >= 10 ? `55${phoneRaw}` : '';

            const url = phone
                ? `https://wa.me/${phone}?text=${encodeURIComponent(activeResult.generatedMessage)}`
                : `https://wa.me/?text=${encodeURIComponent(activeResult.generatedMessage)}`;

            window.open(url, '_blank');
        }
    };

    const sendAllBatchToWhatsapp = () => {
        if (batchResults.length === 0) return;

        const confirmed = window.confirm(
            `Atenção: Esta ação tentará abrir ${batchResults.length} abas do WhatsApp Web sequencialmente.\n\n` +
            `Certifique-se de que os bloqueadores de popup estejam desativados para este site.\n\nDeseja continuar?`
        );

        if (!confirmed) return;

        batchResults.forEach((result, index) => {
            setTimeout(() => {
                const phoneRaw = result.extractedData.contact.replace(/\D/g, '');
                const phone = phoneRaw.length >= 10 ? `55${phoneRaw}` : '';
                const text = encodeURIComponent(result.generatedMessage);
                const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
                window.open(url, '_blank');
            }, index * 1500);
        });
    };

    return (
        <div className="flex flex-col h-full relative">
            <div className="mb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 leading-tight">{title}</h2>
                    <p className="text-gray-500 text-sm">
                        {type === 'daily_summary'
                            ? 'Geração automática de resumo estatístico da agenda.'
                            : (mode === 'individual' ? 'Preencha os dados manualmente.' : 'Geração automática via arquivo.')
                        }
                    </p>
                </div>

                {/* Mode Toggles - HIDE for Procedure Confirmation AND Daily Summary */}
                {type !== 'procedure_confirmation' && type !== 'daily_summary' && (
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => { setMode('individual'); resetState(); }}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${mode === 'individual' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                            disabled={loading}
                        >
                            Manual
                        </button>
                        <button
                            onClick={() => { setMode('batch'); resetState(); }}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${mode === 'batch' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                            disabled={loading}
                        >
                            PDF em Lote
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                {/* Left Column: Input & Actions (3 cols) */}
                <div className="lg:col-span-3 flex flex-col gap-4">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 h-fit relative">

                        {/* Header with Clear Button */}
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-50">
                            <h3 className="font-bold text-gray-700 text-sm">
                                {mode === 'individual' ? 'Dados da Entrada' : (type === 'daily_summary' ? 'Arquivo de Agenda' : 'Arquivo de Fonte')}
                            </h3>
                            {hasData && !loading && (
                                <button
                                    onClick={handleClear}
                                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1 rounded transition-all flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide"
                                    title="Limpar e começar de novo"
                                >
                                    <span className="material-symbols-outlined text-base">delete_sweep</span>
                                    Limpar
                                </button>
                            )}
                        </div>

                        {/* --- INDIVIDUAL MODE --- */}
                        {mode === 'individual' && type !== 'daily_summary' && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-300">
                                {/* Compact Inputs (Existing Logic) */}
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Nome do Paciente *</label>
                                    <input
                                        type="text"
                                        name="patientName"
                                        value={manualForm.patientName}
                                        onChange={handleManualInputChange}
                                        className="w-full p-2.5 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:border-primary outline-none"
                                        placeholder="Nome completo"
                                    />
                                </div>

                                {type === 'procedure_confirmation' && (
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Procedimento / Exame *</label>
                                        <input
                                            type="text"
                                            name="procedure"
                                            value={manualForm.procedure}
                                            onChange={handleManualInputChange}
                                            className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:border-primary outline-none"
                                            placeholder="Ex: Campimetria"
                                        />
                                    </div>
                                )}

                                <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase">Instruções de Preparo</label>
                                        <button
                                            onClick={() => setShowPrepModal(true)}
                                            className="text-[10px] text-primary font-bold hover:underline flex items-center gap-1"
                                        >
                                            <span className="material-symbols-outlined text-xs">settings</span>
                                            Gerenciar
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <select
                                            value={selectedPrepId}
                                            onChange={(e) => setSelectedPrepId(e.target.value)}
                                            className={`w-full p-2.5 border rounded-lg text-sm outline-none appearance-none ${selectedPrepId ? 'bg-green-50 border-green-300 text-green-800' : 'bg-white border-gray-200 text-gray-500'
                                                }`}
                                        >
                                            <option value="">Nenhum preparo selecionado</option>
                                            {preparations.map(p => (
                                                <option key={p.id} value={p.id}>{p.title}</option>
                                            ))}
                                        </select>
                                        <span className="material-symbols-outlined absolute right-2 top-2.5 text-gray-400 pointer-events-none text-lg">
                                            keyboard_arrow_down
                                        </span>
                                    </div>
                                    {selectedPrepId && (
                                        <div className="mt-1 text-[10px] text-gray-500 italic truncate pl-1">
                                            "{preparations.find(p => p.id === selectedPrepId)?.text}"
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Contato *</label>
                                    <input
                                        type="text"
                                        name="contact"
                                        value={manualForm.contact}
                                        onChange={handleManualInputChange}
                                        className="w-full p-2.5 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:border-primary outline-none"
                                        placeholder="(XX) XXXXX-XXXX"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Data *</label>
                                        <input
                                            type="date"
                                            name="date"
                                            value={manualForm.date}
                                            onChange={handleManualInputChange}
                                            className="w-full p-2.5 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:border-primary outline-none text-gray-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Hora *</label>
                                        <input
                                            type="time"
                                            name="time"
                                            value={manualForm.time}
                                            onChange={handleManualInputChange}
                                            className="w-full p-2.5 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:border-primary outline-none text-gray-600"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Médico *</label>
                                    <input
                                        type="text"
                                        name="doctorName"
                                        value={manualForm.doctorName}
                                        onChange={handleManualInputChange}
                                        className="w-full p-2.5 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:border-primary outline-none"
                                        placeholder="Ex: Ricardo Silva (auto: Dr.)"
                                    />
                                </div>

                                <div className="pt-2">
                                    <button
                                        onClick={generateManualMessage}
                                        disabled={!isManualFormValid || loading}
                                        className={`w-full py-2.5 font-bold text-sm text-white transition-all flex items-center justify-center gap-2 rounded-lg ${!isManualFormValid || loading
                                            ? 'bg-gray-300 cursor-not-allowed'
                                            : 'bg-primary hover:bg-primary-dark'
                                            }`}
                                    >
                                        {loading ? 'Gerando...' : 'Gerar Mensagem'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* --- BATCH MODE (OR DAILY SUMMARY) --- */}
                        {mode === 'batch' && type !== 'procedure_confirmation' && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col gap-4">
                                {/* Upload Box */}
                                <div
                                    className={`relative border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${file
                                        ? 'border-primary bg-primary-light/20'
                                        : 'border-gray-300 hover:border-primary hover:bg-gray-50'
                                        }`}
                                    onClick={() => !loading && fileInputRef.current?.click()}
                                >
                                    <input
                                        type="file"
                                        accept="application/pdf,image/*"
                                        className="hidden"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        disabled={loading}
                                    />

                                    <span className={`material-symbols-outlined text-3xl mb-1 ${file ? 'text-primary' : 'text-gray-400'}`}>
                                        {file ? 'description' : 'cloud_upload'}
                                    </span>

                                    {file ? (
                                        <div>
                                            <p className="font-bold text-xs text-primary truncate max-w-[150px]">{file.name}</p>
                                            <p className="text-[10px] text-gray-400 mt-1">Clique para trocar</p>
                                        </div>
                                    ) : (
                                        <p className="text-xs font-medium text-gray-500">
                                            {type === 'daily_summary' ? 'Dia do Prestador - PDF' : 'Selecionar Arquivo'}
                                        </p>
                                    )}
                                </div>

                                {/* Prep and Context - Hidden for Daily Summary as it's just stats */}
                                {type !== 'daily_summary' && (
                                    <>
                                        <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase">Instruções de Preparo (Opcional)</label>
                                                <button
                                                    onClick={() => setShowPrepModal(true)}
                                                    className="text-[10px] text-primary font-bold hover:underline flex items-center gap-1"
                                                >
                                                    <span className="material-symbols-outlined text-xs">settings</span>
                                                    Gerenciar
                                                </button>
                                            </div>
                                            <div className="relative">
                                                <select
                                                    value={selectedPrepId}
                                                    onChange={(e) => setSelectedPrepId(e.target.value)}
                                                    className={`w-full p-2.5 border rounded-lg text-sm outline-none appearance-none ${selectedPrepId ? 'bg-green-50 border-green-300 text-green-800' : 'bg-white border-gray-200 text-gray-500'
                                                        }`}
                                                    disabled={loading}
                                                >
                                                    <option value="">Nenhum preparo selecionado</option>
                                                    {preparations.map(p => (
                                                        <option key={p.id} value={p.id}>{p.title}</option>
                                                    ))}
                                                </select>
                                                <span className="material-symbols-outlined absolute right-2 top-2.5 text-gray-400 pointer-events-none text-lg">
                                                    keyboard_arrow_down
                                                </span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Instrução Adicional (Opcional)</label>
                                            <textarea
                                                value={context}
                                                onChange={(e) => setContext(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-100 rounded-lg p-2 text-xs focus:border-primary outline-none resize-none"
                                                placeholder="Ex: Mencionar feriado..."
                                                rows={2}
                                                disabled={loading}
                                            ></textarea>
                                        </div>
                                    </>
                                )}

                                {/* Context for Daily Summary only */}
                                {type === 'daily_summary' && (
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Observações (Opcional)</label>
                                        <textarea
                                            value={context}
                                            onChange={(e) => setContext(e.target.value)}
                                            className="w-full bg-gray-50 border border-gray-100 rounded-lg p-2 text-xs focus:border-primary outline-none resize-none"
                                            placeholder="Ex: Pular médico X..."
                                            rows={2}
                                            disabled={loading}
                                        ></textarea>
                                    </div>
                                )}

                                {/* Generate Button */}
                                <div className="relative rounded-lg overflow-hidden">
                                    <button
                                        onClick={handleBatchAnalyze}
                                        disabled={!file || loading}
                                        className={`relative w-full py-2.5 font-bold text-sm text-white transition-all flex items-center justify-center gap-2 z-10 rounded-lg ${!file ? 'bg-gray-300 cursor-not-allowed' : 'bg-secondary hover:bg-gray-700'
                                            }`}
                                    >
                                        {loading ? (
                                            <span>{progress < 100 ? `${progress}%` : 'Finalizando...'}</span>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined text-lg">auto_awesome_motion</span>
                                                {type === 'daily_summary' ? 'Gerar Resumo' : 'Gerar em Lote'}
                                            </>
                                        )}
                                    </button>
                                    {loading && (
                                        <div
                                            className="absolute top-0 left-0 h-full bg-secondary opacity-80 z-0"
                                            style={{ width: `${progress}%` }}
                                        ></div>
                                    )}
                                </div>

                                {/* SEND BUTTONS - Hidden for Daily Summary */}
                                {type !== 'daily_summary' && batchResults.length > 0 && selectedBatchIndex !== null && (
                                    <div className="pt-2 border-t border-gray-100 mt-1 animate-in slide-in-from-top-2 fade-in">
                                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-1 text-center">Ações para Lote</p>
                                        <button
                                            onClick={sendToWhatsapp}
                                            className="w-full py-3 font-bold text-sm text-white bg-[#25D366] hover:bg-[#20bd5a] transition-all flex items-center justify-center gap-2 rounded-lg shadow-sm hover:shadow-md hover:-translate-y-0.5"
                                        >
                                            <span className="material-symbols-outlined">send</span>
                                            <span>Enviar para {activeResult?.extractedData.patientName.split(' ')[0]}</span>
                                        </button>

                                        <button
                                            onClick={sendAllBatchToWhatsapp}
                                            className="w-full mt-2 py-3 font-bold text-sm text-primary border border-primary bg-primary-light/30 hover:bg-primary-light transition-all flex items-center justify-center gap-2 rounded-lg"
                                        >
                                            <span className="material-symbols-outlined">send_to_mobile</span>
                                            <span>Enviar Todas ({batchResults.length})</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Output (9 cols) */}
                <div className="lg:col-span-9 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-140px)] no-scrollbar pb-4">

                    {/* --- DAILY SUMMARY VIEW (Special case) --- */}
                    {type === 'daily_summary' && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full flex flex-col animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">summarize</span>
                                    Resumo do Dia
                                </h3>
                                {activeResult && (
                                    <button
                                        onClick={() => copyToClipboard(activeResult.generatedMessage)}
                                        className="text-gray-400 hover:text-primary text-xs flex items-center gap-1"
                                    >
                                        <span className="material-symbols-outlined text-sm">content_copy</span>
                                        Copiar Texto
                                    </button>
                                )}
                            </div>

                            <div className="flex-1 bg-gray-50 rounded-lg border border-gray-200 p-4 relative">
                                {activeResult ? (
                                    <textarea
                                        className="w-full h-full bg-transparent border-none resize-none outline-none text-gray-800 leading-relaxed font-sans text-sm"
                                        value={activeResult.generatedMessage}
                                        onChange={(e) => handleIndividualMessageChange(e.target.value)}
                                    />
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                                        <span className="material-symbols-outlined text-3xl mb-2 opacity-50">description</span>
                                        <p>Carregue o PDF do "Dia do Prestador" para gerar o resumo aqui.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- BATCH MODE: TAGS GRID & PREVIEW --- */}
                    {mode === 'batch' && type !== 'daily_summary' && (
                        <div className="flex flex-col gap-4 h-full">
                            {/* Tags Container */}
                            {batchResults.length > 0 ? (
                                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                                            <span className="material-symbols-outlined text-primary text-lg">checklist</span>
                                            Pacientes Identificados ({batchResults.length})
                                        </h3>
                                        <span className="text-xs text-gray-400">Selecione para conferir</span>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                        {batchResults.map((result, index) => (
                                            <button
                                                key={index}
                                                onClick={() => setSelectedBatchIndex(index)}
                                                className={`
                                            relative px-3 py-2.5 rounded-lg border text-left transition-all group
                                            ${selectedBatchIndex === index
                                                        ? 'bg-primary border-primary text-white shadow-md transform scale-105 z-10'
                                                        : 'bg-white border-gray-100 text-gray-600 hover:border-primary hover:text-primary hover:shadow-sm'
                                                    }
                                        `}
                                            >
                                                <div className="font-bold text-xs truncate w-full flex justify-between items-center gap-2">
                                                    <span className="truncate">{result.extractedData.patientName || `Paciente ${index + 1}`}</span>
                                                    {result.extractedData.contact && (
                                                        <span className={`text-[9px] font-bold px-1.5 rounded-full shrink-0 ${selectedBatchIndex === index ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                                            {result.extractedData.contact.split('/')[0].trim().replace(/\D/g, '').slice(-11).replace(/(\d{2})(\d)/, '($1) $2')}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className={`text-[10px] mt-0.5 truncate flex items-center gap-1 ${selectedBatchIndex === index ? 'text-green-100' : 'text-gray-400'}`}>
                                                    <span className="material-symbols-outlined text-[10px]">schedule</span>
                                                    {result.extractedData.time}
                                                    <span className="mx-1">•</span>
                                                    <span className="truncate">{result.extractedData.doctorName.split(' ').slice(0, 2).join(' ')}</span>
                                                </div>

                                                {/* Action Buttons Overlay */}
                                                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            copyToClipboard(result.extractedData.contact.replace(/\D/g, ''));
                                                        }}
                                                        className={`p-1 rounded hover:bg-black/10 transition-colors ${selectedBatchIndex === index ? 'text-white' : 'text-gray-400'}`}
                                                        title="Copiar Celular"
                                                    >
                                                        <span className="material-symbols-outlined text-[12px]">phone_iphone</span>
                                                    </button>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : !loading && (
                                /* Empty State */
                                <div className="h-64 flex flex-col items-center justify-center text-center bg-white rounded-xl border border-dashed border-gray-300">
                                    <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">grid_view</span>
                                    <p className="text-gray-500 text-sm font-medium">Os pacientes aparecerão aqui como etiquetas.</p>
                                </div>
                            )}

                            {/* Message Preview Area (Clean View for Batch) */}
                            {selectedBatchIndex !== null && activeResult && (
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-1 animate-in fade-in slide-in-from-bottom-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-bold text-gray-800 text-sm">Conferência da Mensagem</h3>
                                        <button
                                            onClick={() => copyToClipboard(activeResult.generatedMessage)}
                                            className="text-gray-400 hover:text-primary text-xs flex items-center gap-1"
                                        >
                                            <span className="material-symbols-outlined text-sm">content_copy</span>
                                            Copiar
                                        </button>
                                    </div>
                                    <textarea
                                        className="w-full h-full min-h-[200px] bg-gray-50 rounded-lg p-4 border-none resize-none outline-none text-gray-700 text-sm leading-relaxed focus:ring-1 focus:ring-primary/20 transition-all"
                                        value={activeResult.generatedMessage}
                                        onChange={(e) => handleBatchMessageChange(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- INDIVIDUAL MODE: FULL PREVIEW --- */}
                    {mode === 'individual' && type !== 'daily_summary' && (
                        <>
                            {/* Generated Message Editor - Takes full height now */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full flex flex-col animate-in fade-in slide-in-from-bottom-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[#25D366]">chat</span>
                                        Mensagem Gerada
                                    </h3>
                                    {activeResult && (
                                        <button
                                            onClick={() => copyToClipboard(activeResult.generatedMessage)}
                                            className="text-gray-400 hover:text-primary text-xs flex items-center gap-1"
                                        >
                                            <span className="material-symbols-outlined text-sm">content_copy</span>
                                            Copiar
                                        </button>
                                    )}
                                </div>

                                <div className="flex-1 bg-gray-50 rounded-lg border border-gray-200 p-4 relative">
                                    {activeResult ? (
                                        <textarea
                                            className="w-full h-full bg-transparent border-none resize-none outline-none text-gray-800 leading-relaxed font-sans text-sm"
                                            value={activeResult.generatedMessage}
                                            onChange={(e) => handleIndividualMessageChange(e.target.value)}
                                        />
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                                            <span className="material-symbols-outlined text-3xl mb-2 opacity-50">edit_square</span>
                                            <p>Preencha os dados à esquerda para gerar a mensagem aqui.</p>
                                        </div>
                                    )}
                                </div>

                                {/* NEW FOOTER HERE */}
                                {activeResult && (
                                    <div className="mt-4 grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-bottom-2">
                                        <button
                                            onClick={() => copyToClipboard(activeResult.generatedMessage)}
                                            className="py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
                                        >
                                            <span className="material-symbols-outlined">content_copy</span>
                                            Copiar Texto
                                        </button>
                                        <button
                                            onClick={sendToWhatsapp}
                                            className="py-3 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
                                        >
                                            <span className="material-symbols-outlined">send</span>
                                            WhatsApp
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Preparation Management Modal - EXPANDED & IMPROVED */}
            {showPrepModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden h-[80vh] flex flex-col relative">

                        {/* Nested View Modal Overlay */}
                        {viewingPrep && (
                            <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur flex flex-col p-8 animate-in fade-in duration-200">
                                <div className="flex justify-between items-start mb-6 border-b border-gray-100 pb-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900">{viewingPrep.title}</h3>
                                        <p className="text-xs text-gray-500 font-bold uppercase mt-1">Conteúdo Completo do Preparo</p>
                                    </div>
                                    <button
                                        onClick={() => setViewingPrep(null)}
                                        className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-2xl">close</span>
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 rounded-xl border border-gray-200 shadow-inner">
                                    <p className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-medium">
                                        {viewingPrep.text}
                                    </p>
                                </div>
                                <div className="mt-6 flex justify-end">
                                    <button
                                        onClick={() => setViewingPrep(null)}
                                        className="px-6 py-2.5 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-900 transition-colors"
                                    >
                                        Fechar Visualização
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-primary text-white shrink-0">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <span className="material-symbols-outlined">medical_information</span>
                                Gerenciar Preparos
                            </h3>
                            <button onClick={() => { setShowPrepModal(false); handleCancelEditPrep(); }} className="hover:bg-white/20 rounded-full p-1 transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                            {/* Left: Editor Column */}
                            <div className="md:w-1/2 p-6 overflow-y-auto border-r border-gray-100 bg-gray-50">
                                <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-base">{editingPrepId ? 'edit' : 'add_circle'}</span>
                                    {editingPrepId ? 'Editar Preparo' : 'Novo Preparo'}
                                </h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Título</label>
                                        <input
                                            type="text"
                                            placeholder="Ex: Jejum 8h"
                                            value={newPrep.title}
                                            onChange={(e) => setNewPrep({ ...newPrep, title: e.target.value })}
                                            className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:border-primary outline-none bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Instruções</label>
                                        <textarea
                                            placeholder="Digite as instruções completas aqui..."
                                            value={newPrep.text}
                                            onChange={(e) => setNewPrep({ ...newPrep, text: e.target.value })}
                                            className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:border-primary outline-none resize-none h-40 bg-white leading-relaxed"
                                        />
                                        <p className="text-[10px] text-gray-400 mt-1 text-right">Quebras de linha serão respeitadas.</p>
                                    </div>

                                    <div className="flex gap-2">
                                        {editingPrepId && (
                                            <button
                                                onClick={handleCancelEditPrep}
                                                className="flex-1 py-2.5 bg-gray-200 text-gray-600 rounded-lg font-bold text-sm hover:bg-gray-300 transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                        )}
                                        <button
                                            onClick={handleSavePreparation}
                                            disabled={!newPrep.title.trim() || !newPrep.text.trim()}
                                            className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-colors shadow-sm flex items-center justify-center gap-2 ${newPrep.title.trim() && newPrep.text.trim()
                                                ? (editingPrepId ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-primary text-white hover:bg-primary-dark')
                                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                }`}
                                        >
                                            <span className="material-symbols-outlined text-base">{editingPrepId ? 'save' : 'add'}</span>
                                            {editingPrepId ? 'Salvar Alterações' : 'Adicionar'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Right: List Column */}
                            <div className="md:w-1/2 p-6 overflow-y-auto">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-sm font-bold text-gray-700">Preparos Cadastrados ({preparations.length})</h4>
                                </div>

                                <div className="space-y-3">
                                    {preparations.length === 0 ? (
                                        <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-100 rounded-lg">
                                            <span className="material-symbols-outlined text-3xl mb-2 opacity-30">playlist_add</span>
                                            <p className="text-sm">Nenhum preparo cadastrado.</p>
                                        </div>
                                    ) : (
                                        preparations.map(prep => (
                                            <div
                                                key={prep.id}
                                                className={`flex items-center justify-between p-3 border rounded-lg transition-all group ${editingPrepId === prep.id
                                                    ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-300'
                                                    : 'border-gray-200 hover:border-primary/50 hover:shadow-sm bg-white'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${editingPrepId === prep.id ? 'bg-blue-200 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        <span className="material-symbols-outlined text-lg">format_list_bulleted</span>
                                                    </div>
                                                    <span className="font-bold text-sm text-gray-800 truncate">
                                                        {prep.title}
                                                    </span>
                                                </div>

                                                <div className="flex gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => setViewingPrep(prep)}
                                                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                                        title="Ver conteúdo"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">visibility</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleEditPreparation(prep)}
                                                        className={`p-1.5 rounded transition-colors ${editingPrepId === prep.id
                                                            ? 'text-blue-600 bg-blue-100'
                                                            : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                                                            }`}
                                                        title="Editar"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeletePreparation(prep.id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                        title="Excluir"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">delete</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgendaAI;