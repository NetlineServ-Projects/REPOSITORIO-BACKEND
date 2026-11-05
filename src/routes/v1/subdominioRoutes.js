const { Router } = require("express");
const router = Router();

const subdominioController = require("../../controllers/subdominioController");
const authMiddleware = require("../../middlewares/authMiddleware");
const { exigirPermissao } = require("../../middlewares/roleMiddleware");
const validate = require("../../validators/validate");
const { PERMISSOES } = require("../../constants/permissoes");

const { subdominioIdParamsSchema } = require("../../validators/subdominioValidator");

// Só leitura, para quem vê as plataformas ou a infraestrutura dos sistemas. Os subdomínios
// são criados, editados e removidos pelo registo de infraestrutura do sistema
const leitura = [authMiddleware, exigirPermissao(PERMISSOES.INFRA_VER, PERMISSOES.SISTEMAS_INFRA_VER)];

router.get("/", ...leitura, subdominioController.listar);

router.get(
  "/:id",
  ...leitura,
  validate(subdominioIdParamsSchema, "params"),
  subdominioController.obter
);

module.exports = router;