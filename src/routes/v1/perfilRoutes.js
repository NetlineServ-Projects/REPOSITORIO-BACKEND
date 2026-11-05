const { Router } = require("express");
const router = Router();

const perfilController = require("../../controllers/perfilController");
const authMiddleware = require("../../middlewares/authMiddleware");
const { exigirPermissao, apenasAdministrador } = require("../../middlewares/roleMiddleware");
const validate = require("../../validators/validate");
const { PERMISSOES } = require("../../constants/permissoes");

const {
  criarPerfilSchema,
  atualizarPerfilSchema,
  perfilIdParamsSchema,
} = require("../../validators/perfilValidator");

// Leitura: quem gere utilizadores (para escolher o perfil de uma conta).
// Escrita: só o Administrador.
const leitura = [authMiddleware, exigirPermissao(PERMISSOES.UTILIZADORES_GERIR)];
const escrita = [authMiddleware, apenasAdministrador];

router.get("/", ...leitura, perfilController.listar);

// Catálogo das permissões, agrupadas (para a matriz em Configurações)
router.get("/permissoes", ...leitura, perfilController.catalogo);

router.post("/", ...escrita, validate(criarPerfilSchema), perfilController.criar);

router.patch(
  "/:id",
  ...escrita,
  validate(perfilIdParamsSchema, "params"),
  validate(atualizarPerfilSchema),
  perfilController.atualizar
);

router.delete(
  "/:id",
  ...escrita,
  validate(perfilIdParamsSchema, "params"),
  perfilController.apagar
);

module.exports = router;
