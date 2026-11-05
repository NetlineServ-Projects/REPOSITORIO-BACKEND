const atividadeService = require("../services/atividadeService");
const HTTP = require("../utils/httpsStatus");
const response = require("../utils/response");
const { PERMISSOES, temPermissao } = require("../constants/permissoes");

exports.obterAtividadesRecentes = async (req, res, next) => {
  try {
    const limite = req.query.limite ? Number(req.query.limite) : 20;
    // Sem atividade.ver, cada um só vê a própria atividade
    const verTodas = temPermissao(req.user, PERMISSOES.ATIVIDADE_VER);
    const usuarioId = verTodas
      ? req.query.usuarioId
        ? Number(req.query.usuarioId)
        : undefined
      : req.user?.id;

    const atividades = await atividadeService.listarRecentes(limite, usuarioId);
    return response.success(res, null, atividades, HTTP.OK);
  } catch (error) {
    next(error);
  }
};