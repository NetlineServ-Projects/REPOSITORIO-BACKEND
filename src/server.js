require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");
const prisma = require("./config/prisma");

const { validarEnvVars } = require("./utils/fileHelper");
const { obterChave } = require("./utils/crypto");

// Falha rápido se alguma variável de ambiente crítica estiver em falta.
// Melhor detectar no arranque do que quando a primeira chamada chegar.
validarEnvVars(["DATABASE_URL", "JWT_SECRET", "ENCRYPTION_KEY"]);
// A ENCRYPTION_KEY também tem de ter o formato certo (64 caracteres hex)
obterChave();

const languageMiddleware = require("./middlewares/i18n");

// Importa as rotas
const routesV1 = require("./routes/v1");

// Importa o middleware de erro
const errorMiddleware = require("./middlewares/errorMiddleware");
const authMiddleware = require("./middlewares/authMiddleware");
const autorizarFicheiro = require("./middlewares/ficheirosProtegidos");

const app = express();

// Configurações Globais
app.use(
    cors({
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        credentials: true,
    })
);
app.use(express.json());
app.use(cookieParser()); // lê o cookie da sessão (netline_sessao)
app.use(languageMiddleware);

// As pastas dos ficheiros enviados não estão no Git (os ficheiros são dados, não código):
// criam-se aqui, para um clone novo ou um volume vazio funcionar logo
for (const pasta of ["avatars", "documentos", "plataformas"]) {
    try {
        fs.mkdirSync(path.join(__dirname, "..", "uploads", pasta), { recursive: true });
    } catch (erro) {
        // Não impede a API de arrancar; só os envios para essa pasta vão falhar
        console.error(`Não foi possível criar uploads/${pasta} (${erro.code}). Verifique as permissões da pasta uploads.`);
    }
}

// Ficheiros enviados: só com sessão iniciada e, nos documentos, só para quem os pode ver.
// O browser envia o cookie da sessão sozinho em <img>, links e no visualizador de PDF.
app.use(
    "/uploads",
    authMiddleware,
    autorizarFicheiro,
    express.static(path.join(__dirname, "..", "uploads"), { index: false, dotfiles: "deny" })
);

// Rota base
app.get("/", (req, res) => {
    res.status(200).json({
        mensagem: "API do Repositório Netline funcionando com sucesso!",
    });
});

// Rotas da API v1
app.use("/api/v1", routesV1);

// Middleware de tratamento de erros — SEMPRE por último
app.use(errorMiddleware);

// Configuração da porta e inicialização do servidor
const PORT = process.env.PORT || 3000;

const servidor = app.listen(PORT, () => {
    console.log(`Servidor iniciado com sucesso na porta ${PORT}`);
});

// Paragem ordenada (docker stop, deploy): deixa de aceitar pedidos, termina os que estão
// a meio e fecha a ligação à base de dados. No contentor o node é o processo 1 e, sem isto,
// ignorava o sinal até o Docker o matar à força.
function terminar(sinal) {
    console.log(`${sinal} recebido: a terminar...`);
    servidor.close(async () => {
        await prisma.$disconnect().catch(() => {});
        process.exit(0);
    });
    // Se algum pedido ficar preso, não espera para sempre
    setTimeout(() => process.exit(1), 8000).unref();
}
process.on("SIGTERM", () => terminar("SIGTERM"));
process.on("SIGINT", () => terminar("SIGINT"));