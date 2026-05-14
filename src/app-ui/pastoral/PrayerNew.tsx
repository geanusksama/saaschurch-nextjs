import { useState } from 'react';
import { Heart, User, FileText, ArrowLeft, Save, Lock, Globe, Users, Tag, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useCreatePrayerRequest } from '../../lib/pastoralHooks';
import { getCurrentChurchId } from '../../lib/pastoralService';

const categories = [
  { id: 'saude', name: 'Saúde', color: 'red', icon: '🏥' },
  { id: 'familia', name: 'Família', color: 'blue', icon: '👨‍👩‍👧‍👦' },
  { id: 'trabalho', name: 'Trabalho', color: 'green', icon: '💼' },
  { id: 'financas', name: 'Finanças', color: 'yellow', icon: '💰' },
  { id: 'vida_espiritual', name: 'Vida Espiritual', color: 'purple', icon: '✝️' },
  { id: 'decisoes', name: 'Decisões', color: 'orange', icon: '🤔' },
  { id: 'libertacao', name: 'Libertação', color: 'indigo', icon: '🛡️' },
  { id: 'gratidao', name: 'Gratidão', color: 'emerald', icon: '🌟' },
  { id: 'outro', name: 'Outro', color: 'slate', icon: '📝' },
];

const urgencyLevels = [
  { id: 'low', name: 'Normal', description: 'Oração contínua', color: 'slate' },
  { id: 'medium', name: 'Importante', description: 'Necessita atenção', color: 'yellow' },
  { id: 'high', name: 'Urgente', description: 'Oração imediata', color: 'red' },
];

const privacyLevels = [
  { 
    id: 'private', 
    name: 'Privado', 
    description: 'Apenas você pode ver',
    icon: Lock,
    color: 'red'
  },
  { 
    id: 'leaders', 
    name: 'Líderes', 
    description: 'Visível para líderes',
    icon: Users,
    color: 'yellow'
  },
  { 
    id: 'public', 
    name: 'Público', 
    description: 'Visível no mural de oração',
    icon: Globe,
    color: 'green'
  },
];

