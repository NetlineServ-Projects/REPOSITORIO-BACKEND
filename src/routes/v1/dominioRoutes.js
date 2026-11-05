const { Router } = require("express");
const router = Router();

const dominioController = require("../../controllers/dominioController");
const authMiddleware = require("../../middlewares/authMiddleware");
const { exigirPermissao } = require("../../middlewares/roleMiddleware");
const validate = require("../../validators/validate");
const { PERMISSOES } = require("../../constants/permissoes");

const {
  criarDominioSchema,
  atualizarDominioSchema,
  dominioIdParamsSchema,
} = require("../../validators/dominioValidator");

// Leitura: quem vê as plataformas ou edita a infraestrutura dos sistemas (escolhe o domínio).
// Escrita: quem gere as plataformas. Não há reautenticação: o domínio não guarda dados sensíveis.
const leitura = [authMiddleware, exigirPermissao(PERMISSOES.INFRA_VER, PERMISSOES.SISTEMAS_INFRA_GERIR)];
const escrita = [authMiddleware, exigirPermissao(PERMISSOES.INFRA_GERIR)];

router.get("/", ...leitura, dominioController.listar);

router.get(
  "/:id",
  ...leitura,
  validate(dominioIdParamsSchema, "params"),
  dominioController.obter
);

router.post(
  "/",
  ...escrita,
  validate(criarDominioSchema),
  dominioController.criar
);

router.patch(
  "/:id",
  ...escrita,
  validate(dominioIdParamsSchema, "params"),
  validate(atualizarDominioSchema),
  dominioController.atualizar
);

router.delete(
  "/:id",
  ...escrita,
  validate(dominioIdParamsSchema, "params"),
  dominioController.apagar
);

module.exports = router;