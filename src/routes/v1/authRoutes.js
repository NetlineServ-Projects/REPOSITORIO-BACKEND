const express = require("express");
const router = express.Router();

const authController = require("../../controllers/authController");
const authMiddleware = require("../../middlewares/authMiddleware");
const { exigirPermissao } = require("../../middlewares/roleMiddleware");
const { PERMISSOES } = require("../../constants/permissoes");
const validate = require("../../validators/validate");

const {
    loginSchema,
    alterarSenhaSchema,
    atualizarPerfilSchema,
    reautenticarSchema,
} = require("../../validators/authValidator");

// Login (rota pública)
router.post("/login", validate(loginSchema), authController.login);
router.post("/logout", authController.logout);

// Dados do utilizador autenticado
router.get("/me", authMiddleware, authController.me);

// Alterar senha (qualquer utilizador autenticado, incluindo funcionario)
router.patch("/senha", authMiddleware, validate(alterarSenhaSchema), authController.alterarSenha);

// Atualizar os próprios dados (nome, email, cargo, departamento) — quem gere utilizadores
router.patch("/me", authMiddleware, exigirPermissao(PERMISSOES.UTILIZADORES_GERIR), validate(atualizarPerfilSchema), authController.atualizarPerfil);

// Reautenticar (confirma password novamente) — usado antes de aceder a
// dados sensíveis de infraestrutura; emite o token elevado de 3 min
router.post("/reautenticar", authMiddleware, validate(reautenticarSchema), authController.reautenticar);

module.exports = router;