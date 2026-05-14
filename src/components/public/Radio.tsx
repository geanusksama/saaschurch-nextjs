import { Link } from 'react-router';
import { Radio as RadioIcon, Play, Pause, Volume2, Heart, Clock, Music, Mic } from 'lucide-react';
import { useState } from 'react';

const schedule = [
  { time: '06:00', program: 'Manhã de Louvor', host: 'Pr. João Silva' },
  { time: '09:00', program: 'Palavra Viva', host: 'Pra. Maria Santos' },
  { time: '12:00', program: 'Hora do Almoço', host: 'DJ Gospel' },
  { time: '15:00', program: 'Tarde com Jesus', host: 'Lídia Costa' },
  { time: '18:00', program: 'Louvor Sem Fronteiras', host: 'André Oliveira' },
  { time: '21:00', program: 'Palavra da Noite', host: 'Pr. Paulo Mendes' },
  { time: '00:00', program: 'Madrugada Gospel', host: 'Automático' }
];

const topSongs = [
  { title: 'Oceanos', artist: 'Ministério Zoe', duration: '4:32' },
  { title: 'Reckless Love', artist: 'Central 3', duration: '5:15' },
  { title: 'Vem Sobre Mim', artist: 'Gabriela Rocha', duration: '4:48' },
  { title: 'Bondade de Deus', artist: 'Isaias Saad', duration: '6:20' },
  { title: 'Yeshua', artist: 'Kemuel', duration: '4:55' }
];

export function Radio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(70);

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <Link to="/public" className="text-white/80 hover:text-white mb-4 inline-block">
            ← Voltar
          </Link>
          <div className="flex items-center gap-4 mb-4">
            <RadioIcon className="w-16 h-16" />
            <div>
              <h1 className="text-5xl font-bold">Rádio MRM 24h</h1>
              <p className="text-xl text-purple-100">
                Música gospel e mensagens que transformam vidas
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Player */}
      <div className="max-w-7xl mx-auto px-4 -mt-8">
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-8">
            {/* Album Art */}
            <div className="w-48 h-48 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Music className="w-24 h-24 text-white" />
            </div>

            {/* Now Playing */}
            <div className="flex-1">
              <div className="text-sm text-purple-100 mb-1">Tocando Agora</div>
              <h2 className="text-2xl font-bold text-white mb-2">Oceanos (Where Feet May Fail)</h2>
              <p className="text-xl text-purple-100 mb-6">Ministério Zoe</p>

              {/* Controls */}
              <div className="flex items-center gap-6 mb-6">
                <button className="w-16 h-16 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform">
                  {isPlaying ? (
                    <Pause className="w-8 h-8 text-purple-600" onClick={() => setIsPlaying(false)} />
                  ) : (
                    <Play className="w-8 h-8 text-purple-600 ml-1" onClick={() => setIsPlaying(true)} />
                  )}
                </button>
                <button className="text-white hover:text-purple-200">
                  <Heart className="w-6 h-6" />
                </button>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-4">
                <Volume2 className="w-5 h-5 text-white" />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="flex-1 h-2 bg-white/20 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, white ${volume}%, rgba(255,255,255,0.2) ${volume}%)`
                  }}
                />
                <span className="text-white font-semibold w-12">{volume}%</span>
              </div>
            </div>

            {/* Live Badge */}
            <div className="flex flex-col items-center gap-2">
              <div className="px-6 py-3 bg-red-500 rounded-full flex items-center gap-2 animate-pulse">
                <div className="w-3 h-3 bg-white rounded-full"></div>
                <span className="text-white font-bold">AO VIVO</span>
              </div>
              <span className="text-white/80 text-sm">2.543 ouvintes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="max-w-7xl mx-auto px-4 py-16 grid lg:grid-cols-2 gap-8">
        {/* Schedule */}
        <div className="bg-slate-800 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Clock className="w-6 h-6 text-purple-400" />
            Programação de Hoje
          </h2>
          <div className="space-y-4">
            {schedule.map((item, index) => (
              <div key={index} className="flex items-center gap-4 p-4 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors">
                <div className="text-purple-400 font-bold text-lg w-20">{item.time}</div>
                <div className="flex-1">
                  <div className="font-semibold text-white">{item.program}</div>
                  <div className="text-sm text-slate-400 flex items-center gap-1">
                    <Mic className="w-3 h-3" />
                    {item.host}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Songs */}
        <div className="bg-slate-800 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Music className="w-6 h-6 text-pink-400" />
            Mais Tocadas da Semana
          </h2>
          <div className="space-y-4">
            {topSongs.map((song, index) => (
              <div key={index} className="flex items-center gap-4 p-4 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors group cursor-pointer">
                <div className="text-2xl font-bold text-purple-400 w-8">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white">{song.title}</div>
                  <div className="text-sm text-slate-400">{song.artist}</div>
                </div>
                <div className="text-sm text-slate-500">{song.duration}</div>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-5 h-5 text-white" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-4 gap-6">
          <div className="bg-purple-500 rounded-xl p-6 text-center text-white">
            <div className="text-4xl font-bold mb-2">24/7</div>
            <div>Sempre No Ar</div>
          </div>
          <div className="bg-pink-500 rounded-xl p-6 text-center text-white">
            <div className="text-4xl font-bold mb-2">5K+</div>
            <div>Músicas</div>
          </div>
          <div className="bg-blue-500 rounded-xl p-6 text-center text-white">
            <div className="text-4xl font-bold mb-2">15+</div>
            <div>Programas</div>
          </div>
          <div className="bg-green-500 rounded-xl p-6 text-center text-white">
            <div className="text-4xl font-bold mb-2">50K+</div>
            <div>Ouvintes/Mês</div>
          </div>
        </div>
      </div>
    </div>
  );
}
