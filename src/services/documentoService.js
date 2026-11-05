const prisma = require("../config/prisma");
const MSG = require("../utils/messages");
const HTTP_STATUS = require("../utils/httpsStatus");
const AppError = require("../utils/AppError");
const { parseId, formatarDocumento } = require("../utils/fileHelper");
const atividadeService = require("./atividadeService");
const notificacaoService = require("./notificacaoService");
const { PERMISSOES, temPermissao } = require("../constants/permissoes");

const includePadrao = {
  categoria: true,
  usuario: {
    select: { id: true, nome: true, email: true },
  },
  // Documentos anexados a partir de um sistema dizem a que sistema pertencem
  sistema: {
    select: { id: true, nome: true },
  },
};

// ---------------------------------------------------------------------------
// Funções auxiliares pequenas — cada uma responde a UMA pergunta.
// Não tocam na base de dados; só calculam valores a partir dos dados recebidos.
// ---------------------------------------------------------------------------

// Quem aprova documentos publica imediatamente; os outros ficam a aguardar aprovação
function podeAprovar(usuario) {
  return temPermissao(usuario, PERMISSOES.DOCUMENTOS_APROVAR);
}

function estadoInicialParaCriacao(usuario) {
  return podeAprovar(usuario) ? "APROVADO" : "PENDENTE";
}

function acaoDeCriacao(usuario, nomeSistema) {
  const base = podeAprovar(usuario) ? "publicou o documento" : "submeteu o documento";
  return nomeSistema ? `${base} no sistema "${nomeSistema}"` : base;
}

function calcularMudancaEstado(dados, usuario) {
  if (!dados.estado) return {};
  if (!podeAprovar(usuario)) throw new AppError(MSG.AUTH.FORBIDDEN, HTTP_STATUS.FORBIDDEN);

  const estado = dados.estado.toUpperCase();
  const resultado = { estado };
  if (estado === "REJEITADO") {
    resultado.motivoRejeicao = dados.motivoRejeicao || "Não especificado";
  }
  return resultado;
}

