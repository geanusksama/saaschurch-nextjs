import { Link } from 'react-router';
import { Mail, Phone } from 'lucide-react';

const leaders = [
  { name: 'Pastor João Silva', role: 'Pastor Presidente', email: 'joao@igreja.com', phone: '(11) 98765-1111' },
  { name: 'Pastora Maria Santos', role: 'Pastora Auxiliar', email: 'maria@igreja.com', phone: '(11) 98765-2222' },
  { name: 'Pastor Carlos Oliveira', role: 'Pastor de Jovens', email: 'carlos@igreja.com', phone: '(11) 98765-3333' },
  { name: 'Pastora Ana Paula', role: 'Pastora de Mulheres', email: 'ana@igreja.com', phone: '(11) 98765-4444' },
  { name: 'Pr. Roberto Costa', role: 'Pastor de Células', email: 'roberto@igreja.com', phone: '(11) 98765-5555' },
  { name: 'Pr. Fernando Lima', role: 'Pastor de Discipulado', email: 'fernando@igreja.com', phone: '(11) 98765-6666' }
];

export function Leadership() {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gradient-to-r from-purple-600 to-blue-500 text-white py-4 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/public" className="text-2xl font-bold">MRM Church</Link>
          <nav className="flex gap-6">
            <Link to="/public" className="hover:underline">Home</Link>
            <Link to="/public/leadership" className="font-semibold">Liderança</Link>
            <Link to="/auth/login" className="hover:underline">Login</Link>
          </nav>
        </div>
      </header>

      <section className="bg-gradient-to-r from-purple-600 to-blue-500 text-white py-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h1 className="text-5xl font-bold mb-6">Nossa Liderança</h1>
          <p className="text-xl text-purple-100">Servos comprometidos com o Reino de Deus</p>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            {leaders.map((leader, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-all">
                <div className="w-24 h-24 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold">
                  {leader.name.split(' ').map(n => n[0]).join('')}
                </div>
                <h3 className="text-xl font-bold text-slate-900 text-center mb-1">{leader.name}</h3>
                <p className="text-purple-600 font-semibold text-center mb-4">{leader.role}</p>
                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <span>{leader.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    <span>{leader.phone}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-slate-400">© 2024 MRM Church. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
