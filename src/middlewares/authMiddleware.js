const jwt = require("jsonwebtoken");

const HTTP = require("../utils/httpsStatus");
const MSG = require("../utils/messages");
const { NOME_COOKIE_SESSAO } = require("../utils/cookieSessao");
const sessaoService = require("../services/sessaoService");

// O token vem do cookie HttpOnly da sessão (o frontend nunca o vê). O cabeçalho
// "Authorization: Bearer <token>" continua aceite para ferramentas como o Postman.
function obterToken(req) {
    const doCookie = req.cookies?.[NOME_COOKIE_SESSAO];
    if (doCookie) return { token: doCookie };

    const authHeader = req.headers.authorization;
    if (!authHeader) return { erro: MSG.AUTH.TOKEN_NOT_PROVIDED };

    const [tipo, token] = authHeader.split(" ");
    if (tipo !== "Bearer" || !token) return { erro: MSG.AUTH.INVALID_TOKEN_FORMAT };
    return { token };
}

async function authenticate(req, res, next) {
    // 1. Obtém o token (cookie da sessão ou cabeçalho Bearer)
    const { token, erro } = obterToken(req);
    if (erro) {
        return res.status(HTTP.UNAUTHORIZED).json({ mensagem: erro });
    }

    // 2. Verifica e descodifica o token
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        console.error("Erro JWT:", error.message);
        return res.status(HTTP.UNAUTHORIZED).json({
            mensagem: MSG.AUTH.INVALID_OR_EXPIRED_TOKEN
        });
    }

    // 3. Carrega o utilizador com o perfil e as permissões atuais. Uma conta apagada ou
    // desativada perde a sessão logo, mesmo com um token ainda válido
    try {
        const sessao = await sessaoService.carregar(Number(decoded.id));
        if (!sessao) {
            return res.status(HTTP.UNAUTHORIZED).json({
                mensagem: MSG.AUTH.INVALID_OR_EXPIRED_TOKEN
            });
        }
        req.user = sessao;
        next();
    } catch (error) {
        next(error);
    }
}

module.exports = authenticate;