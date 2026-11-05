// E-mails institucionais: só os domínios da empresa podem ter conta.
//
//   EMAIL_DOMINIOS_PERMITIDOS  domínios aceites, separados por vírgulas (por omissão: netline.co.mz)
//   LOGIN_SO_EMAIL_INSTITUCIONAL  "true" para o login também recusar outros domínios. Fica desligado
//                                 até as contas antigas (ex.: @gmail.com) mudarem para o e-mail da
//                                 empresa; senão essas pessoas, incluindo administradores, deixam de entrar.

function dominiosPermitidos() {
    return (process.env.EMAIL_DOMINIOS_PERMITIDOS || "netline.co.mz")
        .split(",")
        .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
        .filter(Boolean);
}

function ehEmailInstitucional(email) {
    const dominio = String(email || "").trim().toLowerCase().split("@")[1];
    return Boolean(dominio) && dominiosPermitidos().includes(dominio);
}

function loginExigeEmailInstitucional() {
    return process.env.LOGIN_SO_EMAIL_INSTITUCIONAL === "true";
}

// Para as mensagens: "@netline.co.mz" ou "@a.co.mz ou @b.co.mz"
function descricaoDominios() {
    return dominiosPermitidos().map((d) => `@${d}`).join(" ou ");
}

module.exports = { ehEmailInstitucional, loginExigeEmailInstitucional, descricaoDominios };
