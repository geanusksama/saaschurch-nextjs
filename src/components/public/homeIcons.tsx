/**
 * Catálogo de ícones da home pública.
 *
 * O banco guarda o NOME do ícone (`home_cards.icon`); aqui ele vira componente.
 * O mapa é fechado: nome desconhecido cai em `Circle` em vez de quebrar o
 * render da página mais acessada do sistema.
 */
import {
  User, Users, Home, Play, Radio, Camera, MapPin, Calendar, Clock, BookOpen,
  Heart, HeartHandshake, Sparkles, Music, Mic, Gift, DollarSign, CreditCard,
  HandCoins, Baby, GraduationCap, Briefcase, Laptop, MessageSquare, Phone,
  Mail, Globe, Video, Tv, Podcast, Link as LinkIcon, Share2, Newspaper, Send,
  Download, Info, Star, Church, Cross, Sun, Moon, Map, Navigation, Ticket,
  Wallet, Landmark, Flame, Crown, Feather, Image as ImageIcon, Handshake, Bell,
  Circle,
} from 'lucide-react';

export type HomeIconComponent = (props: React.SVGProps<SVGSVGElement>) => React.ReactElement;

/** Pomba do Peniel — desenho próprio, não existe no lucide. */
export function DoveIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M22 3s-3 1-5.5 3c-3 2.5-5.5 6-6.5 8.5-.75.25-1.5.25-2.25 0-.5-.5-1-1.5-1.25-2.75C5.75 9 4.25 8.75 3 9c1.5 1.5 3 2.5 3.5 4.5.5 2 2 3.5 3.5 4.5.5.25.75.75.5 1.25-.25.75-1 1.75-2.5 2.25 1.25-.25 2.25-.75 2.5-1.5.25-.75.75-.75 1.25-.5 1 1 2.5 2.5 4.5 3.5-.25-1.25-.5-2.75-1.25-3.75C16 18.5 19.5 16 22 13.5c2-2 1.5-5.5 0-7.5-1-1-2-1-2.5-1.5.5-1 1-1.5.5-1.5z" />
    </svg>
  );
}

export const HOME_ICONS: Record<string, any> = {
  User, Users, Dove: DoveIcon, Home, Play, Radio, Camera, MapPin, Calendar,
  Clock, BookOpen, Heart, HeartHandshake, Sparkles, Music, Mic, Gift,
  DollarSign, CreditCard, HandCoins, Baby, GraduationCap, Briefcase, Laptop,
  MessageSquare, Phone, Mail, Globe, Video, Tv, Podcast, Link: LinkIcon, Share2,
  Newspaper, Send, Download, Info, Star, Church, Cross, Sun, Moon, Map,
  Navigation, Ticket, Wallet, Landmark, Flame, Crown, Feather, Image: ImageIcon,
  Handshake, Bell, Circle,
};

export function resolveHomeIcon(name: string | null | undefined): any {
  return (name && HOME_ICONS[name]) || Circle;
}
