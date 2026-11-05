const usuarioService = require("../services/usuarioService");
const HTTP = require("../utils/httpsStatus");
const MSG = require("../utils/messages");
const response = require("../utils/response");
const { construirUrlFotografia } = require("../utils/fileHelper");

// O id chega aqui já validado pelo middleware validate() nos routes que o exigem.

exports.criarUsuario = async (req, res, next) => {
    try {
        const usuario = await usuarioService.criarUsuario(req.body, req.user);
        return response.success(res, MSG.USER.CREATED, usuario, HTTP.CREATED);
    } catch (error) {
        next(error);
    }
};

exports.listarUsuarios = async (req, res, next) => {
    try {
        const usuarios = await usuarioService.listarUsuarios();
        return response.success(res, null, usuarios, HTTP.OK);
    } catch (error) {
        next(error);
    }
};

exports.buscarUsuarioPorId = async (req, res, next) => {
    try {
        const { id } = req.params;
        const usuario = await usuarioService.buscarUsuarioPorId(id);
        return response.success(res, null, usuario, HTTP.OK);
    } catch (error) {
        next(error);
    }
};

exports.atualizarUsuario = async (req, res, next) => {
    try {
        const { id } = req.params;
        // A validação de corpo vazio é feita pelo schema Zod no validator.
        const usuarioAtualizado = await usuarioService.atualizarUsuario(id, req.body, req.user);
        return response.success(res, MSG.USER.UPDATED, usuarioAtualizado, HTTP.OK);
    } catch (error) {
        next(error);
    }
};

exports.eliminarUsuario = async (req, res, next) => {
    try {
        const { id } = req.params;
        await usuarioService.eliminarUsuario(id, req.user);
        return response.success(res, MSG.USER.DELETED, null, HTTP.OK);
    } catch (error) {
        next(error);
    }
};

exports.atualizarPreferencias = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const preferenciasAtualizadas = await usuarioService.atualizarPreferencias(userId, req.body);
        return response.success(res, MSG.USER.UPDATED, preferenciasAtualizadas, HTTP.OK);
    } catch (error) {
        next(error);
    }
};

exports.atualizarFotografia = async (req, res, next) => {
    try {
        if (!req.file) {
            return response.error(res, MSG.VALIDATION.NO_FILE_UPLOADED, HTTP.BAD_REQUEST);
        }
        const userId = req.user.id;
        // Construção da URL centralizada no fileHelper
        const urlFotografia = construirUrlFotografia(req.file.filename);
        const usuarioAtualizado = await usuarioService.atualizarFotografia(userId, urlFotografia);
        return response.success(res, MSG.USER.UPDATED, usuarioAtualizado, HTTP.OK);
    } catch (error) {
        next(error);
    }
};