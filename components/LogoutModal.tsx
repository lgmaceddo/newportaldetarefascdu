import React from 'react';

interface LogoutModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

const LogoutModal = ({ onConfirm, onCancel }: LogoutModalProps) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 bg-primary-dark text-white border-b border-white/10 flex justify-between items-center">
          <h3 className="font-bold text-lg">Confirmar Saída</h3>
          <button onClick={onCancel} className="text-white hover:text-gray-300">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6 text-center">
          <div className="size-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
            <span className="material-symbols-outlined text-3xl">logout</span>
          </div>
          <h4 className="text-gray-800 font-bold text-lg mb-2">Sair do Sistema?</h4>
          <p className="text-gray-500 text-sm">Você precisará fazer login novamente para acessar o portal.</p>
        </div>
        <div className="p-4 border-t border-gray-100 flex gap-3 bg-gray-50">
          <button onClick={onCancel} className="flex-1 py-2.5 text-gray-600 font-bold hover:bg-gray-200 bg-white border border-gray-200 rounded-lg transition-colors text-sm">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-colors shadow-sm text-sm">Sair</button>
        </div>
      </div>
    </div>
  );
};

export default LogoutModal;
