import { Outlet, Link, useLocation } from 'react-router';
import { Home, Calendar, Radio, Video, Users, BookOpen, Mail, Phone, Menu, X } from 'lucide-react';
import { useState } from 'react';

const navigation = [
  { name: 'Início', path: '/public', icon: Home },
  { name: 'Sobre', path: '/public/about' },
  { name: 'Ministérios', path: '/public/ministries' },
  { name: 'Eventos', path: '/public/events', icon: Calendar },
  { name: 'Rádio', path: '/public/radio', icon: Radio },
  { name: 'Ao Vivo', path: '/public/live', icon: Video },
  { name: 'Contato', path: '/public/contact', icon: Mail },
];

export function PublicWebsite() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/public" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">M</span>
              </div>
              <div>
                <h1 className="font-bold text-slate-900">Igreja MRM</h1>
                <p className="text-xs text-slate-500">Transformando Vidas</p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              {navigation.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`text-sm font-medium transition-colors ${
                      isActive ? 'text-purple-600' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* CTA */}
            <div className="hidden md:flex items-center gap-4">
              <Link
                to="/auth/login"
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Entrar
              </Link>
              <Link
                to="/public/events"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                Ver Eventos
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-slate-100 rounded-lg"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-slate-600" />
              ) : (
                <Menu className="w-6 h-6 text-slate-600" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white">
            <nav className="px-4 py-4 space-y-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-4 py-2 rounded-lg text-sm font-medium ${
                      isActive
                        ? 'bg-purple-50 text-purple-600'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-xl">M</span>
                </div>
                <div>
                  <h3 className="font-bold">Igreja MRM</h3>
                  <p className="text-xs text-slate-400">Transformando Vidas</p>
                </div>
              </div>
              <p className="text-sm text-slate-400">
                Uma igreja comprometida com o Reino de Deus e a transformação de vidas.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-4">Links Rápidos</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link to="/public/about" className="hover:text-white">Sobre Nós</Link></li>
                <li><Link to="/public/ministries" className="hover:text-white">Ministérios</Link></li>
                <li><Link to="/public/events" className="hover:text-white">Eventos</Link></li>
                <li><Link to="/public/contact" className="hover:text-white">Contato</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4">Cultos</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>Domingo: 9h e 18h</li>
                <li>Quarta: 20h (Reunião de Oração)</li>
                <li>Sexta: 20h (Culto de Jovens)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4">Contato</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  (11) 98765-4321
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  contato@igrejamrm.com.br
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-800 text-center text-sm text-slate-400">
            <p>&copy; 2024 Igreja MRM. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
