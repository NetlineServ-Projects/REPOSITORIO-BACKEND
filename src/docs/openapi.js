/**
 * openapi.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Especificação OpenAPI 3.1 da API, servida pelo Swagger UI em /api/v1/docs.
 *
 * Os corpos dos pedidos são gerados a partir dos próprios schemas Zod dos
 * validators: o que está documentado é exatamente o que a API valida. Ao criar
 * ou alterar uma rota, acrescente-a ou atualize-a na lista de rotas abaixo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { z } = require("zod");

const authValidator = require("../validators/authValidator");
const documentoValidator = require("../validators/documentoValidator");
const dominioValidator = require("../validators/dominioValidator");
const imagemValidator = require("../validators/imagemValidator");
const plataformaValidator = require("../validators/plataformaValidator");
const servidorValidator = require("../validators/servidorValidator");
const infraValidator = require("../validators/sistemaInfraestruturaValidator");
const sistemaValidator = require("../validators/sistemaValidator");
const usuarioValidator = require("../validators/usuarioValidator");

// ─── ZOD → JSON SCHEMA ───────────────────────────────────────────────────────

// io "input": documenta o que o cliente envia (antes dos defaults e transformações)
function esquema(schemaZod) {
  const { $schema, ...jsonSchema } = z.toJSONSchema(schemaZod, {
    io: "input",
    target: "draft-2020-12",
    unrepresentable: "any",
    override: ({ zodSchema, jsonSchema: js }) => {
      // z.coerce.date() não tem representação própria em JSON Schema
      if (zodSchema instanceof z.ZodDate) {
        js.type = "string";
        js.format = "date-time";
      }
    },
  });
  return jsonSchema;
}

// ─── ACESSO ──────────────────────────────────────────────────────────────────

// A sessão vai no cookie (browser) ou no cabeçalho Bearer (Postman, scripts)
const SESSAO = [{ cookieSessao: [] }, { bearer: [] }];
const SESSAO_ELEVADA = [
  { cookieSessao: [], tokenElevado: [] },
  { bearer: [], tokenElevado: [] },
];

const ACESSO = {
  publico: { security: [], nota: "**Acesso:** público.", erros: [] },
  autenticado: { security: SESSAO, nota: "**Acesso:** qualquer utilizador com sessão.", erros: [401] },
  admin: { security: SESSAO, nota: "**Acesso:** só `ADMIN`.", erros: [401, 403] },
  reautenticacao: {
    security: SESSAO_ELEVADA,
    nota: "**Acesso:** qualquer utilizador com sessão **e** reautenticação recente (cabeçalho `X-Token-Elevado`, ver `POST /api/v1/auth/reautenticar`).",
    erros: [401],
  },
  adminReautenticacao: {
    security: SESSAO_ELEVADA,
    nota: "**Acesso:** só `ADMIN`, **com** reautenticação recente (cabeçalho `X-Token-Elevado`, ver `POST /api/v1/auth/reautenticar`).",
    erros: [401, 403],
  },
};

// ─── PARÂMETROS ──────────────────────────────────────────────────────────────

const PARAMETROS_CAMINHO = {
  id: { type: "integer", minimum: 1 },
  sistemaId: { type: "integer", minimum: 1 },
  credencialId: { type: "integer", minimum: 1 },
  ambiente: { type: "string", enum: infraValidator.AMBIENTES },
};

// Todas as rotas estão montadas em /api/v1 (ver server.js)
const PREFIXO = "/api/v1";

// "/sistemas/:sistemaId/infraestruturas" → "/api/v1/sistemas/{sistemaId}/infraestruturas"
function caminhoOpenApi(caminho) {
  return PREFIXO + caminho.replace(/:([a-zA-Z]+)/g, "{$1}");
}

// ("patch", "/notificacoes/:id/lida") → "patchNotificacoesIdLida"
function operationId(metodo, caminho) {
  const partes = caminho.split("/").filter(Boolean).map((parte) => parte.replace(/^:/, ""));
  return metodo + partes.map((parte) => parte[0].toUpperCase() + parte.slice(1)).join("");
}

function parametrosDoCaminho(caminho) {
  return [...caminho.matchAll(/:([a-zA-Z]+)/g)].map(([, nome]) => ({
    name: nome,
    in: "path",
    required: true,
    schema: PARAMETROS_CAMINHO[nome] ?? { type: "string" },
  }));
}

const query = (nome, schema, descricao) => ({ name: nome, in: "query", required: false, schema, description: descricao });

// ─── CORPOS ──────────────────────────────────────────────────────────────────

const json = (schema) => ({ required: true, content: { "application/json": { schema } } });

// multipart/form-data: um ficheiro e, opcionalmente, os campos de um schema Zod
function multipart({ campo, descricao, obrigatorio = true, campos }) {
  const base = campos ? esquema(campos) : { type: "object", properties: {} };
  return {
    required: true,
    content: {
      "multipart/form-data": {
        schema: {
          ...base,
          properties: { [campo]: { type: "string", format: "binary", description: descricao }, ...base.properties },
          required: [...(obrigatorio ? [campo] : []), ...(base.required ?? [])],
        },
      },
    },
  };
}

// ─── RESPOSTAS ───────────────────────────────────────────────────────────────

const RESPOSTAS_ERRO = {
  400: "Pedido inválido",
  401: "Sem sessão, sessão expirada ou reautenticação em falta",
  403: "Sem permissão para esta operação",
  404: "Não encontrado",
  409: "Conflito (ex: registo duplicado)",
  422: "Dados inválidos",
  429: "Demasiadas tentativas",
  503: "Serviço indisponível (base de dados em baixo)",
};

function respostas({ status = 200, descricao = "Sucesso", erros = [] }) {
  const resultado = {
    [status]: { description: descricao, content: { "application/json": { schema: { $ref: "#/components/schemas/Resposta" } } } },
  };
  for (const codigo of [...new Set(erros)].sort((a, b) => a - b)) {
    const schema = codigo === 422 ? "ErroValidacao" : "Erro";
    resultado[codigo] = {
      description: RESPOSTAS_ERRO[codigo],
      content: { "application/json": { schema: { $ref: `#/components/schemas/${schema}` } } },
    };
  }
  return resultado;
}

// ─── ROTAS ───────────────────────────────────────────────────────────────────

const paths = {};

/**
 * Regista uma rota na especificação.
 *
 * @param {string} metodo  - get, post, put, patch ou delete.
 * @param {string} caminho - Caminho Express, sem o prefixo /api/v1 (ex: "/dominios/:id").
 * @param {object} opcoes  - tag, resumo, descricao, acesso (chave de ACESSO), corpo,
 *                           query, status (sucesso) e erros (códigos adicionais).
 */
