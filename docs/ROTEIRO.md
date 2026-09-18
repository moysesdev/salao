# Roteiro para a banca

## O que é o sistema (decore)

"Sistema web interno para o gerente de um salão cadastrar clientes,
profissionais e serviços, e agendar horários sem conflito."

## Demo ao vivo (5 minutos)

1. Abrir http://localhost:3000
2. Fazer login
3. Cadastrar um profissional: "Maria — Cabeleireira"
4. Cadastrar um serviço: "Corte — R$ 50 — 30 min"
5. Cadastrar um cliente: "João — (11) 98765-4321"
6. Criar agendamento pra Maria às 10:00
7. **Tentar criar outro pra Maria às 10:15** → mostrar que bloqueia
8. Cancelar o primeiro agendamento
9. Fazer logout e tentar acessar /agendamentos no navegador → mostrar 401

## Perguntas que a banca pode fazer

**"Como você evita dois agendamentos no mesmo horário?"**
"Antes de salvar, faço duas consultas no banco: uma verificando se o
profissional já tem agendamento nesse intervalo e outra pro cliente.
Se qualquer uma achar conflito, retorno erro e não salvo."

**"Por que usou JWT?"**
"Porque o token fica dentro de um cookie httpOnly, então o JavaScript
do navegador não consegue ler. Isso protege contra roubo de sessão via XSS."

**"Por que o cancelamento não apaga o registro?"**
"Porque o histórico é importante. Se o gerente cancelou, ainda quero
saber que existiu. Uso soft delete: só mudo o status pra 'cancelado'."

**"O que é bcrypt?"**
"É uma função de hash para senhas. Ela é lenta de propósito, o que
dificulta ataques de força bruta. Nunca guardo a senha em texto puro."

**"Como o código de recuperação é gerado?"**
"Uso crypto.randomBytes pra gerar 8 caracteres aleatórios. Salvo no banco
com validade de 30 minutos e envio por e-mail."

**"Quais as limitações do sistema?"**
"Não tem escala de profissional, nem configuração de horário de
funcionamento. Também não tem cadastro público — é só uso interno do
gerente, como combinado no escopo."

## Se travar

- Respira.
- "Não sei responder isso agora, mas posso pesquisar."
- Ou: "Vou mostrar no sistema em vez de explicar a teoria."

## Três frases que salvam qualquer apresentação

1. "O sistema resolve o problema de conflito de horário no salão."
2. "A regra de negócio fica no `server.js`, na rota de agendamentos."
3. "A senha é criptografada com bcrypt e a sessão usa JWT em cookie."