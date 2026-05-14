import { Link } from 'react-router';
import { Target, Compass, Heart, Star } from 'lucide-react';

export function Vision() {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gradient-to-r from-purple-600 to-blue-500 text-white py-4 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/public" className="text-2xl font-bold">MRM Church</Link>
          <nav className="flex gap-6">
            <Link to="/public" className="hover:underline">Home</Link>
            <Link to="/public/about" className="hover:underline">Sobre</Link>
            <Link to="/public/vision" className="font-semibold">Visão</Link>
            <Link to="/auth/login" className="hover:underline">Login</Link>
          </nav>
        </div>
      </header>

      <section className="bg-gradient-to-r from-purple-600 to-blue-500 text-white py-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h1 className="text-5xl font-bold mb-6">Nossa Visão e Valores</h1>
          <p className="text-xl text-purple-100">Princípios que nos guiam em nossa jornada de fé</p>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12">
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-10">
              <Target className="w-16 h-16 text-purple-600 mb-6" />
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Nossa Visão</h2>
              <p className="text-lg text-slate-700 leading-relaxed">
                Ser uma igreja que transforma vidas através do discipulado intencional, 
                plantando igrejas saudáveis em cada cidade e região do Brasil, 
                capacitando líderes para impactar suas gerações com o Evangelho.
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-10">
              <Compass className="w-16 h-16 text-blue-600 mb-6" />
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Nosso Propósito</h2>
              <p className="text-lg text-slate-700 leading-relaxed">
                Fazer discípulos que fazem discípulos, construindo uma comunidade 
                fundamentada na Palavra de Deus, no amor fraternal e no serviço ao próximo,
                glorificando a Deus em tudo que fazemos.
              </p>
            </div>
          </div>

          <div className="mt-12 grid md:grid-cols-4 gap-6">
            {[
              { icon: Heart, title: 'Amor', desc: 'Base de tudo que fazemos' },
              { icon: Star, title: 'Excelência', desc: 'Fazer o melhor para Deus' },
              { icon: Target, title: 'Propósito', desc: 'Vidas transformadas' },
              { icon: Compass, title: 'Direção', desc: 'Guiados pelo Espírito' }
            ].map((value, i) => {
              const Icon = value.icon;
              return (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 text-center">
                  <Icon className="w-12 h-12 text-purple-600 mx-auto mb-4" />
                  <h3 className="font-bold text-slate-900 mb-2">{value.title}</h3>
                  <p className="text-sm text-slate-600">{value.desc}</p>
                </div>
              );
            })}
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
