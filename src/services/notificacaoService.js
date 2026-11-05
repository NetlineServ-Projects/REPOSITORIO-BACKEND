const prisma = require("../config/prisma");
const MSG = require("../utils/messages");
const HTTP_STATUS = require("../utils/httpsStatus");
const AppError = require("../utils/AppError");
const { parseId } = require("../utils/fileHelper");
const { PERMISSOES, temPermissao, normalizar } = require("../constants/permissoes");
const { calcularDiasParaExpirar } = require("./dominioService");

// A partir de quantos dias antes da expiração quem gere as plataformas é avisado
const DIAS_AVISO_DOMINIO = 30;
// Os avisos de domínio geram-se quando essa pessoa consulta as notificações; no máximo
// uma vez por este intervalo (o sino pergunta a contagem a cada minuto)
const INTERVALO_SINCRONIZACAO_MS = 10 * 60 * 1000;
const LIMITE_LISTA = 30;

const ultimaSincronizacao = new Map(); // usuarioId -> timestamp

const SELECT_NOTIFICACAO = {
  id: true,
  tipo: true,
  referencia: true,
  mensagem: true,
  dataLimite: true,
  lida: true,
  criadoEm: true,
  documentoId: true,
  dominioId: true,
};

// ─── Criação (chamada dentro das transações de documentos) ──────────────────

// Avisa todos os utilizadores ativos cujo perfil tem a permissão, exceto quem fez a ação
async function notificarComPermissao(tx, permissao, { tipo, referencia, documentoId, excetoUsuarioId }) {
  const perfis = await tx.perfilAcesso.findMany({
    select: { id: true, administrador: true, permissoes: true },
  });
  const perfisComPermissao = perfis
    .filter((p) => p.administrador || normalizar(p.permissoes ?? []).includes(permissao))
    .map((p) => p.id);
  if (perfisComPermissao.length === 0) return;

  const destinatarios = await tx.usuario.findMany({
    where: {
      perfilId: { in: perfisComPermissao },
      ativo: true,
      ...(excetoUsuarioId && { id: { not: excetoUsuarioId } }),
    },
    select: { id: true },
  });
  if (destinatarios.length === 0) return;

  await tx.notificacao.createMany({
    data: destinatarios.map((u) => ({ tipo, referencia, documentoId, usuarioId: u.id })),
  });
}

async function notificarUsuario(tx, { usuarioId, tipo, referencia, mensagem, documentoId }) {
  await tx.notificacao.create({
    data: { usuarioId, tipo, referencia, mensagem, documentoId },
  });
}

// ─── Avisos de domínios ──────────────────────────────────────────────────────

function dataIso(data) {
  return data.toISOString().slice(0, 10);
}

/**
 * Cria, para quem gere as plataformas, os avisos dos domínios que expiram nos próximos 30 dias ou já
 * expiraram. A chave (domínio + tipo + data de expiração) impede repetir o mesmo aviso;
 * se o domínio for renovado, a data muda e um futuro aviso volta a ser criado.
 */
async function sincronizarAvisosDominios(usuarioId) {
  const agora = Date.now();
  if (agora - (ultimaSincronizacao.get(usuarioId) ?? 0) < INTERVALO_SINCRONIZACAO_MS) return;
  ultimaSincronizacao.set(usuarioId, agora);

  const limite = new Date(agora + DIAS_AVISO_DOMINIO * 24 * 60 * 60 * 1000);
  const dominios = await prisma.dominio.findMany({
    where: { dataExpiracao: { lte: limite } },
    select: { id: true, nome: true, dataExpiracao: true },
  });
  if (dominios.length === 0) return;

  const avisos = dominios.map((d) => {
    const tipo = calcularDiasParaExpirar(d.dataExpiracao) < 0 ? "DOMINIO_EXPIRADO" : "DOMINIO_A_EXPIRAR";
    return {
      usuarioId,
      tipo,
      referencia: d.nome,
      dataLimite: d.dataExpiracao,
      dominioId: d.id,
      chave: `dominio:${d.id}:${tipo}:${dataIso(d.dataExpiracao)}`,
    };
  });

  await prisma.notificacao.createMany({ data: avisos, skipDuplicates: true });
}

// ─── Leitura e marcação ──────────────────────────────────────────────────────

async function prepararParaLeitura(usuarioAtual) {
  if (temPermissao(usuarioAtual, PERMISSOES.INFRA_GERIR)) {
    await sincronizarAvisosDominios(usuarioAtual.id);
  }
}

async function listar(usuarioAtual) {
  await prepararParaLeitura(usuarioAtual);

  const [notificacoes, naoLidas] = await Promise.all([
    prisma.notificacao.findMany({
      where: { usuarioId: usuarioAtual.id },
      orderBy: { criadoEm: "desc" },
      take: LIMITE_LISTA,
      select: SELECT_NOTIFICACAO,
    }),
    prisma.notificacao.count({ where: { usuarioId: usuarioAtual.id, lida: false } }),
  ]);

  return { notificacoes, naoLidas };
}

async function contarNaoLidas(usuarioAtual) {
  await prepararParaLeitura(usuarioAtual);
  const naoLidas = await prisma.notificacao.count({
    where: { usuarioId: usuarioAtual.id, lida: false },
  });
  return { naoLidas };
}

async function marcarComoLida(id, usuarioAtual) {
  const idNum = parseId(id, MSG.VALIDATION.INVALID_ID);
  // updateMany com o usuarioId: ninguém marca notificações de outra pessoa
  const { count } = await prisma.notificacao.updateMany({
    where: { id: idNum, usuarioId: usuarioAtual.id },
    data: { lida: true },
  });
  if (count === 0) throw new AppError(MSG.NOTIFICACAO.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
}

async function marcarTodasComoLidas(usuarioAtual) {
  await prisma.notificacao.updateMany({
    where: { usuarioId: usuarioAtual.id, lida: false },
    data: { lida: true },
  });
}

module.exports = {
  notificarComPermissao,
  notificarUsuario,
  listar,
  contarNaoLidas,
  marcarComoLida,
  marcarTodasComoLidas,
};
