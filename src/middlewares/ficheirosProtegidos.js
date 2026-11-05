const prisma = require("../config/prisma");
const HTTP = require("../utils/httpsStatus");
const MSG = require("../utils/messages");
const { podeVerDocumento } = require("../services/documentoService");

// Pastas com ficheiros da interface (logótipos de plataformas, fotografias de perfil):
// qualquer utilizador com sessão os pode ver. Tudo o resto são documentos.
const PASTAS_DA_INTERFACE = ["plataformas", "avatars"];

const naoEncontrado = (res) => res.status(HTTP.NOT_FOUND).json({ mensagem: MSG.DOCUMENTO.NOT_FOUND });

// Corre depois do authMiddleware e antes do express.static de /uploads. Um documento só é
// servido a quem o pode ver na API (mesmas regras: categorias sensíveis, pendentes, lixeira).
// Responde 404 e não 403, para não confirmar que o ficheiro existe.
async function autorizarFicheiro(req, res, next) {
  try {
    let relativo;
    try {
      relativo = decodeURIComponent(req.path).replace(/^\/+/, "");
    } catch {
      return naoEncontrado(res);
    }
    if (!relativo || relativo.includes("..") || relativo.includes("\\")) return naoEncontrado(res);

    const pasta = relativo.includes("/") ? relativo.split("/")[0] : null;
    if (PASTAS_DA_INTERFACE.includes(pasta)) return next();

    const documento = await prisma.documento.findFirst({
      where: { caminho: { in: [`uploads/${relativo}`, `/uploads/${relativo}`] } },
      include: { categoria: { select: { sensivel: true } } },
    });

    // Inclui a lixeira: só quem tem documentos.lixeira vê os que lá estão
    if (!documento || !podeVerDocumento(documento, req.user)) return naoEncontrado(res);

    // O browser não deve guardar cópias partilhadas de um ficheiro protegido
    res.set("Cache-Control", "private, no-store");
    // ?transferir=1: o browser grava o ficheiro com o nome original em vez de o abrir.
    // O atributo "download" dos links não chega: o browser ignora-o noutra origem (a API)
    if (req.query.transferir) res.attachment(documento.nomeArquivo || relativo.split("/").pop());
    next();
  } catch (erro) {
    next(erro);
  }
}

module.exports = autorizarFicheiro;
