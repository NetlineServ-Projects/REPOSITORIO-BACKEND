const { sistema } = require("../config/prisma");
const documentoService = require("../services/documentoService");
const HTTP = require("../utils/httpsStatus");
const MSG = require("../utils/messages");
const response = require("../utils/response");

exports.criarDocumento = async (req, res, next) => {
    try {
        const usuario = req.user;
        const ficheiro = req.file;

        if (!ficheiro) {
            return response.error(res, "Nenhum ficheiro foi enviado.", HTTP.BAD_REQUEST);
        }

        const dadosDocumento = {
            titulo: req.body.titulo,
            descricao: req.body.descricao,
            // O multer lê o nome em Latin-1: sem isto "Transacção.pdf" ficava "TransaccÌ§aÌo.pdf"
            nomeArquivo: Buffer.from(ficheiro.originalname, "latin1").toString("utf8"),
            caminho: ficheiro.path.replace(/\\/g, "/"),
            tipoArquivo: ficheiro.mimetype,
            tamanho: ficheiro.size,
            categoriaId: req.body.categoriaId,
            sistemaId: req.body.sistemaId,
        };

        const documentoCriado = await documentoService.criarDocumento(dadosDocumento, usuario);
        return response.success(res, MSG.DOCUMENTO.CREATED, documentoCriado, HTTP.CREATED);
    } catch (error) {
        next(error);
    }
};

exports.listarDocumentos = async (req, res, next) => {
  try {
    const apenasLixeira = req.query.lixeira === "true";
    const documentos = await documentoService.listarDocumentos(req.user, apenasLixeira);
    return response.success(res, null, documentos, HTTP.OK);
  } catch (error) {
    next(error);
  }
};

exports.buscarDocumentoPorId = async (req, res, next) => {
    try {
        const { id } = req.params;
        const documento = await documentoService.buscarDocumentoPorId(id, req.user);
        return response.success(res, null, documento, HTTP.OK);
    } catch (error) {
        next(error);
    }
};

exports.atualizarDocumento = async (req, res, next) => {
    try {
        const { id } = req.params;
        const dadosAtualizacao = req.body;

        if (!dadosAtualizacao || Object.keys(dadosAtualizacao).length === 0) {
            return response.error(res, "Nenhum dado fornecido para atualização.", HTTP.BAD_REQUEST);
        }

        const documentoAtualizado = await documentoService.atualizarDocumento(
            id,
            dadosAtualizacao,
            req.user.perfil,
            req.user // antes: req.user.nome — agora o service precisa também do id, para a Atividade
        );
        return response.success(res, MSG.DOCUMENTO.UPDATED, documentoAtualizado, HTTP.OK);
    } catch (error) {
        next(error);
    }
};

exports.eliminarDocumento = async (req, res, next) => {
  try {
    const { id } = req.params;
    const definitivo = req.query.definitivo === "true";
    await documentoService.eliminarDocumento(id, definitivo, req.user); // antes: req.user.nome
    return response.success(res, MSG.DOCUMENTO.DELETED, null, HTTP.OK);
  } catch (error) {
    next(error);
  }
};