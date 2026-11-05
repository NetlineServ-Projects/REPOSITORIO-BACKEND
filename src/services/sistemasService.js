const prisma = require("../config/prisma");
const MSG = require("../utils/messages");
const HTTP_STATUS = require("../utils/httpsStatus");
const AppError = require("../utils/AppError");
const { parseId } = require("../utils/fileHelper");
const atividadeService = require("./atividadeService");
const {
    montarNomeCompleto,
    prepararSubdominiosDoSistema,
    gravarSubdominiosDoSistema,
} = require("./subdominioService");

const { PERMISSOES, temPermissao } = require("../constants/permissoes");
const { filtroVisibilidade } = require("./documentoService");

// O frontend, como o backend, só pode estar alojado numa plataforma Cloud (ex: Vercel)
const TIPO_PLATAFORMA_CLOUD = "CLOUD_BASE_DADOS";
const AMBIENTES = ["PRODUCAO", "TESTES"];

// Quem criou o sistema (só identificação)
const SELECT_CRIADOR = { select: { id: true, nome: true } };

// ─── SELECT EXPLÍCITO ────────────────────────────────────────────────────────
// Evita expor campos internos ou futuros acidentalmente.

// Plataforma onde está hospedado o frontend (ex: Vercel). Só dados de identificação.
const SELECT_PLATAFORMA_FRONTEND = {
    select: { id: true, nome: true, fornecedor: true, logotipo: true },
};

// Endereço público do sistema em cada ambiente (no máximo um por ambiente)
const SELECT_SUBDOMINIOS_DO_SISTEMA = {
    select: {
        id: true,
        ambiente: true,
        nome: true,
        tipoDns: true,
        destino: true,
        dominioId: true,
        servidorId: true,
        dominio: { select: { id: true, nome: true } },
    },
    orderBy: { ambiente: "asc" },
};

const SELECT_SISTEMA_LISTA = {
    id: true,
    nome: true,
    descricaoCurta: true,
    descricaoLonga: true,
    status: true,
    dataInicio: true,
    dataEntrega: true,
    desenvolvedores: true,
    empresasClientes: true,
    tecnologiasFrontend: true,
    tecnologiasBackend: true,
    tecnologiasInfraestrutura: true,
    repositorioUrl: true,
    urlProducao: true,
    urlTestes: true,
    plataformaFrontendId: true,
    plataformaFrontend: SELECT_PLATAFORMA_FRONTEND,
    subdominios: SELECT_SUBDOMINIOS_DO_SISTEMA,
    responsavelTecnico: true,
    versaoAtual: true,
    ativo: true,
    dataCriacao: true,
    criadoPorId: true,
    criadoPor: SELECT_CRIADOR,
    _count: { select: { documentos: true } },
};

const SELECT_SISTEMA_DETALHE = {
    id: true,
    nome: true,
    descricaoCurta: true,
    descricaoLonga: true,
    status: true,
    dataInicio: true,
    dataEntrega: true,
    desenvolvedores: true,
    empresasClientes: true,
    tecnologiasFrontend: true,
    tecnologiasBackend: true,
    tecnologiasInfraestrutura: true,
    repositorioUrl: true,
    urlProducao: true,
    urlTestes: true,
    plataformaFrontendId: true,
    plataformaFrontend: SELECT_PLATAFORMA_FRONTEND,
    subdominios: SELECT_SUBDOMINIOS_DO_SISTEMA,
    responsavelTecnico: true,
    versaoAtual: true,
    ativo: true,
    dataCriacao: true,
    criadoPorId: true,
    criadoPor: SELECT_CRIADOR,
    documentos: {
        select: {
            id: true,
            titulo: true,
            tipoArquivo: true,
            estado: true,
            dataSubmissao: true,
        },
        // Limita a documentos não apagados
        where: { apagadoEm: null },
        orderBy: { dataSubmissao: "desc" },
        take: 50,
    },
};

// ─── HELPERS INTERNOS ────────────────────────────────────────────────────────

/**
 * Mapeamento de status legível (vindo do formulário) para o valor do enum Prisma.
 * O schema já tem @map nos enums, mas o formulário envia o rótulo visível.
 */
const STATUS_PARA_ENUM = {
    "Em Desenvolvimento": "EM_DESENVOLVIMENTO",
    "Em Produção": "EM_PRODUCAO",
    "Manutenção": "MANUTENCAO",
};

function mapearStatus(status) {
    return STATUS_PARA_ENUM[status] ?? "EM_DESENVOLVIMENTO";
}

/**
 * Constrói o objecto de dados normalizado para criar/actualizar um sistema.
 * Centraliza aqui toda a lógica de normalização para não repetir nos dois sítios.
 *
 * urlTestes e plataformaFrontendId só entram quando vêm no pedido: assim, uma
 * edição que não os envia não apaga os valores que já existem. Enviar null remove-os.
 * Os subdomínios não são colunas do sistema: tratam-se à parte.
 */
