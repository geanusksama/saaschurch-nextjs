import React from 'react';
import { TrendingUp, TrendingDown, Calendar, MapPin, DollarSign, User } from 'lucide-react';

export interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'hover' | 'bordered';
  padding?: 'none' | 'small' | 'medium' | 'large';
  className?: string;
}

export function Card({ 
  children, 
  variant = 'default', 
  padding = 'medium',
  className = '' 
}: CardProps) {
  const variants = {
    default: 'bg-white rounded-xl border border-slate-200',
    hover: 'bg-white rounded-xl border border-slate-200 hover:shadow-lg transition-shadow cursor-pointer',
    bordered: 'bg-white rounded-xl border-2 border-slate-300',
  };
  
  const paddings = {
    none: '',
    small: 'p-4',
    medium: 'p-6',
    large: 'p-8',
  };
  
  return (
    <div className={`${variants[variant]} ${paddings[padding]} ${className}`}>
      {children}
    </div>
  );
}

export interface DashboardCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    isPositive: boolean;
  };
  icon: React.ReactNode;
  iconColor?: string;
}

export function DashboardCard({ 
  title, 
  value, 
  change, 
  icon, 
  iconColor = 'bg-purple-100 text-purple-600' 
}: DashboardCardProps) {
  return (
    <Card variant="hover">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          {change && (
            <div className="flex items-center gap-1 mt-2">
              {change.isPositive ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
              <span className={`text-sm font-medium ${change.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(change.value)}%
              </span>
              <span className="text-sm text-slate-500">vs mês anterior</span>
            </div>
          )}
        </div>
        <div className={`w-12 h-12 ${iconColor} rounded-lg flex items-center justify-center`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

export interface MemberCardProps {
  name: string;
  avatar?: string;
  role?: string;
  email?: string;
  phone?: string;
  status: 'active' | 'inactive';
  onClick?: () => void;
}

export function MemberCard({ 
  name, 
  avatar, 
  role, 
  email, 
  phone, 
  status,
  onClick 
}: MemberCardProps) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2);
  
  return (
    <Card variant="hover" onClick={onClick}>
      <div className="flex items-center gap-4">
        {avatar ? (
          <img src={avatar} alt={name} className="w-12 h-12 rounded-full object-cover" />
        ) : (
          <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-slate-900 truncate">{name}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              status === 'active' 
                ? 'bg-green-100 text-green-700' 
                : 'bg-slate-100 text-slate-700'
            }`}>
              {status === 'active' ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          {role && <p className="text-sm text-slate-600 mb-1">{role}</p>}
          <div className="flex items-center gap-3 text-xs text-slate-500">
            {email && <span className="truncate">{email}</span>}
            {phone && <span>{phone}</span>}
          </div>
        </div>
      </div>
    </Card>
  );
}

export interface LeadCardProps {
  name: string;
  stage: string;
  responsible?: string;
  lastActivity?: string;
  score?: number;
  onClick?: () => void;
}

export function LeadCard({ 
  name, 
  stage, 
  responsible, 
  lastActivity, 
  score,
  onClick 
}: LeadCardProps) {
  return (
    <Card variant="hover" padding="small" onClick={onClick}>
      <div className="space-y-2">
        <h3 className="font-semibold text-slate-900">{name}</h3>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded font-medium">
            {stage}
          </span>
          {score && (
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded font-medium">
              {score} pts
            </span>
          )}
        </div>
        {responsible && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <User className="w-4 h-4" />
            {responsible}
          </div>
        )}
        {lastActivity && (
          <p className="text-xs text-slate-500">
            Última atividade: {lastActivity}
          </p>
        )}
      </div>
    </Card>
  );
}

export interface EventCardProps {
  title: string;
  date: string;
  time: string;
  location: string;
  attendees?: number;
  image?: string;
  onClick?: () => void;
}

export function EventCard({ 
  title, 
  date, 
  time, 
  location, 
  attendees,
  image,
  onClick 
}: EventCardProps) {
  return (
    <Card variant="hover" padding="none" onClick={onClick}>
      {image && (
        <img src={image} alt={title} className="w-full h-40 object-cover rounded-t-xl" />
      )}
      <div className="p-4 space-y-3">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {date} às {time}
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            {location}
          </div>
        </div>
        {attendees !== undefined && (
          <div className="pt-3 border-t border-slate-200">
            <p className="text-sm text-slate-600">
              {attendees} participantes confirmados
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

export interface FinancialSummaryCardProps {
  title: string;
  amount: number;
  change?: {
    value: number;
    isPositive: boolean;
  };
  color?: string;
}

export function FinancialSummaryCard({ 
  title, 
  amount, 
  change,
  color = 'purple'
}: FinancialSummaryCardProps) {
  const colorClasses = {
    purple: 'from-purple-500 to-purple-600',
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    red: 'from-red-500 to-red-600',
  };
  
  return (
    <div className={`bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses] || colorClasses.purple} rounded-xl p-6 text-white`}>
      <div className="flex items-start justify-between mb-4">
        <p className="text-white/80">{title}</p>
        <DollarSign className="w-6 h-6" />
      </div>
      <p className="text-3xl font-bold mb-2">
        {new Intl.NumberFormat('pt-BR', { 
          style: 'currency', 
          currency: 'BRL' 
        }).format(amount)}
      </p>
      {change && (
        <div className="flex items-center gap-1">
          {change.isPositive ? (
            <TrendingUp className="w-4 h-4" />
          ) : (
            <TrendingDown className="w-4 h-4" />
          )}
          <span className="text-sm">
            {change.isPositive ? '+' : ''}{change.value}% vs mês anterior
          </span>
        </div>
      )}
    </div>
  );
}
