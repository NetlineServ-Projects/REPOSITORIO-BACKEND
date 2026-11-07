const express = require("express");

const router = express.Router();

const atividadeRoutes = require("./atividadeRoutes");
const authRoutes = require("./authRoutes");
const categoriaRoutes = require("./categoriaRoutes");
const documentoRoutes = require("./documentoRoutes");
const plataformaRoutes = require("./plataformaRoutes");
const servidorRoutes = require("./servidorRoutes");
const sistemasRoutes = require("./sistemasRoutes");
const sistemaInfraestruturaRoutes = require("./sistemaInfraestruturaRoutes");
const usuarioRoutes = require("./usuarioRoutes");
const healthRoutes = require("./healthRoutes");
const dominioRoutes = require("./dominioRoutes");
const subdominioRoutes = require("./subdominioRoutes");
const imagemRoutes = require("./imagemRoutes");
const notificacaoRoutes = require("./notificacaoRoutes");
const perfilRoutes = require("./perfilRoutes");
const auditoriaRoutes = require("./auditoriaRoutes");

router.use("/atividades", atividadeRoutes);

router.use("/auth", authRoutes);

router.use("/categorias", categoriaRoutes);

router.use("/documentos", documentoRoutes);

router.use("/plataformas", plataformaRoutes);

router.use("/servidores", servidorRoutes);

router.use("/sistemas", sistemasRoutes);

router.use("/sistemas", sistemaInfraestruturaRoutes);

router.use("/usuarios", usuarioRoutes);

router.use("/health", healthRoutes);

router.use("/dominios", dominioRoutes);

router.use("/subdominios", subdominioRoutes);

router.use("/imagens", imagemRoutes);

router.use("/notificacoes", notificacaoRoutes);

router.use("/perfis", perfilRoutes);

// Só para administradores (ver auditoriaRoutes)
router.use("/auditoria", auditoriaRoutes);

module.exports = router;