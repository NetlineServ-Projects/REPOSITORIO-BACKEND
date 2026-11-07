const auditoriaService = require("../services/auditoriaService");

// Pedidos que não se registam: só geram ruído (verificação de saúde, contagem de
// notificações que o frontend pede a cada minuto, documentação e pré-pedidos CORS)
const IGNORAR = [
  /^\/api\/v1\/health(\/|$)/,
  /^\/api\/v1\/notificacoes\/contagem$/,
  /^\/api\/v1\/docs/,
];

// Por trás do proxy (Coolify/Traefik) o IP real vem no X-Forwarded-For
function obterIp(req) {
  const encaminhado = req.headers["x-forwarded-for"];
  if (typeof encaminhado === "string" && encaminhado.trim()) return encaminhado.split(",")[0].trim();
  return req.socket?.remoteAddress ?? null;
}

// Só o nome, o tipo e o tamanho dos ficheiros enviados (nunca o conteúdo)
function resumirFicheiros(req) {
  const lista = req.file ? [req.file] : Array.isArray(req.files) ? req.files : Object.values(req.files ?? {}).flat();
  return lista.map((f) => ({ nome: f.originalname, tipo: f.mimetype, tamanho: f.size }));
}

// Regista cada pedido quando a resposta termina (ou a ligação cai), sem atrasar a resposta.
// Vai antes das rotas; o req.user, posto depois pelo authMiddleware, já existe nessa altura.
function auditoria(req, res, next) {
  if (req.method === "OPTIONS") return next();

  const caminho = req.originalUrl || req.url;
  const semQuery = caminho.split("?")[0];
  if (IGNORAR.some((padrao) => padrao.test(semQuery))) return next();

  const inicio = process.hrtime.bigint();
  let registado = false;

  const registar = () => {
    if (registado) return;
    registado = true;

    const duracaoMs = Number(process.hrtime.bigint() - inicio) / 1e6;
    const ehLogin = semQuery === "/api/v1/auth/login";

    // Fora do ciclo do pedido: a gravação não bloqueia nada
    setImmediate(() => {
      auditoriaService.registar({
        metodo: req.method,
        caminho: semQuery,
        // Sem resposta enviada (ligação cortada pelo cliente): 499, como no nginx
        estado: res.headersSent ? res.statusCode : 499,
        duracaoMs,
        ip: obterIp(req),
        userAgent: req.headers["user-agent"],
        usuario: req.user ?? null,
        emailLogin: ehLogin ? req.body?.email : undefined,
        query: req.query,
        corpo: req.body,
        ficheiros: resumirFicheiros(req),
      });
    });
  };

  res.on("finish", registar);
  res.on("close", registar);
  next();
}

module.exports = auditoria;
