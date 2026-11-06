const prisma = require("../config/prisma");
const AppError = require("../utils/AppError");
const MSG = require("../utils/messages");
const HTTP_STATUS = require("../utils/httpsStatus");
const atividadeService = require("./atividadeService");
const { encriptar, desencriptar } = require("../utils/crypto");
const { rotuloTipoPlataforma, apagarFicheiroAntigoLogotipo } = require("../utils/fileHelper");
const { fornecedorPertenceAoTipo, obterFornecedor } = require("../constants/fornecedoresPlataforma");


const TIPO_GESTAO_DOMINIO = "GESTAO_DOMINIO";
const TIPO_CONTAINERIZACAO = "CONTAINERIZACAO";
const MILISSEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

const FORNECEDOR_OUTRO = "OUTRO";

// Campos que só fazem sentido numa plataforma de containerização
const CAMPOS_SO_CONTAINERIZACAO = ["registryUrl", "namespace"];
const LIMPAR_CAMPOS_CONTAINERIZACAO = { registryUrl: null, namespace: null };

// Nunca devolve nada sensível: a plataforma só tem dados de identificação
// Nunca devolve nada sensível: o token só sai pela rota protegida com reautenticação
const SELECT_SISTEMA_RESUMO = { id: true, nome: true, status: true };

const SELECT_PLATAFORMA = {
  id: true,
  nome: true,
  tipo: true,
  fornecedor: true,
  logotipo: true,
  urlPainel: true,
  ativo: true,
  // Contas de acesso: o token cifrado é lido só para saber se existe (ver formatar)
  acessos: {
    select: { id: true, descricao: true, utilizador: true, tokenCifrado: true },
    orderBy: { id: "asc" },
  },
  registryUrl: true,
  namespace: true,
  criadoEm: true,
  atualizadoEm: true,
  _count: { select: { dominios: true, servidores: true, infraestruturas: true, imagens: true } },
  // Para montar "sistemasHospedados" e os totais em formatar (não saem tal como estão)
  infraestruturas: {
    select: {
      ambiente: true,
      sistema: { select: SELECT_SISTEMA_RESUMO },
      servidor: { select: { nome: true } },
      imagem: { select: { nome: true, tag: true } },
    },
  },
  // Num registo (containerização): os backends que correm a partir das suas imagens
  imagens: {
    select: {
      nome: true,
      tag: true,
      infraestruturas: { select: { ambiente: true, sistema: { select: SELECT_SISTEMA_RESUMO } } },
    },
  },
  sistemasFrontend: { select: SELECT_SISTEMA_RESUMO },
};

// Registos de infraestrutura (ambiente + componente) com o sistema e os
// metadados das credenciais. O valor das credenciais nunca sai daqui.
const SELECT_INFRAESTRUTURAS_ARVORE = {
  select: {
    id: true,
    ambiente: true,

    url: true,
    sistema: {
      select: {
        id: true,
        nome: true,
        status: true,
        versaoAtual: true,
        responsavelTecnico: true,
        repositorioUrl: true,
        urlProducao: true,
      },
    },
    credenciais: {
      select: { id: true, tipo: true, label: true, criadoEm: true },
      orderBy: { criadoEm: "asc" },
    },
  },
  orderBy: [{ ambiente: "asc" }],
};


// ─── ESTRUTURA COMPLETA DA ÁRVORE ─────────────────────────────────────────────
// Hierarquia: Plataforma → Domínio → Subdomínio → Servidor → Sistema → Credenciais
// Notas de segurança:
// - A passwordCifrada NUNCA é lida ou devolvida na árvore.
// - O IP do servidor é desencriptado de forma segura em runtime.
// - As credenciais dos sistemas são devolvidas apenas com metadados (id, tipo, label),
//   sem expor o valorEncriptado (cuja leitura exige a rota protegida com reautenticação).

