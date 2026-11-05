const express = require("express");
const router = express.Router();

const upload = require("../../config/multer");
const documentoController = require("../../controllers/documentoController");
const authMiddleware = require("../../middlewares/authMiddleware");
const { exigirPermissao } = require("../../middlewares/roleMiddleware");
const validate = require("../../validators/validate");

const { createDocumentoSchema } = require("../../validators/documentoValidator");
const { PERMISSOES } = require("../../constants/permissoes");


router.post(
  "/",
  authMiddleware,
  upload.single("ficheiro"),
  validate(createDocumentoSchema),
  documentoController.criarDocumento
);

router.get("/", authMiddleware, documentoController.listarDocumentos);

router.get("/:id", authMiddleware, documentoController.buscarDocumentoPorId);

router.patch("/:id", authMiddleware, documentoController.atualizarDocumento);

// Lixeira: documentos.eliminar; definitivo: documentos.lixeira (verificado no service)
router.delete(
  "/:id",
  authMiddleware,
  exigirPermissao(PERMISSOES.DOCUMENTOS_ELIMINAR, PERMISSOES.DOCUMENTOS_LIXEIRA),
  documentoController.eliminarDocumento
);

module.exports = router;