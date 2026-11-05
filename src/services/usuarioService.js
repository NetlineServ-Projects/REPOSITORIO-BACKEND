const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");

const MSG = require("../utils/messages");
const HTTP_STATUS = require("../utils/httpsStatus");
const AppError = require("../utils/AppError");
const { formatarUsuario, apagarFicheiroAntigoPerfil } = require("../utils/fileHelper");
const sessaoService = require("./sessaoService");


const CAMPOS_PERMITIDOS_ATUALIZACAO = ["nome", "email", "senha", "numero", "cargo", "departamento", "perfilId", "ativo"];

const INCLUDE_PERFIL = { perfil: { select: { id: true, nome: true, administrador: true } } };

// ─── Regras de quem pode mexer em quê ────────────────────────────────────────
// Quem tem utilizadores.gerir (ex.: Secretaria/RH) cria e edita contas, mas só um
// administrador dá o perfil Administrador ou mexe na conta de um administrador.

function garantirPodeUsarPerfil(perfil, ator) {
    if (perfil.administrador && !ator?.administrador) {
        throw new AppError(MSG.USER.SO_ADMINISTRADOR, HTTP_STATUS.FORBIDDEN);
    }
}

function garantirPodeAlterarConta(usuario, ator) {
    if (usuario.perfil.administrador && !ator?.administrador) {
        throw new AppError(MSG.USER.SO_ADMINISTRADOR, HTTP_STATUS.FORBIDDEN);
    }
}

async function obterPerfil(perfilId) {
    const perfil = await prisma.perfilAcesso.findUnique({ where: { id: Number(perfilId) } });
    if (!perfil) throw new AppError(MSG.PERFIL.NOT_FOUND, HTTP_STATUS.BAD_REQUEST);
    return perfil;
}

// Um administrador que perde o perfil, é desativado ou eliminado não pode ser o último ativo
async function garantirOutroAdministradorAtivo(usuarioId) {
    const outros = await prisma.usuario.count({
        where: { id: { not: usuarioId }, ativo: true, perfil: { administrador: true } },
    });
    if (outros === 0) throw new AppError(MSG.USER.ULTIMO_ADMINISTRADOR, HTTP_STATUS.CONFLICT);
}

