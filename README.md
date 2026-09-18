# Salão Beleza — Sistema de Agendamento

Projeto Integrador — Sistema web para o gerente de um salão cadastrar clientes,
profissionais, serviços e agendar horários com controle de conflito.

## Tecnologias

- **Backend:** Node.js, Express, PostgreSQL
- **Frontend:** HTML, Tailwind CSS (via CDN), JavaScript puro
- **Segurança:** bcrypt (senhas), JWT (sessão), cookies httpOnly

## Como rodar

```bash
# 1. Instalar dependências
npm install

# 2. Copiar o .env de exemplo e editar
cp .env.example .env

# 3. Gerar um segredo JWT e colar no .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 4. Criar o banco e as tabelas
createdb salao_db
psql -U postgres -d salao_db -f db/schema.sql

# 5. Criar o gerente (precisa ter RESET_PASSWORD definido no .env)
npm run reset

# 6. Subir o servidor
npm start
```

Acesse em http://localhost:3000

## Funcionalidades

- Login do gerente
- Recuperação de senha por código enviado por e-mail
- Cadastro de clientes, profissionais e serviços
- Agendamento com validação de conflito (por profissional e por cliente)
- Cancelamento com preservação de histórico
- Busca na timeline de agendamentos

## Decisões de segurança

| Tema | Decisão |
|---|---|
| Senhas | Criptografadas com bcrypt (custo 10) |
| Sessão | JWT em cookie httpOnly |
| Recuperação | Código aleatório de 8 caracteres, válido por 30 minutos |
| Concorrência | Verificação de conflito antes de salvar |
| Entradas | Validação e sanitização de todos os campos |
| XSS | Escape de HTML no frontend antes de exibir |

## Limitações conhecidas

- Não há controle de escala/folga de profissional
- Não há configuração de horário de funcionamento
- Não há cadastro público de cliente (é uso interno)
- A verificação de conflito não usa lock no banco, então em teoria duas requisições simultâneas poderiam passar. Para um salão com um só gerente, isso é improvável.