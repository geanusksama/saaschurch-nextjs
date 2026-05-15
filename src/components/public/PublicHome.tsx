import { Link } from 'react-router';
import { Home, User, Play, Radio, Camera, Users, MapPin } from 'lucide-react';

export function PublicHome() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col relative overflow-hidden font-sans">
      <style>{`
        .spotlight-left {
          position: absolute;
          bottom: -20vh;
          left: 30%;
          width: 150px;
          height: 120vh;
          background: linear-gradient(to top, rgba(255,255,255,0.03), transparent);
          transform-origin: bottom center;
          filter: blur(30px);
          animation: spotlightLeft 15s ease-in-out infinite;
        }
        .spotlight-right {
          position: absolute;
          bottom: -20vh;
          right: 30%;
          width: 150px;
          height: 120vh;
          background: linear-gradient(to top, rgba(255,255,255,0.03), transparent);
          transform-origin: bottom center;
          filter: blur(30px);
          animation: spotlightRight 18s ease-in-out infinite;
        }
        .comet {
          position: absolute;
          width: 4px;
          height: 4px;
          background: rgba(255, 255, 255, 0.6);
          border-radius: 50%;
          box-shadow: 0 0 10px 2px rgba(255, 255, 255, 0.3);
          opacity: 0;
        }
        .comet-1 { animation: cometAnimation 25s linear infinite 2s; top: -10%; right: 20%; }
        .comet-2 { animation: cometAnimationReverse 30s linear infinite 7s; top: -10%; left: 30%; }
        .comet-3 { animation: cometAnimation 35s linear infinite 11s; top: -10%; right: 50%; }
        
        @keyframes spotlightLeft {
          0%, 100% { transform: rotate(-35deg); }
          50% { transform: rotate(15deg); }
        }
        @keyframes spotlightRight {
          0%, 100% { transform: rotate(35deg); }
          50% { transform: rotate(-15deg); }
        }
        @keyframes cometAnimation {
          0% { transform: translate(0, 0) rotate(45deg); opacity: 0; }
          5% { opacity: 1; }
          20% { transform: translate(-100vw, 100vh) rotate(45deg); opacity: 0; }
          100% { transform: translate(-100vw, 100vh) rotate(45deg); opacity: 0; }
        }
        @keyframes cometAnimationReverse {
          0% { transform: translate(0, 0) rotate(-45deg); opacity: 0; }
          5% { opacity: 1; }
          20% { transform: translate(100vw, 100vh) rotate(-45deg); opacity: 0; }
          100% { transform: translate(100vw, 100vh) rotate(-45deg); opacity: 0; }
        }
      `}</style>
      
      {/* Animated Lights Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="spotlight-left"></div>
        <div className="spotlight-right"></div>
        <div className="comet comet-1"></div>
        <div className="comet comet-2"></div>
        <div className="comet comet-3"></div>
      </div>

      {/* Background Watermark */}
      <img 
        src="/adcampinas.png" 
        alt="AD Campinas Watermark" 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-5 pointer-events-none w-[80vw] md:w-[50vw] lg:max-w-2xl object-contain mix-blend-screen z-0"
      />

      {/* Header */}
      <header className="flex items-center justify-between p-6 md:px-12 relative z-10">
        <div className="flex items-center">
          <img src="/adcampinas.png" alt="AD Campinas Logo" className="h-10 md:h-12 object-contain mix-blend-screen opacity-90 hover:opacity-100 transition-opacity" />
        </div>

        {/* Right Avatar */}
        <Link to="/auth/login" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors border border-slate-700">
          <User className="w-5 h-5 text-slate-400" />
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row items-center justify-center px-6 md:px-24 py-12 relative z-10 gap-16 lg:gap-32">
        
        {/* Left Column - Missão */}
        <div className="w-full md:w-1/2 max-w-lg">
          <p className="text-slate-400 font-medium mb-2 text-sm tracking-wide">Nossa missão é</p>
          <h1 className="text-6xl md:text-7xl lg:text-[5.5rem] font-medium text-white mb-8 tracking-tight">
            REINAR
          </h1>
          <p className="text-slate-300 leading-relaxed mb-6 text-sm md:text-base font-light">
            Restaurando vidas através do ensino da Palavra, investindo em pessoas, nutrindo o conhecimento, para alcançar a cidade e estabelecer o Reino dos Céus.
          </p>
          <p className="text-slate-500 text-xs tracking-wide">João 3:16</p>
        </div>

        {/* Right Column - Links/Info */}
        <div className="w-full md:w-1/2 max-w-md space-y-8">
          
          {/* Item 1 */}
          <div className="flex items-start gap-5">
            <div className="flex-shrink-0 w-14 h-14 rounded-full border border-slate-600 flex items-center justify-center">
              <Users className="w-6 h-6 text-slate-200" />
            </div>
            <div className="flex flex-col justify-center min-h-[3.5rem]">
              <h3 className="text-lg font-bold text-white mb-1">Dias de culto</h3>
              <div className="text-slate-400 text-xs leading-relaxed space-y-0.5">
                <p><strong className="text-slate-300">Domingo:</strong> 8h EBD, 9:30 e 18:30 Culto da Família</p>
                <p><strong className="text-slate-300">Quarta:</strong> 19:15 Culto de Ensino</p>
                <p><strong className="text-slate-300">Sexta:</strong> 23h Vigília</p>
                <p><strong className="text-slate-300">Sábado:</strong> Manhã - Oração das Mulheres, Noite - Culto de Jovens</p>
              </div>
            </div>
          </div>

          {/* Item 2 */}
          <a href="https://www.youtube.com/@tvadcampinas" target="_blank" rel="noopener noreferrer" className="flex items-start gap-5 group hover:opacity-80 transition-opacity">
            <div className="flex-shrink-0 w-14 h-14 rounded-full border border-slate-600 flex items-center justify-center group-hover:border-[#ff0000] transition-colors">
              <Play className="w-6 h-6 text-slate-200 group-hover:text-[#ff0000] transition-colors" />
            </div>
            <div className="flex flex-col justify-center min-h-[3.5rem]">
              <h3 className="text-lg font-bold text-white mb-1">Culto ao vivo</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Assista o culto ao vivo pela internet<br />em nosso canal no Youtube
              </p>
            </div>
          </a>

          {/* Item 3 */}
          <div className="flex items-start gap-5">
            <div className="flex-shrink-0 w-14 h-14 rounded-full border border-slate-600 flex items-center justify-center">
              <Radio className="w-6 h-6 text-slate-200" />
            </div>
            <div className="flex flex-col justify-center min-h-[3.5rem]">
              <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                102,9
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed flex items-center gap-2">
                Mais FM ao vivo
                <span className="w-2.5 h-2.5 rounded-full bg-[#00b894] animate-pulse"></span>
              </p>
            </div>
          </div>

          {/* Item 4 */}
          <a href="https://www.instagram.com/adcampinas/" target="_blank" rel="noopener noreferrer" className="flex items-start gap-5 group hover:opacity-80 transition-opacity">
            <div className="flex-shrink-0 w-14 h-14 rounded-full border border-slate-600 flex items-center justify-center group-hover:border-pink-500 transition-colors">
              <Camera className="w-6 h-6 text-slate-200 group-hover:text-pink-500 transition-colors" />
            </div>
            <div className="flex flex-col justify-center min-h-[3.5rem]">
              <h3 className="text-lg font-bold text-white mb-1">Instagram</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Saiba o que está acontecendo, siga-nos<br />nas redes sociais
              </p>
            </div>
          </a>

          {/* Item 5 - Endereço */}
          <a href="https://www.google.com/maps/search/?api=1&query=Rua+Barão+de+Parnaíba,+149+-+Campinas" target="_blank" rel="noopener noreferrer" className="flex items-start gap-5 group hover:opacity-80 transition-opacity">
            <div className="flex-shrink-0 w-14 h-14 rounded-full border border-slate-600 flex items-center justify-center group-hover:border-blue-400 transition-colors">
              <MapPin className="w-6 h-6 text-slate-200 group-hover:text-blue-400 transition-colors" />
            </div>
            <div className="flex flex-col justify-center min-h-[3.5rem]">
              <h3 className="text-lg font-bold text-white mb-1">Nossa Sede</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Rua Barão de Parnaíba, 149 - Campinas<br />
                Telefone/WhatsApp: (19) 98928-1188
              </p>
            </div>
          </a>

        </div>
      </main>
    </div>
  );
}