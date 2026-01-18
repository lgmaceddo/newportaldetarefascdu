import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Doctor, Receptionist } from '../types';

// We keep these for reference if needed, but Supabase is the source of truth now.

const Login: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');

  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove tudo que não é dígito
    if (value.length > 11) value = value.slice(0, 11); // Limita a 11 dígitos

    // Aplica a máscara (xx) xxxxx-xxxx
    if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    }
    if (value.length > 7) { // (xx) xxxxx
      value = `${value.slice(0, 10)}-${value.slice(10)}`;
    }

    setPhone(value);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    // Capitalize logic...
    const exceptions = ['de', 'da', 'do', 'dos', 'das', 'e'];
    const formatted = input.toLowerCase().replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());

    const words = input.split(' ');
    const finalName = words.map((word, index) => {
      if (word.length === 0) return '';
      const lower = word.toLowerCase();
      if (index !== 0 && exceptions.includes(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    }).join(' ');

    setName(finalName);
  };

  const handleToggleRegistration = () => {
    const nextState = !isRegistering;
    setIsRegistering(nextState);

    if (nextState) {
      // Defaults for quick demo flow removed, strict real registration now
      setPassword('');
      setPhone('');
      setName('');
      setEmail('');
    } else {
      setPassword('');
      setName('');
      setEmail('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      alert("Email e Senha são obrigatórios.");
      return;
    }

    if (isRegistering && !name.trim()) {
      alert("Nome é obrigatório para cadastro.");
      return;
    }

    setLoading(true);

    try {
      if (isRegistering) {
        // --- REGISTRATION ---
        const userAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ef4444&color=fff`;

        // 1. Sign Up with Supabase Auth (Trigger handles profile creation)
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name,
              role: 'reception',
              avatar: userAvatar,
              specialty: '',
              gender: gender,
              phone: phone || '',
              color: '#10b981' // Standard green for reception
            }
          }
        });

        if (authError) throw authError;

        if (authData.user) {
          // If email confirmation is enabled, the user might not be able to login immediately
          // but the profile is created via trigger.
          if (authData.session) {
            // Auto login successful
            alert("Cadastro realizado com sucesso!");
            navigate('/');
          } else {
            // Email confirmation needed
            alert("Cadastro realizado! Por favor, verifique seu email para confirmar a conta antes de entrar.");
            // Optionally redirect to login or clear form
            setIsRegistering(false);
          }
        }

      } else {
        // --- LOGIN ---
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (loginError) throw loginError;
        navigate('/');
      }

    } catch (error: any) {
      console.error("Authentication Error:", error);
      alert(error.message || "Ocorreu um erro na autenticação.");
    } finally {
      setLoading(false);
    }
  };

  // Quick Login Demo is removed or adjusted to just fill fields for testing if needed
  const fillDemoLogin = (type: 'reception') => {
    setEmail('recepcao@unimed.com');
    setPassword('123456'); // Example
    // Note: These users need to actually exist in Supabase!
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4 font-sans">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row min-h-[550px]">

        {/* Left Side - Form */}
        <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center overflow-y-auto max-h-[90vh] custom-scrollbar">
          <div className="mb-6">
            <div className="size-12 bg-primary rounded-xl flex items-center justify-center text-white mb-5 shadow-lg shadow-primary/30">
              <span className="material-symbols-outlined text-2xl">local_hospital</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
              {isRegistering ? 'Novo Cadastro' : 'Acesso ao Portal'}
            </h1>
            <p className="text-gray-500 text-sm font-medium">
              {isRegistering
                ? 'Preencha seus dados para criar um acesso.'
                : 'Utilize seu email e senha para entrar.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">



            <div className="space-y-4">
              {isRegistering && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-wide">
                    Sexo:
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      onClick={() => setGender('male')}
                      className={`cursor-pointer border-2 rounded-xl p-3 flex items-center justify-center gap-2 transition-all ${gender === 'male'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-gray-100 text-gray-400 hover:border-gray-200 bg-gray-50'
                        }`}
                    >
                      <span className="material-symbols-outlined text-xl">male</span>
                      <span className="text-sm font-bold">Masculino</span>
                    </div>
                    <div
                      onClick={() => setGender('female')}
                      className={`cursor-pointer border-2 rounded-xl p-3 flex items-center justify-center gap-2 transition-all ${gender === 'female'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-gray-100 text-gray-400 hover:border-gray-200 bg-gray-50'
                        }`}
                    >
                      <span className="material-symbols-outlined text-xl">female</span>
                      <span className="text-sm font-bold">Feminino</span>
                    </div>
                  </div>
                </div>
              )}

              {isRegistering && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Nome Completo</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">person</span>
                    <input
                      type="text"
                      required={isRegistering}
                      value={name}
                      onChange={handleNameChange}
                      className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-medium text-gray-700"
                      placeholder="Digite seu nome completo..."
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Email</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">mail</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-medium text-gray-700"
                    placeholder="seu.email@exemplo.com"
                  />
                </div>
              </div>

              {/* Conditional Fields for Registration */}
              {isRegistering && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">


                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Celular <span className="text-gray-300 normal-case font-normal">(Opcional)</span></label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">smartphone</span>
                      <input
                        type="text"
                        value={phone}
                        onChange={handlePhoneChange}
                        className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-medium text-gray-700"
                        placeholder="(XX) XXXXX-XXXX"
                        maxLength={15}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Senha</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">lock</span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-medium text-gray-700"
                    placeholder="******"
                    minLength={6}
                  />
                </div>
                {isRegistering && <p className="text-[10px] text-gray-400 mt-1 ml-1">Mínimo 6 caracteres</p>}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all transform active:scale-[0.98] mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
              ) : (
                <>
                  <span>{isRegistering ? 'Finalizar Cadastro' : 'Entrar no Sistema'}</span>
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={handleToggleRegistration}
              className="text-sm text-gray-500 hover:text-primary font-medium transition-colors outline-none"
            >
              {isRegistering ? 'Já possui cadastro? Fazer Login' : 'Primeiro acesso? Cadastre-se aqui'}
            </button>
          </div>

          {/* Temporary helper for dev */}
          {!isRegistering && (
            <div className="mt-8 pt-4 border-t border-gray-100 flex justify-center gap-4 opacity-50 hover:opacity-100 transition-opacity">
              <button onClick={() => fillDemoLogin('reception')} className="text-[10px] text-gray-400 hover:text-primary underline font-bold uppercase tracking-widest">
                Acesso Rápido - Recepção
              </button>
            </div>
          )}
        </div>

        {/* Right Side - Visual */}
        <div className="hidden md:block w-1/2 bg-primary relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80')] bg-cover bg-center opacity-30 mix-blend-overlay"></div>
          <div className="absolute inset-0 bg-gradient-to-tr from-primary-dark via-primary to-primary/80"></div>

          <div className="relative h-full flex flex-col justify-between p-12 text-white">
            <div className="flex justify-end">
              <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-bold tracking-widest uppercase border border-white/20">
                Unimed Bauru
              </div>
            </div>

            <div>
              <div className="size-16 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center mb-6 border border-white/20">
                <span className="material-symbols-outlined text-3xl">token</span>
              </div>
              <h2 className="text-4xl font-bold mb-4 leading-tight tracking-tight">Gestão Unificada de Atendimento</h2>
              <p className="text-primary-light text-lg leading-relaxed opacity-90 font-medium max-w-sm">
                Simplifique a rotina da sua equipe. Confirmações, agendamentos e comunicação interna em um só lugar.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-medium text-white/60">
              <span className="material-symbols-outlined text-sm">verified_user</span>
              Acesso seguro e monitorado.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;