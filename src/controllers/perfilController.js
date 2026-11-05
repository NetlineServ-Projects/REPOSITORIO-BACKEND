const service = require("../services/perfilService");
const response = require("../utils/response");
const HTTP = require("../utils/httpsStatus");
const MSG = require("../utils/messages");

// O id chega aqui já validado e convertido para número (ver perfilRoutes.js)

exports.listar = async (req, res, next) => {
    try {
        return response.success(res, null, await service.listar(), HTTP.OK);
    } catch (error) {
        next(error);
    }
};

exports.catalogo = async (req, res, next) => {
    try {
        return response.success(res, null, service.catalogo(), HTTP.OK);
    } catch (error) {
        next(error);
    }
};

exports.criar = async (req, res, next) => {
    try {
        const perfil = await service.criar(req.body);
        return response.success(res, MSG.PERFIL.CREATED, perfil, HTTP.CREATED);
    } catch (error) {
        next(error);
    }
};

exports.atualizar = async (req, res, next) => {
    try {
        const perfil = await service.atualizar(req.params.id, req.body);
        return response.success(res, MSG.PERFIL.UPDATED, perfil, HTTP.OK);
    } catch (error) {
        next(error);
    }
};

exports.apagar = async (req, res, next) => {
    try {
        await service.apagar(req.params.id);
        return response.success(res, MSG.PERFIL.DELETED, null, HTTP.OK);
    } catch (error) {
        next(error);
    }
};
