const prisma = require("../config/prisma");
const AppError = require("../utils/AppError");
const MSG = require("../utils/messages");
const HTTP_STATUS = require("../utils/httpsStatus");

/*
 * Auditoria: um registo por pedido à API. Grava-se depois de a resposta sair (ver
 * auditoriaMiddleware), por isso nunca atrasa nem faz falhar o pedido.
 */

const ACOES = [
  "ENTRADA",
  "SAIDA",
  "LOGIN_FALHADO",
  "REAUTENTICACAO",
  "CONSULTA",
  "CRIACAO",
  "ALTERACAO",
  "ELIMINACAO",
  "ACESSO_SENSIVEL",
  "ACESSO_RECUSADO",
  "ERRO",
];

const PREFIXO_API = "/api/v1";

// Rotas que revelam um segredo (token da plataforma, password do servidor, credenciais do sistema)
const ROTA_SENSIVEL = /\/(token|password)$|\/credenciais(\/[^/]+)?$/;

// Campos cujo valor nunca se guarda (palavras-passe, tokens, valores de credenciais...)
const CAMPO_SECRETO = /senha|password|passwd|token|segredo|secret|chave|key|credencial|valor|cookie|authorization/i;
const OCULTO = "[oculto]";
const MAX_TEXTO = 500; // um texto maior é cortado
const MAX_DETALHES = 8000; // tamanho máximo dos detalhes em JSON

/* ------------------------------ Classificação ------------------------------ */

function caminhoSemQuery(url) {
  return (url || "").split("?")[0];
}

// "/api/v1/plataformas/7/acessos/2/token" → { funcionalidade: "plataformas", recursoId: "7" }
function analisarCaminho(caminho) {
  const limpo = caminhoSemQuery(caminho);
  const partes = (limpo.startsWith(PREFIXO_API) ? limpo.slice(PREFIXO_API.length) : limpo)
    .split("/")
    .filter(Boolean);

  const funcionalidade = partes[0] ? partes[0].slice(0, 100) : null;
  // O primeiro segmento que parece um identificador (número ou uuid)
  const recursoId =
    partes.slice(1).find((p) => /^\d+$/.test(p) || /^[0-9a-f-]{32,36}$/i.test(p)) ?? null;

  return { funcionalidade, recursoId };
}

function classificarAcao(metodo, caminho, estado) {
  const limpo = caminhoSemQuery(caminho);

  if (limpo === `${PREFIXO_API}/auth/login`) return estado < 400 ? "ENTRADA" : "LOGIN_FALHADO";
  if (limpo === `${PREFIXO_API}/auth/logout`) return "SAIDA";
  if (estado === 401 || estado === 403) return "ACESSO_RECUSADO";
  if (estado >= 500) return "ERRO";
  if (limpo === `${PREFIXO_API}/auth/reautenticar`) return "REAUTENTICACAO";
  if (metodo === "GET" && ROTA_SENSIVEL.test(limpo)) return "ACESSO_SENSIVEL";

  switch (metodo) {
    case "POST":
      return "CRIACAO";
    case "PUT":
    case "PATCH":
      return "ALTERACAO";
    case "DELETE":
      return "ELIMINACAO";
    default:
      return "CONSULTA";
  }
}

/* --------------------------- Limpeza dos segredos --------------------------- */

// Copia o valor tirando os segredos; corta textos longos e não desce mais de 5 níveis
function semSegredos(valor, nivel = 0) {
  if (valor === null || valor === undefined) return valor;
  if (nivel > 5) return "[…]";
  if (typeof valor === "string") return valor.length > MAX_TEXTO ? `${valor.slice(0, MAX_TEXTO)}…` : valor;
  if (typeof valor !== "object") return valor;
  if (valor instanceof Date) return valor.toISOString();
  if (Array.isArray(valor)) return valor.slice(0, 50).map((v) => semSegredos(v, nivel + 1));

  const copia = {};
  for (const [chave, v] of Object.entries(valor)) {
    copia[chave] = CAMPO_SECRETO.test(chave) && v !== null && v !== "" ? OCULTO : semSegredos(v, nivel + 1);
  }
  return copia;
}

function montarDetalhes({ query, corpo, ficheiros }) {
  const detalhes = {};
  if (query && Object.keys(query).length > 0) detalhes.query = semSegredos(query);
  if (corpo && typeof corpo === "object" && Object.keys(corpo).length > 0) detalhes.corpo = semSegredos(corpo);
  if (ficheiros?.length) detalhes.ficheiros = ficheiros;

  if (Object.keys(detalhes).length === 0) return null;

  // Um corpo enorme (ex: uma lista grande) não enche a tabela
  const texto = JSON.stringify(detalhes);
  if (texto.length > MAX_DETALHES) {
    return { resumo: `${texto.slice(0, MAX_DETALHES)}…`, cortado: true };
  }
  return detalhes;
}

/* --------------------------------- Gravar ---------------------------------- */

