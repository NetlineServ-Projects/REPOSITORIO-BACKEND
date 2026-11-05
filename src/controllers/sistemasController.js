const sistemaService = require("../services/sistemasService");
const HTTP = require("../utils/httpsStatus");
const MSG = require("../utils/messages");
const response = require("../utils/response");

// Padrão uniforme: exports funcionais (igual a todos os outros controllers do projecto).
// O id chega aqui já validado e convertido para número pelo middleware validate().

exports.listar = async (req, res, next) => {
    try {
        const sistemas = await sistemaService.listarTodos(req.user);
        return response.success(res, null, sistemas, HTTP.OK);
    } catch (error) {
        next(error);
    }
};

exports.obterPorId = async (req, res, next) => {
    try {
        const { id } = req.params;
        const sistema = await sistemaService.obterPorId(id, req.user);
        return response.success(res, null, sistema, HTTP.OK);
    } catch (error) {
        next(error);
    }
};

exports.criar = async (req, res, next) => {
    try {
        const novoSistema = await sistemaService.criar(req.body, req.user);
        return response.success(res, MSG.SISTEMA.CREATED, novoSistema, HTTP.CREATED);
    } catch (error) {
        next(error);
    }
};

exports.atualizar = async (req, res, next) => {
    try {
        const { id } = req.params;
        const sistemaAtualizado = await sistemaService.atualizar(id, req.body, req.user);
        return response.success(res, MSG.SISTEMA.UPDATED, sistemaAtualizado, HTTP.OK);
    } catch (error) {
        next(error);
    }
};

exports.apagar = async (req, res, next) => {
    try {
        const { id } = req.params;
        await sistemaService.apagar(id, req.user);
        return response.success(res, MSG.SISTEMA.DELETED, null, HTTP.OK);
    } catch (error) {
        next(error);
    }
};