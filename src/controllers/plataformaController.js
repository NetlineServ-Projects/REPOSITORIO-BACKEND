const service = require("../services/plataformaService");
const response = require("../utils/response");
const HTTP = require("../utils/httpsStatus");
const MSG = require("../utils/messages");
const { FORNECEDORES_POR_TIPO } = require("../constants/fornecedoresPlataforma");

// O id chega aqui já validado e convertido para número
// (ver validate(..., "params") em plataformaRoutes.js).

exports.listar = async (req, res, next) => {
    try {
        const plataformas = await service.listarPlataformas();

        return response.success(res, MSG.PLATAFORMA.LISTADAS, plataformas, HTTP.OK);
    } catch (error) {
        next(error);
    }
};

exports.listarFornecedores = async (req, res, next) => {
    try {
        return response.success(res, MSG.PLATAFORMA.FORNECEDORES_OBTIDOS, FORNECEDORES_POR_TIPO, HTTP.OK);
    } catch (error) {
        next(error);
    }
};

exports.obterArvore = async (req, res, next) => {
    try {
        const arvore = await service.obterArvorePlataformas();

        return response.success(res, MSG.PLATAFORMA.ARVORE_OBTIDA, arvore, HTTP.OK);
    } catch (error) {
        next(error);
    }
};

exports.obterArvorePlataforma = async (req, res, next) => {
    try {
        const arvore = await service.obterArvorePlataforma(req.params.id);

        return response.success(res, MSG.PLATAFORMA.ARVORE_OBTIDA, arvore, HTTP.OK);
    } catch (error) {
        next(error);
    }
};

exports.obter = async (req, res, next) => {
    try {
        const plataforma = await service.obterPlataforma(req.params.id);

        return response.success(res, MSG.PLATAFORMA.OBTIDA, plataforma, HTTP.OK);
    } catch (error) {
        next(error);
    }
};

exports.criar = async (req, res, next) => {
    try {
        const plataforma = await service.criarPlataforma(req.body, req.user.id);

        return response.success(res, MSG.PLATAFORMA.CREATED, plataforma, HTTP.CREATED);
    } catch (error) {
        next(error);
    }
};

exports.atualizar = async (req, res, next) => {
    try {
        const plataforma = await service.atualizarPlataforma(req.params.id, req.body, req.user.id);

        return response.success(res, MSG.PLATAFORMA.UPDATED, plataforma, HTTP.OK);
    } catch (error) {
        next(error);
    }
};

exports.apagar = async (req, res, next) => {
    try {
        await service.apagarPlataforma(req.params.id, req.user.id);

        return response.success(res, MSG.PLATAFORMA.DELETED, null, HTTP.OK);
    } catch (error) {
        next(error);
    }
};

exports.revelarToken = async (req, res, next) => {
    try {
        const resultado = await service.revelarToken(req.params.id, req.params.acessoId, req.user.id);

        // Um segredo nunca deve ficar em cache do browser nem de proxies
        res.set("Cache-Control", "no-store");

        return response.success(res, MSG.PLATAFORMA.TOKEN_OBTIDO, resultado, HTTP.OK);
    } catch (error) {
        next(error);
    }
};

exports.atualizarLogotipo = async (req, res, next) => {
    try {
        if (!req.file) {
            return response.error(res, MSG.PLATAFORMA.LOGOTIPO_OBRIGATORIO, HTTP.BAD_REQUEST);
        }

        const urlLogotipo = `/uploads/plataformas/${req.file.filename}`;
        const plataforma = await service.atualizarLogotipo(req.params.id, urlLogotipo, req.user.id);

        return response.success(res, MSG.PLATAFORMA.LOGOTIPO_ATUALIZADO, plataforma, HTTP.OK);
    } catch (error) {
        next(error);
    }
};