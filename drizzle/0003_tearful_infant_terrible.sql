CREATE TABLE `equipes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`empresa` varchar(255) NOT NULL,
	`cnpj` varchar(18),
	`contato` varchar(255),
	`telefone` varchar(20),
	`email` varchar(255),
	`ativo` boolean DEFAULT true,
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	`atualizadoEm` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `equipes_id` PRIMARY KEY(`id`),
	CONSTRAINT `equipes_cnpj_unique` UNIQUE(`cnpj`)
);
--> statement-breakpoint
ALTER TABLE `colaboradores` ADD `equipeId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `colaboradores` DROP COLUMN `obraId`;