function rota(metodo, caminho, { tag, resumo, descricao, acesso = "autenticado", corpo, query: parametrosQuery = [], status, erros = [] }) {
  const { security, nota, erros: errosAcesso } = ACESSO[acesso];
  const parametros = [...parametrosDoCaminho(caminho), ...parametrosQuery];
  const errosDaRota = [...errosAcesso, ...erros];
  if (corpo) errosDaRota.push(422);
  if (parametrosDoCaminho(caminho).length) errosDaRota.push(404);

  (paths[caminhoOpenApi(caminho)] ??= {})[metodo] = {
    operationId: operationId(metodo, caminho),
    tags: [tag],
    summary: resumo,
    description: [descricao, nota].filter(Boolean).join("\n\n"),
    security,
    ...(parametros.length && { parameters: parametros }),
    ...(corpo && { requestBody: corpo }),
    responses: respostas({ status: status ?? 200, erros: errosDaRota }),
  };
}

// Atalho para os CRUD simples (listar, obter, criar, atualizar, apagar)
function crud(base, { tag, nome, criar, atualizar, leitura = "autenticado", escrita = "admin" }) {
  rota("get", base, { tag, resumo: `Listar ${nome.plural}`, acesso: leitura });
  rota("get", `${base}/:id`, { tag, resumo: `Obter ${nome.singular}`, acesso: leitura });
  rota("post", base, { tag, resumo: `Criar ${nome.singular}`, acesso: escrita, corpo: json(esquema(criar)), status: 201, erros: [409] });
  rota("patch", `${base}/:id`, { tag, resumo: `Atualizar ${nome.singular}`, descricao: "Só os campos enviados são alterados.", acesso: escrita, corpo: json(esquema(atualizar)), erros: [409] });
  rota("delete", `${base}/:id`, { tag, resumo: `Apagar ${nome.singular}`, acesso: escrita, erros: [409] });
}

