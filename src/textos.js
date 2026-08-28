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
      republicando: 'Republicando…',
      republicadoOk: 'Reenviado. Aceito em {n} de {m} relays.',
      republicadoFalhou: 'Nenhum relay aceitou o reenvio. Tente de novo em instantes.',
      republicarApoio: 'Reenvia o mapa já assinado — não precisa da sua chave.',
      maisNovoAviso: 'Um relay tem uma versão mais nova do seu site do que a deste navegador. Recarregue da rede antes de publicar por cima.',
      republicarTravado: 'Não dá para reenviar agora: um relay tem uma versão mais nova do que a deste navegador. Reenviar a daqui mandaria o seu site para trás. Recarregue da rede primeiro.',
      reenvioTitulo: 'Resultado do reenvio, relay por relay:',
      recarregar: 'Recarregar da rede',
      foraDoAr: 'Site fora do ar desde {d}: o mapa publicado está vazio e os endereços do site não mostram nada.',
      foraDoArApoio: 'O seu conteúdo continua aqui. Publicar põe tudo de volta no ar.',
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
      lento: 'pode levar dias para atualizar',
      naoPublicado: 'ainda não publicado — o endereço só mostra o site depois da primeira publicação',
      foraDoAr: 'fora do ar — o endereço não mostra nada até você publicar de novo'
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
    verOnline: 'Ver online ↗', menuSim: '✓', menuNao: '—', semData: '—'
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
      capa: 'Imagem de capa', capaNenhuma: '(nenhuma)', capaApoio: 'Escolha da biblioteca de Mídia.', capaEscolher: 'Escolher…',
      menu: 'Mostrar no menu'
    },
    // M5: UI de aliases — onde o dono vê e, se quiser, apaga um redirecionamento
    // antigo (13 §4.0). Ficam ao lado de "Renomear caminho…", que é quem os cria.
    aliases: {
      titulo: 'Endereços antigos',
      apoio: 'Continuam no ar como redirecionamento para o caminho atual.',
      remover: 'Remover',
      modalTitulo: 'Remover o redirecionamento de {p}?',
      modalTirar: 'Tirar do site: sempre funciona — na próxima publicação o redirecionamento some do mapa do site.',
      modalApagar: 'Apagar dos servidores: o Nostermentor tenta em cada um e depois mostra, servidor por servidor, onde conseguiu. Onde não conseguir, o endereço continua acessível para quem tiver o link.',
      modalAviso: 'Quem guardou o endereço antigo {p} deixa de ser redirecionado — o link para de funcionar.',
      confirmar: 'Remover',
      cancelar: 'Cancelar'
    },
    ferramentas: { negrito: 'Negrito', italico: 'Itálico', titulo: 'Título', link: 'Link', imagem: 'Imagem', lista: 'Lista', citacao: 'Citação', codigo: 'Código' },
    modelos: { negrito: 'texto em negrito', italico: 'texto em itálico', titulo: 'Título', link: 'texto do link', lista: 'item', citacao: 'citação', codigo: 'código' },
    imagem: {
      titulo: 'Inserir imagem da biblioteca',
      nenhuma: 'Ainda não há imagens na biblioteca. Envie uma em Mídia.',
      inserir: 'Inserir', comLink: 'Inserir com link…', linkTitulo: 'Endereço do link', linkPlaceholder: 'https://', linkConfirmar: 'Inserir com link', linkCancelar: 'Cancelar', fechar: 'Fechar'
    },
    capaModal: {
      titulo: 'Escolher imagem de capa', nenhuma: 'Ainda não há imagens na biblioteca. Envie uma em Mídia.',
      semCapa: '(nenhuma)', enviarNova: 'Enviar nova imagem…'
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
  // T6 / T6a / T6b (14 T6, T6a, T6b) — mídia. No M4 entra o essencial:
  // enviar com nome/alt/legenda, limpeza de metadados por padrão, pré-flight
  // por servidor e a lista com remoção. O resto (relato de remoção detalhado,
  // "Reconferir", aba de herdados) é M5.
  t6: {
    titulo: 'Mídia',
    vazio: 'Nenhum arquivo ainda. Envie imagens para usar nas páginas e nos artigos.',
    enviar: 'Enviar arquivos',
    coluna: { arquivo: 'Arquivo', caminho: 'Caminho no site', tamanho: 'Tamanho', estado: 'Estado', ondeEsta: 'Onde está', acoes: '' },
    abas: [['biblioteca', 'Biblioteca'], ['herdados', 'Arquivos herdados']],
    herdado: 'herdado (veio da rede)',
    soLocal: 'só neste navegador',
    remover: 'Remover',
    excluir: 'Excluir',
    excluirTitulo: 'Excluir {p}?',
    excluirTexto: 'Excluir apaga o arquivo daqui agora, e não há o que desfazer. Se ele só existe neste navegador, não haverá outra cópia.',
    excluirJaEsteve: 'Atenção: este arquivo já esteve num servidor. Excluí-lo aqui não o apaga de lá — só perde o registro que o app tinha dele.',
    desfazer: 'Desfazer',
    editar: 'Editar descrição',
    editarTitulo: 'Descrição de {p}',
    salvar: 'Salvar',
    cancelar: 'Cancelar',
    copiarCaminho: 'Copiar endereço',
    copiarMarcacao: 'Copiar marcação',
    copiado: 'Copiado.',
    naoPublicadas: '{n} arquivo(s) ainda não publicado(s).',
    semMiniatura: 'sem pré-visualização aqui',
    dimensoes: '{l} × {a}',
    // "Onde está" (13 §7.2): o caso que o Tails torna crítico é o de baixo.
    emServidores: 'em {n} servidor(es)',
    soAqui: 'só neste navegador — entra no backup obrigatoriamente',
    metadados: { limpos: 'metadados limpos', mantidos: 'metadados mantidos por sua opção', desconhecido: 'metadados: não se sabe (veio da rede)' },
    // Relato de remoção (13 §4.3 `removal`) e a reconferência de 05 §2.2:
    // um servidor pode aceitar o DELETE e continuar a servir o arquivo.
    relatoTitulo: 'O que foi apagado dos servidores',
    relatoApoio: 'Tirar do site sempre funciona. Apagar dos servidores depende de cada um — e pode levar minutos, ou horas, até parar de servir. Reconferir pergunta de novo.',
    relatoApagado: 'apagado de {s}',
    relatoRecusou: '{s} não deixou apagar — continua acessível para quem tiver o endereço',
    relatoPorConferir: '{s}: aceitou, ainda a confirmar',
    reconferir: 'Reconferir',
    reconferindo: 'Reconferindo…',
    relatoSumiu: 'já não está em {s}',
    relatoAindaLa: 'ainda está em {s}',
    relatoIndeterminado: 'não consegui verificar em {s}',
    relatoQuando: 'conferido em {d}',
    relatoNada: 'Nenhum arquivo removido ainda.',
    // Aba de herdados (14 T2c/T6): o que o app preserva porque não é dele.
    herdadosApoio: 'Estes arquivos já estavam publicados nesta chave por outra ferramenta. O Nostermentor não os toca: eles continuam no ar em toda publicação, do jeito que estão, até você removê-los aqui, um a um.',
    herdadosVazio: 'Nenhum arquivo herdado — tudo o que está no ar foi publicado por este app.',
    herdadosColisao: 'Este endereço é também um dos que o app gera. Enquanto o arquivo antigo estiver aqui, a publicação fica bloqueada — remova-o para publicar a sua versão.'
  },
  t6a: {
    titulo: 'Enviar mídia',
    escolher: 'Escolher arquivos',
    apoio: 'No Tails, o seletor alcança o Persistent Storage e o pendrive. Se aparecer uma janela pedindo para confirmar, clique OK.',
    nomeNoSite: 'Nome no site',
    nomeApoio: 'O nome original do arquivo não é guardado.',
    caminhoFinal: 'Ficará em {p}',
    alt: 'Descreva a imagem',
    altApoio: 'É acessibilidade e ajuda a ser encontrado.',
    legenda: 'Legenda',
    limpar: 'Limpar metadados (câmera, data, GPS)',
    limparAviso: 'Publicar é irreversível: o que subir com metadados fica.',
    semLimpeza: 'Este tipo pode conter metadados que o app não remove.',
    svg: 'Será limpo de scripts.',
    paraOnde: 'Para onde vai',
    preflight: { aceita: 'vai aceitar', recusa: 'vai recusar', indeterminado: 'não consegui verificar', verificando: 'verificando…' },
    nenhumServidor: 'Nenhum dos seus servidores aceita este tipo ou tamanho. O arquivo não entra.',
    // Faixas de 05 §2.2 — ditas antes de subir, não depois da recusa.
    grande20: 'Acima de 20 MB este arquivo não cabe nos servidores mais restritivos: ele vai ficar em menos cópias.',
    grande100: 'Acima de 100 MB só os dois servidores principais aceitam. Pelo Tor, um arquivo deste tamanho demora — não feche o navegador durante a publicação.',
    jaVerificado: 'já verificado antes',
    dimensoes: '{l} × {a} pixels',
    adicionar: 'Adicionar à biblioteca',
    adicionadas: '{n} arquivo(s) na biblioteca. Nada subiu ainda — subir é o que "Publicar" faz.',
    erroLeitura: 'Não consegui ler este arquivo.',
    repetido: 'Já existe um arquivo com este caminho.',
    cancelar: 'Cancelar'
  },
  t6b: {
    titulo: 'Remover {p} do site?',
    tirar: 'Tirar do site: sempre funciona — na próxima publicação o arquivo some de todas as páginas e do mapa do site.',
    apagar: 'Apagar dos servidores: o Nostermentor tenta em cada um e depois mostra, servidor por servidor, onde conseguiu. Onde não conseguir, o arquivo continua acessível para quem tiver o endereço dele.',
    usadaEm: 'Páginas e artigos que ainda usam este arquivo: {n}. Eles ficarão com a imagem quebrada.',
    remover: 'Remover',
    cancelar: 'Cancelar'
  },

  // T8 (14 T8) — o botão único com diff prévio, o placar honesto (D8) e a
  // guarda contra publicar por cima de outra máquina (13 §6.3 item 5).
  t8: {
    titulo: 'Publicar',
    conferindo: 'Conferindo o que mudou…',
    conferindoRede: 'Conferindo se alguém publicou este site em outra máquina…',
    conferindoServidores: 'Conferindo se os servidores aceitam os arquivos…',
    naoConferi: 'Não consegui conferir se houve publicação em outra máquina.',
    concorrente: 'Outra máquina publicou este site em {d}. Recarregue da rede antes de publicar por cima — o último a publicar apaga o anterior.',
    recarregar: 'Recarregar da rede',
    vazio: 'Nada a publicar — o site está igual ao que está aqui.',
    blocos: { sobe: 'Sobe', atualiza: 'Atualiza', some: 'Some', herdados: 'Fica como está (veio de outra ferramenta)' },
    porques: {
      blog: 'porque um artigo mudou',
      home: 'porque a inicial mostra artigos recentes',
      site_json: 'sempre que algo muda',
      tema: 'porque o tema mudou',
      alias: 'redirecionamento',
      apagar: 'e o app vai tentar apagar dos servidores',
      sai: 'sai do mapa do site'
    },
    eventosTitulo: 'Eventos assinados',
    eventos: { manifest: 'Mapa do site (manifest)', kind0: 'Perfil', kind10002: 'Lista de relays', kind10063: 'Lista de servidores' },
    total: '{n} arquivo(s), {x} para subir, {m} relays.',
    tor: 'Pelo Tor cada conexão demora de 2 a 8 vezes mais — não feche o navegador.',
    bloqueado: 'Um arquivo não pode subir em nenhum servidor. Remova-o ou mude de servidor para poder publicar.',
    avisosTitulo: 'Avisos do pré-flight',
    naoPodeSubirItem: 'não pode subir em nenhum servidor',
    avisoVaiRecusar: 'vai recusar',
    avisoParcial: '{recusa} — sobe só para {aceita}.',
    colisao: 'Este endereço já tem um arquivo publicado por outra ferramenta: {p}. Publicar agora substituiria o arquivo antigo, e o Nostermentor prometeu preservá-lo.',
    colisoes: 'Estes endereços já têm arquivos publicados por outra ferramenta: {p}. Publicar agora substituiria os arquivos antigos, e o Nostermentor prometeu preservá-los.',
    colisaoApoio: 'Para publicar a sua versão, remova antes o arquivo antigo em Mídia. Enquanto ele estiver lá, continua no ar como está.',
    colisaoBotao: 'Ir a Mídia',
    assinar: 'Assinar e publicar',
    publicando: 'Publicando…',
    passos: {
      upload: 'Enviando arquivos: {f} de {t}',
      assinar: 'Assinando o mapa do site',
      relays: 'Enviando aos relays',
      metadados: 'Enviando os dados da identidade',
      remover: 'Apagando arquivos removidos'
    },
    interrompida: 'Publicação interrompida: {p} não subiu em nenhum servidor. Nada mudou no seu site.',
    interrompidaApoio: 'Os arquivos que subiram ficam registrados — não se perde o trabalho.',
    semRelay: 'Os arquivos subiram, mas nenhum relay aceitou o mapa do site. O site publicado continua o de antes. Tente de novo em instantes ou confira os relays em Avançado.',
    semServidor: 'Não há servidores configurados para receber os arquivos.',
    erroAssinar: 'Não consegui assinar. Entre de novo com a sua chave.',
    publicado: 'Publicado.',
    placarArquivos: 'Arquivos: {n} de {t} em {s}.',
    placarRelays: 'Mapa do site aceito em {n} de {m} relays.',
    placarRelaysDetalhe: '{r} recusou(aram), {q} não respondeu(eram) — você pode "Republicar" no Início mais tarde.',
    placarRemocao: '{p}: apagada de {ok}.',
    placarRemocaoNao: '{p}: {nao} não deixou(aram) apagar — o arquivo continua acessível para quem tiver o endereço.',
    demora: 'Os endereços públicos levam minutos para atualizar — e o nsite.cloud pode levar dias.',
    confira: 'Confira em',
    backupAgora: 'Faça o backup agora — ele guarda o mapa assinado, que é o que permite republicar sem a chave.',
    exportar: 'Exportar backup',
    voltar: 'Voltar ao início',
    motivos: {
      tipo_nao_aceito: 'tipo não aceito',
      grande_demais: 'grande demais',
      sem_permissao: 'sem permissão',
      politica: 'recusado pela política do servidor',
      pagamento: 'exige pagamento',
      limite: 'limite de uso atingido',
      indisponivel: 'servidor indisponível',
      malformado: 'pedido malformado',
      hash_diferente: 'o servidor devolveu outro arquivo',
      origem_inacessivel: 'não conseguiu buscar o arquivo',
      nao_implementa: 'não faz a verificação prévia',
      rede: 'não consegui falar com o servidor',
      timeout: 'demorou demais',
      recusado: 'recusado'
    },
    relayEstados: { aceito: 'aceitou', recusado: 'recusou', timeout: 'não respondeu', erro: 'não consegui conectar', fechou: 'fechou a conexão', invalida: 'endereço inválido', cancelado: 'cancelado' }
  },

  // 14 T7 — Configurações: a `site` inteira (13 §3), com o técnico escondido
  // em "Avançado" (03 §3.6). O bloco "Tirar o site do ar" é o único gesto
  // destrutivo do painel (03 §6, decisão de 2026-08-27).
  t7: {
    titulo: 'Configurações',
    abas: [['site', 'Site'], ['doacoes', 'Doações'], ['aparencia', 'Aparência'], ['privacidade', 'Privacidade'], ['avancado', 'Avançado']],
    salvar: 'Salvar',
    salvando: 'Salvando…',
    salvo: 'Configurações salvas neste navegador.',
    semAlteracoes: 'Nada mudou.',
    regenera: 'Isto muda todas as páginas — a próxima publicação vai subir tudo de novo.',
    soMapa: 'A próxima publicação atualiza o mapa do site e os dados da sua identidade.',
    site: {
      titulo: 'Título',
      tituloApoio: 'É assim que o seu site aparece nos diretórios e na busca.',
      descricao: 'Descrição',
      descricaoApoio: 'Uma frase sobre o site. Vai para o mapa do site e para os buscadores.',
      obrigatorios: 'Título e descrição são obrigatórios para publicar.',
      idioma: 'Idioma',
      idiomas: [['pt-BR', 'Português (Brasil)'], ['pt-PT', 'Português (Portugal)'], ['en', 'Inglês'], ['es', 'Espanhol'], ['fr', 'Francês'], ['de', 'Alemão'], ['it', 'Italiano']],
      perfil: 'Perfil',
      perfilApoio: 'Aparece em apps Nostr e nos diretórios de sites.',
      perfilNome: 'Nome',
      perfilSobre: 'Sobre',
      avatar: 'Imagem do perfil',
      avatarNenhuma: '(nenhuma)',
      avatarEscolher: 'Escolher…',
      avatarModal: 'Escolher a imagem do perfil',
      avatarSemImagens: 'Ainda não há imagens na biblioteca. Envie uma em Mídia.',
      avatarEnviar: 'Enviar nova imagem…',
      avatarApoio: 'Só entra no perfil depois de publicada — é o endereço dela nos servidores que vai para o Nostr.',
      inicial: 'Página inicial',
      inicialPagina: 'Uma página fixa',
      inicialBlog: 'A lista de artigos',
      inicialQual: 'Qual página',
      inicialSemPaginas: 'Você ainda não tem páginas. Crie uma em Páginas.',
      recentes: 'Mostrar os artigos mais recentes na inicial',
      recentesApoio: '0 = nenhum.',
      blog: 'Blog',
      blogTitulo: 'Título da seção',
      menu: 'Menu',
      menuApoio: 'A ordem aqui é a ordem no site. Páginas marcadas "mostrar no menu" que não estiverem nesta lista entram no fim.',
      menuVazio: 'O menu está vazio.',
      menuSubir: '▲',
      menuDescer: '▼',
      menuRemover: 'Remover',
      menuSubirDica: 'Subir',
      menuDescerDica: 'Descer',
      menuPaginaSumida: '(página que não existe mais)',
      menuExterno: '↗',
      menuAddPagina: 'Adicionar página',
      menuAddBlog: 'Adicionar o Blog',
      menuAddLink: 'Adicionar link externo',
      menuLinkRotulo: 'Rótulo',
      menuLinkUrl: 'Endereço (https://…)',
      menuLinkInvalido: 'Endereço inválido: use um endereço http:// ou https:// completo.',
      menuAdicionar: 'Adicionar',
      menuTodasNoMenu: 'Todas as páginas do menu já estão na lista.'
    },
    doacoes: {
      endereco: 'Lightning address do site',
      enderecoApoio: 'Os leitores podem enviar sats direto para você; não passa por ninguém.',
      enderecoInvalido: 'Um lightning address tem a forma nome@dominio.',
      bloco: 'Mostrar o bloco "apoie este site"',
      blocoApoio: 'Aparece no rodapé do site, com o seu endereço Lightning.',
      credito: 'Mostrar "Publicado com Nostermentor" no rodapé do site',
      creditoApoio: 'Ajuda outras pessoas a descobrir a ferramenta; você pode desligar.'
    },
    aparencia: {
      tema: 'Tema',
      temaAtual: 'Padrão',
      semOpcoes: 'Este tema não tem opções para ajustar nesta versão.',
      outros: 'Temas de outras pessoas: numa fase seguinte.',
      previa: 'Ver como o site está ficando',
      previaTitulo: 'Pré-visualização do site',
      previaVazia: 'Ainda não há nada para pré-visualizar.'
    },
    privacidade: {
      hora: 'Mostrar a hora de publicação dos artigos',
      horaApoio: 'Ligado, o site revela a que horas você publica — um padrão que pode indicar seu fuso e rotina.',
      lembrete: 'O que ajuda o site a ser encontrado (título, descrição, mapa do site) está sempre ligado. Anonimato não é invisibilidade.'
    },
    avancado: {
      aviso: 'Só mexa aqui se souber o que está fazendo — a lista padrão foi testada.',
      mostrar: 'Mostrar as opções avançadas',
      relays: 'Relays',
      relaysApoio: 'Os relays guardam o mapa do seu site. Quanto mais aceitarem, mais difícil o site sumir.',
      servidores: 'Servidores de arquivos',
      servidoresApoio: 'Os servidores guardam os arquivos. A ordem é a ordem de confiança — o primeiro é o preferido.',
      remover: 'Remover',
      adicionar: 'Adicionar',
      novoRelay: 'wss://…',
      novoServidor: 'https://…',
      relayInvalido: 'Endereço de relay inválido: precisa começar por wss://.',
      servidorInvalido: 'Endereço de servidor inválido: precisa começar por https://.',
      repetido: 'Este endereço já está na lista.',
      ultimoRelay: 'Precisa sobrar pelo menos um relay — sem relay não há como publicar o mapa do site.',
      ultimoServidor: 'Precisa sobrar pelo menos um servidor — sem servidor não há onde guardar os arquivos.',
      restaurar: 'Restaurar lista padrão',
      testar: 'Testar',
      testando: 'Testando…',
      testeApoio: 'O teste publica um evento efêmero com uma chave descartável. A sua chave não é usada.',
      testeEstados: { aceita: 'aceita escrita', recusa: 'recusou', mudo: 'não respondeu' },
      estados: { atual: '✓ com a versão atual', antigo: '⚠ com uma versão antiga', mais_novo: '⚠ com uma versão mais nova', sem: '✗ sem o site', nao_respondeu: '? não respondeu', desconhecido: '? ainda não verificado' },
      servidorSemDados: 'ainda não verificado',
      servidorVerificado: 'verificado em {d}',
      servidorRecusa: 'recusa: {lista}',
      servidorPadrao: 'da lista padrão: aceita todos os tipos testados e deixa apagar',
      avisoServidor: 'O que subir aqui não sai mais. Este servidor aceita upload de qualquer chave, mas só deixa apagar quem tem conta.',
      avisoServidorApoio: 'O Nostermentor não tem como conferir isso antes de subir: a lista padrão só tem servidores em que a remoção foi medida. Se adicionar outro, é por sua conta.',
      avisoServidorEntendi: 'Entendi, adicionar mesmo assim',
      avisoServidorCancelar: 'Cancelar',
      versao: 'Verificar se há nova versão do Nostermentor ao abrir',
      versaoApoio: 'A verificação em si chega com a tela "Nova versão"; aqui você já decide se quer que ela aconteça. Nunca há atualização automática: quem troca o arquivo é você.',
      fixos: 'Tempos de espera e paralelismo não são ajustáveis: 45 s por relay e 120 s por operação de arquivo, valores medidos para funcionar pelo Tor. O Tor é transparente para o app — não há proxy a configurar.'
    },
    tirarDoAr: {
      titulo: 'Tirar o site do ar',
      texto: 'O endereço do seu site passa a não mostrar nada.',
      naoApaga: 'Não é apagar a história: o índice antigo continua guardado nos relays que já o receberam, e quem tiver o endereço direto de um arquivo ainda pode alcançá-lo. Onde o servidor não deixar apagar, o arquivo fica.',
      naoPerde: 'O seu conteúdo não se perde — continua aqui e no seu backup, e você pode publicar de novo quando quiser.',
      herdados: 'Atenção: {n} arquivo(s) herdado(s) de outra ferramenta saem da biblioteca. O Nostermentor nunca teve esses arquivos, então não há como republicá-los.',
      backup: 'Você tem {n} alteração(ões) que ainda não estão no backup. Exporte antes.',
      backupBotao: 'Exportar backup primeiro',
      confirmeRotulo: 'Para confirmar, digite o título do site: {t}',
      confirmeRotuloSemTitulo: 'Para confirmar, digite: {t}',
      palavraSemTitulo: 'TIRAR DO AR',
      botao: 'Tirar o site do ar',
      trabalhando: 'Tirando do ar…',
      passos: { assinar: 'Assinando o mapa vazio', relays: 'Enviando aos relays', apagar: 'Apagando arquivos: {f} de {t}' },
      semRelay: 'Nenhum relay aceitou o mapa vazio. O seu site continua no ar exatamente como estava, e nenhum arquivo foi apagado. Tente de novo em instantes.',
      semAssinatura: 'Não consegui assinar. Entre de novo com a sua chave.',
      feito: 'Site fora do ar.',
      placarServidor: '{s}: {a} apagado(s), {r} recusado(s), {c} por conferir (de {t}).',
      placarNenhum: 'Este site não tinha arquivos para apagar.',
      placarRelays: 'Mapa vazio aceito em {n} de {m} relays.',
      demora: 'Os endereços públicos levam minutos para refletir — e o nsite.cloud pode levar dias.',
      lembrete: 'O mapa antigo continua nos relays que já o tinham: o 15128 é substituível, não apagável.',
      publicarDeNovo: 'Tudo o que estava aqui voltou ao estado "nunca publicado". Para pôr o site de volta no ar, é só publicar.',
      irPublicar: 'Ir a Publicar'
    }
  },

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
      passoLendo: 'Lendo o que está guardado…',
      passoMidia: 'Preparando a mídia: {f} de {t} ({x})',
      passoMontando: 'Montando o arquivo…',
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

  // T11 — Ajuda e Sobre (14 T11). O LEIA-ME.txt vive também aqui, para quem
  // nunca abriu o arquivo de texto. Cada linha do bloco "abrir" é uma medição
  // da bancada Tails, não conselho genérico: P19 (só as cinco pastas
  // pessoais), P22 (Safest não corre), P28 (F5 no arranque mudo) e P27 (o
  // aviso "Could not read the contents of amnesia", inofensivo).
  t11: {
    titulo: 'Ajuda e Sobre',
    abas: [['abrir', 'Como abrir'], ['chave', 'A sua chave'], ['copias', 'Onde ficam as suas coisas'],
      ['remover', 'Remover não é apagar'], ['apoio', 'Apoiar'], ['sobre', 'Sobre']],
    abrir: {
      titulo: 'Como abrir o Nostermentor',
      intro: 'O Nostermentor é um arquivo só — nostermentor.html. Não instala nada: o navegador é o programa. Guarde-o numa pasta sua e abra-o com dois cliques.',
      tails: 'No Tails (o caso mais restrito — se funciona aqui, funciona em todo lado)',
      tailsPassos: [
        'Copie a pasta do Nostermentor para a pasta Documentos, e faça isso a cada sessão: o Tor Browser do Tails não abre o app a partir do pendrive nem do Persistent Storage.',
        'Abra o arquivo nostermentor.html no Tor Browser (Ctrl+O, ou arraste o arquivo para a janela).',
        'Nível de segurança Standard ou Safer. Em Safest o navegador desliga o JavaScript e o painel não arranca — se isso acontecer, a própria tela explica.',
        'Se a página abrir e ficar parada no aviso inicial, recarregue (F5). Acontece de vez em quando quando o navegador é aberto já com o arquivo.',
        'Os seus dados — chave, backup, imagens — ficam no Persistent Storage. O painel os alcança pelo seletor de arquivos, sempre que você mandar.',
        'Se depois de escolher arquivos aparecer "Could not read the contents of amnesia", clique OK: é um aviso do próprio Tails, sem consequência. Os arquivos chegaram inteiros.'
      ],
      outros: 'No Windows e no Linux',
      outrosPassos: [
        'Guarde a pasta onde quiser (Documentos serve) e abra o nostermentor.html no Firefox ou no Chrome, com dois cliques.',
        'Não é preciso servidor, nem instalação, nem internet para abrir o painel — só para publicar.'
      ],
      fecho: 'O painel não fala com nenhum servidor do projeto. As únicas conexões que ele faz são para os relays e os servidores de arquivos que você escolher em Configurações → Avançado.'
    },
    chave: {
      titulo: 'A sua chave',
      paragrafos: [
        'A chave secreta (nsec) é a única prova de que o site é seu. Quem tem a chave publica no seu lugar — trate-a como a senha de um cofre.',
        'O painel nunca guarda a sua chave. Ela fica na memória desta aba e desaparece quando você tranca ou fecha o navegador. Não está no backup, não está no arquivo do app, não sai daqui.',
        'Não existe recuperação. Não há "esqueci minha senha": perdida a chave, perde-se o endereço do site.',
        'Guarde-a num gerenciador de senhas (o KeePassXC já vem no Tails) ou num arquivo no Persistent Storage — o painel sabe ler os dois.',
        'A npub que aparece no alto da tela é a parte pública: é o endereço do seu site e pode ser mostrada a qualquer um.'
      ]
    },
    copias: {
      titulo: 'Onde ficam as suas coisas',
      intro: 'O Nostermentor guarda o seu trabalho em três lugares, e vale saber qual é qual:',
      itens: [
        ['O site publicado vive na rede', 'o mapa do site fica nos relays e os arquivos nos servidores Blossom. É de lá que o painel reconstrói tudo quando você entra noutro computador — basta a chave.'],
        ['Os rascunhos vivem no backup', 'o arquivo que você exporta na tela Backup é a única cópia do que ainda não foi publicado. Se ele não existir, o que você escreveu hoje pode sumir hoje.'],
        ['O navegador é só a mesa de trabalho', 'no Tor Browser essa mesa é limpa quando o navegador fecha. É por isso que o painel insiste no backup, e não por gosto de insistir.']
      ],
      regra: 'Regra prática: publicou, está na rede; não publicou, só existe no backup.'
    },
    remover: {
      titulo: 'Remover não é apagar',
      paragrafos: [
        'Tirar uma página, um artigo ou uma imagem do site sempre funciona: na próxima publicação aquele endereço deixa de existir e o gateway passa a devolver "não encontrado".',
        'Apagar o arquivo dos servidores é outra coisa, e nem sempre é possível. Um servidor pode recusar apagar, ou continuar a servir o arquivo por algum tempo depois de dizer que apagou. Quem tiver o endereço direto do arquivo ainda pode alcançá-lo.',
        'Por isso o painel relata, servidor por servidor, onde conseguiu apagar e onde não — no fim da tela Mídia, com um botão para reconferir mais tarde.',
        'A consequência prática: limpe o que não quer publicar antes de publicar. As imagens já saem limpas — o painel remove os metadados (onde a foto foi tirada, com que câmera) antes de enviar.',
        'Tirar o site inteiro do ar também existe, em Configurações → Avançado. Também não apaga a história: o mapa antigo continua nos relays que já o receberam.'
      ]
    },
    apoio: {
      titulo: 'Apoiar o Nostermentor',
      paragrafos: [
        'O Nostermentor é grátis e aberto, com licença MIT. Não há versão paga, recurso trancado nem cadastro — e não é para haver.',
        'A melhor forma de apoiar é usar o app e contar o que quebrou: relato de erro vale mais do que elogio.',
        'No rodapé do seu site, a linha "Publicado com Nostermentor" ajuda outras pessoas a chegarem aqui. Ela vem ligada e você pode desligá-la em Configurações → Doações — sem culpa.'
      ],
      lightningRotulo: 'Doação em Lightning:',
      semLightning: 'O endereço para doações ainda não está publicado. Quando estiver, aparece aqui.',
      siteRotulo: 'Site oficial do projeto:',
      semSite: 'O site oficial ainda não está publicado.'
    },
    sobre: {
      titulo: 'Sobre',
      versaoRotulo: 'Versão:',
      licencaRotulo: 'Licença:',
      codigoRotulo: 'Código-fonte:',
      bibliotecasTitulo: 'Bibliotecas embutidas',
      bibliotecasApoio: 'Cada uma entra no arquivo como está, e a montagem recusa gerar o app se o conteúdo de qualquer uma divergir do hash anotado.',
      bibliotecas: [
        ['nostr-tools', '2.25.0', 'Unlicense', 'chaves, assinatura e verificação de eventos'],
        ['DOMPurify', '3.4.14', 'Apache-2.0', 'limpeza do HTML que a pré-visualização mostra'],
        ['marked', '18.0.11', 'MIT', 'Markdown → HTML'],
        ['Mustache', '4.2.0', 'MIT', 'o tema, que vira as páginas do site']
      ],
      privacidade: 'O painel não tem telemetria, não carrega fontes nem imagens de fora e não fala com nenhum servidor do projeto. As únicas conexões são as que você mandar fazer.'
    }
  },

  // Endereços do projeto. Ficam num lugar só: quando existirem de verdade,
  // é aqui que se preenche (T11 mostra o que estiver preenchido e diz a
  // verdade sobre o que não estiver).
  projeto: {
    licenca: 'MIT',
    repositorio: 'https://github.com/LucasQSats/nostermentor',
    lightning: '',
    site: ''
  },

  stub: {
    texto: 'Esta tela ainda não foi implementada nesta versão de desenvolvimento.',
    porTela: {}
  },

  fixos: {
    salvoNaoBackup: 'Salvo neste navegador. Não é backup.',
    fechar: 'Fechar',
    naoConseguiVerificar: 'Não consegui verificar',
    tor: 'Pelo Tor cada conexão demora de 2 a 8 vezes mais — não feche o navegador.',
    privacidade: 'Anonimato não é invisibilidade: o que ajuda o site a ser lido fica ligado; o que revela quem você é fica desligado.'
  }
});