function montarDadosSistema(dados) {
    return {
        nome: dados.nome,
        descricaoCurta: dados.descricaoCurta ?? null,
        descricaoLonga: dados.descricaoLonga ?? null,
        status: mapearStatus(dados.status),
        dataInicio: dados.dataInicio ? new Date(dados.dataInicio) : null,
        dataEntrega: dados.dataEntrega ? new Date(dados.dataEntrega) : null,
        desenvolvedores: dados.desenvolvedores ?? [],
        empresasClientes: dados.empresasClientes ?? [],
        tecnologiasFrontend: dados.tecnologiasFrontend ?? [],
        tecnologiasBackend: dados.tecnologiasBackend ?? [],
        tecnologiasInfraestrutura: dados.tecnologiasInfraestrutura ?? [],
        repositorioUrl: dados.repositorioUrl ?? null,
        urlProducao: dados.urlProducao ?? null,
        ...(dados.urlTestes !== undefined && { urlTestes: dados.urlTestes }),
        ...(dados.plataformaFrontendId !== undefined && {
            plataformaFrontendId: dados.plataformaFrontendId,
        }),
        responsavelTecnico: dados.responsavelTecnico ?? null,
        versaoAtual: dados.versaoAtual ?? null,
        ativo: dados.ativo !== undefined ? dados.ativo : true,
    };
}

/**
 * Confirma que a plataforma do frontend existe e não é de gestão de domínio.
 * Sem plataforma (undefined ou null) não há nada a validar.
 */
