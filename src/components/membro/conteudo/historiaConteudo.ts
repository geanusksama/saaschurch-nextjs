/**
 * História da igreja — conteúdo estático, portado de novoChurch/lib/main.dart
 * (HistoryScreen._sections). Não vem do banco nem tem filtro de campo: é texto
 * institucional fixo, igual para todo mundo. Se um dia virar conteúdo por
 * campo, tem que passar a sair de /api/membro/conteudo como os demais.
 */

export interface SecaoHistoria {
  ano: string;
  titulo: string;
  paragrafos: string[];
}

export const HISTORIA: SecaoHistoria[] = [
  {
    "ano": "1936",
    "titulo": "Fundação por Samuel Hedlund",
    "paragrafos": [
      "A igreja Assembleia de Deus em Campinas foi fundada pelo missionário sueco Samuel Hedlund, em abril de 1936, em um salão na Rua Regente Feijó, 337, onde se realizaram os primeiros cultos assistidos apenas pelo irmão Hedlund e um senhor que fora evangelizado.",
      "Com o passar de dias, converteram-se Joaquina Maria do Espírito Santo e Atílio Perrot. Atílio era um açougueiro tido na região como valentão e promotor de desordens. Por isso, era muito temido. A esposa do missionário convidara Joaquina, esposa de Atílio, para assistir a um culto, na região, ela entregou-se a Jesus e, por isso passou a ser maltratada pelo marido. Hedlund resolveu visita-lo, mas foi expulso da casa de Atílio, que esbravejou: \"você ganhou a minha esposa, mas a mim você não ganha. Sou católico apostólico romano e sei o que faço\".",
      "O homem de Deus não se deu por vencido e continuou orando e visitando Atílio, até que ele se converteu. Três meses depois, em 18 de setembro de 1936, o missionário Samuel Hedlund realizou o primeiro batismo nas águas, no total de 7 novos convertidos, entre os quais estavam Atílio e a esposa, pastor Raimundo de Campos e a esposa Irmã Palmira Diniz, bem como sua irmã Luiza e esposo Paulo Quatel. A alegria enchia-lhes o rosto. No ato, o missionário quebrou em público o revolver que pertencera ao ex-desordeiro Atílio, o açougueiro. Esse testemunho impactou a cidade e o trabalho começou a crescer. As conversões se multiplicaram e o salão se tornou pequeno para comportar o povo. Hedlund, então, alugou um novo salão maior, que logo também ficou superlotado."
    ]
  },
  {
    "ano": "1941",
    "titulo": "Estacas Bem Firmadas",
    "paragrafos": [
      "Quando Samuel Hedlund se transferiu de Campinas para Recife em 1941, as estacas estavam bem firmadas e o evangelho já se estendia por todas as partes da cidade paulista e localidades vizinhas.",
      "A igreja passou a ter um crescimento muito grande, tendo sido pastoreada por vários pastores, entre eles: Álvaro Motta, João Prata Vieira é época em que a igreja se estabeleceu em templo próprio no bairro Vila Nova."
    ]
  },
  {
    "ano": "1941–1976",
    "titulo": "Crescimento e Novos Líderes",
    "paragrafos": [
      "Posteriormente, há uma grande divisão no trabalho e os fiéis, debaixo da liderança do pastor Raimundo Linhares, passaram a se reunir em um salão pequeno na Rua José Paulino, de não mais de 40 metros quadrados. Em seguida, a igreja passa a ser presidida pelo pastor Luiz Gonzaga Medeiros.",
      "Neste tempo foi adquirida parte da propriedade onde hoje está o templo sede atual na Rua Barão de Paraíba.",
      "Posteriormente, o pastor Luiz Gonzaga foi sucedido por um rapidíssimo período pelo missionário Celso Lopes dos Santos, que também foi sucedido pelo Bispo Manoel Ferreira em 1976."
    ]
  },
  {
    "ano": "1976–2000",
    "titulo": "Expansão Nacional e Internacional",
    "paragrafos": [
      "O Bispo Manoel Ferreira adquiriu a segunda parte do terreno, onde atualmente está o templo sede, e iniciou a construção do referido templo, tendo inaugurado o mesmo em fevereiro de 1983.",
      "Na década de 80, visitou a igreja o pastor Costa Deir, que pregando num certo dia, parou e profetizou que daquele púlpito sairiam homens que seriam conhecidos pelo mundo afora e que a igreja de Campinas seria conhecida em todos os continentes é o que veio a ocorrer anos após.",
      "Oriundos do campo de Campinas nasceram os campos de Sumaré, Nova Odessa, Americana, Piracicaba, Jundiaí, Franca, Bebedouro, Barretos, Cosmópolis, Mogi Mirim, Martinho Prado, Mogi Guaçu, Conchal, Rio Claro, Itapira, Limeira, Pirassununga, Porto Ferreira e Vargem Grande do Sul.",
      "Pelo campo de Campinas passaram e saíram grandes homens de Deus, como os pastores: Abner Ferreira, Magner Ferreira, Josué de Campos, Josias de Campos, Dirceu de Paula, Raimundo de Campos, Belchior Martins da Costa, entre muitos outros.",
      "Na gestão do Bispo Manoel Ferreira a igreja viveu uma forte expansão e fortalecimento em toda a cidade. O Bispo Manoel Ferreira estava conduzindo uma grande expansão do ministério de Madureira no exterior, inaugurando igrejas e criando convenções afiliadas na Argentina, Bolívia, Estados Unidos, Inglaterra, Rússia, Itália e Japão."
    ]
  },
  {
    "ano": "2000–2020",
    "titulo": "Bispo Samuel Cássio Ferreira",
    "paragrafos": [
      "Sucedendo o Bispo Manoel Ferreira, assumiu a presidência da igreja o Bispo Samuel Cássio Ferreira, que marcou sua gestão implementando um modelo de administração que se tornaria referência para todo o país.",
      "A promessa sobre a igreja continuava se cumprindo. Nesses anos, o Brasil descobriria o maior líder da igreja na atualidade, através de grandes congressos, cruzadas e convenções que entraram para a história pela excelência como foram conduzidos e pela dimensão e proporção que alcançaram.",
      "Foram anos onde a nação pôde descobrir, através da igreja em Campinas, que Deus havia escolhido e preparado aquele que haveria de ter a responsabilidade em elevar a Assembleia de Deus a posições mais altas, conquistando espaços nunca explorados como programas de televisão, rádio, e com uma visão de expansão nunca pensada.",
      "Isso levou o Bispo Samuel Cássio Ferreira a assumir a presidência da Assembleia de Deus no Brás, sede estadual de São Paulo é o maior campo do país, com mais de 3 mil templos apenas em São Paulo."
    ]
  },
  {
    "ano": "Atualidade",
    "titulo": "Liderança Atual: Pastor Manoel Ferreira Netto",
    "paragrafos": [
      "Hoje a igreja é presidida pelo Pastor Manoel Ferreira Netto, uma liderança jovem, compromissada com a palavra de Deus. Este tem sido um tempo de grande avivamento. Seu ministério tem sido marcado por levar, a corações quebrados, uma palavra de cura e restauração.",
      "Pastor Manoel Ferreira Netto é casado com a Pastora Marjorye Ferreira, que é presidente do departamento feminino e social da igreja, a CIBE (Confederação de Irmãs Beneficentes).",
      "Pastor Manoel e Pastora Marjorye têm dois filhos: Samuel Cássio Ferreira Netto e Manoel Ferreira Junior."
    ]
  }
];
