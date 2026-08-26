/* textos.js — toda a microcopy fixa do painel (14 §13 e textos de cada
   tela). Uma fonte só: nenhuma tela escreve texto de interface fora daqui.
   Só português na v1 (14 §0.11). Textos entre aspas no `14` são a redação
   inicial — mudar aqui, e só aqui. */
const Textos = Object.freeze({
  app: { nome: 'Nostermentor' },

  t1: {
    titulo: 'Entrar no Nostermentor',
    colar: {
      titulo: 'Colar a chave',
      rotulo: 'Chave privada do site (começa por nsec1)',
      mostrar: 'Mostrar a chave',
      esconder: 'Esconder a chave',
      entrar: 'Entrar'
    },
    arquivo: {
      titulo: 'Escolher o arquivo com a chave',
      rotulo: 'Arquivo de texto com a chave numa linha própria',
      apoio: 'Útil no Tails: guarde o arquivo no Persistent Storage e escolha-o aqui a cada sessão.',
      semChave: 'Não encontrei uma chave (nsec1…) neste arquivo. Ela precisa estar numa linha própria.',
      erroLeitura: 'Não consegui ler o arquivo escolhido. Tente de novo.'
    },
    avisoFixo: 'O Nostermentor não guarda a sua chave. Ela fica só na memória desta aba e some ao fechar. Guarde-a no KeePassXC ou no Persistent Storage.',
    linkTails: 'Primeira vez no Tails? Leia isto',
    naoTenhoChave: 'Não tenho chave',
    erroNaoNsec: 'Isto não é uma chave privada (nsec). A chave começa por nsec1.',
    entrandoComo: 'Entrando como ',
    gerar: {
      titulo: 'Sua chave nova',
      alerta: 'Quem tem esta chave é o dono do site; não existe recuperação. Ela é mostrada uma única vez — guarde-a agora.',
      rotuloNsec: 'Chave privada (nsec):',
      rotuloNpub: 'Endereço público do site (npub):',
      baixar: 'Baixar o arquivo ',
      copiei: 'Copiei a chave para o meu gerenciador de senhas',
      antesDeEntrar: 'Para entrar, baixe o arquivo ou confirme que copiou a chave.',
      entrar: 'Entrar',
      cancelar: 'Cancelar'
    },
    tails: {
      titulo: 'Primeira vez no Tails',
      paragrafos: [
        'Copie a pasta do Nostermentor para a pasta Documents a cada sessão. O Tor Browser não abre o painel a partir do pendrive nem do Persistent Storage — só de Documents, Downloads, Pictures, Music e Videos.',
        'Os seus dados (chave, backup, imagens) ficam no Persistent Storage: o painel os alcança pelo seletor de arquivos, e grava o backup pelo diálogo de download. Nada do seu trabalho se perde com isso.',
        'Nível de segurança do Tor Browser: Standard ou Safer. Em Safest o JavaScript é desligado em páginas locais e o painel não arranca.',
        'Se o painel abrir e ficar parado no aviso inicial, recarregue (F5).',
        'Depois de escolher arquivos pode aparecer "Could not read the contents of amnesia" — é um aviso do Tails sem consequência; clique OK, os arquivos chegaram.'
      ]
    }
  },

  t2: {
    titulo: 'Carregando da rede',
    naoImplementado: 'Ainda não implementado. Esta versão de desenvolvimento (marco M1) só entra com a chave; a leitura do site pela rede chega no marco M2.',
    entrouComo: 'Você entrou como '
  },

  moldura: {
    siteSemNome: 'Site sem nome',
    publicar: 'Publicar',
    nadaAPublicar: 'Nada a publicar',
    backupEmDia: 'Backup em dia',
    backupPendente: 'Backup: {n} não exportadas',
    trancar: 'Trancar',
    trancarDica: 'Esquece a chave e volta à tela de entrada. O que está salvo neste navegador continua até ele fechar.',
    menu: [['t3', 'Início'], ['t4', 'Páginas'], ['t5', 'Artigos'], ['t6', 'Mídia'], ['t7', 'Configurações'], ['t11', 'Ajuda']],
    nomes: { t2: 'Carregando da rede', t3: 'Início', t4: 'Páginas', t5: 'Artigos', t6: 'Mídia', t7: 'Configurações', t8: 'Publicar', t9: 'Backup', t10: 'Nova versão', t11: 'Ajuda e Sobre' },
    rodapeApoio: 'Apoie o Nostermentor'
  },

  stub: {
    texto: 'Esta tela ainda não foi implementada nesta versão de desenvolvimento.'
  },

  fixos: {
    salvoNaoBackup: 'Salvo neste navegador. Não é backup.',
    naoConseguiVerificar: 'Não consegui verificar',
    tor: 'Pelo Tor cada conexão demora de 2 a 8 vezes mais — não feche o navegador.',
    privacidade: 'Anonimato não é invisibilidade: o que ajuda o site a ser lido fica ligado; o que revela quem você é fica desligado.'
  }
});
