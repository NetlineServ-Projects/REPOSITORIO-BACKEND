const { Router } = require("express");
const router = Router();

const imagemController = require("../../controllers/imagemController");
const authMiddleware = require("../../middlewares/authMiddleware");
const { exigirPermissao } = require("../../middlewares/roleMiddleware");
const validate = require("../../validators/validate");
const { PERMISSOES } = require("../../constants/permissoes");

const {
  criarImagemSchema,
  atualizarImagemSchema,
  imagemIdParamsSchema,
} = require("../../validators/imagemValidator");

// Leitura: quem vê as plataformas ou edita a infraestrutura dos sistemas (escolhe a imagem).
const leitura = [authMiddleware, exigirPermissao(PERMISSOES.INFRA_VER, PERMISSOES.SISTEMAS_INFRA_GERIR)];

// Escrita: quem gere as plataformas.
const escrita = [authMiddleware, exigirPermissao(PERMISSOES.INFRA_GERIR)];

router.get("/", ...leitura, imagemController.listar);

router.get(
  "/:id",
  ...leitura,
  validate(imagemIdParamsSchema, "params"),
  imagemController.obter
);

router.post(
  "/",
  ...escrita,
  validate(criarImagemSchema),
  imagemController.criar
);

router.patch(
  "/:id",
  ...escrita,
  validate(imagemIdParamsSchema, "params"),
  validate(atualizarImagemSchema),
  imagemController.atualizar
);

router.delete(
  "/:id",
  ...escrita,
  validate(imagemIdParamsSchema, "params"),
  imagemController.apagar
);

module.exports = router;