const SELECT_ARVORE = {
  id: true,
  nome: true,
  tipo: true,
  fornecedor: true,
  logotipo: true,
  urlPainel: true,
  ativo: true,
  criadoEm: true,
  atualizadoEm: true,
  // 1. Domínios (se for GESTAO_DOMINIO)
  dominios: {
    select: {
      id: true,
      nome: true,
      dataExpiracao: true,
      criadoEm: true,
      atualizadoEm: true,
      subdominios: {
        select: {
          id: true,
          nome: true,
          tipoDns: true,
          destino: true,
          ambiente: true,
          sistema: { select: { id: true, nome: true } },
          servidorId: true,
          servidor: {
            select: {
              id: true,
              nome: true,
              hostname: true,
              ipCifrado: true,
              usernameSsh: true,
              numeroCpu: true,
              memoriaRam: true,
              memoriaRamUnidade: true,
              disco: true,
              discoUnidade: true,
              larguraBanda: true,
              larguraBandaUnidade: true,
              sistemaOperativo: true,
              versaoSo: true,
              cloud: true,
              regiao: true,
              infraestruturas: SELECT_INFRAESTRUTURAS_ARVORE,

            },
          },
        },
        orderBy: [{ nome: "asc" }, { tipoDns: "asc" }],
      },
    },
    orderBy: [{ dataExpiracao: "asc" }, { nome: "asc" }],
  },
  // 2. Servidores (se for CLOUD_BASE_DADOS / CONTAINERIZACAO)
  servidores: {
    select: {
      id: true,
      nome: true,
      hostname: true,
      ipCifrado: true,
      usernameSsh: true,
      numeroCpu: true,
      memoriaRam: true,
      memoriaRamUnidade: true,
      disco: true,
      discoUnidade: true,
      larguraBanda: true,
      larguraBandaUnidade: true,
      sistemaOperativo: true,
      versaoSo: true,
      cloud: true,
      regiao: true,
      subdominios: {
        select: {
          id: true,
          nome: true,
          tipoDns: true,
          destino: true,
          ambiente: true,
          sistema: { select: { id: true, nome: true } },
          dominio: {
            select: { id: true, nome: true },
          },
        },
        orderBy: [{ nome: "asc" }, { tipoDns: "asc" }],
      },
      infraestruturas: SELECT_INFRAESTRUTURAS_ARVORE
    },
    orderBy: { nome: "asc" },
  },
  // 3. Backends que correm directamente na plataforma, sem servidor (os que têm servidor
  //    já aparecem dentro dele; incluí-los aqui duplicava-os)
  infraestruturas: { ...SELECT_INFRAESTRUTURAS_ARVORE, where: { servidorId: null } },
  // Frontends alojados nesta plataforma (ex: Vercel)
  sistemasFrontend: { select: { id: true, nome: true, status: true, versaoAtual: true }, orderBy: { nome: "asc" } },

  // 4. Imagens (se for CONTAINERIZACAO)
  imagens: {
    select: {
      id: true,
      nome: true,
      tag: true,
      visibilidade: true,
      origem: true,
      ativo: true,
      // Backends que correm a partir desta imagem (noutra plataforma)
      infraestruturas: SELECT_INFRAESTRUTURAS_ARVORE,
    },
    orderBy: [{ nome: "asc" }, { tag: "asc" }],
  },
};

// ─── HELPERS DE FORMATAÇÃO DA ÁRVORE ──────────────────────────────────────────

function calcularDiasParaExpirar(dataExpiracao) {
  if (!dataExpiracao) return null;
  const agora = new Date();
  const inicioDeHoje = Date.UTC(
    agora.getUTCFullYear(),
    agora.getUTCMonth(),
    agora.getUTCDate()
  );
  return Math.round((new Date(dataExpiracao).getTime() - inicioDeHoje) / MILISSEGUNDOS_POR_DIA);
}

function montarNomeCompleto(nome, nomeDominio) {
  if (!nomeDominio) return nome;
  return nome === "@" ? nomeDominio : `${nome}.${nomeDominio}`;
}

function desencriptarIpSeguro(ipCifrado) {
  if (!ipCifrado) return null;
  try {
    return desencriptar(ipCifrado);
  } catch (_e) {
    return null;
  }
}

