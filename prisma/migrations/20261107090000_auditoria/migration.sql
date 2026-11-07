-- Auditoria: um registo por pedido à API, só visível para os administradores.
-- Não substitui a tabela Atividade (o "Atividade recente" continua igual).

-- CreateTable
CREATE TABLE `auditoria` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `usuarioId` INTEGER NULL,
    `usuarioNome` VARCHAR(255) NULL,
    `usuarioEmail` VARCHAR(255) NULL,
    `perfilNome` VARCHAR(255) NULL,
    `acao` VARCHAR(30) NOT NULL,
    `funcionalidade` VARCHAR(100) NULL,
    `recursoId` VARCHAR(100) NULL,
    `metodo` VARCHAR(10) NOT NULL,
    `caminho` VARCHAR(1000) NOT NULL,
    `estado` INTEGER NOT NULL,
    `duracaoMs` INTEGER NOT NULL,
    `ip` VARCHAR(64) NULL,
    `userAgent` VARCHAR(500) NULL,
    `detalhes` JSON NULL,

    INDEX `auditoria_criadoEm_idx`(`criadoEm`),
    INDEX `auditoria_usuarioId_idx`(`usuarioId`),
    INDEX `auditoria_acao_idx`(`acao`),
    INDEX `auditoria_funcionalidade_idx`(`funcionalidade`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
