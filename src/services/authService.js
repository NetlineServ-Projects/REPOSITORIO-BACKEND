const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");


const MSG = require("../utils/messages");
const HTTP_STATUS = require("../utils/httpsStatus");
const AppError = require("../utils/AppError");
const { formatarUsuario } = require("../utils/fileHelper");
const { TODAS, normalizar } = require("../constants/permissoes");
const limiteLogin = require("../utils/limiteTentativasLogin");

// Hash de uma palavra-passe que ninguém tem: quando o e-mail não existe compara-se contra ele,
// para a resposta demorar o mesmo e não denunciar quais e-mails estão registados
const HASH_FALSO = bcrypt.hashSync("netline-utilizador-inexistente", 10);

const DURACAO_TOKEN_ELEVADO = "3m";

// LOGIN
// Qualquer falha (e-mail inexistente, palavra-passe errada, conta desativada) dá a mesma
// mensagem e o mesmo código: quem anda a testar não fica a saber em que parte errou
exports.login = async ({ email, senha }) => {

    const bloqueio = limiteLogin.segundosDeBloqueio(email);
    if (bloqueio > 0) {
        const erro = new AppError(MSG.AUTH.MUITAS_TENTATIVAS, HTTP_STATUS.TOO_MANY_REQUESTS);
        erro.retryAfter = bloqueio;
        throw erro;
    }

    const user = await prisma.usuario.findUnique({
        where: { email },
        include: { perfil: true }
    });

    const senhaValida = await bcrypt.compare(senha, user?.senha ?? HASH_FALSO);

    if (!user || !senhaValida || !user.ativo) {
        limiteLogin.registarFalha(email);
        throw new AppError(MSG.AUTH.CREDENCIAIS_INVALIDAS, HTTP_STATUS.UNAUTHORIZED);
    }

    limiteLogin.limpar(email);

    // O token só identifica o utilizador: o perfil e as permissões leem-se a cada pedido
    // (sessaoService), para uma mudança de perfil valer logo
    const token = jwt.sign(
        {
            id: user.id,
            nome: user.nome,
            email: user.email
        },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    );

    return {
        token,
        user: comAcesso(user)
    };
};

// Dados do utilizador com o perfil e a lista de permissões, para o frontend decidir o que mostrar.
// (A API volta a verificar tudo: esconder um botão não é segurança.)
function comAcesso(user) {
    const { perfil, ...resto } = formatarUsuario(user);
    return {
        ...resto,
        perfil: { id: perfil.id, nome: perfil.nome, administrador: perfil.administrador },
        permissoes: perfil.administrador ? TODAS : normalizar(perfil.permissoes ?? []),
    };
}

// UTILIZADOR AUTENTICADO
exports.getUserById = async (id) => {

    const user = await prisma.usuario.findUnique({
        where: { id },
        include: { perfil: true }
    });

    if (!user) {
        return null;
    }

    return comAcesso(user);
};

// ALTERAR SENHA (opcional, feito pelo próprio utilizador)
exports.alterarSenha = async (userId, { senhaAtual, novaSenha }) => {

    const user = await prisma.usuario.findUnique({
        where: { id: userId }
    });

    if (!user) {
        throw new AppError(MSG.USER.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    const senhaValida = await bcrypt.compare(senhaAtual, user.senha);

    if (!senhaValida) {
        throw new AppError(MSG.AUTH.INVALID_PASSWORD, HTTP_STATUS.UNAUTHORIZED);
    }

    const novaSenhaHash = await bcrypt.hash(novaSenha, 10);

    await prisma.usuario.update({
        where: { id: userId },
        data: { senha: novaSenhaHash }
    });

    return { mensagem: "Palavra-passe alterada com sucesso." };
};

// REAUTENTICAR (confirma password novamente antes de aceder a dados
// sensíveis de infraestrutura — emite um token elevado, válido por 3 min)
exports.reautenticar = async (usuarioId, { senha }) => {

    const usuario = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { id: true, senha: true }
    });

    if (!usuario) {
        throw new AppError(MSG.AUTH.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);

    if (!senhaValida) {
        throw new AppError(MSG.AUTH.INVALID_PASSWORD, HTTP_STATUS.UNAUTHORIZED);
    }

    const tokenElevado = jwt.sign(
        { usuarioId: usuario.id, tipo: "elevado" },
        process.env.JWT_SECRET,
        { expiresIn: DURACAO_TOKEN_ELEVADO }
    );

    return { tokenElevado, expiraEm: DURACAO_TOKEN_ELEVADO };
};