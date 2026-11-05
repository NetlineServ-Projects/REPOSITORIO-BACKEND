const prisma = require("../config/prisma");
const cache = require("../utils/cache");
const { normalizar } = require("../constants/permissoes");

// O token da sessão só diz QUEM é o utilizador. O perfil e as permissões leem-se da base de
// dados a cada pedido: uma mudança de perfil, de permissões ou uma conta desativada vale logo,
// sem esperar que o token expire. A cache curta evita uma consulta por pedido.
const TTL_SEGUNDOS = 30;
const PREFIXO = "sessao:";

function chave(usuarioId) {
    return `${PREFIXO}${usuarioId}`;
}

// Forma de req.user em toda a API
function paraSessao(usuario) {
    return {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfilId: usuario.perfil.id,
        perfilNome: usuario.perfil.nome,
        administrador: usuario.perfil.administrador,
        permissoes: usuario.perfil.administrador ? [] : normalizar(usuario.perfil.permissoes ?? []),
    };
}

// Devolve null se a conta já não existe ou foi desativada
async function carregar(usuarioId) {
    const emCache = cache.get(chave(usuarioId));
    if (emCache !== undefined) return emCache;

    const usuario = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: {
            id: true,
            nome: true,
            email: true,
            ativo: true,
            perfil: { select: { id: true, nome: true, administrador: true, permissoes: true } },
        },
    });

    const sessao = usuario?.ativo ? paraSessao(usuario) : null;
    cache.set(chave(usuarioId), sessao, TTL_SEGUNDOS);
    return sessao;
}

// Chamar sempre que se altera um utilizador
function invalidar(usuarioId) {
    cache.del(chave(usuarioId));
}

// Chamar sempre que se altera um perfil (afeta todos os utilizadores com esse perfil)
function invalidarTodas() {
    cache.del(cache.keys().filter((k) => k.startsWith(PREFIXO)));
}

module.exports = { carregar, invalidar, invalidarTodas, paraSessao };
