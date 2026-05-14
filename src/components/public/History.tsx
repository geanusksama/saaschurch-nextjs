import { Link } from 'react-router';
import { Calendar } from 'lucide-react';

const milestones = [
  { year: 1974, title: 'Fundação', desc: 'Início da igreja com 12 membros' },
  { year: 1985, title: 'Primeira Expansão', desc: 'Abertura de 5 congregações' },
  { year: 1995, title: 'Crescimento Regional', desc: '50 igrejas plantadas' },
  { year: 2005, title: 'Alcance Nacional', desc: 'Presença em 15 estados' },
  { year: 2015, title: 'Transformação Digital', desc: 'Implementação de tecnologia' },
  { year: 2024, title: 'Visão 2030', desc: '500 igrejas e 100 mil membros' }
];

export function History() {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gradient-to-r from-purple-600 to-blue-500 text-white py-4 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/public" className="text-2xl font-bold">MRM Church</Link>
          <nav className="flex gap-6">
            <Link to="/public" className="hover:underline">Home</Link>
            <Link to="/public/history" className="font-semibold">História</Link>
            <Link to="/auth/login" className="hover:underline">Login</Link>
          </nav>
        </div>
      </header>

      <section className="bg-gradient-to-r from-purple-600 to-blue-500 text-white py-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h1 className="text-5xl font-bold mb-6">Nossa História</h1>
          <p className="text-xl text-purple-100">50 anos transformando vidas para a glória de Deus</p>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-1 bg-purple-200"></div>
            
            <div className="space-y-12">
              {milestones.map((milestone, i) => (
                <div key={i} className="relative pl-20">
                  <div className="absolute left-0 w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold border-4 border-white shadow-lg">
                    <Calendar className="w-8 h-8" />
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-lg transition-all">
                    <span className="text-2xl font-bold text-purple-600">{milestone.year}</span>
                    <h3 className="text-xl font-bold text-slate-900 mt-2 mb-2">{milestone.title}</h3>
                    <p className="text-slate-600 dark:text-slate-400">{milestone.desc}</p>
                  </div>
                </div>
              ))}
            </div>
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
