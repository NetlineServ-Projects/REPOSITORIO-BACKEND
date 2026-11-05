const { z } = require("zod");

const createUserSchema = z.object({
    nome: z.string().trim().min(3, "O nome deve ter pelo menos 3 caracteres."),
    email: z.email("Email inválido."),
    senha: z.string().min(8, "A palavra-passe deve ter pelo menos 8 caracteres."),
    numero: z.string().trim().min(9, "Número inválido."),
    cargo: z.string().trim().min(2, "Cargo é obrigatório."),
    departamento: z.string().trim().min(2, "Departamento é obrigatório."),
    perfilId: z.coerce.number().int().positive("Escolha um perfil.")
});

// Deriva o schema do PATCH tornando todos os campos opcionais, e adiciona
// campos que só fazem sentido em atualização (não na criação)
const updateUserSchema = createUserSchema.partial().extend({
    ativo: z.boolean().optional()
});

module.exports = {
    createUserSchema,
    updateUserSchema
};