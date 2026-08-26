/* textos.js — toda a microcopy fixa do painel (14 §13 e textos de cada
   tela). Uma fonte só: nenhuma tela escreve texto de interface fora daqui.
   Só português na v1 (14 §0.11). Textos entre aspas no `14` são a redação
   inicial — mudar aqui, e só aqui. `{n}` etc. são marcadores substituídos
   pela tela. */
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

  // 14 T2
  t2: {
    titulo: 'Carregando da rede',
    passos: {
      relays: 'Conectando aos relays…',
      site: 'Procurando o seu site…',
      site_json: 'Baixando o conteúdo do site (site.json)…',
      juntar: 'Juntando com o que já estava neste navegador…',
      saude: 'Conferindo a saúde da publicação…'
    },
    relaysResponderam: '{n} de {m} responderam',
    naoResponderam: 'Não responderam: {lista}',
    siteEncontrado: 'encontrado em {n} relays',
    siteNaoEncontrado: 'não encontrado',
    siteJson: {
      ok: 'hash conferido ✓',
      ausente: 'este site não tem site.json (publicado por outra ferramenta)',
      falhou: 'não consegui baixar de nenhum servidor',
      hash_diferente: 'o hash não conferiu — conteúdo descartado',
      invalido: 'arquivo inválido — ignorado',
      mais_novo: 'feito por um Nostermentor mais novo — atualize o app para editá-lo',
      local: 'a rede tem uma versão mais antiga que a deste navegador — mantive a daqui'
    },
    rascunhosPreservados: '{n} rascunhos preservados',
    pronto: 'pronto',
    pulado: '—',
    cancelar: 'Cancelar',
    resumo: 'Site carregado: {p} páginas, {a} artigos, {m} arquivos de mídia. Publicado pela última vez em {d}.',
    resumoHerdado: 'Site carregado: {n} arquivos herdados de outra ferramenta. Publicado pela última vez em {d}.',
    semRede: 'Não consegui falar com nenhum relay. Pode ser a rede, pode ser o Tor. Tentar de novo? Ou continue sem rede: o que você fizer fica neste navegador até conseguir publicar.',
    tentarDeNovo: 'Tentar de novo',
    continuarSemRede: 'Continuar sem rede',
    importarBackup: 'Importar um backup',
    semSite: 'Não encontrei um site publicado com esta chave. Vamos começar um?',
    comecarSite: 'Começar um site novo',
    tentarOutrosRelays: 'Tentar outros relays',
    tituloHome: 'Início',
    herdado: 'Este site foi publicado por outra ferramenta. O Nostermentor vê os {n} arquivos dele, mas não consegue editá-los como páginas e artigos.',
    herdadoApoio: 'Eles aparecem em Mídia → Arquivos herdados e são preservados em toda publicação até você os remover, um a um.',
    irParaInicio: 'Ir para o Início',
    concorrente: 'Outra máquina publicou uma versão mais nova deste site. O que estava publicado foi atualizado a partir da rede; os seus rascunhos ficaram.',
    sobrescritos: 'Substituídos pela versão da rede: {lista}',
    erro: 'Não consegui carregar da rede: {e}',
    entrouComo: 'Você entrou como '
  },

  // 14 T3
  t3: {
    titulo: 'Início',
    aindaCarregando: 'O site ainda está sendo carregado da rede.',
    voltarACarregar: 'Voltar a "Carregando da rede"',
    saude: {
      titulo: 'Saúde da publicação',
      emRelays: 'Seu site está em {n} de {m} relays',
      estados: {
        atual: '✓ com a versão atual',
        antigo: '⚠ com uma versão antiga',
        mais_novo: '⚠ com uma versão mais nova que a deste navegador',
        sem: '✗ sem o site',
        nao_respondeu: '? não respondeu — não consegui verificar'
      },
      verificadoEm: 'Verificado em {d} UTC',
      verificar: 'Verificar de novo',
      verificando: 'Verificando…',
      republicar: 'Republicar',
      republicarM4: 'Republicar chega no marco M4 desta versão de desenvolvimento.',
      maisNovoAviso: 'Um relay tem uma versão mais nova do seu site do que a deste navegador. Recarregue da rede antes de publicar por cima.',
      recarregar: 'Recarregar da rede',
      naoPublicado: 'Seu site ainda não foi publicado.',
      publicar: 'Publicar'
    },
    alteracoes: {
      titulo: 'Alterações não publicadas',
      resumo: '{a} artigos, {p} páginas, {m} mídias',
      detalhe: 'novos: {n} · alterados: {a} · a remover: {r}',
      nada: 'Tudo o que está aqui está publicado.',
      publicar: 'Publicar'
    },
    backup: {
      titulo: 'Backup',
      pendentes: '{n} alterações não exportadas desde {d}',
      pendentesSemData: '{n} alterações não exportadas',
      emDia: 'Backup em dia (último: {d})',
      nunca: 'Você ainda não fez backup. No Tor Browser, tudo isto some ao fechar o navegador.',
      nada: 'Nada só neste navegador: tudo o que está aqui veio da rede.',
      midiaLocal: '{n} arquivos de mídia existem só neste navegador — entram obrigatoriamente no backup.',
      exportar: 'Exportar backup agora'
    },
    atalhos: {
      titulo: 'Atalhos',
      novoArtigo: 'Novo artigo',
      novaPagina: 'Nova página',
      enviarMidia: 'Enviar mídia',
      verSite: 'Ver o site',
      outros: 'outros endereços:',
      lento: 'pode levar dias para atualizar'
    },
    ultimos: { titulo: 'Últimos artigos', nenhum: 'Nenhum artigo ainda.', editar: 'editar' },
    herdados: '{n} arquivos herdados de outra ferramenta (em Mídia → Arquivos herdados).',
    apoie: {
      titulo: 'Apoie o Nostermentor',
      texto: 'O Nostermentor é grátis e aberto. Se ele está sendo útil, apoie o projeto.',
      botao: 'Como apoiar',
      fechar: 'Fechar'
    }
  },

  status: { draft: 'rascunho', published: 'publicado', modified: 'alterado', removed: 'a remover' },

  siteJson: {
    invalido: 'O site.json publicado não está num formato que este app reconheça.',
    maisNovo: 'Este site foi publicado por um Nostermentor mais novo — atualize o app para editá-lo.'
  },

  db: {
    maisNovo: 'Este navegador guarda dados de um Nostermentor mais novo. Atualize o app para continuar.',
    erro: 'Não consegui abrir o armazenamento deste navegador: {e}'
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
