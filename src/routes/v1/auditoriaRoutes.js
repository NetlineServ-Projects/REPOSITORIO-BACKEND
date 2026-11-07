const { Router } = require("express");
const router = Router();

const auditoriaController = require("../../controllers/auditoriaController");
const authMiddleware = require("../../middlewares/authMiddleware");
const { apenasAdministrador } = require("../../middlewares/roleMiddleware");
const validate = require("../../validators/validate");
const { auditoriaIdParamsSchema } = require("../../validators/auditoriaValidator");

// A auditoria é só para o perfil Administrador (nem a permissão atividade.ver chega)
const soAdministrador = [authMiddleware, apenasAdministrador];

router.get("/", ...soAdministrador, auditoriaController.listar);

// Tem de vir antes de "/:id"
router.get("/funcionalidades", ...soAdministrador, auditoriaController.funcionalidades);

router.get(
  "/:id",
  ...soAdministrador,
  validate(auditoriaIdParamsSchema, "params"),
  auditoriaController.obter
);

module.exports = router;
