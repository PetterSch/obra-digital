# Obra Digital - User Guide

## Getting Started

Welcome to Obra Digital, your comprehensive construction project management platform. This guide will help you navigate the main features and workflows.

## Main Features

### 1. Dashboard

The dashboard provides a quick overview of all your projects and recent activities.

**Access:** Click "Dashboard" in the sidebar

**What you'll see:**
- List of all your obras (projects)
- Recent diários (work diaries)
- Quick statistics
- Pending tasks

### 2. Obras (Projects)

#### Creating a New Project

1. Click "Obras" in the sidebar
2. Click "Nova Obra" button
3. Fill in the project details:
   - **Código**: Unique project identifier
   - **Nome**: Project name
   - **Cliente**: Client name
   - **Endereço**: Project address
   - **Cidade/Estado/CEP**: Location details
   - **Responsável Técnico**: Technical responsible person
   - **CREA**: Professional registration number
   - **Data de Início**: Project start date
   - **Data Prevista de Término**: Expected end date
4. Click "Salvar"

#### Viewing Project Details

1. Click on a project from the list
2. You'll see:
   - Project information
   - Progress percentage
   - Recent diários
   - Timeline/Cronograma
   - Team members
   - Reports

### 3. Diário de Obra (Work Diary)

The work diary is the core of the platform where you record daily activities.

#### Creating a Diário

1. Go to a specific project
2. Click "Novo Diário" or "Adicionar Diário"
3. Fill in the information:
   - **Data**: Date of the work
   - **Clima**: Weather conditions (ensolarado, nublado, chuvoso, tempestuoso)
   - **Temperatura**: Temperature in Celsius
   - **Umidade**: Humidity percentage
   - **Observações Gerais**: General observations

#### Tabs in the Diário Form

**Informações Gerais (General Information)**
- Weather and temperature data
- General observations

**Atividades (Activities)**
- Add activities performed on the day
- Describe what was done, where, and status

**Ocorrências (Incidents)**
- Record any incidents or issues
- Describe the problem and impact

**Equipamentos (Equipment)**
- Log equipment used
- Record hours of operation

**Materiais (Materials)**
- Record materials used or delivered
- Track quantities and types

**Mão de Obra (Workforce)**
- Select teams and team members present
- Track attendance
- Quick select buttons: "Todos" (All) or "Nenhum" (None)

**Fotos (Photos)**
- Upload photos from the day
- Add descriptions
- Organize by activity

#### Submitting a Diário

1. Fill in all required information
2. Click "Salvar Diário"
3. The system may generate AI suggestions for text
4. Review suggestions and approve or edit them

### 4. Equipes (Teams)

Manage your work teams and team members.

#### Creating a Team

1. Click "Equipes" in the sidebar
2. Click "Nova Equipe"
3. Enter:
   - **Nome**: Team name (e.g., "Equipe Estrutura")
   - **Empresa**: Company name
4. Click "Salvar"

#### Adding Team Members

1. Click on a team to view details
2. Click "Adicionar Colaborador"
3. Enter:
   - **Nome**: Full name
   - **CPF**: Tax ID (format: 123.456.789-00)
   - **Função**: Role (pedreiro, carpinteiro, encanador, etc.)
   - **Data de Admissão**: Hire date
4. Click "Salvar"

#### Editing/Deleting

- Click the edit icon to modify team or member information
- Click the delete icon to remove (admin only)

### 5. Resumos Periódicos (Periodic Reports)

Generate consolidated reports for specific periods.

#### Accessing Reports

1. Go to a project
2. Click "Resumos" tab or "Resumos Periódicos"
3. Select period type:
   - **Semanal**: Weekly report
   - **Quinzenal**: Bi-weekly report
   - **Mensal**: Monthly report
4. Select start date
5. Click "Gerar Resumo"

#### Report Contents

The system will show:
- **Resumo Narrativo**: AI-generated summary of the period
- **Estatísticas**: Key metrics
  - Total diários
  - Activities performed
  - Incidents recorded
  - Photos taken
  - Team members involved
- **Principais Atividades**: Main activities
- **Principais Ocorrências**: Main incidents
- **Galeria de Fotos**: Photo gallery

#### Exporting Reports

