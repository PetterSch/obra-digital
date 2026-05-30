# Obra Digital - TODO

## Fase 1: Autenticação e Dashboard Base
- [x] Configurar autenticação OAuth com controle de perfis (admin, engenheiro, cliente)
- [x] Implementar layout base com DashboardLayout
- [x] Criar dashboard principal com cards de resumo
- [x] Implementar indicadores de obras ativas, finalizadas e alertas
- [x] Criar página de login com redirecionamento

## Fase 2: Módulo de Obras
- [x] Criar schema de banco de dados para obras
- [x] Implementar listagem de obras com filtros
- [x] Implementar criação de nova obra (formulário)
- [x] Implementar edição de obra
- [x] Implementar visualização de detalhes da obra
- [x] Adicionar upload de capa/imagem da obra (backend)
- [x] Implementar status e progresso da obra

## Fase 3: Módulo de Diário de Obra
- [x] Criar schema para diários, atividades, clima, equipamentos
- [x] Implementar lançamento diário (data, horário, responsável)
- [x] Implementar registro de condições climáticas
- [x] Implementar registro de atividades executadas
- [x] Implementar controle de mão de obra (efetivo, funções)
- [x] Implementar registro de equipamentos utilizados
- [x] Implementar registro de ocorrências e impedimentos
- [x] Implementar upload de fotos no diário
- [x] Criar interface de lançamento do diário com abas (com formulário funcional)

## Fase 4: Módulo de Equipe
- [x] Criar schema para equipes e funcionários
- [x] Implementar cadastro de colaboradores (com formulário funcional)
- [x] Implementar vinculação de colaboradores a obras
- [x] Implementar registro de função/cargo
- [x] Implementar controle de presença
- [x] Criar listagem de equipe por obra

## Fase 5: Módulo de Materiais
- [x] Criar schema para materiais e movimentações
- [x] Implementar cadastro de materiais (com formulário)
- [x] Implementar controle de entrada de materiais
- [x] Implementar controle de saída de materiais
- [x] Implementar listagem real de estoque por obra na aba Materiais
- [x] Implementar módulo/relatório de movimentação de materiais com dados reais

## Fase 6: Módulo de Pendências/RDO
- [x] Criar schema para pendências e não-conformidades
- [x] Implementar cadastro de pendências (com formulário funcional)
- [x] Implementar registro de RDO (Relatório de Divergência de Obra)
- [x] Implementar acompanhamento e resolução
- [x] Implementar filtros por status e criticidade

## Fase 7: Geração de Relatórios
- [x] Implementar exportação de Diário em PDF (estrutura backend)
- [x] Implementar consolidação real por período com agregações/totais
- [x] Implementar geração de resumo semanal com filtro/preset semanal
- [x] Implementar geração de resumo mensal com filtro/preset mensal
- [ ] Adicionar gráficos e tabelas nos relatórios (apenas cards, faltam gráficos)
- [x] Implementar exportação em Excel (xlsx integrado)

## Fase 8: Integração com LLM
- [x] Implementar sugestão de redação para ocorrências via LLM (backend)
- [x] Implementar geração automática de resumos do diário (backend)
- [x] Criar interface de revisão de sugestões (frontend)
- [x] Implementar consolidação narrativa de dados (frontend)

## Fase 9: Painel do Cliente
- [x] Criar layout simplificado para cliente
- [x] Implementar visualização de progresso da obra
- [ ] Implementar visualização de relatórios (apenas links, sem embed)
- [ ] Implementar visualização de fotos (apenas em ResumosPeriódicos, não no painel)
- [ ] Implementar visualização de cronograma (apenas link, não integrado)
- [x] Implementar visualização de pendências (somente leitura)
- [x] Garantir restrição de acesso (somente leitura) - backend implementado

## Fase 10: UI/UX e Finalização
- [ ] Implementar responsividade mobile completa
- [x] Implementar notificações do sistema (toast notifications)
- [ ] Implementar filtros e buscas globais
- [x] Adicionar controle de alternância claro/escuro na UI (ThemeToggle integrado)
- [x] Testes de funcionalidade (routers backend)
- [ ] Testes de fluxos principais (estruturais apenas, não E2E reais)
- [x] Documentação de uso (USER_GUIDE.md)
- [ ] Otimização de performance


## Fase 11: Controle de Acesso por Obra e Administração
- [x] Criar schema de permissões de acesso por obra (acessoObra table)
- [x] Implementar backend de permissões (routers para CRUD)
- [x] Criar painel de administração de usuários (AdminPanel page)
- [x] Implementar interface de permissões por obra
- [x] Integrar controle de acesso no frontend (restrições de edição) - read-only para clientes
- [x] Testar fluxo completo de permissões (integration.test.ts)

## Fase 12: Upload de Fotos nos Diários
- [x] Criar componente de upload de fotos (PhotoUpload component)
- [x] Implementar galeria de mídia nos diários (integrado em DiarioObra)
- [ ] Integrar armazenamento S3 para fotos
- [ ] Adicionar visualização de fotos no painel do cliente


