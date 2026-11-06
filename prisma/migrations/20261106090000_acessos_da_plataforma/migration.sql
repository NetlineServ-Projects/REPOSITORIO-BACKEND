-- Uma plataforma passa a poder ter várias contas de acesso (utilizador + token),
-- ex: a conta da Netline e a de um cliente que gerimos. O utilizador e o token que cada
-- plataforma já tinha passam para a tabela nova como "Conta principal": nada se perde.

-- CreateTable
CREATE TABLE `plataforma_acessos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `descricao` VARCHAR(255) NULL,
    `utilizador` VARCHAR(255) NULL,
    `tokenCifrado` TEXT NULL,
    `plataformaId` INTEGER NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `plataforma_acessos_plataformaId_idx`(`plataformaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `plataforma_acessos` ADD CONSTRAINT `plataforma_acessos_plataformaId_fkey` FOREIGN KEY (`plataformaId`) REFERENCES `plataformas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Copia as credenciais que já existiam (o token continua cifrado, tal como estava)
INSERT INTO `plataforma_acessos` (`descricao`, `utilizador`, `tokenCifrado`, `plataformaId`, `criadoEm`, `atualizadoEm`)
SELECT 'Conta principal', `utilizador`, `tokenCifrado`, `id`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `plataformas`
WHERE (`utilizador` IS NOT NULL AND `utilizador` <> '') OR `tokenCifrado` IS NOT NULL;

-- AlterTable: só depois da cópia
ALTER TABLE `plataformas` DROP COLUMN `tokenCifrado`,
    DROP COLUMN `utilizador`;
