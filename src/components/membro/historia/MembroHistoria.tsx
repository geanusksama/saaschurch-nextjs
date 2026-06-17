"use client";

import { motion } from 'motion/react';
import { MembroShell } from '../MembroShell';

const TEAL = '#2dd4bf';

interface TimelineItem {
  year: string;
  title: string;
  desc: string;
  highlight?: boolean;
}

const HISTORIA: TimelineItem[] = [
  { year: '1936', title: 'Fundação', desc: 'A Assembleia de Deus em Campinas é fundada por missionários pioneiros, com os primeiros cultos realizados em residências.', highlight: true },
  { year: '1942', title: 'Primeiro templo', desc: 'Inauguração do primeiro templo próprio, marco histórico para a comunidade evangélica em Campinas.' },
  { year: '1955', title: 'Expansão regional', desc: 'A obra cresce e são abertas as primeiras igrejas filiais na região metropolitana de Campinas.' },
  { year: '1970', title: 'Construção da sede', desc: 'Início da construção do templo sede na Rua Barão de Parnaíba, 149, que se tornaria a maior estrutura da AD em Campinas.' },
  { year: '1980', title: 'Escola Bíblica', desc: 'Consolidação da Escola Bíblica Dominical com centenas de alunos e expansão do programa de formação teológica.', highlight: true },
  { year: '1990', title: 'Crescimento dos departamentos', desc: 'Fortalecimento dos departamentos de jovens, crianças, casais e mocidade, com eventos de alcance regional.' },
  { year: '2000', title: 'Novo milênio', desc: 'A AD Campinas entra no novo milênio com mais de 10 mil membros ativos e dezenas de igrejas filiadas no campo.' },
  { year: '2005', title: 'Rádio Mais FM', desc: 'Início das transmissões pela Rádio Mais FM 102,9, levando a Palavra a toda a cidade de Campinas e região.', highlight: true },
  { year: '2010', title: 'Modernização', desc: 'Reforma e ampliação do templo sede, adotando novas tecnologias de sonorização, iluminação e transmissão ao vivo.' },
  { year: '2015', title: 'TV e Digital', desc: 'Expansão para plataformas digitais: YouTube, redes sociais e transmissões ao vivo, alcançando fiéis além das fronteiras físicas.' },
  { year: '2018', title: 'Peniel', desc: 'O evento Peniel — encontro de oração e avivamento — se consolida como um dos maiores eventos da AD em São Paulo.', highlight: true },
  { year: '2020', title: 'Pandemia e resiliência', desc: 'Durante a pandemia, a AD Campinas manteve os cultos por transmissão ao vivo e ampliou os programas de assistência social.' },
  { year: '2023', title: 'App novoChurch', desc: 'Lançamento do aplicativo novoChurch, unindo tecnologia e fé para conectar membros a recursos espirituais na palma da mão.' },
  { year: '2024', title: 'Portal Digital', desc: 'Inauguração do Portal Digital integrado ao sistema MRM, com área exclusiva para membros e gestão eclesiástica completa.', highlight: true },
];

export default function MembroHistoria() {
  return (
    <MembroShell title="Nossa História">
      <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="max-w-lg mx-auto px-5 py-4 pb-8">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 text-center"
          >
            <p className="text-3xl mb-3">⛪</p>
            <h2 className="text-xl font-bold text-white mb-1">Assembleia de Deus</h2>
            <p className="text-sm text-white/40">Campinas — desde 1936</p>
          </motion.div>

          {/* Timeline */}
          <div className="relative">
            {/* Vertical line */}
            <div
              className="absolute left-[22px] top-0 bottom-0 w-px"
              style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.12) 5%, rgba(255,255,255,0.12) 95%, transparent)' }}
            />

            <div className="space-y-1">
              {HISTORIA.map((item, i) => (
                <motion.div
                  key={item.year}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex gap-4 group"
                >
                  {/* Year dot */}
                  <div className="flex-shrink-0 flex flex-col items-center" style={{ width: 44 }}>
                    <div
                      className="w-[10px] h-[10px] rounded-full mt-4 flex-shrink-0 transition-all"
                      style={{
                        background: item.highlight ? TEAL : 'rgba(255,255,255,0.2)',
                        boxShadow: item.highlight ? `0 0 8px ${TEAL}88` : 'none',
                        zIndex: 1,
                        marginLeft: 17,
                      }}
                    />
                  </div>

                  {/* Content */}
                  <div
                    className="flex-1 mb-3 px-4 py-3.5 rounded-2xl transition-all"
                    style={{
                      background: item.highlight ? `${TEAL}0a` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${item.highlight ? TEAL + '25' : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    <div className="flex items-baseline gap-2 mb-1.5">
                      <span
                        className="text-xs font-bold"
                        style={{ color: item.highlight ? TEAL : 'rgba(255,255,255,0.35)' }}
                      >
                        {item.year}
                      </span>
                      <span className="text-sm font-semibold text-white/85">{item.title}</span>
                    </div>
                    <p className="text-xs text-white/40 leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center text-xs text-white/20 mt-8 italic"
          >
            "Edificando o Reino de Deus desde 1936"
          </motion.p>
        </div>
      </div>
    </MembroShell>
  );
}