function calcularRestauro(dados, usuario) {
  if (dados.apagadoEm !== null) return {};
  if (!temPermissao(usuario, PERMISSOES.DOCUMENTOS_LIXEIRA)) throw new AppError(MSG.AUTH.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
  return { apagadoEm: null };
}

function calcularEdicaoCampos(dados) {
  const resultado = {};
  if (dados.titulo) resultado.titulo = dados.titulo;
  if (dados.descricao !== undefined) resultado.descricao = dados.descricao;
  if (dados.categoriaId) resultado.categoriaId = parseId(dados.categoriaId, MSG.VALIDATION.INVALID_ID);
  return resultado;
}

function acaoDeAtualizacao(dadosParaAtualizar) {
  if (dadosParaAtualizar.estado === "APROVADO") return "aprovou o documento";
  if (dadosParaAtualizar.estado === "REJEITADO") return "rejeitou o documento";
  if (dadosParaAtualizar.apagadoEm === null) return "restaurou o documento";
  return null; // edição de titulo/descricao/categoria não gera atividade
}

// ---------------------------------------------------------------------------
// Operações principais
// ---------------------------------------------------------------------------

exports.criarDocumento = async (dados, usuario) => {
  if (!dados.categoriaId) {
    throw new AppError(MSG.VALIDATION.CATEGORIA_REQUIRED, HTTP_STATUS.BAD_REQUEST);
  }

  const categoriaIdNum = parseId(dados.categoriaId, MSG.VALIDATION.INVALID_ID);
  const usuarioIdNum = parseId(usuario.id || usuario.usuarioId, MSG.VALIDATION.INVALID_ID);
  const sistemaIdNum = dados.sistemaId ? parseId(dados.sistemaId, MSG.VALIDATION.INVALID_ID) : undefined;

  const novoDocumento = await prisma.$transaction(async (tx) => {
    const documento = await tx.documento.create({
      data: {
        titulo: dados.titulo || dados.nomeArquivo,
        descricao: dados.descricao || "",
        nomeArquivo: dados.nomeArquivo,
        caminho: dados.caminho,
        tipoArquivo: dados.tipoArquivo,
        tamanho: BigInt(dados.tamanho || 0),
        categoriaId: categoriaIdNum,
        usuarioId: usuarioIdNum,
        estado: estadoInicialParaCriacao(usuario),
        ...(sistemaIdNum && { sistemaId: sistemaIdNum }),
      },
      include: includePadrao,
    });

    await atividadeService.registrar(tx, {
      usuarioId: usuarioIdNum,
      acao: acaoDeCriacao(usuario, documento.sistema?.nome),
      documentoId: documento.id,
      sistemaId: documento.sistemaId ?? undefined,
    });

    // Um documento à espera de aprovação avisa quem aprova, para ir ao painel de aprovações
    if (documento.estado === "PENDENTE") {
      await notificacaoService.notificarComPermissao(tx, PERMISSOES.DOCUMENTOS_APROVAR, {
        tipo: "DOCUMENTO_SUBMETIDO",
        // O admin vê logo a que sistema o documento pertence
        referencia: documento.sistema ? `${documento.titulo} · ${documento.sistema.nome}` : documento.titulo,
        documentoId: documento.id,
        excetoUsuarioId: usuarioIdNum,
      });
    }

    return documento;
  });

  return formatarDocumento(novoDocumento);
};

// Categorias sensíveis: só quem tem documentos.sensiveis. Pendentes e rejeitados dos outros:
// só quem aprova. Os restantes veem os publicados (APROVADO) e os que eles próprios submeteram.
// Documentos na lixeira: só quem tem documentos.lixeira.
function podeVerDocumento(documento, usuario) {
  if (documento.apagadoEm && !temPermissao(usuario, PERMISSOES.DOCUMENTOS_LIXEIRA)) return false;
  if (documento.categoria?.sensivel && !temPermissao(usuario, PERMISSOES.DOCUMENTOS_SENSIVEIS)) return false;
  if (podeAprovar(usuario)) return true;
  return documento.estado === "APROVADO" || documento.usuarioId === Number(usuario.id);
}

// Também usada para servir os ficheiros em /uploads (middleware ficheirosProtegidos)
exports.podeVerDocumento = podeVerDocumento;

// As mesmas regras do podeVerDocumento, em forma de filtro Prisma (sem a lixeira).
// Também usada na lista de documentos do detalhe de um sistema.
function filtroVisibilidade(usuario) {
  const where = {};
  if (!temPermissao(usuario, PERMISSOES.DOCUMENTOS_SENSIVEIS)) where.categoria = { sensivel: false };
  if (!podeAprovar(usuario)) where.OR = [{ estado: "APROVADO" }, { usuarioId: Number(usuario.id) }];
  return where;
}

exports.filtroVisibilidade = filtroVisibilidade;

exports.listarDocumentos = async (usuario, apenasLixeira = false) => {
  if (apenasLixeira && !temPermissao(usuario, PERMISSOES.DOCUMENTOS_LIXEIRA)) {
    throw new AppError(MSG.AUTH.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
  }

  const where = { ...filtroVisibilidade(usuario), apagadoEm: apenasLixeira ? { not: null } : null };

  const documentos = await prisma.documento.findMany({
    where,
    include: includePadrao,
    orderBy: apenasLixeira ? { apagadoEm: "desc" } : { dataSubmissao: "desc" },
  });

  return documentos.map(formatarDocumento);
};

exports.buscarDocumentoPorId = async (id, usuario) => {
  const idNum = parseId(id, MSG.VALIDATION.INVALID_ID);

  const documento = await prisma.documento.findUnique({
    where: { id: idNum },
    include: includePadrao,
  });

  if (!documento) throw new AppError(MSG.DOCUMENTO.NOT_FOUND, HTTP_STATUS.NOT_FOUND);

  if (!podeVerDocumento(documento, usuario)) {
    throw new AppError(MSG.DOCUMENTO.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  return formatarDocumento(documento);
};

// Atualização parcial: título, descrição, categoria, e/ou estado (aprovar/rejeitar/restaurar).
// usuarioAtual precisa de { id, nome } — o id vai para a Atividade, o nome não é usado aqui
// (fica disponível para quem chamar, se precisar de o mostrar antes de ter a resposta).
exports.atualizarDocumento = async (id, dados, usuarioAtual) => {
  const idNum = parseId(id, MSG.VALIDATION.INVALID_ID);
  const usuarioIdNum = parseId(usuarioAtual.id, MSG.VALIDATION.INVALID_ID);

  const documentoAtualizado = await prisma.$transaction(async (tx) => {
    const documentoExiste = await tx.documento.findUnique({
      where: { id: idNum },
      include: { categoria: { select: { sensivel: true } } },
    });
    // Quem não pode ver o documento também não o pode alterar (e não fica a saber que existe)
    if (!documentoExiste || !podeVerDocumento(documentoExiste, usuarioAtual)) {
      throw new AppError(MSG.DOCUMENTO.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }
    // Editar título, descrição ou categoria: quem submeteu ou quem aprova
    const editaCampos = ["titulo", "descricao", "categoriaId"].some((c) => dados[c] !== undefined);
    if (editaCampos && documentoExiste.usuarioId !== usuarioIdNum && !podeAprovar(usuarioAtual)) {
      throw new AppError(MSG.AUTH.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
    }

    const dadosParaAtualizar = {
      ...calcularMudancaEstado(dados, usuarioAtual),
      ...calcularRestauro(dados, usuarioAtual),
      ...calcularEdicaoCampos(dados),
    };

    const documento = await tx.documento.update({
      where: { id: idNum },
      data: dadosParaAtualizar,
      include: includePadrao,
    });

    const acao = acaoDeAtualizacao(dadosParaAtualizar);
    if (acao) {
      await atividadeService.registrar(tx, { usuarioId: usuarioIdNum, acao, documentoId: documento.id });
    }

    // Quem submeteu fica a saber da decisão (com o motivo, se for rejeitado)
    const decisao = dadosParaAtualizar.estado;
    const mudouDeEstado = decisao && decisao !== documentoExiste.estado;
    if (mudouDeEstado && ["APROVADO", "REJEITADO"].includes(decisao) && documento.usuarioId !== usuarioIdNum) {
      await notificacaoService.notificarUsuario(tx, {
        usuarioId: documento.usuarioId,
        tipo: decisao === "APROVADO" ? "DOCUMENTO_APROVADO" : "DOCUMENTO_REJEITADO",
        referencia: documento.titulo,
        mensagem: decisao === "REJEITADO" ? documento.motivoRejeicao : null,
        documentoId: documento.id,
      });
    }

    return documento;
  });

  return formatarDocumento(documentoAtualizado);
};

exports.eliminarDocumento = async (id, definitivo = false, usuarioAtual) => {
  const idNum = parseId(id, MSG.VALIDATION.INVALID_ID);
  const usuarioIdNum = usuarioAtual ? parseId(usuarioAtual.id, MSG.VALIDATION.INVALID_ID) : null;

  await prisma.$transaction(async (tx) => {
    const documentoExiste = await tx.documento.findUnique({
      where: { id: idNum },
      include: { categoria: { select: { sensivel: true } } },
    });
    if (!documentoExiste) throw new AppError(MSG.DOCUMENTO.NOT_FOUND, HTTP_STATUS.NOT_FOUND);

    // Mover para a lixeira: documentos.eliminar. Eliminar de vez: documentos.lixeira
    const permissao = definitivo ? PERMISSOES.DOCUMENTOS_LIXEIRA : PERMISSOES.DOCUMENTOS_ELIMINAR;
    if (!temPermissao(usuarioAtual, permissao)) throw new AppError(MSG.AUTH.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
    if (!podeVerDocumento(documentoExiste, usuarioAtual)) {
      throw new AppError(MSG.DOCUMENTO.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    if (definitivo) {
      if (!documentoExiste.apagadoEm) {
        throw new AppError(
          "O documento precisa de estar na lixeira antes de ser eliminado definitivamente.",
          HTTP_STATUS.BAD_REQUEST
        );
      }
      await tx.documento.delete({ where: { id: idNum } });
    } else {
      await tx.documento.update({ where: { id: idNum }, data: { apagadoEm: new Date() } });
    }

    if (usuarioIdNum) {
      await atividadeService.registrar(tx, {
        usuarioId: usuarioIdNum,
        acao: definitivo ? "eliminou definitivamente o documento" : "moveu para a lixeira o documento",
        // se o delete foi definitivo, o documento já não existe — não há documentoId válido para ligar
        documentoId: definitivo ? null : idNum,
      });
    }
  });

  return true;
};