async function obterUsuario(id) {
    const usuario = await prisma.usuario.findUnique({ where: { id: Number(id) }, include: INCLUDE_PERFIL });
    if (!usuario) throw new AppError(MSG.USER.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    return usuario;
}

// ─── Operações ───────────────────────────────────────────────────────────────

exports.criarUsuario = async ({ nome, email, senha, numero, cargo, departamento, perfilId }, ator) => {

    const usuarioExistente = await prisma.usuario.findUnique({
        where: { email }
    });

    if (usuarioExistente) {
        throw new AppError(MSG.USER.EMAIL_ALREADY_EXISTS, HTTP_STATUS.CONFLICT);
    }

    const perfil = await obterPerfil(perfilId);
    garantirPodeUsarPerfil(perfil, ator);

    const senhaHash = await bcrypt.hash(senha, 10);

    const usuario = await prisma.usuario.create({
        data: {
            nome,
            email,
            senha: senhaHash,
            numero,
            cargo,
            departamento,
            perfilId: perfil.id
        },
        include: INCLUDE_PERFIL
    });

    return formatarUsuario(usuario);
};

exports.listarUsuarios = async () => {
    const usuarios = await prisma.usuario.findMany({
        orderBy: { dataCriacao: "desc" },
        include: INCLUDE_PERFIL
    });

    return usuarios.map(formatarUsuario);
};

exports.buscarUsuarioPorId = async (id) => {
    return formatarUsuario(await obterUsuario(id));
};

exports.atualizarUsuario = async (id, dadosAtualizacao, ator) => {
    const usuarioExistente = await obterUsuario(id);
    const idNumero = usuarioExistente.id;

    // Filtra apenas os campos permitidos vindos do body (evita mass assignment)
    const dados = {};
    for (const campo of CAMPOS_PERMITIDOS_ATUALIZACAO) {
        if (dadosAtualizacao[campo] !== undefined) dados[campo] = dadosAtualizacao[campo];
    }

    garantirPodeAlterarConta(usuarioExistente, ator);

    const mudaPerfil = dados.perfilId !== undefined && Number(dados.perfilId) !== usuarioExistente.perfilId;
    const desativa = dados.ativo === false && usuarioExistente.ativo;

    // Ninguém se tranca fora: o próprio não muda o seu perfil nem se desativa
    if ((mudaPerfil || desativa) && ator && idNumero === ator.id) {
        throw new AppError(MSG.USER.PROPRIA_CONTA, HTTP_STATUS.FORBIDDEN);
    }

    if (mudaPerfil) {
        const novoPerfil = await obterPerfil(dados.perfilId);
        garantirPodeUsarPerfil(novoPerfil, ator);
        dados.perfilId = novoPerfil.id;
        if (usuarioExistente.perfil.administrador && !novoPerfil.administrador) {
            await garantirOutroAdministradorAtivo(idNumero);
        }
    } else {
        delete dados.perfilId;
    }

    if (desativa && usuarioExistente.perfil.administrador) {
        await garantirOutroAdministradorAtivo(idNumero);
    }

    // Se houver alteração de email, verifica se já pertence a outro utilizador
    if (dados.email && dados.email !== usuarioExistente.email) {
        const emailEmUso = await prisma.usuario.findUnique({
            where: { email: dados.email }
        });

        if (emailEmUso) {
            throw new AppError(MSG.USER.EMAIL_ALREADY_EXISTS, HTTP_STATUS.CONFLICT);
        }
    }

    // Se enviou nova senha, gera o hash
    if (dados.senha) {
        dados.senha = await bcrypt.hash(dados.senha, 10);
    }

    const usuarioAtualizado = await prisma.usuario.update({
        where: { id: idNumero },
        data: dados,
        include: INCLUDE_PERFIL
    });

    // O novo perfil ou a desativação valem já no próximo pedido desta pessoa
    sessaoService.invalidar(idNumero);

    return formatarUsuario(usuarioAtualizado);
};

exports.eliminarUsuario = async (id, ator) => {
    const usuarioExistente = await obterUsuario(id);

    garantirPodeAlterarConta(usuarioExistente, ator);
    if (ator && usuarioExistente.id === ator.id) {
        throw new AppError(MSG.USER.PROPRIA_CONTA, HTTP_STATUS.FORBIDDEN);
    }
    if (usuarioExistente.perfil.administrador) {
        await garantirOutroAdministradorAtivo(usuarioExistente.id);
    }

    await prisma.usuario.delete({
        where: { id: usuarioExistente.id }
    });

    sessaoService.invalidar(usuarioExistente.id);

    return true;
};

exports.atualizarPreferencias = async (userId, { temaEscuro, notificacoesEmail, idioma }) => {
    const dados = {};

    if (typeof temaEscuro === "boolean") dados.temaEscuro = temaEscuro;
    if (typeof notificacoesEmail === "boolean") dados.notificacoesEmail = notificacoesEmail;
    if (typeof idioma === "string") dados.idioma = idioma;

    const usuarioAtualizado = await prisma.usuario.update({
        where: { id: userId },
        data: dados
    });

    return formatarUsuario(usuarioAtualizado);
};



exports.atualizarFotografia = async (userId, urlFotografia) => {
    const usuarioExistente = await prisma.usuario.findUnique({
        where: { id: userId }
    });

    if (!usuarioExistente) {
        throw new AppError(MSG.USER.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    const usuarioAtualizado = await prisma.usuario.update({
        where: { id: userId },
        data: { fotografia: urlFotografia }
    });

    if (usuarioExistente.fotografia) {
        apagarFicheiroAntigoPerfil(usuarioExistente.fotografia);
    }

    return formatarUsuario(usuarioAtualizado);
};