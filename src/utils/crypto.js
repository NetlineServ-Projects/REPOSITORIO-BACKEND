const crypto = require("crypto");

const ALGORITMO = "aes-256-gcm";
const TAMANHO_IV = 12; // 12 bytes é o recomendado para GCM (não 16, como noutros modos)

function obterChave() {
  const chaveHex = process.env.ENCRYPTION_KEY;

  if (!chaveHex) {
    throw new Error(
      "ENCRYPTION_KEY não está definida nas variáveis de ambiente."
    );
  }

  const chave = Buffer.from(chaveHex, "hex");

  if (chave.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY inválida: deve ter 32 bytes (64 caracteres em hex) para AES-256."
    );
  }

  return chave;
}

/**
 * Encripta um texto simples e devolve uma única string,
 * pronta para gravar num campo String/Text da base de dados.
 * Formato: iv:authTag:conteudoEncriptado (tudo em hexadecimal)
 */
function encriptar(textoPlano) {
  if (textoPlano === null || textoPlano === undefined || textoPlano === "") {
    return null;
  }

  const chave = obterChave();
  const iv = crypto.randomBytes(TAMANHO_IV);

  const cifra = crypto.createCipheriv(ALGORITMO, chave, iv);

  const encriptado = Buffer.concat([
    cifra.update(String(textoPlano), "utf8"),
    cifra.final(),
  ]);

  const authTag = cifra.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encriptado.toString("hex"),
  ].join(":");
}

/**
 * Reverte o processo acima. Recebe a string gravada na base de dados
 * e devolve o texto original.
 */
function desencriptar(textoEncriptado) {
  if (!textoEncriptado) {
    return null;
  }

  const partes = textoEncriptado.split(":");

  if (partes.length !== 3) {
    throw new Error("Formato de valor encriptado inválido.");
  }

  const [ivHex, authTagHex, dadosHex] = partes;

  const chave = obterChave();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const dados = Buffer.from(dadosHex, "hex");

  const decifra = crypto.createDecipheriv(ALGORITMO, chave, iv);
  decifra.setAuthTag(authTag);

  const decriptado = Buffer.concat([
    decifra.update(dados),
    decifra.final(),
  ]);

  return decriptado.toString("utf8");
}
/**
 * Hash determinístico (HMAC-SHA256) de um IP, usado SÓ para garantir unicidade
 * (@@unique([plataformaId, ipHash])), porque o IP encriptado muda a cada
 * encriptação (IV aleatório). A subchave é derivada da ENCRYPTION_KEY, por isso
 * não é preciso nenhuma variável de ambiente nova.
 */
function hashIp(ip) {
  const subchave = crypto
    .createHmac("sha256", obterChave())
    .update("hash-ip-servidor")
    .digest();

  const normalizado = String(ip).trim().toLowerCase();

  return crypto.createHmac("sha256", subchave).update(normalizado).digest("hex");
}

module.exports = { encriptar, desencriptar, hashIp, obterChave };
