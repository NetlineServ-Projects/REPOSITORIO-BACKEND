const { z } = require("zod");
const { ACOES } = require("../services/auditoriaService");

const vazioParaUndefined = (valor) => (typeof valor === "string" && valor.trim() === "" ? undefined : valor);

const dataSchema = z.preprocess(
  vazioParaUndefined,
  z.coerce.date({ error: "Data inválida." }).optional()
);

// Filtros da lista e da exportação (vêm na query string)
const filtrosAuditoriaSchema = z.object({
  desde: dataSchema,
  ate: dataSchema,
  utilizador: z.preprocess(vazioParaUndefined, z.string().trim().max(255).optional()),
  acao: z.preprocess(vazioParaUndefined, z.enum(ACOES, { error: "Acção inválida." }).optional()),
  funcionalidade: z.preprocess(vazioParaUndefined, z.string().trim().max(100).optional()),
  metodo: z.preprocess(
    vazioParaUndefined,
    z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"], { error: "Método inválido." }).optional()
  ),
  resultado: z.preprocess(
    vazioParaUndefined,
    z.enum(["sucesso", "erro"], { error: "Resultado inválido." }).optional()
  ),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
});

const auditoriaIdParamsSchema = z.object({
  id: z.coerce.number({ error: "ID inválido." }).int("ID inválido.").positive("ID inválido."),
});

module.exports = { filtrosAuditoriaSchema, auditoriaIdParamsSchema };
