import React, { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus, Priority, Doctor } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '../services/supabase';

const mockDoctors: Doctor[] = [
    { id: 'd1', name: 'Dr. Ricardo Silva', specialty: 'Cardiologia', phone: '(14) 99881-0001', avatar: '', color: '', status: 'active' },
    { id: 'd2', name: 'Dra. Ana Souza', specialty: 'Pediatria', phone: '(14) 99881-0002', avatar: '', color: '', status: 'active' },
    { id: 'd3', name: 'Dr. Paulo Mendes', specialty: 'Ultrassom', phone: '(14) 99881-0003', avatar: '', color: '', status: 'vacation' },
];

const mockTasks: Task[] = [
    {
        id: '1',
        title: 'Documentação Pendente',
        description: 'Favor conferir a documentação do paciente João Silva para o exame de amanhã.',
        isPatientRelated: true,
        patient: 'João Silva',
        patientCard: '0032.1123.4432.00',
        patientPhone: '(14) 99887-7766',
        taskType: 'message',
        date: '2023-10-27'
    },
    {
        id: '2',
        title: 'Aviso de Reunião',
        description: 'Reunião extraordinária no setor às 15h.',
        isPatientRelated: false,
        taskType: 'message',
        date: '2023-10-28'
    }
];

const RichTextEditor = ({ value, onChange, placeholder }: { value: string, onChange: (v: string) => void, placeholder?: string }) => {
    const editorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value || '';
        }
    }, [value]);

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const format = (command: string, e: React.MouseEvent) => {
        e.preventDefault();
        document.execCommand(command, false, '');
        if (editorRef.current) {
            editorRef.current.focus();
            onChange(editorRef.current.innerHTML);
        }
    };

    return (
        <div className="border border-gray-300 rounded-xl overflow-hidden focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all shadow-sm bg-white relative">
            <div className="bg-gray-50 border-b border-gray-200 p-2 flex flex-wrap gap-1">
                <button type="button" onMouseDown={(e) => format('bold', e)} className="p-1 rounded hover:bg-gray-200 text-gray-700 font-bold w-7 text-center" title="Negrito">B</button>
                <button type="button" onMouseDown={(e) => format('italic', e)} className="p-1 rounded hover:bg-gray-200 text-gray-700 italic w-7 text-center" title="Itálico">I</button>
                <button type="button" onMouseDown={(e) => format('underline', e)} className="p-1 rounded hover:bg-gray-200 text-gray-700 underline w-7 text-center" title="Sublinhado">U</button>
                <div className="w-[1px] h-5 bg-gray-300 mx-1 my-auto"></div>
                <button type="button" onMouseDown={(e) => format('insertUnorderedList', e)} className="p-1 rounded hover:bg-gray-200 text-gray-700 flex items-center justify-center w-7" title="Lista Simples">
                    <span className="material-symbols-outlined text-[16px]">format_list_bulleted</span>
                </button>
                <button type="button" onMouseDown={(e) => format('insertOrderedList', e)} className="p-1 rounded hover:bg-gray-200 text-gray-700 flex items-center justify-center w-7" title="Lista Numerada">
                    <span className="material-symbols-outlined text-[16px]">format_list_numbered</span>
                </button>
            </div>
            <div
                ref={editorRef}
                contentEditable
                className="w-full p-3 outline-none text-sm min-h-[120px] max-h-[300px] overflow-y-auto"
                onInput={handleInput}
                onBlur={handleInput}
            />
            {(!value || value === '<br>') && (
                <div className="absolute pointer-events-none text-gray-400 text-sm p-3 top-[40px] left-0">
                    {placeholder}
                </div>
            )}
        </div>
    );
};

