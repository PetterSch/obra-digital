CREATE TABLE `acesso_cliente` (
	`id` int AUTO_INCREMENT NOT NULL,
	`obraId` int NOT NULL,
	`usuarioId` int NOT NULL,
	`tokenAcesso` varchar(255),
	`dataExpiracao` datetime,
	`ativo` boolean DEFAULT true,
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `acesso_cliente_id` PRIMARY KEY(`id`),
	CONSTRAINT `acesso_cliente_tokenAcesso_unique` UNIQUE(`tokenAcesso`)
);
--> statement-breakpoint
CREATE TABLE `atividades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`diarioId` int NOT NULL,
	`descricao` text NOT NULL,
	`local` varchar(255),
	`status` enum('nao_iniciada','em_andamento','concluida') DEFAULT 'em_andamento',
	`percentualConcluido` int DEFAULT 0,
	`prioridade` enum('baixa','media','alta') DEFAULT 'media',
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `atividades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `colaboradores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`obraId` int NOT NULL,
	`nome` varchar(255) NOT NULL,
	`cpf` varchar(14),
	`funcao` enum('servente','pedreiro','carpinteiro','armador','eletricista','encanador','pintor','encarregado','engenheiro') NOT NULL,
	`dataAdmissao` date,
	`dataDemissao` date,
	`ativo` boolean DEFAULT true,
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	`atualizadoEm` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `colaboradores_id` PRIMARY KEY(`id`),
	CONSTRAINT `colaboradores_cpf_unique` UNIQUE(`cpf`)
);
--> statement-breakpoint
CREATE TABLE `diarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`obraId` int NOT NULL,
	`data` date NOT NULL,
	`horarioInicio` varchar(5),
	`horarioFim` varchar(5),
	`responsavel` int NOT NULL,
	`clima` enum('ensolarado','nublado','chuvoso','tempestade','ventania'),
	`temperatura` decimal(5,1),
	`umidade` int,
	`observacoesGerais` longtext,
	`assinaturaMestre` varchar(500),
	`assinaturaEncarregado` varchar(500),
	`assinaturaCliente` varchar(500),
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	`atualizadoEm` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `diarios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `equipamentos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`diarioId` int NOT NULL,
	`nome` varchar(255) NOT NULL,
	`quantidade` int NOT NULL,
	`horasUso` decimal(8,2),
	`observacoes` text,
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `equipamentos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`usuarioId` int,
	`acao` varchar(100) NOT NULL,
	`tabela` varchar(100),
	`registroId` int,
	`dadosAntigos` json,
	`dadosNovos` json,
	`ipAddress` varchar(45),
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mao_de_obra` (
	`id` int AUTO_INCREMENT NOT NULL,
	`diarioId` int NOT NULL,
	`funcao` enum('servente','pedreiro','carpinteiro','armador','eletricista','encanador','pintor','encarregado','engenheiro') NOT NULL,
	`quantidade` int NOT NULL,
	`horasTrabalhadas` decimal(5,2),
	`faltas` int DEFAULT 0,
	`atrasos` int DEFAULT 0,
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mao_de_obra_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `materiais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`obraId` int NOT NULL,
	`nome` varchar(255) NOT NULL,
	`unidade` varchar(50) NOT NULL,
	`quantidade` decimal(12,3),
	`fornecedor` varchar(255),
	`observacoes` text,
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	`atualizadoEm` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `materiais_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `midia` (
	`id` int AUTO_INCREMENT NOT NULL,
	`obraId` int,
	`diarioId` int,
	`atividades` int,
	`tipo` enum('foto','documento') NOT NULL,
	`descricao` text,
	`caminhoArmazenamento` varchar(500) NOT NULL,
	`nomeOriginal` varchar(255),
	`tamanhoBytes` int,
	`mimeType` varchar(100),
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `midia_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `movimentacao_materiais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`materialId` int NOT NULL,
	`diarioId` int,
	`tipo` enum('entrada','saida') NOT NULL,
	`quantidade` decimal(12,3) NOT NULL,
	`data` date NOT NULL,
	`observacoes` text,
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `movimentacao_materiais_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `obras` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigo` varchar(50) NOT NULL,
	`nome` varchar(255) NOT NULL,
	`cliente` varchar(255) NOT NULL,
	`endereco` text NOT NULL,
	`cidade` varchar(100) NOT NULL,
	`estado` varchar(2) NOT NULL,
	`cep` varchar(10) NOT NULL,
	`responsavelTecnico` varchar(255) NOT NULL,
	`crea` varchar(50),
	`dataInicio` date NOT NULL,
	`dataPrevistTermino` date NOT NULL,
	`dataTermino` date,
	`status` enum('planejamento','em_andamento','pausada','finalizada') NOT NULL DEFAULT 'planejamento',
	`valorContrato` decimal(15,2),
	`descricao` longtext,
	`capaCaminhoArmazenamento` varchar(500),
	`percentualAndamento` int DEFAULT 0,
	`criadoPor` int NOT NULL,
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	`atualizadoEm` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `obras_id` PRIMARY KEY(`id`),
	CONSTRAINT `obras_codigo_unique` UNIQUE(`codigo`)
);
--> statement-breakpoint
CREATE TABLE `ocorrencias` (
	`id` int AUTO_INCREMENT NOT NULL,
	`diarioId` int NOT NULL,
	`tipo` enum('atraso_material','falta_equipe','chuva','problema_projeto','acidente','nao_conformidade','interferencia','outro') NOT NULL,
	`descricao` longtext NOT NULL,
	`criticidade` enum('baixa','media','alta','critica') DEFAULT 'media',
	`responsavel` int,
	`prazoCorracao` date,
	`status` enum('aberta','em_andamento','resolvida','cancelada') DEFAULT 'aberta',
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	`atualizadoEm` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ocorrencias_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pendencias` (
	`id` int AUTO_INCREMENT NOT NULL,
	`obraId` int NOT NULL,
	`diarioId` int,
	`titulo` varchar(255) NOT NULL,
	`descricao` longtext,
	`tipo` enum('rdo','pendencia','nao_conformidade') DEFAULT 'pendencia',
	`status` enum('aberta','em_andamento','resolvida','cancelada') DEFAULT 'aberta',
	`prioridade` enum('baixa','media','alta','critica') DEFAULT 'media',
	`responsavel` int,
	`dataVencimento` date,
	`dataResolucao` date,
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	`atualizadoEm` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pendencias_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `presenca` (
	`id` int AUTO_INCREMENT NOT NULL,
	`colaboradorId` int NOT NULL,
	`diarioId` int NOT NULL,
	`data` date NOT NULL,
	`presente` boolean DEFAULT true,
	`horarioChegada` varchar(5),
	`horarioSaida` varchar(5),
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `presenca_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `relatorios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`obraId` int NOT NULL,
	`tipo` enum('diario','semanal','mensal') NOT NULL,
	`dataInicio` date NOT NULL,
	`dataFim` date NOT NULL,
	`conteudo` longtext,
	`caminhoArmazenamentoPDF` varchar(500),
	`geradoPor` int NOT NULL,
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `relatorios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sugestoes_llm` (
	`id` int AUTO_INCREMENT NOT NULL,
	`diarioId` int,
	`ocorrenciaId` int,
	`tipo` enum('resumo_diario','sugestao_ocorrencia','analise_produtividade') NOT NULL,
	`sugestao` longtext NOT NULL,
	`aprovada` boolean DEFAULT false,
	`textoFinal` longtext,
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	`atualizadoEm` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sugestoes_llm_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','engenheiro','cliente') NOT NULL DEFAULT 'engenheiro';