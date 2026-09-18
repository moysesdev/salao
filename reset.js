//Cria (ou atualiza) o gerente no banco.
//Rodar com: npm run reset

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  user:     process.env.DB_USER,
  host:     process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port:     Number(process.env.DB_PORT)
});

async function resetar() {
  const email = process.env.RESET_EMAIL || 'gerente@salao.com';
  const senha = process.env.RESET_PASSWORD;

  if (!senha || senha.length < 8) {
    console.error('ERRO: Defina RESET_PASSWORD (mínimo 8 caracteres) no .env');
    process.exit(1);
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);

    const existe = await pool.query('SELECT id FROM gerente WHERE email = $1', [email]);

    if (existe.rows.length > 0) {
      await pool.query('UPDATE gerente SET senha = $1 WHERE email = $2', [senhaHash, email]);
      console.log(`Senha do gerente ${email} atualizada.`);
    } else {
      await pool.query(
        'INSERT INTO gerente (nome, email, senha) VALUES ($1, $2, $3)',
        ['Gerente', email, senhaHash]
      );
      console.log(`Gerente ${email} criado.`);
    }

    console.log('\n--- LOGIN ---');
    console.log('E-mail:', email);
    console.log('Senha : (a definida em RESET_PASSWORD)\n');
  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    await pool.end();
  }
}

resetar();