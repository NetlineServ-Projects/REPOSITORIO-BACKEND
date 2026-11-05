const express = require("express");
const router = express.Router();

const usuarioController = require("../../controllers/usuarioController");
const authMiddleware = require("../../middlewares/authMiddleware");
const { exigirPermissao } = require("../../middlewares/roleMiddleware");
const validate = require("../../validators/validate");
const uploadFotografia = require("../../middlewares/uploadFotografia"); // novo

const { createUserSchema, updateUserSchema } = require("../../validators/usuarioValidator");
const { PERMISSOES } = require("../../constants/permissoes");

// Gerir contas: quem tem utilizadores.gerir. Contas de administrador e o perfil
// Administrador só um administrador as mexe (verificado no service)
router.post(
    "/",
    authMiddleware,
    exigirPermissao(PERMISSOES.UTILIZADORES_GERIR),
    validate(createUserSchema),
    usuarioController.criarUsuario
);

// Qualquer utilizador autenticado pode atualizar as PRÓPRIAS preferências
router.patch("/me/preferencias", authMiddleware, usuarioController.atualizarPreferencias);

// Qualquer utilizador autenticado pode atualizar a PRÓPRIA fotografia
router.patch(
    "/me/fotografia",
    authMiddleware,
    uploadFotografia.single("fotografia"),
    usuarioController.atualizarFotografia
);

router.get("/", authMiddleware, exigirPermissao(PERMISSOES.UTILIZADORES_GERIR), usuarioController.listarUsuarios);

router.get("/:id", authMiddleware, exigirPermissao(PERMISSOES.UTILIZADORES_GERIR), usuarioController.buscarUsuarioPorId);

router.patch("/:id", authMiddleware, exigirPermissao(PERMISSOES.UTILIZADORES_GERIR), validate(updateUserSchema), usuarioController.atualizarUsuario);

router.delete("/:id", authMiddleware, exigirPermissao(PERMISSOES.UTILIZADORES_GERIR), usuarioController.eliminarUsuario);

module.exports = router;