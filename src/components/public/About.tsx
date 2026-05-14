import { Link } from 'react-router';
import { Heart, Users, Globe, Target } from 'lucide-react';

export function About() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-blue-500 text-white py-4 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/public" className="text-2xl font-bold">MRM Church</Link>
          <nav className="flex gap-6">
            <Link to="/public" className="hover:underline">Home</Link>
            <Link to="/public/about" className="font-semibold">Sobre</Link>
            <Link to="/public/events" className="hover:underline">Eventos</Link>
            <Link to="/auth/login" className="hover:underline">Login</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-r from-purple-600 to-blue-500 text-white py-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h1 className="text-5xl font-bold mb-6">Sobre Nossa Igreja</h1>
          <p className="text-xl text-purple-100">
            Uma comunidade comprometida com o Reino de Deus, transformando vidas através do amor e da Palavra.
          </p>
        </div>
      </section>

      {/* Mission, Vision, Values */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-8 border border-slate-200">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-6">
                <Target className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Missão</h3>
              <p className="text-slate-600 leading-relaxed">
                Fazer discípulos de todas as nações, ensinando-os a obedecer tudo o que Jesus ordenou, transformando vidas através do amor de Deus.
              </p>
            </div>

            <div className="bg-white rounded-xl p-8 border border-slate-200">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                <Globe className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Visão</h3>
              <p className="text-slate-600 leading-relaxed">
                Ser uma igreja referência em discipulado e plantação de igrejas, alcançando cada cidade com o Evangelho através de células multiplicadoras.
              </p>
            </div>

            <div className="bg-white rounded-xl p-8 border border-slate-200">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <Heart className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Valores</h3>
              <ul className="text-slate-600 space-y-2">
                <li>• Palavra de Deus</li>
                <li>• Oração</li>
                <li>• Comunhão</li>
                <li>• Discipulado</li>
                <li>• Evangelismo</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl font-bold text-center text-slate-900 mb-12">Nossa Comunidade</h2>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-5xl font-bold text-purple-600 mb-2">50+</div>
              <p className="text-slate-600 dark:text-slate-400">Anos de História</p>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold text-blue-600 mb-2">15K+</div>
              <p className="text-slate-600 dark:text-slate-400">Membros</p>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold text-green-600 mb-2">200+</div>
              <p className="text-slate-600 dark:text-slate-400">Igrejas</p>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold text-orange-600 mb-2">30+</div>
              <p className="text-slate-600 dark:text-slate-400">Ministérios</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-slate-400">© 2024 MRM Church. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