// Quem tentou entrar: no login ainda não há sessão, procura-se a conta pelo e-mail
async function identificarPorEmail(email) {
  if (typeof email !== "string" || !email.trim()) return null;
  const usuario = await prisma.usuario.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, nome: true, email: true, perfil: { select: { nome: true } } },
  });
  return usuario
    ? { usuarioId: usuario.id, usuarioNome: usuario.nome, usuarioEmail: usuario.email, perfilNome: usuario.perfil?.nome ?? null }
    : { usuarioEmail: email.trim().slice(0, 255) };
}

/**
 * Grava um registo. Nunca lança: uma falha na auditoria não pode estragar o pedido.
 * "pedido" vem do middleware: { metodo, caminho, estado, duracaoMs, ip, userAgent,
 * usuario (req.user), emailLogin, query, corpo, ficheiros }
 */
async function registar(pedido) {
  try {
    const { funcionalidade, recursoId } = analisarCaminho(pedido.caminho);
    const acao = classificarAcao(pedido.metodo, pedido.caminho, pedido.estado);

    let quem = {};
    if (pedido.usuario) {
      quem = {
        usuarioId: pedido.usuario.id,
        usuarioNome: pedido.usuario.nome ?? null,
        usuarioEmail: pedido.usuario.email ?? null,
        perfilNome: pedido.usuario.perfilNome ?? null,
      };
    } else if (pedido.emailLogin) {
      quem = (await identificarPorEmail(pedido.emailLogin)) ?? {};
    }

    await prisma.registoAuditoria.create({
      data: {
        ...quem,
        acao,
        funcionalidade,
        recursoId,
        metodo: pedido.metodo.slice(0, 10),
        caminho: pedido.caminho.slice(0, 1000),
        estado: pedido.estado,
        duracaoMs: Math.max(0, Math.round(pedido.duracaoMs)),
        ip: pedido.ip ? String(pedido.ip).slice(0, 64) : null,
        userAgent: pedido.userAgent ? String(pedido.userAgent).slice(0, 500) : null,
        detalhes: montarDetalhes(pedido) ?? undefined,
      },
    });
  } catch (erro) {
    console.error("Não foi possível gravar o registo de auditoria:", erro.message);
  }
}

/* --------------------------------- Consultar -------------------------------- */

function montarFiltro(filtros) {
  const where = {};

  if (filtros.desde || filtros.ate) {
    where.criadoEm = {};
    if (filtros.desde) where.criadoEm.gte = filtros.desde;
    if (filtros.ate) where.criadoEm.lte = filtros.ate;
  }

  if (filtros.utilizador) {
    const termo = filtros.utilizador.trim();
    if (/^an[oó]nimo$/i.test(termo)) {
      where.usuarioId = null;
      where.usuarioEmail = null;
    } else {
      where.OR = [{ usuarioNome: { contains: termo } }, { usuarioEmail: { contains: termo } }];
    }
  }

  if (filtros.acao) where.acao = filtros.acao;
  if (filtros.funcionalidade) where.funcionalidade = filtros.funcionalidade;
  if (filtros.metodo) where.metodo = filtros.metodo;
  if (filtros.resultado === "sucesso") where.estado = { lt: 400 };
  if (filtros.resultado === "erro") where.estado = { gte: 400 };

  return where;
}

// Na lista não vêm os detalhes (podem ser grandes): só no registo aberto
const SELECT_LISTA = {
  id: true,
  criadoEm: true,
  usuarioId: true,
  usuarioNome: true,
  usuarioEmail: true,
  perfilNome: true,
  acao: true,
  funcionalidade: true,
  recursoId: true,
  metodo: true,
  caminho: true,
  estado: true,
  duracaoMs: true,
  ip: true,
};

async function listar(filtros) {
  const where = montarFiltro(filtros);
  const porPagina = filtros.porPagina;
  const pagina = filtros.pagina;

  const [total, registos] = await prisma.$transaction([
    prisma.registoAuditoria.count({ where }),
    prisma.registoAuditoria.findMany({
      where,
      select: SELECT_LISTA,
      orderBy: { id: "desc" },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
  ]);

  return { registos, total, pagina, porPagina, totalPaginas: Math.max(1, Math.ceil(total / porPagina)) };
}

async function obter(id) {
  const registo = await prisma.registoAuditoria.findUnique({ where: { id } });
  if (!registo) throw new AppError(MSG.AUDITORIA.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  return registo;
}

// Funcionalidades que já aparecem nos registos (para o filtro)
async function listarFuncionalidades() {
  const grupos = await prisma.registoAuditoria.groupBy({
    by: ["funcionalidade"],
    where: { funcionalidade: { not: null } },
    orderBy: { funcionalidade: "asc" },
  });
  return grupos.map((g) => g.funcionalidade);
}

/* --------------------------------- Retenção --------------------------------- */

// Apaga os registos mais antigos do que "dias" (AUDITORIA_RETENCAO_DIAS, por omissão 365)
async function apagarAntigos(dias) {
  const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  const { count } = await prisma.registoAuditoria.deleteMany({ where: { criadoEm: { lt: limite } } });
  if (count > 0) console.log(`Auditoria: ${count} registos com mais de ${dias} dias apagados.`);
}

module.exports = {
  ACOES,
  registar,
  listar,
  obter,
  listarFuncionalidades,
  apagarAntigos,
  // exportadas para testes
  classificarAcao,
  analisarCaminho,
  semSegredos,
};
