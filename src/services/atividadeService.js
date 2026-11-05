const prisma = require("../config/prisma");

async function registrar(tx, { usuarioId, acao, documentoId, sistemaId }) {
  return tx.atividade.create({
    data: { usuarioId, acao, documentoId, sistemaId },
  });
}

async function listarRecentes(limite = 20, usuarioId = undefined) {
  const where = usuarioId ? { usuarioId } : {};
  return prisma.atividade.findMany({
    where,
    orderBy: { criadoEm: "desc" },
    take: limite,
    include: {
      usuario: { select: { id: true, nome: true, perfil: { select: { id: true, nome: true } } } },
      documento: { select: { id: true, titulo: true } },
      sistema: { select: { id: true, nome: true } },
    },
  });
}

module.exports = { registrar, listarRecentes };