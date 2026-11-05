const { Router } = require("express");
const router = Router();

const sistemaInfraestruturaController = require("../../controllers/sistemaInfraestruturaController");
const authMiddleware = require("../../middlewares/authMiddleware");
const { exigirPermissao } = require("../../middlewares/roleMiddleware");
const exigirReautenticacao = require("../../middlewares/exigirReautenticacao");
const validate = require("../../validators/validate");
const { PERMISSOES } = require("../../constants/permissoes");

const {
  sistemaIdParamsSchema,
  infraestruturaParamsSchema,
  credencialParamsSchema,
  salvarInfraestruturaSchema,
  credencialSchema,
  credencialUpdateSchema,
} = require("../../validators/sistemaInfraestruturaValidator");

// Este router é montado em /sistemas (ver routes/index.js), a seguir ao
// sistemasRoutes. As cadeias de middlewares são aplicadas rota a rota e NÃO
// com router.use(): um router.use() sem caminho correria para qualquer pedido
// a /sistemas/* que chegasse aqui, e um 404 passaria a pedir reautenticação.
//
// Leitura: quem tem acesso à infraestrutura dos sistemas, com reautenticação recente
// (token elevado, 3 min).
const leitura = [authMiddleware, exigirPermissao(PERMISSOES.SISTEMAS_INFRA_VER), exigirReautenticacao];

// Escrita: quem gere a infraestrutura dos sistemas. A permissão é verificada ANTES da
// reautenticação, para quem não a tem receber 403 logo, sem ter de introduzir a password.
const escrita = [authMiddleware, exigirPermissao(PERMISSOES.SISTEMAS_INFRA_GERIR), exigirReautenticacao];

// A validação vem depois da autenticação: quem não tem sessão nem token
// elevado não recebe detalhes de validação.
//
// A infraestrutura é só do backend: há uma por sistema e ambiente.

// ── Leitura ──────────────────────────────────────────────────────────────

// Infraestruturas já registadas do sistema, de todos os ambientes (nada é desencriptado)
router.get(
  "/:sistemaId/infraestruturas",
  ...leitura,
  validate(sistemaIdParamsSchema, "params"),
  sistemaInfraestruturaController.listar
);

// Infraestrutura de um ambiente, desencriptada e auditada
router.get(
  "/:sistemaId/infraestruturas/:ambiente",
  ...leitura,
  validate(infraestruturaParamsSchema, "params"),
  sistemaInfraestruturaController.obter
);

// ── Escrita ──────────────────────────────────────────────────────────────

// Cria ou atualiza a infraestrutura de um ambiente (upsert), incluindo o
// subdomínio, se vier no corpo do pedido
router.put(
  "/:sistemaId/infraestruturas/:ambiente",
  ...escrita,
  validate(infraestruturaParamsSchema, "params"),
  validate(salvarInfraestruturaSchema),
  sistemaInfraestruturaController.salvar
);

router.post(
  "/:sistemaId/infraestruturas/:ambiente/credenciais",
  ...escrita,
  validate(infraestruturaParamsSchema, "params"),
  validate(credencialSchema),
  sistemaInfraestruturaController.adicionarCredencial
);

router.patch(
  "/:sistemaId/infraestruturas/:ambiente/credenciais/:credencialId",
  ...escrita,
  validate(credencialParamsSchema, "params"),
  validate(credencialUpdateSchema),
  sistemaInfraestruturaController.atualizarCredencial
);

router.delete(
  "/:sistemaId/infraestruturas/:ambiente/credenciais/:credencialId",
  ...escrita,
  validate(credencialParamsSchema, "params"),
  sistemaInfraestruturaController.apagarCredencial
);

module.exports = router;