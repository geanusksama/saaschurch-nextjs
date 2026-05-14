import { Link } from 'react-router';
import { Calendar, User, Tag, ArrowRight, TrendingUp, Heart, MessageCircle } from 'lucide-react';

const featuredPost = {
  title: 'Como Viver uma Vida de Propósito em 2024',
  excerpt: 'Descubra os princípios bíblicos que vão transformar sua jornada espiritual e dar direção aos seus passos.',
  author: 'Pr. João Silva',
  date: '10 de Março, 2024',
  category: 'Vida Cristã',
  image: 'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=1200',
  readTime: '8 min',
  views: '2.5K',
  likes: 234
};

const posts = [
  {
    title: 'O Poder da Oração Persistente',
    excerpt: 'Aprenda com exemplos bíblicos como a perseverança na oração pode mudar sua vida.',
    author: 'Pra. Maria Santos',
    date: '8 de Março, 2024',
    category: 'Oração',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
    readTime: '5 min'
  },
  {
    title: 'Família: O Plano Original de Deus',
    excerpt: 'Como construir relacionamentos familiares sólidos baseados nos princípios bíblicos.',
    author: 'Pr. Carlos Mendes',
    date: '5 de Março, 2024',
    category: 'Família',
    image: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800',
    readTime: '6 min'
  },
  {
    title: 'Superando Desafios com Fé',
    excerpt: 'Testemunhos reais de pessoas que venceram através da fé em Jesus Cristo.',
    author: 'Lídia Costa',
    date: '3 de Março, 2024',
    category: 'Testemunho',
    image: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=800',
    readTime: '7 min'
  },
  {
    title: 'Jovens: Vivendo a Fé na Universidade',
    excerpt: 'Dicas práticas para manter sua fé firme no ambiente acadêmico.',
    author: 'André Oliveira',
    date: '1 de Março, 2024',
    category: 'Jovens',
    image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800',
    readTime: '4 min'
  },
  {
    title: 'Missões: Levando o Evangelho aos Confins',
    excerpt: 'Conheça histórias inspiradoras de missionários que estão mudando o mundo.',
    author: 'Pra. Ana Costa',
    date: '28 de Fevereiro, 2024',
    category: 'Missões',
    image: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800',
    readTime: '9 min'
  },
  {
    title: 'Finanças na Perspectiva Bíblica',
    excerpt: 'Princípios de administração financeira segundo a Palavra de Deus.',
    author: 'Pr. Pedro Santos',
    date: '25 de Fevereiro, 2024',
    category: 'Finanças',
    image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800',
    readTime: '6 min'
  }
];

const categories = [
  { name: 'Vida Cristã', count: 45, color: 'bg-purple-500' },
  { name: 'Oração', count: 32, color: 'bg-blue-500' },
  { name: 'Família', count: 28, color: 'bg-green-500' },
  { name: 'Jovens', count: 24, color: 'bg-orange-500' },
  { name: 'Testemunho', count: 38, color: 'bg-pink-500' },
  { name: 'Missões', count: 19, color: 'bg-cyan-500' }
];

export function Blog() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <Link to="/public" className="text-white/80 hover:text-white mb-4 inline-block">
            ← Voltar
          </Link>
          <h1 className="text-5xl font-bold mb-4">Blog MRM</h1>
          <p className="text-xl text-purple-100">
            Conteúdo que edifica, inspira e transforma
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-16">
        {/* Featured Post */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-purple-600" />
            Post em Destaque
          </h2>
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="md:flex">
              <div className="md:w-1/2 h-96 bg-cover bg-center" style={{ backgroundImage: `url(${featuredPost.image})` }}>
                <div className="h-full bg-gradient-to-r from-black/60 to-transparent"></div>
              </div>
              <div className="md:w-1/2 p-8">
                <span className="inline-block px-3 py-1 bg-purple-500 text-white rounded-full text-sm font-semibold mb-4">
                  {featuredPost.category}
                </span>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">
                  {featuredPost.title}
                </h3>
                <p className="text-slate-600 mb-6">
                  {featuredPost.excerpt}
                </p>
                
                <div className="flex items-center gap-4 text-sm text-slate-500 mb-6">
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {featuredPost.author}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {featuredPost.date}
                  </div>
                  <div>{featuredPost.readTime} de leitura</div>
                </div>

                <div className="flex items-center gap-6 mb-6">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Heart className="w-5 h-5" />
                    {featuredPost.likes}
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <MessageCircle className="w-5 h-5" />
                    45
                  </div>
                </div>

                <button className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                  Ler Mais
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Posts Grid */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Últimas Postagens</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {posts.map((post, index) => (
                <div key={index} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="h-48 bg-cover bg-center" style={{ backgroundImage: `url(${post.image})` }}></div>
                  <div className="p-6">
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-xs font-semibold mb-3">
                      {post.category}
                    </span>
                    <h3 className="text-xl font-bold text-slate-900 mb-2 line-clamp-2">
                      {post.title}
                    </h3>
                    <p className="text-slate-600 text-sm mb-4 line-clamp-3">
                      {post.excerpt}
                    </p>
                    
                    <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {post.author}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {post.date}
                      </div>
                    </div>

                    <button className="text-purple-600 hover:text-purple-700 font-semibold text-sm flex items-center gap-1">
                      Ler Mais
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Load More */}
            <div className="text-center mt-8">
              <button className="px-8 py-3 bg-white border-2 border-purple-600 text-purple-600 rounded-lg font-semibold hover:bg-purple-600 hover:text-white transition-colors">
                Carregar Mais Posts
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Categories */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Tag className="w-5 h-5 text-purple-600" />
                Categorias
              </h3>
              <div className="space-y-3">
                {categories.map((category, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 ${category.color} rounded-full`}></div>
                      <span className="font-medium text-slate-900">{category.name}</span>
                    </div>
                    <span className="text-sm text-slate-500">{category.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Newsletter */}
            <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl shadow-md p-6 text-white">
              <h3 className="text-xl font-bold mb-2">Newsletter</h3>
              <p className="text-purple-100 text-sm mb-4">
                Receba novos posts diretamente no seu email
              </p>
              <input
                type="email"
                placeholder="seu@email.com"
                className="w-full px-4 py-2 rounded-lg mb-3 text-slate-900"
              />
              <button className="w-full py-2 bg-white text-purple-600 rounded-lg font-semibold hover:shadow-lg transition-shadow">
                Inscrever-se
              </button>
            </div>

            {/* Popular Posts */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Posts Populares</h3>
              <div className="space-y-4">
                {posts.slice(0, 3).map((post, index) => (
                  <div key={index} className="flex gap-3 cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors">
                    <div className="w-16 h-16 bg-cover bg-center rounded-lg flex-shrink-0" style={{ backgroundImage: `url(${post.image})` }}></div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm text-slate-900 line-clamp-2 mb-1">
                        {post.title}
                      </h4>
                      <p className="text-xs text-slate-500">{post.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
