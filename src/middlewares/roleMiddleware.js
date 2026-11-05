const response = require("../utils/response");
const HTTP = require("../utils/httpsStatus");
const MSG = require("../utils/messages");
const { temPermissao } = require("../constants/permissoes");

// Deixa passar quem tem PELO MENOS UMA das permissões indicadas (o administrador tem todas).
// Usa-se sempre depois do authMiddleware.
function exigirPermissao(...permissoes) {
    return (req, res, next) => {
        if (!permissoes.some((p) => temPermissao(req.user, p))) {
            return response.error(res, MSG.AUTH.FORBIDDEN, HTTP.FORBIDDEN);
        }
        next();
    };
}

// Só o perfil Administrador (configurar perfis, por exemplo)
function apenasAdministrador(req, res, next) {
    if (!req.user?.administrador) {
        return response.error(res, MSG.AUTH.FORBIDDEN, HTTP.FORBIDDEN);
    }
    next();
}

module.exports = { exigirPermissao, apenasAdministrador };
