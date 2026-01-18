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
        title: 'Preparar laudo do paciente João',
        description: 'Verificar as imagens de ressonância anexadas no sistema PACS e comparar com o exame anterior de 2022.',
        isPatientRelated: true,
        patient: 'João Silva',
        patientCard: '0032.1123.4432.00',
        patientPhone: '(14) 99887-7766',
        status: TaskStatus.PENDING,
        priority: Priority.HIGH,
        date: '2023-10-27'
    },
    {
        id: '2',
        title: 'Reunião de setor',
        description: 'Discutir novas escalas de plantão para o próximo mês.',
        isPatientRelated: false,
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.MEDIUM,
        date: '2023-10-28'
    },
    { id: '3', title: 'Solicitar insumos', status: TaskStatus.DONE, priority: Priority.LOW, date: '2023-10-26' },
    { id: '4', title: 'Confirmar cirurgias da semana', status: TaskStatus.PENDING, priority: Priority.HIGH, date: '2023-10-29' },
];

const Tasks: React.FC = () => {
    const { user, selectedFloor } = useAuth();
    const [tasks, setTasks] = useState<Task[]>(() => {
        const saved = localStorage.getItem('mediportal_tasks');
        return saved ? JSON.parse(saved) : mockTasks;
    });

    const printableRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: printableRef,
        documentTitle: 'Recado_Unimed',
    });

    useEffect(() => {
        localStorage.setItem('mediportal_tasks', JSON.stringify(tasks));
    }, [tasks]);

    const [filter, setFilter] = useState<TaskStatus | 'Active'>('Active');
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
        status: TaskStatus.PENDING,
        priority: Priority.MEDIUM,
        date: new Date().toISOString().split('T')[0],
        taskType: 'task',
        messageType: 'Receita',
        authorName: '',
        recipientId: '',
        recipientName: '',
        sector: selectedFloor // Default to current selected floor
    });

    // Filter Logic
    const filteredTasks = tasks.filter(task => {
        // Sector Filtering: Only show tasks for the current selected floor
        // (Legacy tasks without sector are shown for backward compatibility, or you can filter them out)
        if (task.sector && task.sector !== selectedFloor) return false;

        if (filter === 'Active') {
            return task.status !== TaskStatus.DONE;
        }
        return task.status === filter;
    });

    // Handlers
    const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
        setTasks(prevTasks =>
            prevTasks.map(task =>
                task.id === taskId ? { ...task, status: newStatus } : task
            )
        );
    };

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
                status: TaskStatus.PENDING,
                priority: Priority.MEDIUM,
                date: new Date().toISOString().split('T')[0],
                taskType: 'task',
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

        if (window.confirm("Tem certeza que deseja excluir esta tarefa permanentemente?")) {
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
            alert("Por favor, preencha o título da tarefa.");
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
                status: cleanData.status as TaskStatus,
                priority: cleanData.priority as Priority,
                date: cleanData.date || new Date().toISOString().split('T')[0],
                taskType: cleanData.taskType as 'task' | 'message',
                messageType: cleanData.messageType as 'Receita' | 'Medicamentos' | 'Outros',
                authorName: user?.name || '',
                createdAt: new Date().toISOString(),
                sector: selectedFloor // Tie to the current active floor
            };
            setTasks(prev => [newTask, ...prev]);
        } else if (modalMode === 'edit' && currentTask) {
            setTasks(prev => prev.map(t => t.id === currentTask.id ? { ...t, ...cleanData, authorName: t.authorName || (user?.name || '') } as Task : t));
        }
        closeModal();
    };

    const getPriorityColor = (p: Priority) => {
        switch (p) {
            case Priority.HIGH: return 'bg-red-100 text-red-700 border-red-200';
            case Priority.MEDIUM: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case Priority.LOW: return 'bg-blue-100 text-blue-700 border-blue-200';
        }
    };

    const getStatusIcon = (s: TaskStatus) => {
        switch (s) {
            case TaskStatus.PENDING: return 'radio_button_unchecked';
            case TaskStatus.IN_PROGRESS: return 'hourglass_empty';
            case TaskStatus.DONE: return 'check_circle';
        }
    }

    const getStatusStyles = (s: TaskStatus) => {
        switch (s) {
            case TaskStatus.DONE: return 'bg-green-100 text-green-600';
            case TaskStatus.IN_PROGRESS: return 'bg-blue-100 text-blue-600';
            default: return 'bg-gray-100 text-gray-500 group-hover:bg-gray-200';
        }
    }

    return (
        <div className="flex flex-col gap-6 relative">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Portal de Tarefas CDU</h2>
                    <p className="text-gray-500">Gestão Unificada de Atendimento - Fluxo de Trabalho.</p>
                </div>
                <button
                    onClick={() => handleOpenModal('create')}
                    className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold hover:bg-primary-dark transition-all flex items-center gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/40 transform active:scale-95"
                >
                    <span className="material-symbols-outlined">add_circle</span>
                    Novo Registro
                </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
                {['Active', TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.DONE].map((status) => {
                    let label = status;
                    if (status === 'Active') label = 'Em Aberto';

                    return (
                        <button
                            key={status}
                            onClick={() => setFilter(status as any)}
                            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${filter === status
                                ? 'bg-primary text-white shadow-md'
                                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                }`}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredTasks.map((task) => (
                    <div
                        key={task.id}
                        onClick={() => handleOpenModal('view', task)}
                        className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 group"
                    >
                        <div className="flex items-start gap-4 flex-1 w-full">
                            <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                                <div
                                    className={`p-3 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${getStatusStyles(task.status)}`}
                                    title="Clique para alterar o status"
                                >
                                    <span className="material-symbols-outlined text-2xl pointer-events-none">{getStatusIcon(task.status)}</span>
                                </div>
                                <select
                                    value={task.status}
                                    onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                >
                                    {Object.values(TaskStatus).map((status) => (
                                        <option key={status} value={status}>
                                            {status}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex-1 min-w-0">
                                <h4 className={`font-bold text-lg transition-all truncate ${task.status === TaskStatus.DONE ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                    {task.title}
                                </h4>
                                <div className="flex flex-wrap gap-2 mt-2 text-sm text-gray-500">
                                    {task.taskType === 'message' && (
                                        <span className="flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider shadow-sm">
                                            <span className="material-symbols-outlined text-[12px]">chat_bubble</span>RECADO: {task.messageType}
                                        </span>
                                    )}
                                    {task.taskType === 'task' && (
                                        <span className="flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider shadow-sm">
                                            <span className="material-symbols-outlined text-[12px]">assignment</span>TAREFA
                                        </span>
                                    )}
                                    {task.isPatientRelated && task.patient && (
                                        <span className="flex items-center gap-1 bg-gray-50 text-gray-600 border border-gray-200 px-2 py-1 rounded-md font-medium text-[11px]">
                                            <span className="material-symbols-outlined text-[12px]">personal_injury</span>Pac: {task.patient}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-none pt-4 lg:pt-0 mt-2 lg:mt-0">
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={(e) => handleEditClick(task, e)}
                                    className="p-2 text-gray-400 hover:text-primary hover:bg-primary-light rounded-lg transition-colors z-10 relative"
                                    title="Editar Tarefa"
                                    type="button"
                                >
                                    <span className="material-symbols-outlined pointer-events-none">edit</span>
                                </button>
                                <button
                                    onClick={(e) => handleDelete(task.id, e)}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors z-10 relative"
                                    title="Excluir Tarefa"
                                    type="button"
                                >
                                    <span className="material-symbols-outlined pointer-events-none">delete</span>
                                </button>
                            </div>

                            <span className={`px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${getPriorityColor(task.priority)}`}>
                                {task.priority}
                            </span>
                        </div>
                    </div>
                ))}

                {filteredTasks.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                        <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">
                            {filter === TaskStatus.DONE ? 'playlist_add_check' : 'assignment_turned_in'}
                        </span>
                        <p className="text-gray-500 font-medium">
                            {filter === TaskStatus.DONE ? 'Nenhuma tarefa concluída ainda.' : 'Nenhuma tarefa pendente encontrada.'}
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
                                    <span className="material-symbols-outlined text-white">
                                        {formData.taskType === 'message' ? 'chat_bubble' : 'assignment'}
                                    </span>
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="font-bold text-lg text-white leading-none">
                                        {modalMode === 'create' && (formData.taskType === 'message' ? 'Novo Recado' : 'Nova Tarefa')}
                                        {modalMode === 'edit' && (formData.taskType === 'message' ? 'Editar Recado' : 'Editar Tarefa')}
                                        {modalMode === 'view' && (formData.taskType === 'message' ? 'Visualizar Registro' : 'Detalhes da Tarefa')}
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
                                            <div className="bg-white border-2 border-primary/10 p-4 rounded-2xl flex justify-between items-center shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                                        <span className="material-symbols-outlined">label_important</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block leading-none mb-1">Tipo de Recado</span>
                                                        <span className="font-bold text-base text-primary-dark">{formData.messageType}</span>
                                                    </div>
                                                </div>
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
                                                        {formData.taskType === 'message' ? 'Assunto' : 'Título da Atividade'}
                                                    </label>
                                                    <h2 className="text-gray-900 font-bold text-2xl truncate pr-4">{formData.title}</h2>
                                                </div>
                                                <div className="flex gap-2">
                                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-bold border uppercase ${getPriorityColor(formData.priority as Priority)}`}>
                                                        {formData.priority}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                                    <span className="material-symbols-outlined text-sm">{formData.taskType === 'message' ? 'history_edu' : 'notes'}</span>
                                                    {formData.taskType === 'message' ? 'Formalização' : 'Descrição'}
                                                </label>
                                                <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap bg-gray-50/50 p-4 rounded-xl border border-gray-100 min-h-[120px]">
                                                    {formData.description || <span className="text-gray-300 italic">Sem conteúdo formalizado.</span>}
                                                </div>
                                            </div>

                                            {formData.taskType === 'message' && (
                                                <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
                                                    <div>
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Responsável</span>
                                                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
                                                            <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary">
                                                                {formData.authorName?.[0] || 'S'}
                                                            </div>
                                                            {formData.authorName || 'Sistema'}
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

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                                            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Carteirinha</label>
                                                            <p className="font-mono text-xs font-bold text-gray-700">{formData.patientCard || '-'}</p>
                                                        </div>
                                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                                            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Guia/Aut.</label>
                                                            <p className="text-gray-900 font-bold text-xs">{formData.patientGuide || '-'}</p>
                                                        </div>
                                                    </div>

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

                                        {/* TASK TYPE TOGGLE */}
                                        <div className="flex bg-gray-100 p-1.5 rounded-2xl self-start w-fit mb-4">
                                            <button
                                                onClick={() => setFormData({ ...formData, taskType: 'task' })}
                                                className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${formData.taskType === 'task' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                            >
                                                <span className="material-symbols-outlined text-lg">assignment</span>
                                                Tarefa
                                            </button>
                                            <button
                                                onClick={() => setFormData({ ...formData, taskType: 'message' })}
                                                className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${formData.taskType === 'message' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                            >
                                                <span className="material-symbols-outlined text-lg">chat_bubble</span>
                                                Recado
                                            </button>
                                        </div>

                                        {formData.taskType === 'message' && (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Categoria do Recado</label>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        {['Receita', 'Medicamentos', 'Outros'].map(type => (
                                                            <button
                                                                key={type}
                                                                onClick={() => setFormData({ ...formData, messageType: type as any })}
                                                                className={`py-3 px-4 rounded-xl border-2 font-bold text-sm transition-all ${formData.messageType === type
                                                                    ? 'border-primary bg-primary/5 text-primary'
                                                                    : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'}`}
                                                            >
                                                                {type}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

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
                                                        {showProfessionalResults && (doctors.filter(d => d.name.toLowerCase().includes((formData.recipientName || searchProfessional).toLowerCase())).length > 0) && (
                                                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto overflow-x-hidden no-scrollbar border-primary/20 animate-in fade-in slide-in-from-top-1 duration-200">
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
                                                    {formData.recipientId && (
                                                        <div className="absolute right-3 top-[38px] flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-lg pointer-events-none">
                                                            <span className="material-symbols-outlined text-[12px]">verified</span>
                                                            VINCULADO
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                                {formData.taskType === 'message' ? 'Assunto do Recado *' : 'Título da Tarefa *'}
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.title}
                                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                                className="w-full p-4 border border-gray-300 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-base font-medium transition-all shadow-sm"
                                                placeholder={formData.taskType === 'message' ? "Ex: Documentação Pendente, Aviso Clínico..." : "O que precisa ser feito?"}
                                                autoFocus
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2 grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Prioridade</label>
                                                    <select
                                                        value={formData.priority}
                                                        onChange={e => setFormData({ ...formData, priority: e.target.value as Priority })}
                                                        className="w-full p-3 border border-gray-300 rounded-xl focus:border-primary outline-none text-sm bg-white cursor-pointer shadow-sm"
                                                    >
                                                        {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Status</label>
                                                    <select
                                                        value={formData.status}
                                                        onChange={e => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                                                        className="w-full p-3 border border-gray-300 rounded-xl focus:border-primary outline-none text-sm bg-white cursor-pointer shadow-sm"
                                                    >
                                                        {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                                {formData.taskType === 'message' ? 'Formalização do Texto *' : 'Detalhes / Observações'}
                                            </label>
                                            <textarea
                                                value={formData.description}
                                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                                className="w-full p-4 border border-gray-300 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm resize-none h-40 transition-all shadow-sm"
                                                placeholder={formData.taskType === 'message' ? "Digite aqui o conteúdo completo do recado..." : "Descreva os passos necessários para concluir esta tarefa..."}
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
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Carteirinha</label>
                                                            <input
                                                                type="text"
                                                                value={formData.patientCard}
                                                                onChange={e => setFormData({ ...formData, patientCard: e.target.value })}
                                                                className="w-full p-3 border border-gray-300 rounded-xl focus:border-primary outline-none text-sm"
                                                                placeholder="000.000.000"
                                                                disabled={!formData.isPatientRelated}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Guia</label>
                                                            <input
                                                                type="text"
                                                                value={formData.patientGuide}
                                                                onChange={e => setFormData({ ...formData, patientGuide: e.target.value })}
                                                                className="w-full p-3 border border-gray-300 rounded-xl focus:border-primary outline-none text-sm"
                                                                placeholder="Opcional"
                                                                disabled={!formData.isPatientRelated}
                                                            />
                                                        </div>
                                                    </div>
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
                                        Excluir Tarefa
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
                                        {modalMode === 'create' ? (formData.taskType === 'message' ? 'Criar Recado' : 'Criar Tarefa') : 'Salvar Alterações'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- PRINTABLE RECADO HIDDEN --- */}
            <div style={{ display: 'none' }}>
                <div ref={printableRef} className="print-recado-container" style={{
                    width: '15cm',
                    minHeight: '12cm',
                    padding: '0.6cm',
                    backgroundColor: 'white',
                    color: 'black',
                    fontFamily: '"Segoe UI", Roboto, Arial, sans-serif',
                    display: 'flex',
                    flexDirection: 'column',
                    border: '2px solid #00665C',
                    position: 'relative'
                }}>
                    {/* Header: Brand & Meta */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #00665C', paddingBottom: '8px', marginBottom: '10px' }}>
                        <div>
                            <div style={{ fontSize: '8px', fontWeight: '800', color: '#666', textTransform: 'uppercase', marginBottom: '2px' }}>Para: Profissional / Destinatário</div>
                            <div style={{ color: '#00665C', fontSize: '18px', fontWeight: '900', letterSpacing: '-0.5px', lineHeight: '1.2' }}>{formData.recipientName || 'CORPO CLÍNICO CDU'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ backgroundColor: '#00665C', color: 'white', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', display: 'inline-block' }}>
                                {formData.messageType?.toUpperCase() || 'RECADO'}
                            </div>
                        </div>
                    </div>

                    {/* Patient Smart Box */}
                    {formData.isPatientRelated && (
                        <div style={{ border: '1.5px solid #eee', borderRadius: '8px', padding: '8px 12px', marginBottom: '10px', backgroundColor: '#fcfcfc' }}>
                            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                <div style={{ flex: 2 }}>
                                    <div style={{ fontSize: '7px', fontWeight: '800', color: '#00665C', textTransform: 'uppercase', marginBottom: '1px' }}>Paciente / Beneficiário</div>
                                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#111' }}>{formData.patient}</div>
                                </div>
                                {formData.patientCard && (
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '7px', fontWeight: '800', color: '#666', textTransform: 'uppercase', marginBottom: '1px' }}>Carteirinha</div>
                                        <div style={{ fontSize: '10px', fontWeight: '700', color: '#333', fontFamily: 'monospace' }}>{formData.patientCard}</div>
                                    </div>
                                )}
                                {formData.patientGuide && (
                                    <div style={{ flex: 0.8 }}>
                                        <div style={{ fontSize: '7px', fontWeight: '800', color: '#666', textTransform: 'uppercase', marginBottom: '1px' }}>Guia</div>
                                        <div style={{ fontSize: '10px', fontWeight: '700', color: '#333' }}>{formData.patientGuide}</div>
                                    </div>
                                )}
                                {formData.patientPhone && (
                                    <div style={{ flex: 1, textAlign: 'right' }}>
                                        <div style={{ fontSize: '7px', fontWeight: '800', color: '#666', textTransform: 'uppercase', marginBottom: '1px' }}>Contato</div>
                                        <div style={{ fontSize: '10px', fontWeight: '700', color: '#333' }}>{formData.patientPhone}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Content Section */}
                    <div style={{ flex: 1, border: '1.5px solid #eee', borderRadius: '8px', padding: '10px 15px', display: 'flex', flexDirection: 'column', minHeight: '0' }}>
                        <div style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: '5px', marginBottom: '8px' }}>
                            <div style={{ fontSize: '7px', fontWeight: '800', color: '#999', textTransform: 'uppercase' }}>Assunto do Registro</div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#000' }}>{formData.title}</div>
                        </div>
                        <div style={{ fontSize: '11px', lineHeight: '1.4', color: '#333', whiteSpace: 'pre-wrap', flex: 1 }}>
                            {formData.description || <span style={{ color: '#aaa', fontStyle: 'italic' }}>Nenhum conteúdo detalhado informado.</span>}
                        </div>
                    </div>

                    {/* Footer / Signature Row */}
                    <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '10px' }}>
                        <div style={{ border: '1px solid #f0f0f0', borderRadius: '6px', padding: '6px 10px' }}>
                            <div style={{ fontSize: '6px', fontWeight: 'bold', color: '#aaa', textTransform: 'uppercase', marginBottom: '2px' }}>Formalizado por</div>
                            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#333' }}>{formData.authorName || (user?.role === 'reception' ? 'RECEPCIONISTA' : user?.name) || 'SISTEMA UNIFICADO'}</div>
                            <div style={{ fontSize: '7px', color: '#00665C', marginTop: '1px', fontWeight: 'bold' }}>setor: {selectedFloor || 'Não informado'}</div>
                        </div>
                        <div style={{ border: '1px solid #f0f0f0', borderRadius: '6px', padding: '6px 10px', textAlign: 'right' }}>
                            <div style={{ fontSize: '7px', fontWeight: 'bold', color: '#aaa', textTransform: 'uppercase', marginBottom: '2px' }}>Data e Horário</div>
                            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#333' }}>{new Date().toLocaleString('pt-BR')}</div>
                            <div style={{ fontSize: '7px', color: '#666', marginTop: '1px' }}>Bauru - SP</div>
                        </div>
                    </div>

                    {/* Divider for storage book */}
                    <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px dashed #ccc', textAlign: 'center' }}>
                        <div style={{ fontSize: '7px', color: '#bbb', textTransform: 'uppercase', letterSpacing: '4px', fontWeight: 'bold' }}>ANEXAR AO LIVRO OFÍCIO</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Tasks;