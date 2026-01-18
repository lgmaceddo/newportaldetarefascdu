import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Settings: React.FC = () => {
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Stats State ---
    const [stats, setStats] = useState({
        professionals: 0,
        receptionists: 0,
        scripts: 0,
        tasks: 0,
        notes: 0,
        lastBackup: localStorage.getItem('mediportal_last_backup_date') || 'Nunca realizado',
    });

    // Load stats on mount
    useEffect(() => {
        const loadStats = () => {
            const docs = JSON.parse(localStorage.getItem('mediportal_professionals') || '[]');
            const recs = JSON.parse(localStorage.getItem('mediportal_receptionists') || '[]');
            const scripts = JSON.parse(localStorage.getItem('mediportal_scripts') || '[]');
            const tasks = JSON.parse(localStorage.getItem('mediportal_tasks') || '[]');
            const notes = JSON.parse(localStorage.getItem('mediportal_notes') || '[]');

            setStats(prev => ({
                ...prev,
                professionals: docs.length,
                receptionists: recs.length,
                scripts: scripts.length,
                tasks: tasks.length,
                notes: notes.length,
            }));
        };
        loadStats();
    }, []);

    // --- Export Logic ---
    const handleExport = () => {
        const data = {
            meta: {
                version: '1.0',
                exportedBy: user?.name,
                timestamp: new Date().toISOString(),
            },
            data: {
                mediportal_professionals: localStorage.getItem('mediportal_professionals'),
                mediportal_receptionists: localStorage.getItem('mediportal_receptionists'),
                mediportal_notes: localStorage.getItem('mediportal_notes'),
                mediportal_scripts: localStorage.getItem('mediportal_scripts'),
                mediportal_script_categories: localStorage.getItem('mediportal_script_categories'),
                mediportal_rooms: localStorage.getItem('mediportal_rooms'),
                mediportal_allocations: localStorage.getItem('mediportal_allocations'),
                mediportal_preparations: localStorage.getItem('mediportal_preparations'),
                mediportal_units_info: localStorage.getItem('mediportal_units_info'),
            }
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `mediportal_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Update last backup date
        const now = new Date().toLocaleString();
        localStorage.setItem('mediportal_last_backup_date', now);
        setStats(prev => ({ ...prev, lastBackup: now }));
    };

    // --- Import Logic ---
    const handleImportClick = () => {
        if (window.confirm("ATENÇÃO: Importar um backup substituirá TODOS os dados atuais do sistema (Médicos, Recados, Scripts, etc.).\n\nDeseja continuar?")) {
            fileInputRef.current?.click();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                const json = JSON.parse(content);

                if (!json.data) {
                    throw new Error("Formato de arquivo inválido.");
                }

                // Restore keys
                Object.keys(json.data).forEach(key => {
                    if (json.data[key] !== null) {
                        localStorage.setItem(key, json.data[key]);
                    }
                });

                alert("Importação realizada com sucesso! O sistema será recarregado.");
                window.location.reload();

            } catch (error) {
                console.error(error);
                alert("Erro ao importar arquivo. Verifique se o arquivo é um backup válido do MediPortal.");
            }
        };
        reader.readAsText(file);
        // Reset input
        e.target.value = '';
    };

    return (
        <div className="flex flex-col gap-8 w-full">

            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Configurações do Sistema</h2>
                <p className="text-gray-500 text-sm">Visão geral e gerenciamento de dados do portal.</p>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                        <span className="material-symbols-outlined text-2xl">groups</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Corpo Clínico</p>
                        <h3 className="text-2xl font-bold text-gray-800">{stats.professionals}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                        <span className="material-symbols-outlined text-2xl">support_agent</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Recepção</p>
                        <h3 className="text-2xl font-bold text-gray-800">{stats.receptionists}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                        <span className="material-symbols-outlined text-2xl">description</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Scripts Ativos</p>
                        <h3 className="text-2xl font-bold text-gray-800">{stats.scripts}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
                        <span className="material-symbols-outlined text-2xl">sticky_note_2</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Recados no Sistema</p>
                        <h3 className="text-2xl font-bold text-gray-800">{stats.notes}</h3>
                    </div>
                </div>
            </div>

            {/* Data Management Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                    <span className="material-symbols-outlined text-gray-500">database</span>
                    <h3 className="font-bold text-gray-800">Backup e Restauração de Dados</h3>
                </div>

                <div className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                        {/* Export Column */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary mt-1">
                                    <span className="material-symbols-outlined">cloud_download</span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800 text-lg">Exportar Dados (Backup)</h4>
                                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                                        Gere um arquivo JSON contendo todos os cadastros de médicos, recepcionistas, scripts, recados e configurações de salas. Salve este arquivo em local seguro.
                                    </p>
                                    <p className="text-xs text-gray-400 mt-2 font-mono">
                                        Último backup: {stats.lastBackup}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={handleExport}
                                className="mt-auto w-full py-3 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined">download</span>
                                Baixar Backup (.json)
                            </button>
                        </div>

                        {/* Divider */}
                        <div className="hidden md:block w-px bg-gray-200 self-stretch mx-auto"></div>

                        {/* Import Column */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-red-50 rounded-lg text-red-600 mt-1">
                                    <span className="material-symbols-outlined">cloud_upload</span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800 text-lg">Importar Dados</h4>
                                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                                        Restaure o sistema a partir de um arquivo de backup anterior.
                                    </p>
                                    <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                                        <p className="text-xs text-red-600 font-bold flex items-center gap-1">
                                            <span className="material-symbols-outlined text-sm">warning</span>
                                            Atenção:
                                        </p>
                                        <p className="text-xs text-red-500 mt-1">
                                            Esta ação substituirá <strong>todos</strong> os dados atuais pelos dados do arquivo. Esta ação é irreversível.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept=".json"
                                onChange={handleFileChange}
                            />

                            <button
                                onClick={handleImportClick}
                                className="mt-auto w-full py-3 bg-white border-2 border-dashed border-gray-300 hover:border-red-400 hover:bg-red-50 text-gray-600 hover:text-red-600 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined">upload_file</span>
                                Selecionar Arquivo para Restaurar
                            </button>
                        </div>

                    </div>
                </div>
            </div>

            {/* Info Section */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 flex items-start gap-4">
                <span className="material-symbols-outlined text-blue-600 text-3xl">info</span>
                <div>
                    <h4 className="font-bold text-blue-900">Sobre os Dados</h4>
                    <p className="text-sm text-blue-800 mt-1 leading-relaxed">
                        O MediPortal armazena todas as informações localmente no seu navegador (Local Storage) para garantir rapidez e privacidade.
                        Por isso, é fundamental realizar backups periódicos caso você precise limpar o cache do navegador ou mudar de computador.
                    </p>
                </div>
            </div>

        </div>
    );
};

export default Settings;