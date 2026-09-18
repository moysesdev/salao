//SERVIDOR DO SISTEMA SALÃO
//Tudo que o backend faz está neste arquivo.
//Organizar em seções para facilitar a leitura.


require('dotenv').config();

const express      = require('express');
const { Pool }     = require('pg');
const path         = require('path');
const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const crypto       = require('crypto');
const nodemailer   = require('nodemailer');


//1. CONFIGURAÇÕES INICIAIS

//Verifica se as variáveis obrigatórias existem. Se não, para o servidor.
const obrigatorias = ['DB_USER', 'DB_HOST', 'DB_DATABASE', 'DB_PASSWORD', 'DB_PORT', 'JWT_SECRET'];
const faltando = obrigatorias.filter(k => !process.env[k]);
if (faltando.length > 0) {
  console.error('ERRO: Faltam variáveis no .env:', faltando.join(', '));
  process.exit(1);
}

if (process.env.JWT_SECRET.length < 32) {
  console.error('ERRO: JWT_SECRET precisa ter no mínimo 32 caracteres.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;
const ehProducao = process.env.NODE_ENV === 'production';


//2. CONEXÃO COM O BANCO DE DADOS

const pool = new Pool({
  user:     process.env.DB_USER,
  host:     process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port:     Number(process.env.DB_PORT)
});

pool.on('error', (err) => {
  console.error('[BANCO] Erro inesperado:', err.message);
});


//3. MIDDLEWARES (funções que rodam antes das rotas)

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

//Middleware de autenticação: verifica se o gerente está logado.
//Ele lê o cookie 'token_gerente' e valida o JWT.
function autenticarGerente(req, res, next) {
  const token = req.cookies.token_gerente;
  if (!token) {
    return res.status(401).json({ erro: 'Acesso não autorizado. Faça login.' });
  }
  try {
    req.gerente = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Sessão inválida ou expirada.' });
  }
}


//4. FUNÇÕES AUXILIARES

//Remove espaços e limita o tamanho de uma string. Retorna null se inválida.
function limparTexto(valor, tamanhoMaximo = 255) {
  if (typeof valor !== 'string') return null;
  const texto = valor.trim();
  if (texto.length === 0 || texto.length > tamanhoMaximo) return null;
  return texto;
}

//Normaliza telefone: remove tudo que não é número.
//Aceita "+55 11 98765-4321" e retorna "11987654321".
//Aceita também "11987654321" direto.
function normalizarTelefone(valor) {
  if (typeof valor !== 'string') return null;
  let numeros = valor.replace(/\D/g, ''); // remove tudo que não é dígito
  if (numeros.startsWith('55') && numeros.length >= 12) {
    numeros = numeros.substring(2); // remove o DDI 55
  }
  if (numeros.length < 10 || numeros.length > 11) return null;
  return numeros;
}

//Formata telefone para exibição: "11987654321" -> "(11) 98765-4321"
function formatarTelefone(numeros) {
  if (!numeros) return '';
  const n = String(numeros);
  if (n.length === 11) return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`;
  return n;
}

//Envia e-mail com o código de recuperação.
//Se SMTP não estiver configurado, imprime no console (modo dev).
async function enviarEmailRecuperacao(destinatario, codigo) {
  if (!process.env.SMTP_HOST) {
    console.log(`\n[DEV] Código de recuperação para ${destinatario}: ${codigo}\n`);
    return;
  }
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: destinatario,
      subject: 'Recuperação de senha - Salão Beleza',
      text: `Seu código de recuperação é: ${codigo}\nVálido por 30 minutos.`
    });
    console.log(`[EMAIL] Código enviado para ${destinatario}`);
  } catch (err) {
    console.error('[EMAIL] Erro ao enviar:', err.message);
    console.log(`[DEV] Código para ${destinatario}: ${codigo}`);
  }
}


//5. ROTAS DE AUTENTICAÇÃO

//Página principal (login)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

//Login do gerente
app.post('/login', async (req, res) => {
  const email = limparTexto(req.body.email, 255);
  const senha = typeof req.body.senha === 'string' ? req.body.senha : null;

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Preencha e-mail e senha.' });
  }

  try {
    const resultado = await pool.query(
      'SELECT id, nome, email, senha FROM gerente WHERE email = $1',
      [email]
    );

    if (resultado.rows.length === 0) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    const gerente = resultado.rows[0];
    const senhaCorreta = await bcrypt.compare(senha, gerente.senha);

    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    //Cria o token JWT com os dados do gerente
    const token = jwt.sign(
      { id: gerente.id, nome: gerente.nome, email: gerente.email },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    //Salva o token num cookie httpOnly (JavaScript do navegador não acessa)
    res.cookie('token_gerente', token, {
      httpOnly: true,
      secure: ehProducao, //só envia em HTTPS quando em produção
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000 //8 horas em milissegundos
    });

    res.json({
      mensagem: 'Login com sucesso!',
      gerente: { nome: gerente.nome, email: gerente.email }
    });
  } catch (err) {
    console.error('[LOGIN] Erro:', err.message);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

//Logout (limpa o cookie)
app.post('/logout', (req, res) => {
  res.clearCookie('token_gerente');
  res.json({ mensagem: 'Logout realizado.' });
});

//Verifica se o gerente ainda está logado (chamado ao abrir a página)
app.get('/verificar-sessao', autenticarGerente, (req, res) => {
  res.json({ autenticado: true, gerente: req.gerente });
});

//Passo 1 da recuperação: gerar código e enviar por e-mail
app.post('/esqueci-senha', async (req, res) => {
  const email = limparTexto(req.body.email, 255);
  if (!email) return res.status(400).json({ erro: 'Informe o e-mail.' });

  //Mensagem genérica (não revela se o e-mail existe ou não)
  const respostaGenerica = {
    mensagem: 'Se o e-mail estiver cadastrado, o código foi enviado.'
  };

  try {
    const resultado = await pool.query(
      'SELECT id FROM gerente WHERE email = $1',
      [email]
    );

    if (resultado.rows.length === 0) {
      return res.json(respostaGenerica);
    }

    //Gera um código aleatório de 8 caracteres (ex: A1B2C3D4)
    const codigo = crypto.randomBytes(4).toString('hex').toUpperCase();
    const expiracao = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

    await pool.query(
      'UPDATE gerente SET token_recuperacao = $1, token_expiracao = $2 WHERE email = $3',
      [codigo, expiracao, email]
    );

    await enviarEmailRecuperacao(email, codigo);

    return res.json(respostaGenerica);
  } catch (err) {
    console.error('[ESQUECI-SENHA] Erro:', err.message);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

//Passo 2: redefinir a senha usando o código
app.post('/redefinir-senha', async (req, res) => {
  const token = limparTexto(req.body.token, 64);
  const novaSenha = typeof req.body.novaSenha === 'string' ? req.body.novaSenha : '';

  if (!token || !novaSenha) {
    return res.status(400).json({ erro: 'Informe o código e a nova senha.' });
  }

  if (novaSenha.length < 8) {
    return res.status(400).json({ erro: 'A senha deve ter no mínimo 8 caracteres.' });
  }

  try {
    const resultado = await pool.query(
      'SELECT id FROM gerente WHERE token_recuperacao = $1 AND token_expiracao > NOW()',
      [token.toUpperCase()]
    );

    if (resultado.rows.length === 0) {
      return res.status(400).json({ erro: 'Código inválido ou expirado.' });
    }

    //Criptografa a nova senha antes de salvar
    const senhaHash = await bcrypt.hash(novaSenha, 10);

    await pool.query(
      'UPDATE gerente SET senha = $1, token_recuperacao = NULL, token_expiracao = NULL WHERE id = $2',
      [senhaHash, resultado.rows[0].id]
    );

    res.json({ mensagem: 'Senha redefinida com sucesso.' });
  } catch (err) {
    console.error('[REDEFINIR-SENHA] Erro:', err.message);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});


//6. ROTAS DE CLIENTES (todas exigem login)

app.get('/clientes', autenticarGerente, async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT id, nome, telefone FROM clientes ORDER BY nome ASC'
    );
    //Formata o telefone pra exibir bonitinho no select
    const clientes = resultado.rows.map(c => ({
      ...c,
      telefone: formatarTelefone(c.telefone)
    }));
    res.json(clientes);
  } catch (err) {
    console.error('[CLIENTES] Erro:', err.message);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

app.post('/clientes', autenticarGerente, async (req, res) => {
  const nome = limparTexto(req.body.nome, 150);
  const telefone = normalizarTelefone(req.body.telefone);

  if (!nome || !telefone) {
    return res.status(400).json({ erro: 'Nome e telefone válido são obrigatórios.' });
  }

  try {
    const resultado = await pool.query(
      'INSERT INTO clientes (nome, telefone) VALUES ($1, $2) RETURNING id, nome, telefone',
      [nome, telefone]
    );
    const cliente = resultado.rows[0];
    res.status(201).json({
      mensagem: 'Cliente cadastrado!',
      cliente: { ...cliente, telefone: formatarTelefone(cliente.telefone) }
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Telefone já cadastrado.' });
    }
    console.error('[CLIENTES] Erro:', err.message);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});


//7. ROTAS DE PROFISSIONAIS

app.get('/profissionais', autenticarGerente, async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT id, nome, cargo FROM profissionais ORDER BY id ASC'
    );
    res.json(resultado.rows);
  } catch (err) {
    console.error('[PROFISSIONAIS] Erro:', err.message);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

app.post('/profissionais', autenticarGerente, async (req, res) => {
  const nome = limparTexto(req.body.nome, 150);
  const cargo = limparTexto(req.body.cargo, 100) || 'Atendente';

  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' });

  try {
    const resultado = await pool.query(
      'INSERT INTO profissionais (nome, cargo) VALUES ($1, $2) RETURNING id, nome, cargo',
      [nome, cargo]
    );
    res.status(201).json({
      mensagem: 'Profissional cadastrado!',
      profissional: resultado.rows[0]
    });
  } catch (err) {
    console.error('[PROFISSIONAIS] Erro:', err.message);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});


//8. ROTAS DE SERVIÇOS

app.get('/servicos', autenticarGerente, async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT id, nome, preco, duracao_minutos FROM servicos ORDER BY nome ASC'
    );
    res.json(resultado.rows);
  } catch (err) {
    console.error('[SERVICOS] Erro:', err.message);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

app.post('/servicos', autenticarGerente, async (req, res) => {
  const nome = limparTexto(req.body.nome, 150);
  const preco = Number(req.body.preco);
  const duracao = Number(req.body.duracao_minutos) || 30;

  if (!nome || isNaN(preco) || preco < 0) {
    return res.status(400).json({ erro: 'Dados do serviço inválidos.' });
  }

  try {
    const resultado = await pool.query(
      'INSERT INTO servicos (nome, preco, duracao_minutos) VALUES ($1, $2, $3) RETURNING id, nome, preco, duracao_minutos',
      [nome, preco, duracao]
    );
    res.status(201).json({
      mensagem: 'Serviço cadastrado!',
      servico: resultado.rows[0]
    });
  } catch (err) {
    console.error('[SERVICOS] Erro:', err.message);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});


//9. ROTAS DE AGENDAMENTOS

//Lista os agendamentos não cancelados
app.get('/agendamentos', autenticarGerente, async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT a.id, a.data_hora_inicio, a.data_hora_fim, a.status,
             c.nome AS cliente_nome, c.telefone AS cliente_telefone,
             p.nome AS profissional_nome,
             s.nome AS servico_nome, s.preco AS servico_preco
      FROM agendamentos a
      JOIN clientes c ON a.cliente_id = c.id
      LEFT JOIN profissionais p ON a.profissional_id = p.id
      LEFT JOIN servicos s ON a.servico_id = s.id
      WHERE a.status <> 'cancelado'
      ORDER BY a.data_hora_inicio ASC
    `);
    res.json(resultado.rows);
  } catch (err) {
    console.error('[AGENDAMENTOS] Erro:', err.message);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

//Cria um novo agendamento
app.post('/agendamentos', autenticarGerente, async (req, res) => {
  const { cliente_id, profissional_id, servico_id } = req.body;
  const inicioTexto = req.body.data_hora_inicio || req.body.data_hora;

  //Valida se todos os campos vieram
  if (!cliente_id || !profissional_id || !servico_id || !inicioTexto) {
    return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
  }

  const inicio = new Date(inicioTexto);
  if (isNaN(inicio.getTime())) {
    return res.status(400).json({ erro: 'Data/hora inválida.' });
  }

  if (inicio.getTime() < Date.now() - 60000) {
    return res.status(400).json({ erro: 'Não é possível agendar no passado.' });
  }

  try {
    //1. Verifica se o cliente existe
    const clienteExiste = await pool.query('SELECT id FROM clientes WHERE id = $1', [cliente_id]);
    if (clienteExiste.rows.length === 0) {
      return res.status(404).json({ erro: 'Cliente não encontrado.' });
    }

    //2. Verifica se o profissional existe
    const profExiste = await pool.query('SELECT id FROM profissionais WHERE id = $1', [profissional_id]);
    if (profExiste.rows.length === 0) {
      return res.status(404).json({ erro: 'Profissional não encontrado.' });
    }

    //3. Busca a duração do serviço
    const servico = await pool.query('SELECT duracao_minutos FROM servicos WHERE id = $1', [servico_id]);
    if (servico.rows.length === 0) {
      return res.status(404).json({ erro: 'Serviço não encontrado.' });
    }
    const duracao = servico.rows[0].duracao_minutos;
    const fim = new Date(inicio.getTime() + duracao * 60000);

    //4. Verifica se o profissional já tem algo nesse intervalo
    const conflitoProf = await pool.query(`
      SELECT id FROM agendamentos
      WHERE profissional_id = $1
        AND status <> 'cancelado'
        AND data_hora_inicio < $2
        AND data_hora_fim > $3
    `, [profissional_id, fim, inicio]);

    if (conflitoProf.rows.length > 0) {
      return res.status(409).json({ erro: 'Profissional já tem agendamento nesse horário.' });
    }

    //5. Verifica se o cliente já tem algo nesse intervalo
    const conflitoCli = await pool.query(`
      SELECT id FROM agendamentos
      WHERE cliente_id = $1
        AND status <> 'cancelado'
        AND data_hora_inicio < $2
        AND data_hora_fim > $3
    `, [cliente_id, fim, inicio]);

    if (conflitoCli.rows.length > 0) {
      return res.status(409).json({ erro: 'Cliente já tem agendamento nesse horário.' });
    }

    //6. Salva o agendamento
    const novo = await pool.query(`
      INSERT INTO agendamentos
        (cliente_id, profissional_id, servico_id, data_hora_inicio, data_hora_fim, status)
      VALUES ($1, $2, $3, $4, $5, 'agendado')
      RETURNING *
    `, [cliente_id, profissional_id, servico_id, inicio, fim]);

    res.status(201).json({
      mensagem: 'Agendamento realizado!',
      agendamento: novo.rows[0]
    });
  } catch (err) {
    console.error('[AGENDAMENTOS] Erro:', err.message);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

//Cancela um agendamento (soft delete: só muda o status)
app.patch('/agendamentos/:id/cancelar', autenticarGerente, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ erro: 'ID inválido.' });

  try {
    const resultado = await pool.query(`
      UPDATE agendamentos SET status = 'cancelado'
      WHERE id = $1 AND status <> 'cancelado'
      RETURNING id
    `, [id]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Agendamento não encontrado.' });
    }

    res.json({ mensagem: 'Agendamento cancelado.' });
  } catch (err) {
    console.error('[CANCELAR] Erro:', err.message);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});


//10. INICIAR O SERVIDOR

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Ambiente: ${ehProducao ? 'produção' : 'desenvolvimento'}`);
});