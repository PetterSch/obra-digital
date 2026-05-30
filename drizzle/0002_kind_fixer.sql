CREATE TABLE `acesso_obra` (
	`id` int AUTO_INCREMENT NOT NULL,
	`obraId` int NOT NULL,
	`usuarioId` int NOT NULL,
	`permissao` enum('visualizar','editar','admin') NOT NULL DEFAULT 'visualizar',
	`ativo` boolean DEFAULT true,
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	`atualizadoEm` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `acesso_obra_id` PRIMARY KEY(`id`)
);
