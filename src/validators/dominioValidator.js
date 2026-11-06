const { z } = require("zod");

const INT_MAX = 2147483647; // limite da coluna INT do MySQL

// Etiquetas de 1 a 63 caracteres separadas por pontos, terminando numa extensão
// (letras ou, para domínios internacionalizados, "xn--...")
const DOMINIO_REGEX =
  /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

const nomeSchema = z
  .string({ error: "O nome do domínio é obrigatório." })
  .trim()
  .toLowerCase()
  .regex(DOMINIO_REGEX, "Nome de domínio inválido. Exemplo válido: empresa.co.mz");

// Formato AAAA-MM-DD (valida também o calendário: 2027-02-30 é recusado).
// Fica guardada à meia-noite UTC.
const dataExpiracaoSchema = z.iso
  .date({ error: "A data de expiração deve estar no formato AAAA-MM-DD e ser uma data válida." })
  .transform((valor) => new Date(`${valor}T00:00:00.000Z`));

const plataformaIdSchema = z
  .number({ error: "A plataforma é obrigatória e deve ser um número." })
  .int("A plataforma é inválida.")
  .positive("A plataforma é inválida.")
  .max(INT_MAX, "A plataforma é inválida.");

// Conta da plataforma (instituição) a que o domínio pertence; null = sem conta
const acessoIdSchema = z
  .number({ error: "A conta deve ser um número." })
  .int("A conta é inválida.")
  .positive("A conta é inválida.")
  .max(INT_MAX, "A conta é inválida.")
  .nullable()
  .optional();

const campos = {
  nome: nomeSchema,
  dataExpiracao: dataExpiracaoSchema,
  plataformaId: plataformaIdSchema,
  acessoId: acessoIdSchema,
};

const criarDominioSchema = z.object(campos);

const atualizarDominioSchema = z
  .object(campos)
  .partial()
  .refine((dados) => Object.keys(dados).length > 0, {
    error: "Indique pelo menos um campo para atualizar.",
  });

const dominioIdParamsSchema = z.object({
  id: z.coerce.number({ error: "ID inválido." }).int("ID inválido.").positive("ID inválido."),
});

module.exports = {
  criarDominioSchema,
  atualizarDominioSchema,
  dominioIdParamsSchema,
};