function formatarServidorArvore(servidor) {
  if (!servidor) return null;
  const { ipCifrado, ...resto } = servidor;
  return {
    ...resto,
    ip: desencriptarIpSeguro(ipCifrado),
  };
}

function formatarArvore(plataforma) {
  const { dominios = [], servidores = [], infraestruturas = [], imagens = [], ...resto } = plataforma;

  if (plataforma.tipo === TIPO_GESTAO_DOMINIO) {
    return {
      ...resto,
      dominios: dominios.map((dom) => {
        const diasParaExpirar = calcularDiasParaExpirar(dom.dataExpiracao);
        return {
          ...dom,
          diasParaExpirar,
          expirado: diasParaExpirar < 0,
          subdominios: dom.subdominios.map((sub) => ({
            ...sub,
            nomeCompleto: montarNomeCompleto(sub.nome, dom.nome),
            servidor: sub.servidor ? formatarServidorArvore(sub.servidor) : null,
          })),
        };
      }),
    };
  }

  // CLOUD_BASE_DADOS ou CONTAINERIZACAO
  return {
    imagens,
    ...resto,
    servidores: servidores.map((srv) => {
      const { ipCifrado, subdominios = [], ...dadosServidor } = srv;
      return {
        ...dadosServidor,
        ip: desencriptarIpSeguro(ipCifrado),
        subdominios: subdominios.map((sub) => ({
          ...sub,
          nomeCompleto: montarNomeCompleto(sub.nome, sub.dominio?.nome),
        })),
      };
    }),
    infraestruturas, // sistemas directamente ligados (ex.: Vercel)
  };
}