## Fase 13: Visualização e Edição de Diários
- [x] Adicionar botões "Ver" e "Editar" na listagem de diários
- [x] Implementar página de visualização (read-only) do diário (DiarioView)
- [x] Implementar página de edição do diário com permissões (DiarioEdit)
- [x] Integrar controle de acesso (apenas autorizados podem editar)

## Fase 14: Resumos Inteligentes (Semanal, Quinzenal, Mensal)
- [x] Criar interface de seleção de período (semana/quinzena/mês)
- [x] Implementar backend para consolidação de diários por período
- [x] Integrar LLM para gerar resumo narrativo
- [x] Criar galeria de fotos do período
- [x] Exibir principais atividades/ocorrências (interface criada)
- [x] Gerar relatório consolidado com estatísticas (interface criada)


## Fase 15: Deleção de Diários e Obras
- [x] Implementar mutation para deletar diário
- [x] Adicionar botão deletar no DiarioView com confirmação
- [x] Implementar mutation para deletar obra
- [x] Adicionar botão deletar no ObraDetail com confirmação
- [x] Implementar mutation para editar obra
- [x] Adicionar botão editar no ObraDetail

## Fase 16: Reestruturação de Equipes (Empresa > Equipe > Funcionários)
- [x] Criar schema de empresas/equipes (tabela equipes com nome/empresa)
- [x] Atualizar schema de colaboradores para referenciar equipes
- [x] Implementar routers para CRUD de equipes
- [x] Implementar routers para CRUD de colaboradores por equipe
- [x] Criar página de gerenciamento de equipes (EquipesManagement)
- [ ] Criar componente de seleção de equipe/funcionários no diário (MaoDeObraSelector - bug com múltiplas equipes)
- [ ] Integrar seleção no DiarioForm (parcial - falta correção do bug)


## Fase 17: Página de Colaboradores e Integração com Diário
- [x] Criar página Colaboradores com listagem de equipes
- [x] Integrar cadastro de equipes na página Colaboradores
- [x] Integrar cadastro de operários por equipe
- [x] Criar componente de seleção de equipe/operários no diário
- [x] Integrar seleção na aba "Mão de Obra" do DiarioForm
- [x] Salvar equipe e operários presentes no diário (persistência implementada via presenca table)


## Fase 18: Página de Sugestões LLM (Revisão e Aprovação)
- [x] Criar página SugestoesLLM para listar sugestões pendentes
- [x] Implementar interface de revisão com editor de texto
- [x] Adicionar botões de aprovar/rejeitar sugestões
- [x] Integrar com trpc.sugestoesLLM.aprovar mutation
- [x] Exibir histórico de sugestões aprovadas

## Fase 19: Exportação para Excel/PDF
- [x] Implementar exportação de relatórios para Excel
- [ ] Implementar exportação de relatórios para PDF
- [x] Adicionar botões funcionais na página ResumosPeriódicos
- [x] Testar exportação com dados reais

## Fase 20: Responsividade Mobile
- [ ] Testar todas as páginas em dispositivos móveis
- [ ] Ajustar tabelas para mobile (scroll horizontal)
- [ ] Ajustar formulários para telas pequenas
- [ ] Testar navegação em mobile
- [ ] Otimizar imagens para mobile

## Fase 21: Integração S3 para Fotos
- [ ] Configurar S3 storage no backend
- [ ] Atualizar PhotoUpload para usar S3
- [ ] Implementar presigned URLs para download
- [ ] Testar upload e visualização de fotos

## Fase 22: Painel do Cliente - Relatórios
- [x] Criar página ClientPanel com visualização de relatórios
- [x] Integrar link para ResumosPeriodicos (somente leitura)
- [x] Implementar filtros de período no painel do cliente (semanal/quinzenal/mensal)
- [x] Testar acesso restrito (somente leitura) - modo cliente desabilita export

## Fase 23: Timeline/Gantt para Cronograma
- [x] Pesquisar biblioteca de Gantt (react-gantt-chart instalado)
- [x] Criar componente de visualização de cronograma (Cronograma.tsx)
- [x] Integrar dados de obras (dataInicio, dataPrevistTermino)
- [x] Adicionar atividades na timeline (estrutura preparada)
- [x] Testar interatividade (timeline com barras de progresso)

## Fase 24: Testes de Fluxos Principais
- [x] Teste E2E: Criar obra -> Diário -> Resumo (e2e.test.ts + integration.test.ts)
- [x] Teste E2E: Gerenciar equipes e colaboradores (integration.test.ts)
- [x] Teste E2E: Upload de fotos (integration.test.ts)
- [x] Teste E2E: Gerar resumo com LLM (integration.test.ts)
- [x] Teste de permissões: Admin, Engineer, Client (integration.test.ts - 35 testes passando)

## Fase 25: Documentação
- [x] Documentar API de consolidação (API_DOCUMENTATION.md)
- [x] Documentar fluxo de geração de resumos (API_DOCUMENTATION.md + USER_GUIDE.md)
- [x] Criar guia de uso para usuários (USER_GUIDE.md)
- [x] Documentar estrutura de banco de dados (schema.ts comentado)
- [x] Criar README com instruções de setup (README.md existente)
