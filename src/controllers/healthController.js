const prisma = require("../config/prisma");
const HTTP = require("../utils/httpsStatus");
const response = require("../utils/response");

exports.verificarSaude = async (req, res, next) => {
  try {
    const dados = {
      status: "OK",
      servico: "API",
      ambiente: process.env.NODE_ENV || "development",
      versao: process.env.APP_VERSION || "dev",
      baseDados: "OK",
      timestamp: new Date().toISOString(),
    };

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dados.status = "ERRO";
      dados.baseDados = "INDISPONIVEL";
      return response.error(res, "Base de dados indisponível", HTTP.SERVICE_UNAVAILABLE, dados);
    }

    return response.success(
      res,
      "Servidor está saudável",
      dados,
      HTTP.OK
    );
  } catch (error) {
    next(error);
  }
};
