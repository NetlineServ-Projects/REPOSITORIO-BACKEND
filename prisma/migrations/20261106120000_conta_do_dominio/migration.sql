-- Um domínio pertence a uma plataforma e a uma das contas dessa plataforma (a instituição:
-- a Netline ou um cliente que gerimos). Opcional: os domínios que já existem ficam sem conta.
-- Se a conta for apagada, o domínio fica sem conta (não é apagado).

-- AlterTable
ALTER TABLE `dominios` ADD COLUMN `acessoId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `dominios_acessoId_idx` ON `dominios`(`acessoId`);

-- AddForeignKey
ALTER TABLE `dominios` ADD CONSTRAINT `dominios_acessoId_fkey` FOREIGN KEY (`acessoId`) REFERENCES `plataforma_acessos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
