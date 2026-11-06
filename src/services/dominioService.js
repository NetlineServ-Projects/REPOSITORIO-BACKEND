const prisma = require("../config/prisma");
const AppError = require("../utils/AppError");
const MSG = require("../utils/messages");
const HTTP_STATUS = require("../utils/httpsStatus");
const atividadeService = require("./atividadeService");
const { montarNomeCompleto } = require("./subdominioService");

// Só estas plataformas podem ter domínios
const TIPO_PLATAFORMA_COM_DOMINIOS = "GESTAO_DOMINIO";

const MILISSEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

// O domínio só tem dados de identificação, nada sensível
const SELECT_DOMINIO = {
  id: true,
  nome: true,
  dataExpiracao: true,
  plataformaId: true,
  plataforma: { select: { id: true, nome: true, tipo: true } },
  // A conta (instituição) só com a identificação: o token nunca sai daqui
  acessoId: true,
  acesso: { select: { id: true, descricao: true, utilizador: true } },
  criadoEm: true,
  atualizadoEm: true,
  _count: { select: { subdominios: true } },
};

// Domínio com os seus subdomínios (só leitura). O servidor aparece só com
// identificação: o IP e a password nunca saem daqui.
const SELECT_DOMINIO_DETALHE = {
  ...SELECT_DOMINIO,
  subdominios: {
    select: {
      id: true,
      nome: true,
      tipoDns: true,
      destino: true,
      servidor: { select: { id: true, nome: true, hostname: true } },
      ambiente: true,
      sistema: { select: { id: true, nome: true } },
    },
    orderBy: [{ nome: "asc" }, { tipoDns: "asc" }],
  },
};

/**
 * Dias que faltam para a expiração, contados desde o início do dia de hoje (UTC).
 * Zero significa que expira hoje; negativo significa que já expirou.
 */
function calcularDiasParaExpirar(dataExpiracao) {
  const agora = new Date();
  const inicioDeHoje = Date.UTC(
    agora.getUTCFullYear(),
    agora.getUTCMonth(),
    agora.getUTCDate()
  );

  return Math.round((dataExpiracao.getTime() - inicioDeHoje) / MILISSEGUNDOS_POR_DIA);
}

function formatarSubdominio(subdominio, nomeDominio) {
  return {
    ...subdominio,
    nomeCompleto: montarNomeCompleto(subdominio.nome, nomeDominio),
  };
}

function formatar(dominio) {
  const { _count, subdominios, ...resto } = dominio;
  const diasParaExpirar = calcularDiasParaExpirar(resto.dataExpiracao);

  return {
    ...resto,
    diasParaExpirar,
    expirado: diasParaExpirar < 0,
    totais: { subdominios: _count.subdominios },
    // só existe quando o select de detalhe foi usado
    ...(subdominios && {
      subdominios: subdominios.map((s) => formatarSubdominio(s, resto.nome)),
    }),
  };
}

