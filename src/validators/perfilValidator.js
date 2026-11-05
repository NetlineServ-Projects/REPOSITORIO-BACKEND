const { z } = require("zod");
const { TODAS } = require("../constants/permissoes");

const INT_MAX = 2147483647; // limite da coluna INT do MySQL

const permissoesSchema = z.array(
    z.enum(TODAS, { error: "Permissão desconhecida." }),
    { error: "As permissões devem ser uma lista." }
);

const criarPerfilSchema = z.object({
    nome: z.string({ error: "O nome do perfil é obrigatório." }).trim().min(2, "O nome deve ter pelo menos 2 caracteres.").max(60, "O nome deve ter no máximo 60 caracteres."),
    descricao: z.string().trim().max(190, "A descrição deve ter no máximo 190 caracteres.").optional().default(""),
    permissoes: permissoesSchema,
});

const atualizarPerfilSchema = criarPerfilSchema
    .partial()
    .refine((dados) => Object.keys(dados).length > 0, "Indique pelo menos um campo para atualizar.");

const perfilIdParamsSchema = z.object({
    id: z.coerce.number({ error: "Identificador inválido." }).int().positive().max(INT_MAX),
});

module.exports = { criarPerfilSchema, atualizarPerfilSchema, perfilIdParamsSchema };
