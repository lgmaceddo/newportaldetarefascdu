import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface NavItem {
  name: string;
  icon: string;
  path?: string;
  subItems?: { name: string; icon: string; path: string }[];
}

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  // Define menu structure
  const allNavItems: NavItem[] = [
    {
      name: 'Agenda',
      icon: 'calendar_month',
      subItems: [
        { name: 'Confirmar Consulta', icon: 'event_available', path: '/agenda/confirmacao' },
        { name: 'Confirmar Procedimento', icon: 'fact_check', path: '/agenda/confirmar-procedimento' },
        { name: 'Reagendamento', icon: 'edit_calendar', path: '/agenda/reagendamento' },
        { name: 'Espelho Diário', icon: 'summarize', path: '/agenda/espelho-diario' },
      ]
    },
    { name: 'Tarefas', icon: 'check_circle', path: '/tarefas' },
    { name: 'Mapa Diário', icon: 'map', path: '/mapa' },
    { name: 'Scripts', icon: 'description', path: '/scripts' },
    { name: 'Equipe Recepção', icon: 'groups', path: '/recepcao' },
    { name: 'Corpo Clínico', icon: 'manage_accounts', path: '/profissionais' },
    { name: 'Usuários', icon: 'admin_panel_settings', path: '/usuarios' },
    { name: 'Dashboard', icon: 'dashboard', path: '/' },
    { name: 'Configurações', icon: 'settings', path: '/configuracoes' },
  ];

  // Filter items based on user role
  const navItems = allNavItems.filter(item => {
    // Doctor View: Restricted to Dashboard, Tarefas
    if (user?.role === 'doctor') {
      return ['Dashboard', 'Tarefas'].includes(item.name);
    }

    // Reception View: Show everything (Dashboard is already in allNavItems at the specific position)
    if (user?.role === 'reception') {
      return true;
    }

    return true;
  });

  const [expandedMenus, setExpandedMenus] = useState<string[]>(
    location.pathname.includes('/agenda') ? ['Agenda'] : []
  );

  const toggleMenu = (name: string) => {
    setExpandedMenus(prev =>
      prev.includes(name)
        ? []
        : [name]
    );
  };

  return (
    <aside className="w-20 lg:w-64 bg-white border-r border-gray-200 flex flex-col h-full shrink-0 transition-all duration-300 py-4">
      <nav className="flex-1 flex flex-col gap-1 px-3 overflow-y-auto no-scrollbar">
        {navItems.map((item) => (
          <div key={item.name}>
            {item.subItems ? (
              <>
                <button
                  onClick={() => toggleMenu(item.name)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors group text-base font-bold ${location.pathname.includes(item.name.toLowerCase()) || expandedMenus.includes(item.name)
                    ? 'text-primary-dark bg-primary-light'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                >
                  <div className="flex items-center">
                    <span className="material-symbols-outlined text-xl">{item.icon}</span>
                    <span className="ml-3 hidden lg:block">{item.name}</span>
                  </div>
                  <span className={`material-symbols-outlined text-sm hidden lg:block transition-transform duration-200 ${expandedMenus.includes(item.name) ? 'rotate-180' : ''
                    }`}>
                    expand_more
                  </span>
                </button>

                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedMenus.includes(item.name) ? 'max-h-52 opacity-100 mt-1' : 'max-h-0 opacity-0'
                  }`}>
                  <div className="flex flex-col gap-1 pl-0 lg:pl-3 relative ml-2 border-l-2 border-gray-100">
                    {item.subItems.map((sub) => (
                      <NavLink
                        key={sub.path}
                        to={sub.path}
                        className={({ isActive }) =>
                          `flex items-center px-3 py-2 rounded-r-lg transition-colors text-sm font-bold ${isActive
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                          }`
                        }
                      >
                        <span className="material-symbols-outlined text-base mr-2">
                          {sub.icon}
                        </span>
                        <span className="hidden lg:block">{sub.name}</span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <NavLink
                to={item.path!}
                onClick={() => setExpandedMenus([])}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2.5 rounded-lg transition-colors text-base font-bold ${isActive
                    ? 'bg-primary-light text-primary-dark shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <span className="material-symbols-outlined text-xl">{item.icon}</span>
                <span className="ml-3 hidden lg:block">{item.name}</span>
              </NavLink>
            )}
          </div>
        ))}
      </nav>

      <div className="pt-4 pb-2 px-2 flex flex-col items-center gap-4 shrink-0">
        <div className="w-full h-px bg-gray-100"></div>
        <img
          src="/unimed-bauru-logo.png"
          alt="Unimed Bauru"
          className="w-auto h-8 lg:h-12 object-contain opacity-80 hover:opacity-100 transition-opacity duration-300"
        />
        <div className="hidden lg:block text-center mt-[-10px]">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] leading-tight">Centro de Diagnóstico</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;