const service = require("../services/auditoriaService");
const response = require("../utils/response");
const HTTP = require("../utils/httpsStatus");
const MSG = require("../utils/messages");
const { filtrosAuditoriaSchema } = require("../validators/auditoriaValidator");

// No Express 5 o req.query é só de leitura: os filtros validam-se aqui
function lerFiltros(req, res) {
  const resultado = filtrosAuditoriaSchema.safeParse(req.query);
  if (!resultado.success) {
    const erros = resultado.error.issues.map((issue) => ({
      campo: issue.path.join("."),
      mensagem: issue.message,
    }));
    response.error(res, MSG.VALIDATION.INVALID_DATA, HTTP.UNPROCESSABLE_ENTITY, erros);
    return null;
  }
  return resultado.data;
}

exports.listar = async (req, res, next) => {
  try {
    const filtros = lerFiltros(req, res);
    if (!filtros) return;
    const dados = await service.listar(filtros);
    return response.success(res, null, dados, HTTP.OK);
  } catch (error) {
    next(error);
  }
};

exports.obter = async (req, res, next) => {
  try {
    const registo = await service.obter(req.params.id);
    return response.success(res, null, registo, HTTP.OK);
  } catch (error) {
    next(error);
  }
};

exports.funcionalidades = async (req, res, next) => {
  try {
    return response.success(res, null, await service.listarFuncionalidades(), HTTP.OK);
  } catch (error) {
    next(error);
  }
};
