-- SCHEMA DO SISTEMA SALÃO
-- Rode uma vez para criar as tabelas

-- Gerente (só existe um, mas fica em tabela pra ser correto)
CREATE TABLE IF NOT EXISTS gerente (
  id                SERIAL PRIMARY KEY,
  nome              VARCHAR(150) NOT NULL,
  email             VARCHAR(255) NOT NULL UNIQUE,
  senha             VARCHAR(255) NOT NULL,
  token_recuperacao VARCHAR(64),
  token_expiracao   TIMESTAMP,
  criado_em         TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Clientes
-- telefone guarda SÓ dígitos (ex: 11987654321). O front formata pra exibir.
CREATE TABLE IF NOT EXISTS clientes (
  id        SERIAL PRIMARY KEY,
  nome      VARCHAR(150) NOT NULL,
  telefone  VARCHAR(20)  NOT NULL UNIQUE,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Profissionais que atendem no salão
CREATE TABLE IF NOT EXISTS profissionais (
  id        SERIAL PRIMARY KEY,
  nome      VARCHAR(150) NOT NULL,
  cargo     VARCHAR(100) NOT NULL DEFAULT 'Atendente',
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Serviços oferecidos (com duração pra calcular o fim do agendamento)
CREATE TABLE IF NOT EXISTS servicos (
  id              SERIAL PRIMARY KEY,
  nome            VARCHAR(150) NOT NULL,
  preco           NUMERIC(10,2) NOT NULL CHECK (preco >= 0),
  duracao_minutos INT NOT NULL DEFAULT 30 CHECK (duracao_minutos > 0),
  criado_em       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Agendamentos
-- status: 'agendado', 'cancelado' ou 'concluido'
-- Quando cancelado, NÃO apagamos — só mudamos o status (soft delete)
CREATE TABLE IF NOT EXISTS agendamentos (
  id               SERIAL PRIMARY KEY,
  cliente_id       INT NOT NULL REFERENCES clientes(id),
  profissional_id  INT NOT NULL REFERENCES profissionais(id),
  servico_id       INT NOT NULL REFERENCES servicos(id),
  data_hora_inicio TIMESTAMP NOT NULL,
  data_hora_fim    TIMESTAMP NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'agendado',
  criado_em        TIMESTAMP NOT NULL DEFAULT NOW(),
  CHECK (data_hora_fim > data_hora_inicio)
);

-- Índices para deixar as buscas mais rápidas
CREATE INDEX IF NOT EXISTS idx_ag_profissional ON agendamentos (profissional_id, data_hora_inicio);
CREATE INDEX IF NOT EXISTS idx_ag_cliente      ON agendamentos (cliente_id, data_hora_inicio);