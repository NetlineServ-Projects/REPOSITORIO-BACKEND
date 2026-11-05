-- Perfis de acesso configuráveis (substituem o enum ADMIN/FUNCIONARIO).
-- Os ADMIN passam a Administrador e os FUNCIONARIO a Programador, que tem exatamente
-- os acessos que um funcionário tinha: ninguém ganha nem perde acesso com esta migração.

-- CreateTable
CREATE TABLE `PerfilAcesso` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(191) NOT NULL DEFAULT '',
    `administrador` BOOLEAN NOT NULL DEFAULT false,
    `permissoes` JSON NOT NULL,
    `dataCriacao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PerfilAcesso_nome_key`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Perfis iniciais (os mesmos de src/constants/permissoes.js)
INSERT INTO `PerfilAcesso` (`id`, `nome`, `descricao`, `administrador`, `permissoes`) VALUES
    (1, 'Administrador', 'Acesso total, incluindo perfis e permissões.', true, JSON_ARRAY()),
    (2, 'Secretaria/RH', 'Documentos, sistemas e utilizadores, sem plataformas nem infraestrutura dos sistemas.', false,
        JSON_ARRAY('documentos.aprovar', 'documentos.eliminar', 'documentos.sensiveis', 'documentos.lixeira',
                   'sistemas.criar', 'sistemas.gerir', 'atividade.ver', 'utilizadores.gerir')),
    (3, 'Programador', 'Sistemas, infraestrutura e credenciais; plataformas só para consulta.', false,
        JSON_ARRAY('sistemas.criar', 'sistemas.infraestrutura.ver', 'sistemas.infraestrutura.gerir', 'infraestrutura.ver')),
    (4, 'Consultor', 'Sistemas, infraestrutura e credenciais; plataformas só para consulta.', false,
        JSON_ARRAY('sistemas.criar', 'sistemas.infraestrutura.ver', 'sistemas.infraestrutura.gerir', 'infraestrutura.ver'));

-- AlterTable: a coluna nova começa vazia, recebe o perfil equivalente e só depois fica obrigatória
ALTER TABLE `Usuario` ADD COLUMN `perfilId` INTEGER NULL;

UPDATE `Usuario` SET `perfilId` = CASE WHEN `perfil` = 'ADMIN' THEN 1 ELSE 3 END;

ALTER TABLE `Usuario` MODIFY `perfilId` INTEGER NOT NULL,
    DROP COLUMN `perfil`;

-- AddForeignKey
ALTER TABLE `Usuario` ADD CONSTRAINT `Usuario_perfilId_fkey` FOREIGN KEY (`perfilId`) REFERENCES `PerfilAcesso`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