// Sistemas distintos que usam a plataforma: frontend alojado nela, backend a correr nela
// (Cloud) ou backend a correr a partir de uma imagem guardada nela (registo).
// Um sistema com Produção e Testes aparece uma vez, com uma entrada por ambiente.
function listarSistemasHospedados({ infraestruturas = [], imagens = [], sistemasFrontend = [] }) {
  const porId = new Map();
  const obter = (sistema) => {
    if (!porId.has(sistema.id)) porId.set(sistema.id, { ...sistema, frontend: false, backend: [] });
    return porId.get(sistema.id);
  };

  for (const sistema of sistemasFrontend) obter(sistema).frontend = true;
  const nomeImagem = (imagem) => (imagem ? `${imagem.nome}:${imagem.tag}` : null);
  for (const { ambiente, sistema, servidor, imagem } of infraestruturas) {
    obter(sistema).backend.push({ ambiente, servidor: servidor?.nome ?? null, imagem: nomeImagem(imagem), viaImagem: false });
  }
  for (const imagem of imagens) {
    for (const { ambiente, sistema } of imagem.infraestruturas) {
      obter(sistema).backend.push({ ambiente, servidor: null, imagem: nomeImagem(imagem), viaImagem: true });
    }
  }

  return [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}

function formatar(plataforma) {
  const { _count, acessos, infraestruturas, imagens, sistemasFrontend, ...resto } = plataforma;
  const sistemasHospedados = listarSistemasHospedados({ infraestruturas, imagens, sistemasFrontend });
  return {
    ...resto,
    // O token nunca sai aqui: só pela rota protegida com reautenticação
    acessos: (acessos ?? []).map(({ tokenCifrado, ...acesso }) => ({
      ...acesso,
      temToken: Boolean(tokenCifrado),
    })),
    sistemasHospedados,
    totais: {
      dominios: _count?.dominios ?? 0,
      servidores: _count?.servidores ?? 0,
      sistemas: sistemasHospedados.length,
      imagens: _count?.imagens ?? 0,
    },
  };
}

async function obterPlataformaOuFalhar(id) {
  const plataforma = await prisma.plataforma.findUnique({
    where: { id },
    select: SELECT_PLATAFORMA,
  });

  if (!plataforma) {
    throw new AppError(MSG.PLATAFORMA.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  return plataforma;
}

async function garantirNomeLivre(nome, ignorarId) {
  const existente = await prisma.plataforma.findUnique({
    where: { nome },
    select: { id: true },
  });

  if (existente && existente.id !== ignorarId) {
    throw new AppError(MSG.PLATAFORMA.NOME_JA_EXISTE, HTTP_STATUS.CONFLICT);
  }
}

// Duas gravações em simultâneo podem passar a verificação acima; a constraint da BD apanha-as
function tratarNomeDuplicado(erro) {
  if (erro && erro.code === "P2002") {
    throw new AppError(MSG.PLATAFORMA.NOME_JA_EXISTE, HTTP_STATUS.CONFLICT);
  }
  throw erro;
}

/**
 * Servidores e backends de sistemas só existem em CLOUD_BASE_DADOS, imagens só em
 * CONTAINERIZACAO e domínios só em GESTAO_DOMINIO.
 * Mudar o tipo não pode deixar registos num tipo que não os admite.
 */
function verificarMudancaDeTipo(atual, novoTipo) {
  const { dominios, servidores, infraestruturas, imagens } = atual._count;

  const incompativel =
    (novoTipo !== TIPO_GESTAO_DOMINIO && dominios > 0) ||
    (novoTipo !== "CLOUD_BASE_DADOS" && servidores > 0) ||
    (novoTipo !== "CONTAINERIZACAO" && imagens > 0) ||
    (novoTipo !== "CLOUD_BASE_DADOS" && infraestruturas > 0);

  if (incompativel) {
    throw new AppError(MSG.PLATAFORMA.TIPO_INCOMPATIVEL, HTTP_STATUS.CONFLICT);
  }
}

async function listarPlataformas() {
  const plataformas = await prisma.plataforma.findMany({
    select: SELECT_PLATAFORMA,
    orderBy: [{ tipo: "asc" }, { nome: "asc" }],
  });

  return plataformas.map(formatar);
}

async function obterPlataforma(id) {
  return formatar(await obterPlataformaOuFalhar(id));
}

/**
 * Retorna a árvore completa de TODAS as plataformas registadas.
 */
async function obterArvorePlataformas() {
  const plataformas = await prisma.plataforma.findMany({
    select: SELECT_ARVORE,
    orderBy: [{ tipo: "asc" }, { nome: "asc" }],
  });

  return plataformas.map(formatarArvore);
}

/**
 * Retorna a árvore completa de UMA plataforma específica.
 */
async function obterArvorePlataforma(id) {
  const plataforma = await prisma.plataforma.findUnique({
    where: { id },
    select: SELECT_ARVORE,
  });

  if (!plataforma) {
    throw new AppError(MSG.PLATAFORMA.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  return formatarArvore(plataforma);
}

/**
 * Valida o ESTADO FINAL da plataforma (o que vem no pedido por cima do que já existia)
 * e monta os dados a gravar:
 *   - o fornecedor tem de pertencer ao tipo;
 *   - o nome vem do fornecedor, exceto em "Outro", onde é o utilizador que o escreve;
 *   - registryUrl e namespace só existem em CONTAINERIZACAO.
 * As contas de acesso ficam de fora: são gravadas à parte (ver gravarAcessos).
 */
function prepararDadosPlataforma(dados, atual) {
  const { nome, acessos, ...data } = dados;

  const tipo = dados.tipo ?? atual?.tipo;
  const fornecedor = dados.fornecedor ?? atual?.fornecedor;

  if (!fornecedorPertenceAoTipo(tipo, fornecedor)) {
    throw new AppError(MSG.PLATAFORMA.FORNECEDOR_INVALIDO_PARA_TIPO, HTTP_STATUS.UNPROCESSABLE_ENTITY);
  }

  if (fornecedor !== FORNECEDOR_OUTRO) {
    data.nome = obterFornecedor(tipo, fornecedor).rotulo;
  } else if (nome !== undefined) {
    data.nome = nome;
  } else if (!atual || atual.fornecedor !== FORNECEDOR_OUTRO) {
    throw new AppError(MSG.PLATAFORMA.NOME_OBRIGATORIO_OUTRO, HTTP_STATUS.UNPROCESSABLE_ENTITY);
  }

  if (tipo !== TIPO_CONTAINERIZACAO) {
    const enviouCampoDeContainerizacao = CAMPOS_SO_CONTAINERIZACAO.some(
      (campo) => dados[campo] !== undefined && dados[campo] !== null
    );
    if (enviouCampoDeContainerizacao) {
      throw new AppError(MSG.PLATAFORMA.CAMPOS_REGISTRY_INVALIDOS, HTTP_STATUS.CONFLICT);
    }
  }

  return data;
}

// Dados a gravar de uma conta de acesso. O token é encriptado; sem token no pedido
// (undefined) mantém-se o que já estava, null apaga-o.
function dadosAcesso(acesso) {
  const data = {
    descricao: acesso.descricao ?? null,
    utilizador: acesso.utilizador ?? null,
  };
  if (acesso.token !== undefined) {
    data.tokenCifrado = acesso.token === null ? null : encriptar(acesso.token);
  }
  return data;
}

/**
 * Garante que as contas enviadas com id pertencem à plataforma (e não se repetem),
 * antes de gravar. "idsAtuais" vazio = plataforma nova (nenhuma conta pode vir com id).
 */
function validarAcessos(acessos, idsAtuais) {
  const vistos = new Set();
  for (const { id } of acessos) {
    if (id === undefined) continue;
    if (!idsAtuais.has(id) || vistos.has(id)) {
      throw new AppError(MSG.PLATAFORMA.ACESSO_NAO_ENCONTRADO, HTTP_STATUS.NOT_FOUND);
    }
    vistos.add(id);
  }
}

/**
 * A lista enviada é a lista completa: as contas com id são atualizadas, as sem id
 * são criadas e as que já existiam mas não vieram são apagadas.
 */
async function gravarAcessos(tx, plataformaId, acessos) {
  const idsMantidos = acessos.filter((a) => a.id !== undefined).map((a) => a.id);

  await tx.plataformaAcesso.deleteMany({
    where: { plataformaId, id: { notIn: idsMantidos } },
  });

  for (const acesso of acessos) {
    if (acesso.id !== undefined) {
      await tx.plataformaAcesso.update({ where: { id: acesso.id }, data: dadosAcesso(acesso) });
    } else {
      await tx.plataformaAcesso.create({ data: { ...dadosAcesso(acesso), plataformaId } });
    }
  }
}

async function criarPlataforma(dados, usuarioId) {
  const data = prepararDadosPlataforma(dados, null);
  const acessos = dados.acessos ?? [];
  validarAcessos(acessos, new Set());
  await garantirNomeLivre(data.nome);

  try {
    return await prisma.$transaction(async (tx) => {
      const criada = await tx.plataforma.create({
        data: {
          ...data, // já validado e limpo pelo Zod
          acessos: { create: acessos.map(dadosAcesso) },
        },
        select: SELECT_PLATAFORMA,
      });

      await atividadeService.registrar(tx, {
        usuarioId,
        acao: `Criou a plataforma "${criada.nome}" (${rotuloTipoPlataforma(criada.tipo)})`,
      });

      return formatar(criada);
    });
  } catch (erro) {
    return tratarNomeDuplicado(erro);
  }
}

async function atualizarPlataforma(id, dados, usuarioId) {
  const atual = await obterPlataformaOuFalhar(id);

  const data = prepararDadosPlataforma(dados, atual);
  const tipoDestino = dados.tipo ?? atual.tipo;

  if (tipoDestino !== TIPO_CONTAINERIZACAO && atual.tipo === TIPO_CONTAINERIZACAO) {
    Object.assign(data, LIMPAR_CAMPOS_CONTAINERIZACAO);
  }

  if (data.nome !== undefined) {
    await garantirNomeLivre(data.nome, id);
  }

  if (dados.tipo !== undefined && dados.tipo !== atual.tipo) {
    verificarMudancaDeTipo(atual, dados.tipo);
  }

  // Sem "acessos" no pedido, as contas ficam como estão
  if (dados.acessos !== undefined) {
    validarAcessos(dados.acessos, new Set(atual.acessos.map((a) => a.id)));
  }

  try {
    return await prisma.$transaction(async (tx) => {
      if (dados.acessos !== undefined) {
        await gravarAcessos(tx, id, dados.acessos);
      }

      const atualizada = await tx.plataforma.update({
        where: { id },
        data: data,
        select: SELECT_PLATAFORMA,
      });

      await atividadeService.registrar(tx, {
        usuarioId,
        acao: `Atualizou a plataforma "${atualizada.nome}"`,
      });

      return formatar(atualizada);
    });
  } catch (erro) {
    return tratarNomeDuplicado(erro);
  }
}

async function apagarPlataforma(id, usuarioId) {
  const atual = await obterPlataformaOuFalhar(id);
  const { dominios, servidores, infraestruturas, imagens } = atual._count;

  if (dominios + servidores + infraestruturas + imagens > 0) {
    throw new AppError(MSG.PLATAFORMA.TEM_DEPENDENCIAS, HTTP_STATUS.CONFLICT);
  }

  return prisma.$transaction(async (tx) => {
    await tx.plataforma.delete({ where: { id } });

    await atividadeService.registrar(tx, {
      usuarioId,
      acao: `Apagou a plataforma "${atual.nome}" (${rotuloTipoPlataforma(atual.tipo)})`,
    });
  });
}

async function revelarToken(id, acessoId, usuarioId) {
  const acesso = await prisma.plataformaAcesso.findFirst({
    where: { id: acessoId, plataformaId: id },
    select: { descricao: true, utilizador: true, tokenCifrado: true, plataforma: { select: { nome: true } } },
  });

  if (!acesso) {
    throw new AppError(MSG.PLATAFORMA.ACESSO_NAO_ENCONTRADO, HTTP_STATUS.NOT_FOUND);
  }

  if (!acesso.tokenCifrado) {
    throw new AppError(MSG.PLATAFORMA.TOKEN_NAO_DEFINIDO, HTTP_STATUS.NOT_FOUND);
  }

  let token;
  try {
    token = desencriptar(acesso.tokenCifrado);
  } catch (_erro) {
    throw new AppError(
      "Não foi possível desencriptar o token da plataforma. Verifique a chave de encriptação.",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }

  await atividadeService.registrar(prisma, {
    usuarioId,
    // Identifica a conta (descrição ou utilizador), já que a plataforma pode ter várias
    acao: `Visualizou o token da conta "${acesso.descricao || acesso.utilizador || "sem nome"}" da plataforma "${acesso.plataforma.nome}"`,
  });

  return { token };
}

/**
 * Substitui o logótipo de uma plataforma.
 * O ficheiro antigo é apagado em background (sem bloquear a resposta).
 *
 * @param {number} id           - ID da plataforma.
 * @param {string} urlLogotipo  - URL relativa do novo logótipo (ex: "/uploads/plataformas/abc.png").
 * @param {number} usuarioId    - ID do utilizador que fez o upload.
 */
async function atualizarLogotipo(id, urlLogotipo, usuarioId) {
  const atual = await obterPlataformaOuFalhar(id);

  const atualizada = await prisma.plataforma.update({
    where: { id },
    data: { logotipo: urlLogotipo },
    select: SELECT_PLATAFORMA,
  });

  // Apaga o ficheiro antigo em background — não bloqueia a resposta
  apagarFicheiroAntigoLogotipo(atual.logotipo);

  await atividadeService.registrar(prisma, {
    usuarioId,
    acao: `Atualizou o logótipo da plataforma "${atual.nome}"`,
  });

  return formatar(atualizada);
}

module.exports = {
  listarPlataformas,
  obterPlataforma,
  obterArvorePlataformas,
  obterArvorePlataforma,
  criarPlataforma,
  atualizarPlataforma,
  apagarPlataforma,
  revelarToken,
  atualizarLogotipo,
};