async function garantirPlataformaDoFrontend(plataformaId) {
    if (plataformaId === undefined || plataformaId === null) return;

    const plataforma = await prisma.plataforma.findUnique({
        where: { id: plataformaId },
        select: { id: true, tipo: true },
    });

    if (!plataforma) {
        throw new AppError(MSG.PLATAFORMA.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    if (plataforma.tipo !== TIPO_PLATAFORMA_CLOUD) {
        throw new AppError(MSG.SISTEMA.FRONTEND_PLATAFORMA_INVALIDA, HTTP_STATUS.CONFLICT);
    }
}

/**
 * Endereço de cada ambiente: o subdomínio registado tem prioridade;
 * sem ele, usa-se o URL escrito à mão (urlProducao / urlTestes).
 */
function montarUrlsAmbientes(subdominios, urlProducao, urlTestes) {
    const manual = { PRODUCAO: urlProducao, TESTES: urlTestes };

    return AMBIENTES.map((ambiente) => {
        const subdominio = subdominios.find((s) => s.ambiente === ambiente);
        const url = subdominio ? `https://${subdominio.nomeCompleto}` : manual[ambiente];
        return url ? { ambiente, url } : null;
    }).filter(Boolean);
}

// Campos dos subdomínios que são infraestrutura (destino DNS, servidor): só para quem a vê
function semDadosDeInfraestrutura({ tipoDns, destino, servidorId, ...subdominio }) {
    return subdominio;
}

/**
 * Formata um sistema: adiciona o nome completo dos subdomínios, os endereços
 * calculados e (nas listas) o totalDocumentos, e remove _count.
 */
function formatar(sistema, usuarioAtual) {
    const { _count, subdominios = [], ...resto } = sistema;
    const verInfraestrutura = temPermissao(usuarioAtual, PERMISSOES.SISTEMAS_INFRA_VER);

    const subdominiosComNome = subdominios.map((s) => ({
        ...(verInfraestrutura ? s : semDadosDeInfraestrutura(s)),
        nomeCompleto: montarNomeCompleto(s.nome, s.dominio.nome),
    }));

    return {
        ...resto,
        ...(_count && { totalDocumentos: _count.documentos }),
        subdominios: subdominiosComNome,
        urlsAmbientes: montarUrlsAmbientes(subdominiosComNome, resto.urlProducao, resto.urlTestes),
    };
}

// Valida e converte o id do utilizador (pode vir como string de req.user)
function resolverUsuarioId(usuarioAtual) {
    if (!usuarioAtual) return null;
    return parseId(usuarioAtual.id, MSG.VALIDATION.INVALID_ID);
}

/**
 * Quem criou o sistema (e ainda pode criar sistemas) edita-o e elimina-o. Quem tem
 * sistemas.gerir pode sempre, também os sistemas sem criador (antigos, ou de utilizadores eliminados).
 */
function garantirPodeGerir(sistema, usuarioAtual) {
    if (temPermissao(usuarioAtual, PERMISSOES.SISTEMAS_GERIR)) return;
    const ehCriador = sistema.criadoPorId !== null && sistema.criadoPorId === usuarioAtual?.id;
    if (ehCriador && temPermissao(usuarioAtual, PERMISSOES.SISTEMAS_CRIAR)) return;
    throw new AppError(MSG.SISTEMA.SEM_PERMISSAO, HTTP_STATUS.FORBIDDEN);
}

/**
 * O alojamento do frontend e os subdomínios (domínio, servidor, destino DNS) são infraestrutura:
 * quem não a gere pode criar e editar o sistema, mas estes campos são ignorados.
 */
function semCamposDeInfraestrutura(dados, usuarioAtual) {
    if (temPermissao(usuarioAtual, PERMISSOES.SISTEMAS_INFRA_GERIR)) return dados;
    const { plataformaFrontendId, subdominios, ...resto } = dados;
    return resto;
}

// ─── FUNÇÕES PÚBLICAS (exports funcionais, padrão do projecto) ──────────────

async function listarTodos(usuarioAtual) {
    const sistemas = await prisma.sistema.findMany({
        select: SELECT_SISTEMA_LISTA,
        orderBy: { dataCriacao: "desc" },
    });

    return sistemas.map((s) => formatar(s, usuarioAtual));
}

async function obterPorId(id, usuarioAtual) {
    const idNum = parseId(id, MSG.VALIDATION.INVALID_ID);

    // Os documentos do sistema seguem as mesmas regras de visibilidade da lista de documentos
    const sistema = await prisma.sistema.findUnique({
        where: { id: idNum },
        select: {
            ...SELECT_SISTEMA_DETALHE,
            documentos: {
                ...SELECT_SISTEMA_DETALHE.documentos,
                where: { ...SELECT_SISTEMA_DETALHE.documentos.where, ...filtroVisibilidade(usuarioAtual) },
            },
        },
    });

    if (!sistema) {
        throw new AppError(MSG.SISTEMA.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    return formatar(sistema, usuarioAtual);
}

// usuarioAtual precisa de { id } (vem de req.user no controller)
async function criar(dadosRecebidos, usuarioAtual) {
    const usuarioId = resolverUsuarioId(usuarioAtual);
    const dados = semCamposDeInfraestrutura(dadosRecebidos, usuarioAtual);

    await garantirPlataformaDoFrontend(dados.plataformaFrontendId);
    const subdominios = await prepararSubdominiosDoSistema(null, dados.subdominios);

    return prisma.$transaction(async (tx) => {
        const criado = await tx.sistema.create({
            data: { ...montarDadosSistema(dados), criadoPorId: usuarioId },
            select: { id: true },
        });

        await gravarSubdominiosDoSistema(tx, criado.id, subdominios);

        // Lê depois de gravar, para a resposta já trazer os subdomínios
        const novoSistema = await tx.sistema.findUnique({
            where: { id: criado.id },
            select: SELECT_SISTEMA_LISTA,
        });

        if (usuarioId) {
            await atividadeService.registrar(tx, {
                usuarioId,
                acao: `Criou o sistema "${novoSistema.nome}"`,
                sistemaId: novoSistema.id,
            });
        }

        return formatar(novoSistema, usuarioAtual);
    });
}

async function atualizar(id, dadosRecebidos, usuarioAtual) {
    const idNum = parseId(id, MSG.VALIDATION.INVALID_ID);
    const usuarioId = resolverUsuarioId(usuarioAtual);
    const dados = semCamposDeInfraestrutura(dadosRecebidos, usuarioAtual);

    await garantirPlataformaDoFrontend(dados.plataformaFrontendId);
    const subdominios = await prepararSubdominiosDoSistema(idNum, dados.subdominios);

    return prisma.$transaction(async (tx) => {
        const sistemaExiste = await tx.sistema.findUnique({
            where: { id: idNum },
            select: { id: true, nome: true, criadoPorId: true },
        });

        if (!sistemaExiste) {
            throw new AppError(MSG.SISTEMA.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
        }
        garantirPodeGerir(sistemaExiste, usuarioAtual);

        await tx.sistema.update({
            where: { id: idNum },
            data: montarDadosSistema(dados),
            select: { id: true },
        });

        await gravarSubdominiosDoSistema(tx, idNum, subdominios);

        const sistemaAtualizado = await tx.sistema.findUnique({
            where: { id: idNum },
            select: SELECT_SISTEMA_LISTA,
        });

        if (usuarioId) {
            await atividadeService.registrar(tx, {
                usuarioId,
                acao: `Atualizou o sistema "${sistemaAtualizado.nome}"`,
                sistemaId: sistemaAtualizado.id,
            });
        }

        return formatar(sistemaAtualizado, usuarioAtual);
    });
}

async function apagar(id, usuarioAtual) {
    const idNum = parseId(id, MSG.VALIDATION.INVALID_ID);
    const usuarioId = resolverUsuarioId(usuarioAtual);

    return prisma.$transaction(async (tx) => {
        const sistemaExiste = await tx.sistema.findUnique({
            where: { id: idNum },
            select: { id: true, nome: true, criadoPorId: true },
        });

        if (!sistemaExiste) {
            throw new AppError(MSG.SISTEMA.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
        }
        garantirPodeGerir(sistemaExiste, usuarioAtual);

        // Os subdomínios, a infraestrutura e as credenciais saem em cascata
        await tx.sistema.delete({ where: { id: idNum } });

        if (usuarioId) {
            // sistemaId fica de fora: o sistema já não existe depois do delete,
            // por isso o nome vai directamente no texto da acção.
            await atividadeService.registrar(tx, {
                usuarioId,
                acao: `Eliminou o sistema "${sistemaExiste.nome}"`,
            });
        }
    });
}

module.exports = {
    listarTodos,
    obterPorId,
    criar,
    atualizar,
    apagar,
};