const Tasks: React.FC = () => {
    const { user, selectedFloor, getFormattedDisplayName } = useAuth();

    // Helper to replace [MEU_NOME] placeholder with current display name
    const replacePlaceholders = (text: string) => {
        if (!text) return text;
        const currentName = getFormattedDisplayName();
        return text.replace(/\[MEU_NOME\]/g, currentName);
    };
    const [tasks, setTasks] = useState<Task[]>(() => {
        const saved = localStorage.getItem('mediportal_tasks');
        return saved ? JSON.parse(saved) : mockTasks;
    });

    const [selectedForBatch, setSelectedForBatch] = useState<string[]>([]);
    
    // PRINT REFS & HANDLERS
    const printableRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: printableRef,
        documentTitle: 'Recado_Unimed',
    });

    const batchPrintableRef = useRef<HTMLDivElement>(null);
    const handleBatchPrint = useReactToPrint({
        contentRef: batchPrintableRef,
        documentTitle: 'Recados_Lote_Unimed',
    });

    const toggleBatchSelect = (taskId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedForBatch(prev => 
            prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
        );
    };

    useEffect(() => {
        localStorage.setItem('mediportal_tasks', JSON.stringify(tasks));
    }, [tasks]);
    const [doctors, setDoctors] = useState<Doctor[]>(mockDoctors);
    const [searchProfessional, setSearchProfessional] = useState('');
    const [showProfessionalResults, setShowProfessionalResults] = useState(false);

    useEffect(() => {
        const fetchDoctors = async () => {
            try {
                // Fetch all doctors
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('role', 'doctor');

                if (error) throw error;
                if (data) {
                    const mapped: Doctor[] = data
                        .map((p: any) => {
                            const parts = (p.specialty || '').split(' | ');
                            return {
                                id: p.id,
                                name: p.name || 'Sem Nome',
                                specialty: (parts[0] || 'Geral').trim(),
                                sector: (parts[1] || '').trim(), // Extract sector from specialty field
                                phone: p.phone || '',
                                avatar: p.avatar || '',
                                status: p.status || 'active',
                                color: '',
                                gender: p.gender
                            };
                        })
                        // Filter doctors to show only those assigned to the current selected floor
                        .filter(doc => !doc.sector || doc.sector === selectedFloor);

                    setDoctors(mapped);
                }
            } catch (err) {
                console.error('Error fetching doctors:', err);
            }
        };
        fetchDoctors();
    }, [selectedFloor]);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create'>('create');
    const [currentTask, setCurrentTask] = useState<Task | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<Task>>({
        title: '',
        description: '',
        isPatientRelated: false,
        patient: '',
        patientCard: '',
        patientGuide: '',
        patientPhone: '',
        date: new Date().toISOString().split('T')[0],
        taskType: 'message',
        messageType: 'Receita',
        authorName: '',
        recipientId: '',
        recipientName: '',
        sector: selectedFloor // Default to current selected floor
    });

    // Filter Logic - Only Recados
    const filteredTasks = tasks.filter(task => {
        if (task.sector && task.sector !== selectedFloor) return false;
        return task.taskType === 'message';
    });

    // Handlers
    const handleOpenModal = (mode: 'view' | 'edit' | 'create', task?: Task) => {
        setModalMode(mode);
        if (task) {
            setCurrentTask(task);
            setFormData({ ...task });
        } else {
            setCurrentTask(null);
            // Reset form for create
            setFormData({
                title: '',
                description: '',
                isPatientRelated: false,
                patient: '',
                patientCard: '',
                patientGuide: '',
                patientPhone: '',
                date: new Date().toISOString().split('T')[0],
                taskType: 'message',
                messageType: 'Receita',
                recipientId: '',
                recipientName: '',
                sector: selectedFloor
            });
            setSearchProfessional('');
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSearchProfessional('');
        setShowProfessionalResults(false);
        setTimeout(() => setCurrentTask(null), 200); // Wait for animation
    };

    const handleDelete = (taskId: string, e?: React.MouseEvent) => {
        // Robust event handling to prevent modal opening
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (window.confirm("Tem certeza que deseja excluir este recado permanentemente?")) {
            setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId));

            // If the deleted task was open in the modal, close it
            if (isModalOpen && currentTask?.id === taskId) {
                closeModal();
            }
        }
    };

    const handleEditClick = (task: Task, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleOpenModal('edit', task);
    };

    const handleSave = () => {
        if (!formData.title) {
            alert("Por favor, preencha o assunto do recado.");
            return;
        }

        const cleanData = { ...formData };
        if (!cleanData.isPatientRelated) {
            cleanData.patient = '';
            cleanData.patientCard = '';
            cleanData.patientGuide = '';
            cleanData.patientPhone = '';
        }

        if (modalMode === 'create') {
            const newTask: Task = {
                id: Date.now().toString(),
                title: cleanData.title || '',
                description: cleanData.description || '',
                isPatientRelated: cleanData.isPatientRelated,
                patient: cleanData.patient,
                patientCard: cleanData.patientCard,
                patientGuide: cleanData.patientGuide,
                patientPhone: cleanData.patientPhone,
                taskType: 'message',
                messageType: cleanData.messageType as 'Receita' | 'Medicamentos' | 'Outros',
                authorName: getFormattedDisplayName(),
                createdAt: new Date().toISOString(),
                sector: selectedFloor // Tie to the current active floor
            };
            setTasks(prev => [newTask, ...prev]);
        } else if (modalMode === 'edit' && currentTask) {
            setTasks(prev => prev.map(t => t.id === currentTask.id ? { ...t, ...cleanData, authorName: t.authorName || getFormattedDisplayName() } as Task : t));
        }
        closeModal();
    };

    // Remove unused helpers
    const getPriorityColor = (p: any) => 'bg-gray-100';
    const getStatusIcon = (s: any) => 'mail';
    const getStatusStyles = (s: any) => 'bg-primary/10 text-primary';

    return (
        <div className="flex flex-col gap-6 relative">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Portal de Recados</h2>
                    <p className="text-gray-500">Gestão de Recados e Comunicações Médicas.</p>
                </div>
                <button
                    onClick={() => handleOpenModal('create')}
                    className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold hover:bg-primary-dark transition-all flex items-center gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/40 transform active:scale-95"
                >
                    <span className="material-symbols-outlined">add_circle</span>
                    Novo Registro
                </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 justify-between items-center w-full">
                <div className="flex gap-2">
                    <div className="bg-primary/5 text-primary px-4 py-2 rounded-full text-sm font-bold border border-primary/20">
                        Todos os Recados
                    </div>
                </div>
                {selectedForBatch.length > 0 && (
                    <div className="flex items-center gap-3 bg-primary/10 px-4 py-1.5 rounded-full border border-primary/20 animate-in slide-in-from-right-2">
                        <span className="text-sm font-bold text-primary shrink-0">{selectedForBatch.length} {selectedForBatch.length === 1 ? 'selecionado' : 'selecionados'}</span>
                        <div className="w-[1px] h-4 bg-primary/30 shrink-0"></div>
                        <button
                            onClick={() => {
                                handleBatchPrint();
                            }}
                            className="text-primary hover:text-primary-dark font-bold text-sm flex items-center gap-1 transition-colors shrink-0"
                        >
                            <span className="material-symbols-outlined text-[18px]">print</span>
                            Imprimir Lote
                        </button>
                        <button
                            onClick={() => setSelectedForBatch([])}
                            className="text-gray-400 hover:text-red-500 font-bold text-[10px] ml-1 uppercase transition-colors shrink-0 flex items-center"
                            title="Limpar seleção"
                        >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredTasks.filter(t => t.taskType === 'message').map((task) => (
                    <div
                        key={task.id}
                        onClick={() => handleOpenModal('view', task)}
                        className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 group"
                    >
                        <div className="flex items-start gap-4 flex-1 w-full relative">
                            {/* Checkbox for batch select */}
                            {task.taskType === 'message' && (
                                <div 
                                    className="pt-2.5 pr-1 cursor-pointer transition-transform hover:scale-110 shrink-0"
                                    onClick={(e) => toggleBatchSelect(task.id, e)}
                                    title="Selecionar para impressão em lote"
                                >
                                    <span className={`material-symbols-outlined text-2xl transition-colors ${selectedForBatch.includes(task.id) ? 'text-primary' : 'text-gray-300 hover:text-gray-400'}`}>
                                        {selectedForBatch.includes(task.id) ? 'check_box' : 'check_box_outline_blank'}
                                    </span>
                                </div>
                            )}

                            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <span className="material-symbols-outlined text-2xl">mail</span>
                            </div>

                            <div className="flex-1 min-w-0">
                                <h4 className={`font-bold text-lg transition-all truncate ${task.status === TaskStatus.DONE ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                    {task.title}
                                </h4>
                                <div className="flex flex-wrap gap-2 mt-2 text-sm text-gray-500">
                                    {task.taskType === 'message' && (
                                        <span className="flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider shadow-sm">
                                            <span className="material-symbols-outlined text-[12px]">chat_bubble</span>RECADO
                                        </span>
                                    )}
                                    {/* Task label removed as only Messages are shown */}
                                    {task.isPatientRelated && task.patient && (
                                        <span className="flex items-center gap-1 bg-gray-50 text-gray-600 border border-gray-200 px-2 py-1 rounded-md font-medium text-[11px]">
                                            <span className="material-symbols-outlined text-[12px]">personal_injury</span>Pac: {task.patient}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 w-full lg:w-auto justify-end">
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={(e) => handleEditClick(task, e)}
                                    className="p-2 text-gray-400 hover:text-primary hover:bg-primary-light rounded-lg transition-colors z-10 relative"
                                    title="Editar Recado"
                                    type="button"
                                >
                                    <span className="material-symbols-outlined pointer-events-none">edit</span>
                                </button>
                                <button
                                    onClick={(e) => handleDelete(task.id, e)}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors z-10 relative"
                                    title="Excluir Recado"
                                    type="button"
                                >
                                    <span className="material-symbols-outlined pointer-events-none">delete</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {filteredTasks.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                        <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">
                            mail_outline
                        </span>
                        <p className="text-gray-500 font-medium">
                            Nenhum recado encontrado para este setor.
                        </p>
                    </div>
                )}
            </div>

            {/* --- WIDE MODAL FOR ALL MODES --- */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 transition-all border border-gray-200">

                        {/* Header */}
                        <div className="px-6 py-4 flex justify-between items-center shrink-0 bg-[#00665C] text-white">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/10 rounded-lg">
                                    <span className="material-symbols-outlined">
                                        chat_bubble
                                    </span>
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="font-bold text-lg text-white leading-none">
                                        {modalMode === 'create' && 'Novo Recado'}
                                        {modalMode === 'edit' && 'Editar Recado'}
                                        {modalMode === 'view' && 'Visualizar Registro'}
                                    </h3>
                                    <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest mt-1">Gestão Unificada CDU</span>
                                </div>
                            </div>
                            <button onClick={closeModal} className="p-1 rounded-full hover:bg-white/20 transition-colors text-white">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Body - Scrollable with Grid Layout */}
                        <div className="p-6 overflow-y-auto no-scrollbar bg-gray-50/30">
                            {/* VIEW MODE */}
                            {modalMode === 'view' ? (
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                    {/* Smart Card Content: Main Info */}
                                    <div className={`${formData.isPatientRelated ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-4`}>

                                        {formData.taskType === 'message' && (
                                            <div className="bg-white border-2 border-primary/10 p-4 rounded-2xl flex justify-end items-center shadow-sm">
                                                <button
                                                    onClick={handlePrint}
                                                    className="flex items-center gap-2 bg-primary text-white hover:bg-primary-dark px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95"
                                                >
                                                    <span className="material-symbols-outlined text-base">print</span>
                                                    Imprimir Recado
                                                </button>
                                            </div>
                                        )}

                                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                                            {/* Watermark/Label for recipient in view mode */}
                                            {formData.taskType === 'message' && (
                                                <div className="absolute top-0 right-0 px-4 py-1 bg-primary/5 border-b border-l border-primary/10 rounded-bl-xl text-[9px] font-bold text-primary tracking-widest uppercase">
                                                    Destinatário: {formData.recipientName || 'Geral'}
                                                </div>
                                            )}
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="min-w-0 flex-1">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                                                        Assunto
                                                    </label>
                                                    <h2 className="text-gray-900 font-bold text-2xl truncate pr-4">{replacePlaceholders(formData.title)}</h2>
                                                </div>
                                                <div className="flex gap-2">
                                                    {/* Status/Priority indicators removed per request */}
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                                    <span className="material-symbols-outlined text-sm">history_edu</span>
                                                    Formalização
                                                </label>
                                                <div 
                                                    className="text-gray-700 text-sm leading-relaxed bg-gray-50/50 p-4 rounded-xl border border-gray-100 min-h-[120px]"
                                                    dangerouslySetInnerHTML={{ __html: formData.description ? replacePlaceholders(formData.description) : '<span class="text-gray-300 italic">Sem conteúdo formalizado.</span>' }}
                                                />
                                            </div>

                                            {formData.taskType === 'message' && (
                                                <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
                                                    <div>
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Responsável</span>
                                                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
                                                            <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary">
                                                                {replacePlaceholders(formData.authorName || 'Sistema')?.[0] || 'S'}
                                                            </div>
                                                            {replacePlaceholders(formData.authorName || 'Sistema')}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Data / Hora</span>
                                                        <span className="text-xs font-bold text-gray-600">
                                                            {formData.createdAt ? new Date(formData.createdAt).toLocaleString('pt-BR') : '-'}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right Column: Mini Patient Card (5 cols) */}
                                    {formData.isPatientRelated && (
                                        <div className="lg:col-span-5">
                                            <div className="bg-white rounded-2xl border-2 border-primary/5 p-5 shadow-sm h-full flex flex-col">
                                                <div className="flex items-center gap-3 text-primary-dark border-b border-gray-100 pb-4 mb-4">
                                                    <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                                        <span className="material-symbols-outlined text-xl">account_circle</span>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-base leading-none text-primary-dark">Dados do Paciente</h4>
                                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Identificação CDU</span>
                                                    </div>
                                                </div>

                                                <div className="space-y-4 flex-1">
                                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Nome Completo</label>
                                                        <p className="text-gray-900 font-bold text-sm leading-tight">{formData.patient || '-'}</p>
                                                    </div>

                                                    {/* Carteirinha and Guia removed per request */}

                                                    <div className="bg-primary/5 p-3 rounded-xl border border-primary/10">
                                                        <label className="text-[9px] font-bold text-primary/60 uppercase tracking-widest block mb-1">Contato Rápido</label>
                                                        <div className="flex items-center gap-2">
                                                            <span className="material-symbols-outlined text-base text-primary">phone_in_talk</span>
                                                            <span className="text-sm font-bold text-primary-dark">{formData.patientPhone || 'Não inf.'}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-6 pt-4 border-t border-gray-100 text-center">
                                                    <span className="text-[9px] text-gray-400 italic">Vínculo ativo para este registro</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* EDIT / CREATE MODE - Slim Form */
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                    {/* Left Column: Form Fields (8 cols) */}
                                    <div className="lg:col-span-8 space-y-5">

                                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div className="relative">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Destinatário (Profissional)</label>
                                                    <div className="relative">
                                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">person_search</span>
                                                        <input
                                                            type="text"
                                                            placeholder="Buscar médico por nome ou especialidade..."
                                                            value={formData.recipientName || searchProfessional}
                                                            onChange={(e) => {
                                                                setSearchProfessional(e.target.value);
                                                                setFormData({ ...formData, recipientName: e.target.value });
                                                                setShowProfessionalResults(true);
                                                            }}
                                                            onFocus={() => setShowProfessionalResults(true)}
                                                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm transition-all"
                                                        />
                                                        {showProfessionalResults && ((formData.recipientName || searchProfessional).length > 0 || doctors.length > 0) && (
                                                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto overflow-x-hidden no-scrollbar border-primary/20 animate-in fade-in slide-in-from-top-1 duration-200">
                                                                {/* Custom Name Button */}
                                                                {(formData.recipientName || searchProfessional) && !doctors.some(d => d.name.toLowerCase() === (formData.recipientName || searchProfessional).toLowerCase()) && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setShowProfessionalResults(false);
                                                                            setFormData({ ...formData, recipientId: '', recipientName: formData.recipientName || searchProfessional });
                                                                        }}
                                                                        className="w-full px-4 py-3 text-left hover:bg-primary/5 flex items-center gap-3 group transition-colors border-b border-gray-100 bg-gray-50"
                                                                    >
                                                                        <div className="p-2 bg-gray-200 rounded-lg text-gray-500 group-hover:bg-primary group-hover:text-white transition-colors">
                                                                            <span className="material-symbols-outlined text-sm">person_add</span>
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="text-sm font-bold text-gray-800 truncate">
                                                                                Usar destinatário avulso: <span className="text-primary group-hover:text-primary-dark">{formData.recipientName || searchProfessional}</span>
                                                                            </div>
                                                                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Registrar sem vínculo no sistema</div>
                                                                        </div>
                                                                    </button>
                                                                )}

                                                                {/* Doctors List */}
                                                                {doctors
                                                                    .filter(d => d.name.toLowerCase().includes((formData.recipientName || searchProfessional).toLowerCase()))
                                                                    .map(doc => (
                                                                        <button
                                                                            key={doc.id}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setFormData({ ...formData, recipientId: doc.id, recipientName: doc.name });
                                                                                setSearchProfessional(doc.name);
                                                                                setShowProfessionalResults(false);
                                                                            }}
                                                                            className="w-full px-4 py-2.5 text-left hover:bg-primary/5 flex items-center justify-between group transition-colors border-b border-gray-50 last:border-0"
                                                                        >
                                                                            <div>
                                                                                <div className="text-sm font-bold text-gray-800 group-hover:text-primary">{doc.name}</div>
                                                                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{doc.specialty}</div>
                                                                            </div>
                                                                            <span className="material-symbols-outlined text-gray-300 group-hover:text-primary text-lg">check_circle</span>
                                                                        </button>
                                                                    ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="relative">
                                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Responsável</label>
                                                        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 cursor-default transition-all shadow-inner">
                                                            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                                                {getFormattedDisplayName()[0]}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold text-gray-700 leading-none">{getFormattedDisplayName()}</span>
                                                                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">Autor Logado</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="relative">
                                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Setor Ativo</label>
                                                        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 cursor-default shadow-inner">
                                                            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                                <span className="material-symbols-outlined text-sm">layers</span>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-bold text-gray-700 leading-tight uppercase tracking-tighter truncate max-w-[120px]">{selectedFloor || 'Geral'}</span>
                                                                <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Andar Atificado</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                                Assunto do Recado *
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.title}
                                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                                className="w-full p-4 border border-gray-300 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-base font-medium transition-all shadow-sm"
                                                placeholder="Ex: Documentação Pendente, Aviso Clínico..."
                                                autoFocus
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                                Formalização do Texto *
                                            </label>
                                            <RichTextEditor
                                                value={formData.description || ''}
                                                onChange={v => setFormData({ ...formData, description: v })}
                                                placeholder="Digite aqui o conteúdo completo do recado..."
                                            />
                                        </div>
                                    </div>

                                    {/* Right Column: Patient Toggle & Data (4 cols) */}
                                    <div className="lg:col-span-4 flex flex-col">
                                        <div className={`rounded-2xl border transition-all duration-300 h-full overflow-hidden flex flex-col ${formData.isPatientRelated
                                            ? 'bg-white border-primary/30 shadow-lg shadow-primary/5'
                                            : 'bg-gray-50 border-gray-200'
                                            }`}>
                                            <div
                                                className="p-5 flex items-center justify-between cursor-pointer border-b border-gray-100"
                                                onClick={() => setFormData({ ...formData, isPatientRelated: !formData.isPatientRelated })}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2.5 rounded-xl transition-colors ${formData.isPatientRelated ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
                                                        <span className="material-symbols-outlined">personal_injury</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-sm font-bold text-gray-900">Vincular Paciente</span>
                                                        <span className="block text-xs text-gray-500">Habilitar dados clínicos</span>
                                                    </div>
                                                </div>
                                                <div className={`w-12 h-7 rounded-full relative transition-colors duration-300 ${formData.isPatientRelated ? 'bg-primary' : 'bg-gray-300'}`}>
                                                    <div className={`absolute top-1 left-1 bg-white size-5 rounded-full transition-transform duration-300 shadow-sm ${formData.isPatientRelated ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                                </div>
                                            </div>

                                            <div className={`flex-1 transition-all duration-300 ease-in-out bg-white ${formData.isPatientRelated ? 'opacity-100' : 'opacity-50 grayscale pointer-events-none'}`}>
                                                <div className="p-6 space-y-5">
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nome do Paciente</label>
                                                        <input
                                                            type="text"
                                                            value={formData.patient}
                                                            onChange={e => setFormData({ ...formData, patient: e.target.value })}
                                                            className="w-full p-3 border border-gray-300 rounded-xl focus:border-primary outline-none text-sm"
                                                            placeholder="Nome completo"
                                                            disabled={!formData.isPatientRelated}
                                                        />
                                                    </div>
                                                    {/* Carteirinha and Guia removed per request */}
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Telefone</label>
                                                        <input
                                                            type="text"
                                                            value={formData.patientPhone}
                                                            onChange={e => setFormData({ ...formData, patientPhone: e.target.value })}
                                                            className="w-full p-3 border border-gray-300 rounded-xl focus:border-primary outline-none text-sm"
                                                            placeholder="(XX) XXXXX-XXXX"
                                                            disabled={!formData.isPatientRelated}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Action */}
                        <div className="bg-gray-50 px-8 py-5 flex justify-end gap-3 border-t border-gray-100 shrink-0">
                            {modalMode === 'view' ? (
                                <>
                                    <button
                                        onClick={(e) => currentTask && handleDelete(currentTask.id, e)}
                                        className="mr-auto text-red-500 hover:text-red-700 font-bold text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2 hover:bg-red-50"
                                        type="button"
                                    >
                                        <span className="material-symbols-outlined">delete</span>
                                        Excluir Recado
                                    </button>
                                    <button
                                        onClick={() => currentTask && handleOpenModal('edit', currentTask)}
                                        className="bg-primary hover:bg-primary-dark text-white font-bold text-sm px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2 shadow-sm shadow-primary/30"
                                    >
                                        <span className="material-symbols-outlined text-lg">edit</span>
                                        Editar
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={closeModal}
                                        className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        className="px-8 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors shadow-lg shadow-primary/30 flex items-center gap-2 transform active:scale-95"
                                    >
                                        {modalMode === 'create' ? <span className="material-symbols-outlined text-lg">add_circle</span> : <span className="material-symbols-outlined text-lg">save</span>}
                                        {modalMode === 'create' ? 'Criar Recado' : 'Salvar Alterações'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- PRINTABLE RECADO HIDDEN --- */}
            <div style={{ display: 'none' }}>
                <div ref={printableRef} style={{ padding: '1.5cm 1cm 1cm 1.5cm', boxSizing: 'border-box' }}>
                    <div className="print-recado-container" style={{
                        width: '15cm',
                        height: 'auto',
                        minHeight: 'fit-content',
                        padding: '0.6cm',
                        backgroundColor: 'white',
                        color: 'black',
                        fontFamily: '"Segoe UI", Roboto, Arial, sans-serif',
                        display: 'flex',
                        flexDirection: 'column',
                        border: '2px solid #00665C',
                        position: 'relative',
                        boxSizing: 'border-box'
                    }}>
                    {/* Header: Brand & Meta */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #00665C', paddingBottom: '8px', marginBottom: '10px' }}>
                        <div>
                            <div style={{ fontSize: '8px', fontWeight: '800', color: '#666', textTransform: 'uppercase', marginBottom: '2px' }}>Para: Profissional / Destinatário</div>
                            <div style={{ color: '#00665C', fontSize: '18px', fontWeight: '900', letterSpacing: '-0.5px', lineHeight: '1.2' }}>{formData.recipientName || 'CORPO CLÍNICO CDU'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ backgroundColor: '#00665C', color: 'white', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', display: 'inline-block' }}>
                                RECADO
                            </div>
                        </div>
                    </div>

                    {/* Content Section */}
                    <div style={{ flex: 1, border: '2px solid #555', borderRadius: '8px', padding: '10px 15px', display: 'flex', flexDirection: 'column', minHeight: '0' }}>
                        <div style={{ borderBottom: '2px solid #555', paddingBottom: '5px', marginBottom: '8px' }}>
                            <div style={{ fontSize: '7px', fontWeight: '900', color: '#444', textTransform: 'uppercase' }}>Assunto do Registro</div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#000' }}>{replacePlaceholders(formData.title)}</div>
                        </div>
                        <div 
                            style={{ fontSize: '11px', lineHeight: '1.4', color: '#333', flex: 1 }}
                            dangerouslySetInnerHTML={{ __html: formData.description ? replacePlaceholders(formData.description) : '<span style="color: #aaa; font-style: italic">Nenhum conteúdo detalhado informado.</span>' }}
                        />
                    </div>

                    {/* Compact Footer: Patient on Left, Author & Time on Right */}
                    <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        
                        {/* LEFT COLUMN: PACIENTE */}
                        <div style={{ border: '2px solid #555', borderRadius: '6px', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ fontSize: '7px', fontWeight: '900', color: '#444', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1.5px solid #ccc', paddingBottom: '3px' }}>Dados do Paciente / Beneficiário</div>
                            {formData.isPatientRelated ? (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '5px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ fontSize: '6px', fontWeight: '900', color: '#888', textTransform: 'uppercase' }}>Nome</div>
                                            <div style={{ fontSize: '11px', fontWeight: '900', color: '#111' }}>{formData.patient || '-'}</div>
                                        </div>
                                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ fontSize: '6px', fontWeight: '900', color: '#888', textTransform: 'uppercase' }}>Contato</div>
                                            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#333' }}>{formData.patientPhone || '-'}</div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#999', fontStyle: 'italic' }}>Registro sem vínculo de paciente.</span>
                                </div>
                            )}
                        </div>

                        {/* RIGHT COLUMN: AUTOR & DATA */}
                        <div style={{ border: '2px solid #555', borderRadius: '6px', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
                            <div style={{ fontSize: '7px', fontWeight: '900', color: '#444', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1.5px solid #ccc', paddingBottom: '3px' }}>Registro e Formalização</div>
                             <div style={{ display: 'flex', flexDirection: 'column' }}>
                                 <div style={{ fontSize: '6px', fontWeight: '900', color: '#888', textTransform: 'uppercase' }}>Emitido Por</div>
                                 <div style={{ fontSize: '11px', fontWeight: '900', color: '#111' }}>{replacePlaceholders(formData.authorName || (user?.role === 'reception' ? 'RECEPCIONISTA' : user?.name) || 'SISTEMA UNIFICADO')}</div>
                             </div>
                             <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', paddingTop: '4px' }}>
                                 <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#333' }}>{new Date().toLocaleString('pt-BR')} • Bauru - SP</div>
                             </div>
                        </div>

                    </div>

                </div>
                </div>
            </div>

            {/* --- BATCH PRINTABLE RECADOS HIDDEN --- */}
            <div style={{ display: 'none' }}>
                <div ref={batchPrintableRef} style={{ padding: '0', boxSizing: 'border-box', backgroundColor: 'white', width: '210mm' }}>
                    {selectedForBatch.map((taskId, index) => {
                        const batchTask = tasks.find(t => t.id === taskId);
                        if (!batchTask || batchTask.taskType !== 'message') return null;

                        return (
                            <div key={taskId} style={{ padding: '0.6cm 1.5cm', width: '210mm', minHeight: '99mm', height: 'auto', boxSizing: 'border-box', pageBreakInside: 'avoid', borderBottom: '1px dashed #ccc' }}>
                                <div className="print-recado-container" style={{
                                    width: '100%',
                                    height: 'auto',
                                    backgroundColor: 'white',
                                    color: 'black',
                                    fontFamily: '"Segoe UI", Roboto, Arial, sans-serif',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    border: '2px solid #00665C',
                                    position: 'relative',
                                    boxSizing: 'border-box',
                                    padding: '0.4cm'
                                }}>
                                    {/* Header: Brand & Meta */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #00665C', paddingBottom: '4px', marginBottom: '6px' }}>
                                        <div>
                                            <div style={{ fontSize: '7px', fontWeight: '800', color: '#666', textTransform: 'uppercase', marginBottom: '1px' }}>Para: Profissional / Destinatário</div>
                                            <div style={{ color: '#00665C', fontSize: '16px', fontWeight: '900', letterSpacing: '-0.5px', lineHeight: '1.2' }}>{batchTask.recipientName || 'CORPO CLÍNICO CDU'}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ backgroundColor: '#00665C', color: 'white', padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', display: 'inline-block' }}>
                                                RECADO
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content Section */}
                                    <div style={{ flex: 1, border: '2px solid #555', borderRadius: '8px', padding: '6px 12px', display: 'flex', flexDirection: 'column', minHeight: '0' }}>
                                        <div style={{ borderBottom: '2px solid #555', paddingBottom: '3px', marginBottom: '4px' }}>
                                            <div style={{ fontSize: '6px', fontWeight: '900', color: '#444', textTransform: 'uppercase' }}>Assunto do Registro</div>
                                            <div style={{ fontSize: '12px', fontWeight: '800', color: '#000' }}>{replacePlaceholders(batchTask.title)}</div>
                                        </div>
                                        <div 
                                            style={{ fontSize: '10px', lineHeight: '1.3', color: '#333', flex: 1, paddingBottom: '4px' }}
                                            dangerouslySetInnerHTML={{ __html: batchTask.description ? replacePlaceholders(batchTask.description) : '<span style="color: #aaa; font-style: italic">Nenhum conteúdo detalhado informado.</span>' }}
                                        />
                                    </div>

                                    {/* Compact Footer */}
                                    <div style={{ marginTop: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <div style={{ border: '2px solid #555', borderRadius: '6px', padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ fontSize: '7px', fontWeight: '900', color: '#444', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1.5px solid #ccc', paddingBottom: '3px' }}>Dados do Paciente / Beneficiário</div>
                                            {batchTask.isPatientRelated ? (
                                                <>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '5px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <div style={{ fontSize: '6px', fontWeight: '900', color: '#888', textTransform: 'uppercase' }}>Nome</div>
                                                            <div style={{ fontSize: '11px', fontWeight: '900', color: '#111' }}>{batchTask.patient || '-'}</div>
                                                        </div>
                                                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                                                            <div style={{ fontSize: '6px', fontWeight: '900', color: '#888', textTransform: 'uppercase' }}>Contato</div>
                                                            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#333' }}>{batchTask.patientPhone || '-'}</div>
                                                        </div>
                                                    </div>
                                                    {/* Carteirinha/Guia removed per request */}
                                                </>
                                            ) : (
                                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#999', fontStyle: 'italic' }}>Registro sem vínculo de paciente.</span>
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ border: '2px solid #555', borderRadius: '6px', padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
                                            <div style={{ fontSize: '7px', fontWeight: '900', color: '#444', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1.5px solid #ccc', paddingBottom: '3px' }}>Registro e Formalização</div>
                                             <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                 <div style={{ fontSize: '6px', fontWeight: '900', color: '#888', textTransform: 'uppercase' }}>Emitido Por</div>
                                                 <div style={{ fontSize: '11px', fontWeight: '900', color: '#111' }}>{replacePlaceholders(batchTask.authorName || 'SISTEMA UNIFICADO')}</div>
                                             </div>
                                             <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', paddingTop: '4px' }}>
                                                 <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#333' }}>{batchTask.date || new Date().toLocaleString('pt-BR')} • Bauru - SP</div>
                                             </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default Tasks;