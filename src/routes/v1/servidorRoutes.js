const { Router } = require("express");
const router = Router();

const servidorController = require("../../controllers/servidorController");
const authMiddleware = require("../../middlewares/authMiddleware");
const { exigirPermissao } = require("../../middlewares/roleMiddleware");
const exigirReautenticacao = require("../../middlewares/exigirReautenticacao");
const validate = require("../../validators/validate");
const { PERMISSOES } = require("../../constants/permissoes");

const {
  criarServidorSchema,
  atualizarServidorSchema,
  servidorIdParamsSchema,
} = require("../../validators/servidorValidator");

// Leitura (IP incluído, password nunca): quem vê as plataformas ou edita a infraestrutura dos sistemas.
const leitura = [authMiddleware, exigirPermissao(PERMISSOES.INFRA_VER, PERMISSOES.SISTEMAS_INFRA_GERIR)];

// Escrita: quem gere as plataformas. Para exigir também reautenticação (como na
// infraestrutura), acrescenta exigirReautenticacao a este array.
const escrita = [authMiddleware, exigirPermissao(PERMISSOES.INFRA_GERIR)];

// Revelar a password: quem vê as plataformas, e só com reautenticação recente (token elevado, 3 min)
const leituraProtegida = [authMiddleware, exigirPermissao(PERMISSOES.INFRA_VER), exigirReautenticacao];

router.get("/", ...leitura, servidorController.listar);

router.get(
  "/:id",
  ...leitura,
  validate(servidorIdParamsSchema, "params"),
  servidorController.obter
);

router.get(
  "/:id/password",
  ...leituraProtegida,
  validate(servidorIdParamsSchema, "params"),
  servidorController.revelarPassword
);

router.post(
  "/",
  ...escrita,
  validate(criarServidorSchema),
  servidorController.criar
);

router.patch(
  "/:id",
  ...escrita,
  validate(servidorIdParamsSchema, "params"),
  validate(atualizarServidorSchema),
  servidorController.atualizar
);

router.delete(
  "/:id",
  ...escrita,
  validate(servidorIdParamsSchema, "params"),
  servidorController.apagar
);

module.exports = router;