async function obterDominioOuFalhar(id, select = SELECT_DOMINIO) {
  const dominio = await prisma.dominio.findUnique({
    where: { id },
    select,
  });

  if (!dominio) {
    throw new AppError(MSG.DOMINIO.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  return dominio;
}

async function garantirPlataformaDeDominios(plataformaId) {
  const plataforma = await prisma.plataforma.findUnique({
    where: { id: plataformaId },
    select: { id: true, tipo: true, ativo: true },
  });

  if (!plataforma) {
    throw new AppError(MSG.PLATAFORMA.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  if (plataforma.tipo !== TIPO_PLATAFORMA_COM_DOMINIOS) {
    throw new AppError(MSG.DOMINIO.PLATAFORMA_INVALIDA, HTTP_STATUS.CONFLICT);
  }

  if (!plataforma.ativo) {
    throw new AppError(MSG.DOMINIO.PLATAFORMA_INATIVA, HTTP_STATUS.CONFLICT);
  }
}

// A conta escolhida tem de ser uma das contas da plataforma do domínio
async function garantirContaDaPlataforma(acessoId, plataformaId) {
  if (acessoId === null || acessoId === undefined) return;

  const conta = await prisma.plataformaAcesso.findUnique({
    where: { id: acessoId },
    select: { plataformaId: true },
  });

  if (!conta || conta.plataformaId !== plataformaId) {
    throw new AppError(MSG.DOMINIO.CONTA_FORA_DA_PLATAFORMA, HTTP_STATUS.UNPROCESSABLE_ENTITY);
  }
}

async function garantirNomeLivre(nome, ignorarId) {
  const existente = await prisma.dominio.findUnique({
    where: { nome },
    select: { id: true },
  });

  if (existente && existente.id !== ignorarId) {
    throw new AppError(MSG.DOMINIO.NOME_JA_EXISTE, HTTP_STATUS.CONFLICT);
  }
}

// Duas gravações em simultâneo podem passar a verificação acima; a constraint da BD apanha-as
function tratarNomeDuplicado(erro) {
  if (erro && erro.code === "P2002") {
    throw new AppError(MSG.DOMINIO.NOME_JA_EXISTE, HTTP_STATUS.CONFLICT);
  }
  throw erro;
}

async function listarDominios() {
  const dominios = await prisma.dominio.findMany({
    select: SELECT_DOMINIO_DETALHE,
    orderBy: [{ dataExpiracao: "asc" }, { nome: "asc" }], // os que expiram primeiro vêm no topo
  });

  return dominios.map(formatar);
}

async function obterDominio(id) {
  return formatar(await obterDominioOuFalhar(id, SELECT_DOMINIO_DETALHE));
}


async function criarDominio(dados, usuarioId) {
  await garantirPlataformaDeDominios(dados.plataformaId);
  await garantirContaDaPlataforma(dados.acessoId, dados.plataformaId);
  await garantirNomeLivre(dados.nome);

  try {
    return await prisma.$transaction(async (tx) => {
      const criado = await tx.dominio.create({
        data: dados, // já validado e normalizado pelo Zod
        select: SELECT_DOMINIO,
      });

      await atividadeService.registrar(tx, {
        usuarioId,
        acao: `Criou o domínio "${criado.nome}" na plataforma "${criado.plataforma.nome}"`,
      });

      return formatar(criado);
    });
  } catch (erro) {
    return tratarNomeDuplicado(erro);
  }
}

async function atualizarDominio(id, dados, usuarioId) {
  const atual = await obterDominioOuFalhar(id);

  const mudouPlataforma = dados.plataformaId !== undefined && dados.plataformaId !== atual.plataformaId;
  if (mudouPlataforma) {
    await garantirPlataformaDeDominios(dados.plataformaId);
    // A conta antiga era da outra plataforma: sem conta nova no pedido, o domínio fica sem conta
    if (dados.acessoId === undefined) dados.acessoId = null;
  }
  await garantirContaDaPlataforma(dados.acessoId, dados.plataformaId ?? atual.plataformaId);

  if (dados.nome !== undefined) {
    await garantirNomeLivre(dados.nome, id);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const atualizado = await tx.dominio.update({
        where: { id },
        data: dados,
        select: SELECT_DOMINIO,
      });

      // Renovado (ou com outra data): os avisos de expiração antigos deixam de valer
      if (atualizado.dataExpiracao.getTime() !== atual.dataExpiracao.getTime()) {
        await tx.notificacao.deleteMany({ where: { dominioId: id } });
      }

      await atividadeService.registrar(tx, {
        usuarioId,
        acao: `Atualizou o domínio "${atualizado.nome}"`,
      });

      return formatar(atualizado);
    });
  } catch (erro) {
    return tratarNomeDuplicado(erro);
  }
}

async function apagarDominio(id, usuarioId) {
  const atual = await obterDominioOuFalhar(id);

  // O schema apagaria os subdomínios em cascata; a API recusa para não perder registos DNS por engano
  if (atual._count.subdominios > 0) {
    throw new AppError(MSG.DOMINIO.TEM_DEPENDENCIAS, HTTP_STATUS.CONFLICT);
  }

  return prisma.$transaction(async (tx) => {
    await tx.dominio.delete({ where: { id } });

    await atividadeService.registrar(tx, {
      usuarioId,
      acao: `Apagou o domínio "${atual.nome}"`,
    });
  });
}


module.exports = {
  listarDominios,
  obterDominio,
  criarDominio,
  atualizarDominio,
  apagarDominio,
  calcularDiasParaExpirar,
};