// ── Sistema ──
rota("get", "/health", {
  tag: "Sistema",
  resumo: "Estado da API",
  descricao: "Devolve a versão da imagem (`data.versao`) e o estado da ligação à base de dados. Responde **503** se a base de dados estiver em baixo.",
  acesso: "publico",
  erros: [503],
});

// ── Autenticação ──
rota("post", "/auth/login", {
  tag: "Autenticação",
  resumo: "Iniciar sessão",
  descricao: "Devolve o utilizador e define o cookie `netline_sessao` (HttpOnly, válido 24 h). Aqui no Swagger, depois deste pedido, o browser envia o cookie sozinho em todos os outros.\n\nA mensagem de erro é sempre a mesma, e 5 tentativas falhadas no mesmo e-mail bloqueiam-no durante 15 minutos.",
  acesso: "publico",
  corpo: json(esquema(authValidator.loginSchema)),
  erros: [401, 429],
});
rota("post", "/auth/logout", { tag: "Autenticação", resumo: "Terminar sessão", descricao: "Apaga o cookie da sessão.", acesso: "publico" });
rota("get", "/auth/me", { tag: "Autenticação", resumo: "Utilizador da sessão" });
rota("patch", "/auth/senha", {
  tag: "Autenticação",
  resumo: "Alterar a própria palavra-passe",
  corpo: json(esquema(authValidator.alterarSenhaSchema)),
});
rota("patch", "/auth/me", {
  tag: "Autenticação",
  resumo: "Atualizar o próprio perfil",
  acesso: "admin",
  corpo: json(esquema(authValidator.atualizarPerfilSchema)),
  erros: [409],
});
rota("post", "/auth/reautenticar", {
  tag: "Autenticação",
  resumo: "Confirmar a palavra-passe (reautenticação)",
  descricao: "Devolve `data.tokenElevado`, válido 3 minutos, que dá acesso aos dados sensíveis (credenciais, passwords e tokens). Envie-o no cabeçalho `X-Token-Elevado`: aqui no Swagger, em **Authorize → tokenElevado**.",
  corpo: json(esquema(authValidator.reautenticarSchema)),
});

// ── Utilizadores ──
rota("get", "/usuarios", { tag: "Utilizadores", resumo: "Listar utilizadores", acesso: "admin" });
rota("get", "/usuarios/:id", { tag: "Utilizadores", resumo: "Obter utilizador", acesso: "admin" });
rota("post", "/usuarios", {
  tag: "Utilizadores",
  resumo: "Criar utilizador",
  acesso: "admin",
  corpo: json(esquema(usuarioValidator.createUserSchema)),
  status: 201,
  erros: [409],
});
rota("patch", "/usuarios/:id", {
  tag: "Utilizadores",
  resumo: "Atualizar utilizador",
  descricao: "Só os campos enviados são alterados. `ativo: false` impede o utilizador de iniciar sessão.",
  acesso: "admin",
  corpo: json(esquema(usuarioValidator.updateUserSchema)),
  erros: [409],
});
rota("delete", "/usuarios/:id", { tag: "Utilizadores", resumo: "Apagar utilizador", acesso: "admin" });
rota("patch", "/usuarios/me/preferencias", {
  tag: "Utilizadores",
  resumo: "Atualizar as próprias preferências",
  corpo: json({
    type: "object",
    properties: {
      temaEscuro: { type: "boolean" },
      notificacoesEmail: { type: "boolean" },
      idioma: { type: "string", enum: ["pt", "en"] },
    },
  }),
});
rota("patch", "/usuarios/me/fotografia", {
  tag: "Utilizadores",
  resumo: "Atualizar a própria fotografia",
  corpo: multipart({ campo: "fotografia", descricao: "JPEG, PNG ou WebP, até 2 MB." }),
});

