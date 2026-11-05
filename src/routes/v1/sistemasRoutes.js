const { Router } = require("express");
const router = Router();

const sistemaController = require("../../controllers/sistemasController");
const authMiddleware = require("../../middlewares/authMiddleware");
const { exigirPermissao } = require("../../middlewares/roleMiddleware");
const validate = require("../../validators/validate");
const { PERMISSOES } = require("../../constants/permissoes");

const { createSistemaSchema } = require("../../validators/sistemaValidator");
const { updateSistemaSchema } = require("../../validators/sistemaValidator");

// Listar sistemas (qualquer utilizador autenticado)
router.get("/", authMiddleware, sistemaController.listar);

// Obter detalhes de um sistema (qualquer utilizador autenticado)
router.get("/:id", authMiddleware, sistemaController.obterPorId);

router.post(
  "/",
  authMiddleware,
  exigirPermissao(PERMISSOES.SISTEMAS_CRIAR),
  validate(createSistemaSchema),
  sistemaController.criar
);

router.patch(
  "/:id",
  authMiddleware,
  validate(updateSistemaSchema),
  sistemaController.atualizar
);

// Editar e eliminar: quem criou o sistema, ou quem gere todos os sistemas (verificado no service)
router.delete(
  "/:id",
  authMiddleware,
  sistemaController.apagar
);

module.exports = router;