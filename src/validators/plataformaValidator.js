const { z } = require("zod");
const { TODOS_OS_FORNECEDORES } = require("../constants/fornecedoresPlataforma");

const TIPOS_PLATAFORMA = ["CLOUD_BASE_DADOS", "CONTAINERIZACAO", "GESTAO_DOMINIO"];

const vazioParaNull = (valor) =>
  typeof valor === "string" && valor.trim() === "" ? null : valor;

// O nome só é pedido quando o fornecedor é "Outro"; nos restantes vem do fornecedor.
// A regra (obrigatório só com "Outro") é verificada no service.
const nomeSchema = z.preprocess(
  (valor) => (typeof valor === "string" && valor.trim() === "" ? undefined : valor),
  z
    .string({ error: "O nome deve ser texto." })
    .trim()
    .min(2, "O nome deve ter pelo menos 2 caracteres.")
    .max(255, "O nome não pode ter mais de 255 caracteres.")
    .optional()
);

const fornecedorSchema = z.enum(TODOS_OS_FORNECEDORES, { error: "Fornecedor inválido." });

// Aceita só http/https (bloqueia esquemas como javascript:) e trata "" como "sem valor"
const urlPainelSchema = z.preprocess(
  vazioParaNull,
  z
    .url({ protocol: /^https?$/, error: "O URL do painel deve começar por http:// ou https://." })
    .max(255, "O URL do painel não pode ter mais de 255 caracteres.")
    .nullable()
    .optional()
);

// Endereço de registry sem protocolo: host[:porta][/caminho], ex: "ghcr.io/netline"
const REGISTRY_URL_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?(:\d{1,5})?(\/[a-zA-Z0-9._-]+)*$/;

const registryUrlSchema = z.preprocess(
  vazioParaNull,
  z
    .string({ error: "O URL do registry deve ser texto." })
    .trim()
    .max(500, "O URL do registry não pode ter mais de 500 caracteres.")
    .regex(REGISTRY_URL_REGEX, "URL do registry inválido (ex: ghcr.io/netline).")
    .nullable()
    .optional()
);

const textoOpcionalSchema = (campo) =>
  z.preprocess(
    vazioParaNull,
    z
      .string({ error: `${campo} deve ser texto.` })
      .trim()
      .max(255, `${campo} não pode ter mais de 255 caracteres.`)
      .nullable()
      .optional()
  );

// Sem trim (um token não deve ser alterado). "" é ignorado: ao editar uma conta, deixar o
// campo vazio significa "manter o token atual". Para apagar o token, enviar null.
const tokenSchema = z.preprocess(
  (valor) => (valor === "" ? undefined : valor),
  z
    .string({ error: "O token deve ser texto." })
    .max(1000, "O token não pode ter mais de 1000 caracteres.")
    .nullable()
    .optional()
);

const MAX_ACESSOS = 50;

// Uma conta de acesso da plataforma. Com id edita uma conta que já existe; sem id cria uma nova.
const acessoSchema = z
  .object({
    id: z.number({ error: "ID da conta inválido." }).int("ID da conta inválido.").positive("ID da conta inválido.").optional(),
    descricao: textoOpcionalSchema("A descrição da conta"),
    utilizador: textoOpcionalSchema("O utilizador"),
    token: tokenSchema,
  })
  .refine((acesso) => acesso.id !== undefined || acesso.utilizador || acesso.token, {
    error: "Cada conta de acesso precisa de um utilizador ou de um token.",
  });

// Lista completa das contas: as que não vierem (pelo id) são apagadas
const acessosSchema = z
  .array(acessoSchema, { error: "As contas de acesso devem ser uma lista." })
  .max(MAX_ACESSOS, `Uma plataforma não pode ter mais de ${MAX_ACESSOS} contas de acesso.`)
  .optional();

const criarPlataformaSchema = z.object({
  nome: nomeSchema,
  tipo: z.enum(TIPOS_PLATAFORMA, {
    error: `Tipo de plataforma inválido. Valores aceites: ${TIPOS_PLATAFORMA.join(", ")}.`,
  }),
  fornecedor: fornecedorSchema,
  urlPainel: urlPainelSchema,
  ativo: z.boolean({ error: "O campo ativo deve ser verdadeiro ou falso." }).optional(),
  acessos: acessosSchema,
  // Só para CONTAINERIZACAO (verificado no service)
  registryUrl: registryUrlSchema,
  namespace: textoOpcionalSchema("O namespace"),
});

const atualizarPlataformaSchema = criarPlataformaSchema
  .partial()
  .refine((dados) => Object.keys(dados).length > 0, {
    error: "Indique pelo menos um campo para atualizar.",
  });

const idSchema = z.coerce.number({ error: "ID inválido." }).int("ID inválido.").positive("ID inválido.");

const plataformaIdParamsSchema = z.object({ id: idSchema });

// Revelar o token de uma conta: /plataformas/:id/acessos/:acessoId/token
const acessoParamsSchema = z.object({ id: idSchema, acessoId: idSchema });

module.exports = {
  criarPlataformaSchema,
  atualizarPlataformaSchema,
  plataformaIdParamsSchema,
  acessoParamsSchema,
};