// ── Documentos ──
rota("get", "/documentos", {
  tag: "Documentos",
  resumo: "Listar documentos",
  descricao: "Cada utilizador só vê os documentos a que tem acesso (categorias sensíveis e pendentes seguem regras próprias).",
  query: [query("lixeira", { type: "boolean" }, "`true` para listar só os documentos na lixeira.")],
});
rota("get", "/documentos/:id", { tag: "Documentos", resumo: "Obter documento", erros: [403] });
rota("post", "/documentos", {
  tag: "Documentos",
  resumo: "Enviar documento",
  descricao: "Um `ADMIN` publica logo (`APROVADO`); um `FUNCIONARIO` fica a aguardar aprovação (`PENDENTE`).",
  corpo: multipart({
    campo: "ficheiro",
    descricao: "PDF, DOC, DOCX, XLS, XLSX, PNG ou JPG, até 50 MB.",
    campos: documentoValidator.createDocumentoSchema,
  }),
  status: 201,
});
rota("patch", "/documentos/:id", {
  tag: "Documentos",
  resumo: "Atualizar, aprovar, rejeitar ou restaurar documento",
  descricao: "Edita os campos enviados. Mudar o `estado` e restaurar da lixeira (`apagadoEm: null`) são exclusivos de `ADMIN`.",
  corpo: json({
    type: "object",
    properties: {
      titulo: { type: "string", minLength: 3 },
      descricao: { type: "string" },
      categoriaId: { type: "integer", minimum: 1 },
      estado: { type: "string", enum: ["APROVADO", "REJEITADO", "PENDENTE"], description: "Só ADMIN." },
      motivoRejeicao: { type: "string", description: "Usado com `estado: REJEITADO`." },
      apagadoEm: { type: "null", description: "`null` restaura o documento da lixeira. Só ADMIN." },
    },
  }),
  erros: [400, 403],
});
rota("delete", "/documentos/:id", {
  tag: "Documentos",
  resumo: "Apagar documento",
  descricao: "Por omissão, move o documento para a lixeira.",
  acesso: "admin",
  query: [query("definitivo", { type: "boolean" }, "`true` apaga o documento e o ficheiro de vez.")],
});

// ── Categorias e atividade ──
rota("get", "/categorias", { tag: "Categorias", resumo: "Listar categorias" });
rota("get", "/atividades/recentes", {
  tag: "Atividade",
  resumo: "Atividade recente",
  descricao: "Um `FUNCIONARIO` vê só a sua atividade; um `ADMIN` vê a de todos ou a de um utilizador.",
  query: [
    query("limite", { type: "integer", minimum: 1, default: 20 }, "Número máximo de registos."),
    query("usuarioId", { type: "integer", minimum: 1 }, "Só `ADMIN`: filtra por utilizador."),
  ],
});

// ── Notificações ──
rota("get", "/notificacoes", { tag: "Notificações", resumo: "Listar as próprias notificações" });
rota("get", "/notificacoes/contagem", { tag: "Notificações", resumo: "Contar notificações não lidas" });
rota("patch", "/notificacoes/lidas", { tag: "Notificações", resumo: "Marcar todas como lidas" });
rota("patch", "/notificacoes/:id/lida", { tag: "Notificações", resumo: "Marcar uma como lida" });

// ── Sistemas ──
rota("get", "/sistemas", { tag: "Sistemas", resumo: "Listar sistemas" });
rota("get", "/sistemas/:id", { tag: "Sistemas", resumo: "Obter sistema" });
rota("post", "/sistemas", {
  tag: "Sistemas",
  resumo: "Criar sistema",
  descricao: "`subdominios` define o endereço público de cada ambiente (`PRODUCAO`, `TESTES`).",
  corpo: json(esquema(sistemaValidator.createSistemaSchema)),
  status: 201,
  erros: [409],
});
rota("patch", "/sistemas/:id", {
  tag: "Sistemas",
  resumo: "Atualizar sistema",
  descricao: "Só quem criou o sistema ou um `ADMIN`. Em `subdominios`: ambiente omitido não muda, `null` remove, objeto cria ou atualiza.",
  corpo: json(esquema(sistemaValidator.updateSistemaSchema)),
  erros: [403, 409],
});
rota("delete", "/sistemas/:id", { tag: "Sistemas", resumo: "Apagar sistema", descricao: "Só quem criou o sistema ou um `ADMIN`.", erros: [403] });