- Click "Exportar Excel" to download a detailed Excel report
- PDF export coming soon

### 6. Sugestões LLM (AI Suggestions)

The system uses AI to generate suggestions for your diários.

#### Reviewing Suggestions

1. Click "Sugestões LLM" in the sidebar
2. You'll see pending suggestions
3. For each suggestion:
   - Read the generated text
   - Edit if needed
   - Click "Aprovar" to accept
   - Click "Rejeitar" to discard

#### Suggestion Types

- **Resumo Diário**: Daily summary
- **Descrição de Atividade**: Activity description
- **Análise de Ocorrência**: Incident analysis

### 7. Cronograma (Timeline)

View the project timeline and progress.

#### Accessing Timeline

1. Go to a project
2. Click "Cronograma" tab
3. You'll see:
   - Project dates (start, expected end, duration)
   - Time elapsed vs. total duration
   - Project progress percentage
   - Status indicator
   - Timeline of recent diários

#### Understanding the Timeline

- **Blue bar**: Time elapsed since project start
- **Green bar**: Project completion percentage
- **Status colors**:
  - Green: Finalizada (Completed)
  - Blue: Em Andamento (In Progress)
  - Yellow: Pausada (Paused)
  - Gray: Planejamento (Planning)

### 8. Painel do Cliente (Client Panel)

If you have client access, you can view project information in read-only mode.

#### Accessing Client Panel

1. Click "Painel do Cliente" (if available)
2. Select a project
3. View:
   - Project progress
   - Diários
   - Resumos (reports)
   - Pendências (pending items)

**Note:** Clients cannot export reports or edit information.

## Common Workflows

### Workflow 1: Daily Work Diary Entry

1. At the end of each workday:
   - Go to the project
   - Click "Novo Diário"
   - Fill in weather and general observations
   - Add activities performed
   - Record any incidents
   - Log equipment and materials used
   - Select team members present
   - Upload photos
   - Submit

2. Review AI suggestions:
   - Go to "Sugestões LLM"
   - Review generated text
   - Approve or edit
   - Approved suggestions are added to the diário

### Workflow 2: Weekly Report Generation

1. On Friday or end of week:
   - Go to project
   - Click "Resumos"
   - Select "Semanal"
   - Set start date to Monday
   - Click "Gerar Resumo"
   - Review the consolidated report
   - Export to Excel if needed
   - Share with stakeholders

### Workflow 3: Team Management

1. At project start:
   - Go to "Equipes"
   - Create teams (Estrutura, Alvenaria, Acabamento, etc.)
   - Add team members to each team

2. Daily:
   - When creating diário, select teams and members present
   - System tracks attendance

3. Reporting:
   - Reports show team utilization
   - Can see which teams were most active

## Tips & Tricks

### Efficiency

- Use "Todos" button to quickly select all team members
- Use "Nenhum" button to deselect all
- Save frequently to avoid losing data
- Use templates for recurring activities

### Best Practices

- Fill in diários at the end of each day while information is fresh
- Include photos for visual documentation
- Be specific in incident descriptions
- Use consistent terminology for activities
- Review AI suggestions for accuracy before approving

### Troubleshooting

**Can't create a diário?**
- Make sure you have "engenheiro" role or higher
- Check that the project exists and is active

**Photos not uploading?**
- Check file size (should be under 10MB)
- Verify file format (JPG, PNG supported)
- Check internet connection

**Report not generating?**
- Ensure there are diários in the selected period
- Check that dates are in correct format
- Try refreshing the page

## User Roles & Permissions

### Admin
- Full access to all features
- Can create/edit/delete projects
- Can manage users and permissions
- Can view all reports

### Engenheiro (Engineer)
- Can create and edit diários
- Can manage teams and team members
- Can view and export reports
- Cannot delete projects

### Cliente (Client)
- Can view diários (read-only)
- Can view reports (read-only)
- Cannot export or edit
- Cannot create diários

## Support

For technical issues or questions:
1. Check this guide first
2. Contact your project administrator
3. Submit a support ticket

## Updates & New Features

The platform is continuously improved. Check the dashboard for announcements about new features.

---

**Last Updated:** May 2026
**Version:** 1.0
