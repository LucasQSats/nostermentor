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

  // 14 T4 / T5 — listas
  t4: {
    titulo: 'Páginas', nova: 'Nova página', voltar: '← Páginas',
    colunas: { titulo: 'Título', caminho: 'Caminho', estado: 'Estado', menu: 'No menu', atualizada: 'Atualizada', acoes: 'Ações' },
    selo: 'Início',
    vazio: 'Nenhuma página ainda.', vazioFiltro: 'Nenhuma página com este filtro.',
    removerAviso: 'A página sai do site na próxima publicação. Até lá, você pode desfazer.',
    excluirAviso: 'Esta página nunca foi publicada. Excluir apaga de vez.',
    inicioAviso: 'Definir esta página como Início regenera todas as páginas na próxima publicação.',
    filtros: [['todos', 'Todas'], ['draft', 'Rascunhos'], ['published', 'Publicadas'], ['modified', 'Alteradas'], ['removed', 'A remover']],
    estados: { draft: 'Rascunho', published: 'Publicada', modified: 'Alterada', removed: 'A remover' },
    estadosDica: { draft: 'nunca publicada', published: 'está no site como está aqui', modified: 'a versão publicada é outra', removed: 'some na próxima publicação' }
  },
  t5: {
    titulo: 'Artigos', novo: 'Novo artigo', voltar: '← Artigos',
    colunas: { titulo: 'Título', caminho: 'Caminho', data: 'Data', etiquetas: 'Etiquetas', estado: 'Estado', atualizada: 'Atualizada', acoes: 'Ações' },
    vazio: 'Nenhum artigo ainda.', vazioFiltro: 'Nenhum artigo com este filtro.',
    removerAviso: 'O artigo sai do site na próxima publicação. Até lá, você pode desfazer.',
    excluirAviso: 'Este artigo nunca foi publicado. Excluir apaga de vez.',
    filtros: [['todos', 'Todos'], ['draft', 'Rascunhos'], ['published', 'Publicados'], ['modified', 'Alterados'], ['removed', 'A remover']],
    estados: { draft: 'Rascunho', published: 'Publicado', modified: 'Alterado', removed: 'A remover' },
    estadosDica: { draft: 'nunca publicado', published: 'está no site como está aqui', modified: 'a versão publicada é outra', removed: 'some na próxima publicação' }
  },
  listas: {
    busca: 'Buscar por título', buscaRotulo: 'Buscar',
    acoes: { editar: 'Editar', ver: 'Ver', remover: 'Remover', desfazer: 'Desfazer remoção', excluir: 'Excluir', inicio: 'Definir como Início', confirmar: 'Confirmar', cancelar: 'Cancelar' },
    menuSim: '✓', menuNao: '—', semData: '—'
  },

  // 14 T4a / T5a — editor
  editor: {
    titulos: { novaPagina: 'Nova página', novoArtigo: 'Novo artigo', editarPagina: 'Editar página', editarArtigo: 'Editar artigo' },
    campos: {
      titulo: 'Título', caminho: 'Caminho', renomear: 'Renomear caminho…',
      renomearExplica: 'O caminho antigo continua funcionando e passa a redirecionar para o novo. Links que outras pessoas já guardaram não quebram.',
      ehInicio: 'Esta página é o Início do site: é publicada em /index.html.',
      descricao: 'Descrição', descricaoApoio: 'Uma frase para os buscadores — se vazio, o primeiro parágrafo é usado.',
      conteudo: 'Conteúdo', conteudoApoio: 'Markdown. Os botões inserem a marcação no texto selecionado.',
      data: 'Data', dataApoio: 'O leitor vê só o dia (a hora de publicação fica escondida).',
      resumo: 'Resumo', resumoApoio: 'Aparece na lista do blog; se vazio, o primeiro parágrafo.',
      etiquetas: 'Etiquetas', etiquetasApoio: 'Separadas por vírgula. Só para exibir — páginas por etiqueta vêm numa fase seguinte.',
      capa: 'Imagem de capa', capaNenhuma: '(nenhuma)', capaApoio: 'Escolha da biblioteca de Mídia.',
      menu: 'Mostrar no menu'
    },
    ferramentas: { negrito: 'Negrito', italico: 'Itálico', titulo: 'Título', link: 'Link', imagem: 'Imagem', lista: 'Lista', citacao: 'Citação', codigo: 'Código' },
    modelos: { negrito: 'texto em negrito', italico: 'texto em itálico', titulo: 'Título', link: 'texto do link', lista: 'item', citacao: 'citação', codigo: 'código' },
    imagem: {
      titulo: 'Inserir imagem da biblioteca',
      nenhuma: 'Ainda não há imagens na biblioteca. Enviar mídia chega no marco M4 desta versão de desenvolvimento.',
      inserir: 'Inserir', fechar: 'Fechar'
    },
    previa: { titulo: 'Pré-visualização', rotulo: 'Pré-visualização do conteúdo (isolada)' },
    lateral: {
      estado: 'Estado', ultima: 'Última alteração {d}', nuncaSalvo: 'Ainda não salvo neste navegador.',
      salvar: 'Salvar', salvando: 'Salvando…', salvo: 'Salvo às {h} UTC.', salvoAuto: 'Salvo automaticamente às {h} UTC.',
      publicar: 'Publicar alterações', ver: 'Ver como ficará'
    },
    erros: {
      tituloObrigatorio: 'O título é obrigatório.',
      caminhoInvalido: 'Caminho inválido: use só letras minúsculas, números e hífens.',
      caminhoReservado: 'Este caminho é reservado pelo site — escolha outro.',
      caminhoEmUso: 'Já existe outro com este caminho.',
      removido: 'Marcado para remoção. Desfaça a remoção para voltar a editar.',
      naoEncontrado: 'Não encontrei este registro neste navegador.'
    },
    verComoFicara: { titulo: 'Como ficará no site', fechar: 'Fechar' },
    sair: 'Há alterações não salvas.'
  },

  // 14 T9 — backup
  t9: {
    titulo: 'Backup',
    porque: 'O que está neste navegador não é durável: no Tor Browser some ao fechar. O backup é a única cópia que sobrevive.',
    exportar: {
      titulo: 'Exportar',
      necessario: 'O necessário', necessarioApoio: 'tudo o que está neste navegador + a mídia que só existe aqui',
      completo: 'Completo', completoApoio: 'inclui também a mídia já publicada — para quem não confia que os servidores durem',
      estimativa: 'Tamanho estimado: ~{x}. A mídia ocupa 33 % a mais dentro do backup.',
      grande: 'Backup grande — pelo Tor, gerar e baixar pode demorar.',
      preparar: 'Preparar o backup', preparando: 'Preparando…',
      baixar: 'Baixar {nome}', pronto: 'Pronto: {x}. Clique para baixar.',
      tails: 'No Tails, salve no Persistent Storage — é lá que ele sobrevive ao reinício.',
      falhou: 'Se o download falhou, exporte de novo.',
      baixado: 'Backup baixado. O contador de alterações não exportadas foi zerado.',
      tripwire: 'Backup interrompido por segurança: encontrei uma chave privada nos dados. Isto é um bug — nada foi gravado.',
      erro: 'Não consegui preparar o backup: {e}'
    },
    importar: {
      titulo: 'Importar',
      rotulo: 'Arquivo de backup (.json)', lendo: 'Lendo o arquivo…',
      resumo: 'Backup de {d}, versão {v}, feito pelo Nostermentor {app}.',
      chaveMesma: 'Chave: a mesma desta sessão ✓', chaveOutra: 'Chave: outra ({npub}) ⚠',
      contem: 'Contém {p} páginas, {a} artigos, {m} mídias ({b} com arquivo).',
      plano: 'Ao juntar: {n} novos, {u} atualizados, {i} iguais (ignorados), {l} locais mais recentes que o backup (mantidos).',
      juntar: 'Juntar com o que está aqui', substituir: 'Substituir tudo',
      substituirConfirma: 'Isto apaga tudo o que está neste navegador e põe o backup no lugar. Tem certeza?',
      substituirSim: 'Sim, substituir tudo', cancelar: 'Cancelar',
      outraChave: 'Este backup é de outra chave. Ele foi recusado.',
      outraChaveBotao: 'Importar como conteúdo desta chave',
      outraChaveAviso: 'O conteúdo passa a pertencer à chave desta sessão. O que estava publicado pela outra chave não é trazido.',
      maisNovo: 'Este backup foi feito por um Nostermentor mais novo — atualize o app para abri-lo.',
      novaVersao: 'Nova versão',
      invalido: 'Este arquivo não é um backup do Nostermentor.',
      tripwire: 'Importação interrompida por segurança: este arquivo contém uma chave privada. Nada foi gravado.',
      erroLeitura: 'Não consegui ler o arquivo escolhido. Tente de novo.',
      erro: 'Não consegui importar: {e}',
      feito: 'Backup importado: {n} novos, {u} atualizados, {i} iguais, {l} mantidos.',
      feitoSubstituir: 'Tudo substituído pelo backup: {n} registros.',
      sobrescritos: 'Substituídos pelo backup: {lista}',
      renomeados: 'Renomeados por colisão de caminho: {lista}'
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
    texto: 'Esta tela ainda não foi implementada nesta versão de desenvolvimento.',
    // 00 §6.1 (decisão de 2026-08-26): o "Publicar" acende no M3 mas só funciona no M4 — a mensagem é honesta
    porTela: { t8: 'Publicar chega no marco M4 desta versão de desenvolvimento. O que você escreveu está salvo neste navegador — exporte o backup para não perder.' }
  },

  fixos: {
    salvoNaoBackup: 'Salvo neste navegador. Não é backup.',
    fechar: 'Fechar',
    naoConseguiVerificar: 'Não consegui verificar',
    tor: 'Pelo Tor cada conexão demora de 2 a 8 vezes mais — não feche o navegador.',
    privacidade: 'Anonimato não é invisibilidade: o que ajuda o site a ser lido fica ligado; o que revela quem você é fica desligado.'
  }
});