// ── Infraestrutura dos sistemas ──
const TAG_INFRA = "Infraestrutura";
rota("get", "/sistemas/:sistemaId/infraestruturas", {
  tag: TAG_INFRA,
  resumo: "Listar infraestruturas do sistema",
  descricao: "Infraestruturas registadas em todos os ambientes, sem desencriptar credenciais.",
  acesso: "reautenticacao",
});
rota("get", "/sistemas/:sistemaId/infraestruturas/:ambiente", {
  tag: TAG_INFRA,
  resumo: "Obter infraestrutura de um ambiente",
  descricao: "Inclui as credenciais desencriptadas. O acesso fica registado na atividade.",
  acesso: "reautenticacao",
});
rota("put", "/sistemas/:sistemaId/infraestruturas/:ambiente", {
  tag: TAG_INFRA,
  resumo: "Criar ou atualizar infraestrutura de um ambiente",
  acesso: "adminReautenticacao",
  corpo: json(esquema(infraValidator.salvarInfraestruturaSchema)),
  erros: [409],
});
rota("post", "/sistemas/:sistemaId/infraestruturas/:ambiente/credenciais", {
  tag: TAG_INFRA,
  resumo: "Adicionar credencial",
  descricao: "O valor é guardado encriptado.",
  acesso: "adminReautenticacao",
  corpo: json(esquema(infraValidator.credencialSchema)),
  status: 201,
});
rota("patch", "/sistemas/:sistemaId/infraestruturas/:ambiente/credenciais/:credencialId", {
  tag: TAG_INFRA,
  resumo: "Atualizar credencial",
  acesso: "adminReautenticacao",
  corpo: json(esquema(infraValidator.credencialUpdateSchema)),
});
rota("delete", "/sistemas/:sistemaId/infraestruturas/:ambiente/credenciais/:credencialId", {
  tag: TAG_INFRA,
  resumo: "Apagar credencial",
  acesso: "adminReautenticacao",
});

// ── Plataformas ──
rota("get", "/plataformas/arvore", { tag: "Plataformas", resumo: "Árvore de todas as plataformas", descricao: "Plataformas com os respetivos servidores, domínios e imagens." });
rota("get", "/plataformas/fornecedores", { tag: "Plataformas", resumo: "Fornecedores por tipo de plataforma" });
rota("get", "/plataformas/:id/arvore", { tag: "Plataformas", resumo: "Árvore de uma plataforma" });
rota("get", "/plataformas/:id/acessos/:acessoId/token", {
  tag: "Plataformas",
  resumo: "Revelar o token de uma conta de acesso da plataforma",
  descricao: "O acesso fica registado na atividade.",
  acesso: "reautenticacao",
});
rota("patch", "/plataformas/:id/logotipo", {
  tag: "Plataformas",
  resumo: "Atualizar o logótipo",
  acesso: "admin",
  corpo: multipart({ campo: "logotipo", descricao: "PNG, JPEG ou WebP, até 2 MB (SVG não é aceite)." }),
});
crud("/plataformas", {
  tag: "Plataformas",
  nome: { singular: "plataforma", plural: "plataformas" },
  criar: plataformaValidator.criarPlataformaSchema,
  atualizar: plataformaValidator.atualizarPlataformaSchema,
});

// ── Servidores ──
rota("get", "/servidores/:id/password", {
  tag: "Servidores",
  resumo: "Revelar a password do servidor",
  descricao: "As listagens nunca incluem a password. O acesso fica registado na atividade.",
  acesso: "reautenticacao",
});
crud("/servidores", {
  tag: "Servidores",
  nome: { singular: "servidor", plural: "servidores" },
  criar: servidorValidator.criarServidorSchema,
  atualizar: servidorValidator.atualizarServidorSchema,
});

// ── Domínios, subdomínios e imagens ──
crud("/dominios", {
  tag: "Domínios",
  nome: { singular: "domínio", plural: "domínios" },
  criar: dominioValidator.criarDominioSchema,
  atualizar: dominioValidator.atualizarDominioSchema,
});
rota("get", "/subdominios", {
  tag: "Domínios",
  resumo: "Listar subdomínios",
  descricao: "Só leitura: os subdomínios são geridos através de `subdominios` no sistema.",
});
rota("get", "/subdominios/:id", { tag: "Domínios", resumo: "Obter subdomínio" });
crud("/imagens", {
  tag: "Imagens de container",
  nome: { singular: "imagem", plural: "imagens" },
  criar: imagemValidator.criarImagemSchema,
  atualizar: imagemValidator.atualizarImagemSchema,
});

