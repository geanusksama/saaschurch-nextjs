import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "SaaS Church Management",
  description: "Plataforma de gestão eclesiástica",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${inter.variable} h-full antialiased`}>
      <head>
        {/* Apply dark class before first paint to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var root=document.documentElement;var dark=localStorage.getItem('mrm_theme');if(dark==='dark'){root.classList.add('dark')}var raw=localStorage.getItem('mrm_branding');if(!raw){return}var settings=JSON.parse(raw);var primary=/^#[0-9a-fA-F]{6}$/.test(settings.primaryColor||'')?settings.primaryColor:'#7c8ba1';var secondary=/^#[0-9a-fA-F]{6}$/.test(settings.secondaryColor||'')?settings.secondaryColor:'#c7d2df';var radius=Number(settings.radius);if(Number.isNaN(radius)){radius=10}radius=Math.min(18,Math.max(6,radius));function hexToRgb(hex){var n=parseInt(hex.replace('#',''),16);return{r:(n>>16)&255,g:(n>>8)&255,b:n&255}}function alpha(hex,opacity){var rgb=hexToRgb(hex);return 'rgba('+rgb.r+', '+rgb.g+', '+rgb.b+', '+opacity+')'}function shade(hex,amount){var rgb=hexToRgb(hex);function clamp(channel){return Math.min(255,Math.max(0,channel+amount))}var parts=[clamp(rgb.r),clamp(rgb.g),clamp(rgb.b)].map(function(channel){return channel.toString(16).padStart(2,'0')}).join('');return '#'+parts}root.style.setProperty('--primary',primary);root.style.setProperty('--secondary',alpha(primary,0.08));root.style.setProperty('--accent',alpha(primary,0.1));root.style.setProperty('--ring',alpha(primary,0.24));root.style.setProperty('--sidebar-primary',primary);root.style.setProperty('--sidebar-accent',alpha(primary,0.08));root.style.setProperty('--sidebar-ring',alpha(primary,0.22));root.style.setProperty('--radius',radius+'px');root.style.setProperty('--theme-primary',primary);root.style.setProperty('--theme-primary-strong',shade(primary,-14));root.style.setProperty('--theme-primary-hover',shade(primary,-8));root.style.setProperty('--theme-primary-soft',alpha(primary,0.1));root.style.setProperty('--theme-primary-soft-strong',alpha(primary,0.14));root.style.setProperty('--theme-primary-border',alpha(primary,0.18));root.style.setProperty('--theme-primary-ring',alpha(primary,0.14));root.style.setProperty('--theme-secondary',secondary);root.style.setProperty('--theme-secondary-hover',shade(secondary,-8));root.style.setProperty('--theme-secondary-soft',alpha(secondary,0.12));var href=settings.logoUrl||'/favicon.ico';['icon','shortcut icon','apple-touch-icon'].forEach(function(rel){var link=document.head.querySelector('link[rel="'+rel+'"]');if(!link){link=document.createElement('link');link.rel=rel;document.head.appendChild(link)}link.type='image/png';link.href=href})}catch(e){}})()`,
          }}
        />
      </head>
      <body suppressHydrationWarning className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