export default function PrayerNew() {
  const navigate = useNavigate();
  const createPrayer = useCreatePrayerRequest();
  const churchId = getCurrentChurchId();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedUrgency, setSelectedUrgency] = useState('low');
  const [selectedPrivacy, setSelectedPrivacy] = useState('private');
  const [requestFor, setRequestFor] = useState<'self' | 'other'>('self');
  const [personName, setPersonName] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedCategoryData = categories.find(c => c.id === selectedCategory);

  async function handleSubmit() {
    setErrorMessage(null);
    if (!churchId) {
      setErrorMessage('Igreja ativa não encontrada.');
      return;
    }
    if (!title.trim() || !description.trim() || !selectedCategory) {
      setErrorMessage('Preencha título, descrição e categoria.');
      return;
    }

    const priority = selectedUrgency === 'high' ? 'urgent' : 'normal';
    const visibility = selectedPrivacy === 'leaders' ? 'leadership' : selectedPrivacy;

    try {
      await createPrayer.mutateAsync({
        churchId,
        requesterName: requestFor === 'other' ? personName || null : null,
        title,
        description,
        category: selectedCategory as any,
        priority: priority as 'normal' | 'urgent',
        visibility: visibility as 'public' | 'leadership' | 'private',
        isAnonymous: anonymous,
      });
      navigate('/app-ui/prayer-wall');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Não foi possível criar o pedido de oração.');
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/app-ui/prayer-wall" className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center">
            <Heart className="w-6 h-6 text-rose-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Novo Pedido de Oração</h1>
            <p className="text-slate-600 dark:text-slate-400">Compartilhe seu pedido com a comunidade</p>
          </div>
        </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Request For */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Este pedido é para:</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setRequestFor('self')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  requestFor === 'self'
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <User className={`w-6 h-6 mx-auto mb-2 ${requestFor === 'self' ? 'text-purple-600' : 'text-slate-400'}`} />
                <p className={`text-sm font-semibold ${requestFor === 'self' ? 'text-purple-600' : 'text-slate-700'}`}>
                  Para mim
                </p>
              </button>
              <button
                onClick={() => setRequestFor('other')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  requestFor === 'other'
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <Users className={`w-6 h-6 mx-auto mb-2 ${requestFor === 'other' ? 'text-purple-600' : 'text-slate-400'}`} />
                <p className={`text-sm font-semibold ${requestFor === 'other' ? 'text-purple-600' : 'text-slate-700'}`}>
                  Para outra pessoa
                </p>
              </button>
            </div>

            {requestFor === 'other' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nome da Pessoa
                </label>
                <input
                  type="text"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="Digite o nome..."
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
              </div>
            )}
          </div>

          {/* Title */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Título do Pedido</h3>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Oração pela saúde da minha mãe"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            />
          </div>

          {/* Category */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Categoria</h3>
            <div className="grid grid-cols-3 gap-3">
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedCategory === category.id
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{category.icon}</div>
                  <p className={`text-sm font-semibold ${
                    selectedCategory === category.id ? 'text-purple-600' : 'text-slate-700'
                  }`}>
                    {category.name}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Descrição do Pedido</h3>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Compartilhe os detalhes do seu pedido de oração..."
              rows={6}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            />
            <p className="text-sm text-slate-500 mt-2">
              {description.length} / 500 caracteres
            </p>
          </div>

          {/* Urgency */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Nível de Urgência</h3>
            <div className="grid grid-cols-3 gap-3">
              {urgencyLevels.map(level => (
                <button
                  key={level.id}
                  onClick={() => setSelectedUrgency(level.id)}
                  className={`p-4 rounded-lg border-2 text-center transition-all ${
                    selectedUrgency === level.id
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className={`font-semibold mb-1 ${
                    selectedUrgency === level.id ? 'text-purple-600' : 'text-slate-900'
                  }`}>
                    {level.name}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{level.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Privacy */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Privacidade</h3>
            <div className="space-y-3">
              {privacyLevels.map(level => {
                const Icon = level.icon;
                return (
                  <button
                    key={level.id}
                    onClick={() => setSelectedPrivacy(level.id)}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                      selectedPrivacy === level.id
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`w-5 h-5 mt-0.5 ${
                        selectedPrivacy === level.id ? 'text-purple-600' : 'text-slate-400'
                      }`} />
                      <div className="flex-1">
                        <p className={`font-semibold mb-1 ${
                          selectedPrivacy === level.id ? 'text-purple-600' : 'text-slate-900'
                        }`}>
                          {level.name}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{level.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedPrivacy === 'public' && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900 mb-1">Pedido Público</p>
                    <p className="text-sm text-blue-700">
                      Este pedido aparecerá no Mural de Oração e todos os membros poderão orar por você
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Anonymous Option */}
          {selectedPrivacy === 'public' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                  className="mt-1 w-5 h-5 text-purple-600 rounded focus:ring-purple-600"
                />
                <div>
                  <p className="font-semibold text-slate-900">Pedido Anônimo</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Seu nome não será exibido no mural de oração
                  </p>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Ações</h3>
            <div className="space-y-3">
              {errorMessage && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={createPrayer.isPending}
                className="w-full flex items-center gap-3 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-60"
              >
                <Save className="w-5 h-5" />
                {createPrayer.isPending ? 'Enviando...' : 'Enviar Pedido'}
              </button>
              <Link to="/app-ui/prayer-wall" className="w-full flex items-center gap-3 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
                <ArrowLeft className="w-5 h-5" />
                Cancelar
              </Link>
            </div>
          </div>

          {/* Summary */}
          {title && selectedCategoryData && (
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-6">
              <h3 className="font-bold text-slate-900 mb-4">Resumo</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Título</p>
                  <p className="font-semibold text-slate-900">{title}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Categoria</p>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{selectedCategoryData.icon}</span>
                    <span className="font-semibold text-slate-900">{selectedCategoryData.name}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Urgência</p>
                  <p className="font-semibold text-slate-900">
                    {urgencyLevels.find(u => u.id === selectedUrgency)?.name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Privacidade</p>
                  <p className="font-semibold text-slate-900">
                    {privacyLevels.find(p => p.id === selectedPrivacy)?.name}
                  </p>
                </div>
                {requestFor === 'other' && personName && (
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Oração por</p>
                    <p className="font-semibold text-slate-900">{personName}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-200 p-6">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-bold text-slate-900 mb-2">Dicas</h3>
            <ul className="text-sm text-slate-600 space-y-2">
              <li>• Seja específico no seu pedido</li>
              <li>• Escolha a privacidade adequada</li>
              <li>• Atualize quando for respondido</li>
              <li>• Ore também pelos outros</li>
            </ul>
          </div>

          {/* Stats */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Seus Pedidos</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Ativos</span>
                <span className="font-bold text-slate-900">3</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Respondidos</span>
                <span className="font-bold text-green-600">12</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Você orou por</span>
                <span className="font-bold text-purple-600">47</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
