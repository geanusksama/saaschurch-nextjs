import {
  Users,
  HeartHandshake,
  Award,
  Home,
  MessageCircle,
  Calendar,
  Smartphone,
  Wallet,
  BookOpen,
  Bird,
  Settings,
} from 'lucide-react';

/**
 * Grade com os módulos do sistema, no painel de apresentação do login/cadastro.
 *
 * Substitui os três números soltos que existiam ali (+1k membros, R$ 4.2M,
 * 100% integrado): eram valores inventados, e quem chega nesta tela quer saber
 * o que o sistema faz, não uma estatística.
 *
 * A lista espelha as seções do menu lateral em `AppUI.tsx`. A seção "Principal"
 * fica de fora de propósito — ela é só Notificações e Caixa de Entrada, não um
 * módulo. Se um módulo for adicionado ao menu, some aqui também.
 */
const MODULOS = [
  { nome: 'Secretaria', icon: Users },
  { nome: 'Gestão Pastoral', icon: HeartHandshake },
  { nome: 'Finanças', icon: Wallet },
  { nome: 'Ministérios', icon: Award },
  { nome: 'Grupos Familiares', icon: Home },
  { nome: 'Comunicação', icon: MessageCircle },
  { nome: 'Eventos', icon: Calendar },
  { nome: 'App Móvel', icon: Smartphone },
  { nome: 'Gestão EBD', icon: BookOpen },
  { nome: 'Peniel', icon: Bird },
  { nome: 'Sistema', icon: Settings },
];

export function ModulesShowcase() {
  return (
    <div>
      <p className="text-slate-400 text-[11px] font-semibold tracking-widest uppercase mb-4">
        Módulos do sistema
      </p>

      <div className="grid grid-cols-3 gap-2.5">
        {MODULOS.map(({ nome, icon: Icon }) => (
          <div
            key={nome}
            className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur-xl transition-colors hover:border-emerald-500/40 hover:bg-white/10"
          >
            <Icon className="h-4 w-4 flex-shrink-0 text-emerald-400" strokeWidth={1.75} />
            <span className="truncate text-[11px] font-semibold leading-tight text-slate-200">
              {nome}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