// ─── DOCUMENTO ───────────────────────────────────────────────────────────────

const DESCRICAO = `API do Repositório Digital da Netline: documentos e aprovações, sistemas e a sua infraestrutura, plataformas, servidores, domínios, utilizadores e notificações.

## Como testar aqui
1. Abra **Autenticação → POST /api/v1/auth/login**, clique em **Try it out** e inicie sessão. O browser guarda o cookie da sessão e envia-o sozinho nos pedidos seguintes.
2. Para os dados sensíveis (credenciais, passwords, tokens), faça **POST /api/v1/auth/reautenticar** e cole o \`data.tokenElevado\` em **Authorize → tokenElevado**. É válido 3 minutos.

Fora do browser (Postman, scripts), envie o token no cabeçalho \`Authorization: Bearer <token>\`.

## Formato das respostas
Todas as respostas seguem \`{ sucesso, mensagem, data }\`. Nos erros de validação (422), \`data\` é a lista \`[{ campo, mensagem }]\`. As mensagens vêm em português ou inglês, conforme o cabeçalho \`Accept-Language\` (\`pt\` ou \`en\`).`;

function gerarEspecificacao() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Repositório Digital da Netline — API",
      version: process.env.APP_VERSION || "dev",
      description: DESCRICAO,
    },
    servers: [{ url: "/" }],
    tags: [
      { name: "Sistema", description: "Estado e versão da API." },
      { name: "Autenticação", description: "Sessão, palavra-passe e reautenticação para dados sensíveis." },
      { name: "Utilizadores", description: "Gestão de utilizadores (ADMIN) e preferências da própria conta." },
      { name: "Documentos", description: "Envio, aprovação, lixeira e restauro de documentos." },
      { name: "Categorias", description: "Categorias dos documentos (as sensíveis têm acesso restrito)." },
      { name: "Atividade", description: "Registo de auditoria das ações dos utilizadores." },
      { name: "Notificações", description: "Notificações do utilizador da sessão." },
      { name: "Sistemas", description: "Sistemas desenvolvidos e os seus subdomínios." },
      { name: TAG_INFRA, description: "Infraestrutura e credenciais de cada sistema por ambiente. Exige reautenticação." },
      { name: "Plataformas", description: "Clouds, bases de dados, registries de containers e gestão de domínios." },
      { name: "Servidores", description: "Servidores das plataformas. A password só é revelada com reautenticação." },
      { name: "Domínios", description: "Domínios e subdomínios." },
      { name: "Imagens de container", description: "Imagens publicadas nos registries das plataformas de containerização." },
    ],
    paths,
    components: {
      securitySchemes: {
        cookieSessao: {
          type: "apiKey",
          in: "cookie",
          name: "netline_sessao",
          description: "Definido por POST /api/v1/auth/login. No browser é enviado automaticamente.",
        },
        bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "O mesmo token da sessão, para o Postman ou scripts." },
        tokenElevado: {
          type: "apiKey",
          in: "header",
          name: "X-Token-Elevado",
          description: "Devolvido por POST /api/v1/auth/reautenticar. Válido 3 minutos.",
        },
      },
      schemas: {
        Resposta: {
          type: "object",
          properties: {
            sucesso: { type: "boolean", examples: [true] },
            mensagem: { type: ["string", "null"] },
            data: { description: "Conteúdo da resposta (objeto, lista ou null)." },
          },
        },
        Erro: {
          type: "object",
          properties: {
            sucesso: { type: "boolean", examples: [false] },
            mensagem: { type: "string" },
            data: {},
          },
        },
        ErroValidacao: {
          type: "object",
          properties: {
            sucesso: { type: "boolean", examples: [false] },
            mensagem: { type: "string" },
            data: {
              type: "array",
              items: {
                type: "object",
                properties: { campo: { type: "string" }, mensagem: { type: "string" } },
              },
            },
          },
        },
      },
    },
  };
}

module.exports = { gerarEspecificacao };
