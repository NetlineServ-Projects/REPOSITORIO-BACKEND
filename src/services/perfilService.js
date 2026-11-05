const prisma = require("../config/prisma");
const MSG = require("../utils/messages");
const HTTP_STATUS = require("../utils/httpsStatus");
const AppError = require("../utils/AppError");
const cache = require("../utils/cache");
const sessaoService = require("./sessaoService");
const { GRUPOS, TODAS, normalizar } = require("../constants/permissoes");

// Perfis de acesso (Configurações → Perfis e permissões). Só o Administrador os altera.
// O perfil "administrador" tem sempre tudo: não se edita nem se apaga.

function formatar(perfil) {
    const { _count, permissoes, ...resto } = perfil;
    return {
        ...resto,
        permissoes: perfil.administrador ? TODAS : normalizar(permissoes ?? []),
        totalUtilizadores: _count?.usuarios ?? 0,
    };
}

const INCLUDE_CONTAGEM = { _count: { select: { usuarios: true } } };

async function obterOuFalhar(id) {
    const perfil = await prisma.perfilAcesso.findUnique({ where: { id }, include: INCLUDE_CONTAGEM });
    if (!perfil) throw new AppError(MSG.PERFIL.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    return perfil;
}

async function garantirNomeLivre(nome, excetoId) {
    const existente = await prisma.perfilAcesso.findUnique({ where: { nome } });
    if (existente && existente.id !== excetoId) {
        throw new AppError(MSG.PERFIL.NOME_EM_USO, HTTP_STATUS.CONFLICT);
    }
}

// Mudar permissões muda o que os utilizadores do perfil veem: as sessões em cache e as
// categorias em cache (que dependem de documentos.sensiveis) deixam de valer
function invalidarCaches() {
    sessaoService.invalidarTodas();
    cache.del(cache.keys().filter((k) => k.startsWith("categorias:")));
}

async function listar() {
    const perfis = await prisma.perfilAcesso.findMany({
        include: INCLUDE_CONTAGEM,
        // O Administrador primeiro, os outros por ordem de criação
        orderBy: [{ administrador: "desc" }, { id: "asc" }],
    });
    return perfis.map(formatar);
}

function catalogo() {
    return GRUPOS;
}

async function criar({ nome, descricao, permissoes }) {
    await garantirNomeLivre(nome);
    const perfil = await prisma.perfilAcesso.create({
        data: { nome, descricao: descricao ?? "", administrador: false, permissoes: normalizar(permissoes) },
        include: INCLUDE_CONTAGEM,
    });
    return formatar(perfil);
}

async function atualizar(id, dados) {
    const perfil = await obterOuFalhar(id);
    if (perfil.administrador) throw new AppError(MSG.PERFIL.ADMINISTRADOR_BLOQUEADO, HTTP_STATUS.FORBIDDEN);

    if (dados.nome !== undefined) await garantirNomeLivre(dados.nome, id);

    const atualizado = await prisma.perfilAcesso.update({
        where: { id },
        data: {
            ...(dados.nome !== undefined && { nome: dados.nome }),
            ...(dados.descricao !== undefined && { descricao: dados.descricao }),
            ...(dados.permissoes !== undefined && { permissoes: normalizar(dados.permissoes) }),
        },
        include: INCLUDE_CONTAGEM,
    });

    invalidarCaches();
    return formatar(atualizado);
}

async function apagar(id) {
    const perfil = await obterOuFalhar(id);
    if (perfil.administrador) throw new AppError(MSG.PERFIL.ADMINISTRADOR_BLOQUEADO, HTTP_STATUS.FORBIDDEN);
    if (perfil._count.usuarios > 0) throw new AppError(MSG.PERFIL.EM_USO, HTTP_STATUS.CONFLICT);

    await prisma.perfilAcesso.delete({ where: { id } });
    invalidarCaches();
}

module.exports = { listar, catalogo, criar, atualizar, apagar };
