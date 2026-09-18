//FRONTEND DO SISTEMA SALÃO
//Este arquivo conversa com o backend via fetch.
//Toda chamada usa cookies (credentials: 'same-origin').


'use strict';

//Guarda todos os agendamentos carregados (para o filtro de busca)
let todosAgendamentos = [];


//1. FUNÇÕES AUXILIARES

//Escapa HTML. É proteção contra XSS (se alguém cadastrar
//um cliente chamado "<script>alert(1)</script>", não executa).
function escapeHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

//Função que faz requisições HTTP e já devolve o JSON.
//Uso: const { ok, data } = await api('/login', { method: 'POST', body: ... })
async function api(caminho, opcoes = {}) {
  const resposta = await fetch(caminho, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(opcoes.headers || {}) },
    ...opcoes
  });

  let dados = null;
  try { dados = await resposta.json(); } catch (_) { /* sem corpo */ }

  return { ok: resposta.ok, status: resposta.status, data: dados };
}


//2. INICIALIZAÇÃO

document.addEventListener('DOMContentLoaded', () => {
  //Preenche a data do agendamento com hoje
  const campoData = document.getElementById('modalDateInput');
  if (campoData) campoData.value = new Date().toISOString().split('T')[0];

  //Liga cada botão do HTML à sua função
  document.getElementById('loginForm').addEventListener('submit', fazerLogin);
  document.getElementById('btnLogout').addEventListener('click', fazerLogout);

  document.getElementById('btnOpenForgot').addEventListener('click', abrirModalRecuperacao);
  document.getElementById('btnCloseForgot').addEventListener('click', fecharModalRecuperacao);
  document.getElementById('stepRequestCode').addEventListener('submit', solicitarCodigo);
  document.getElementById('stepResetPassword').addEventListener('submit', redefinirSenha);

  document.getElementById('btnOpenClient').addEventListener('click', () => abrirModal('clientModal'));
  document.getElementById('btnCloseClient').addEventListener('click', () => fecharModal('clientModal'));
  document.getElementById('formCliente').addEventListener('submit', salvarCliente);

  document.getElementById('btnOpenStaff').addEventListener('click', () => abrirModal('staffModal'));
  document.getElementById('btnCloseStaff').addEventListener('click', () => fecharModal('staffModal'));
  document.getElementById('formStaff').addEventListener('submit', salvarProfissional);

  document.getElementById('btnOpenBooking').addEventListener('click', () => abrirModal('bookingModal'));
  document.getElementById('btnCloseBooking').addEventListener('click', () => fecharModal('bookingModal'));
  document.getElementById('btnCancelBooking').addEventListener('click', () => fecharModal('bookingModal'));
  document.getElementById('formAgendamento').addEventListener('submit', salvarAgendamento);

  document.getElementById('searchInput').addEventListener('input', filtrarAgendamentos);

  //Ao carregar a página, pergunta ao servidor se já está logado
  verificarSessao();
});


//3. SESSÃO (login, logout, verificar)

async function verificarSessao() {
  const { ok, data } = await api('/verificar-sessao');
  if (ok && data && data.autenticado) {
    mostrarPainel(data.gerente);
  } else {
    mostrarLogin();
  }
}

async function fazerLogin(evento) {
  evento.preventDefault();

  const email = document.getElementById('loginEmail').value.trim();
  const senha = document.getElementById('loginSenha').value;
  const erroDiv = document.getElementById('loginError');
  const sucessoDiv = document.getElementById('loginSuccess');

  erroDiv.classList.add('hidden');
  sucessoDiv.classList.add('hidden');

  const { ok, data } = await api('/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha })
  });

  if (ok) {
    document.getElementById('loginSenha').value = '';
    mostrarPainel(data.gerente);
  } else {
    erroDiv.innerText = (data && data.erro) || 'Erro ao realizar login.';
    erroDiv.classList.remove('hidden');
  }
}

async function fazerLogout() {
  await api('/logout', { method: 'POST' });
  mostrarLogin();
}

function mostrarLogin() {
  document.getElementById('loginSection').classList.remove('hidden');
  document.getElementById('appSection').classList.add('hidden');
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginSenha').value = '';
}

function mostrarPainel(gerente) {
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('appSection').classList.remove('hidden');

  if (gerente && gerente.nome) {
    document.getElementById('saudacaoGerente').innerText = 'Gerente: ' + gerente.nome;
  }

  //Carrega tudo que o painel precisa
  carregarClientes();
  carregarProfissionais();
  carregarServicos();
  carregarAgendamentos();
}


//4. RECUPERAÇÃO DE SENHA

function abrirModalRecuperacao() {
  abrirModal('forgotModal');
  document.getElementById('stepRequestCode').classList.remove('hidden');
  document.getElementById('stepResetPassword').classList.add('hidden');
}

function fecharModalRecuperacao() {
  fecharModal('forgotModal');
  document.getElementById('resetTokenInput').value = '';
  document.getElementById('newPasswordInput').value = '';
}

async function solicitarCodigo(evento) {
  evento.preventDefault();

  const email = document.getElementById('forgotEmail').value.trim();

  const { ok, data } = await api('/esqueci-senha', {
    method: 'POST',
    body: JSON.stringify({ email })
  });

  if (ok) {
    //Troca para a tela de digitar o código
    document.getElementById('stepRequestCode').classList.add('hidden');
    document.getElementById('stepResetPassword').classList.remove('hidden');
  } else {
    alert((data && data.erro) || 'Erro ao gerar código.');
  }
}

async function redefinirSenha(evento) {
  evento.preventDefault();

  const token = document.getElementById('resetTokenInput').value.trim();
  const novaSenha = document.getElementById('newPasswordInput').value;

  const { ok, data } = await api('/redefinir-senha', {
    method: 'POST',
    body: JSON.stringify({ token, novaSenha })
  });

  if (ok) {
    fecharModalRecuperacao();
    const sucessoDiv = document.getElementById('loginSuccess');
    sucessoDiv.innerText = (data && data.mensagem) || 'Senha redefinida.';
    sucessoDiv.classList.remove('hidden');
  } else {
    alert((data && data.erro) || 'Erro ao redefinir senha.');
  }
}


//5. CONTROLE DE MODAIS

function abrirModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function fecharModal(id) {
  document.getElementById(id).classList.add('hidden');
}


//6. CARREGAMENTO DE DADOS

async function carregarClientes() {
  const { ok, data } = await api('/clientes');
  if (!ok) return;

  const select = document.getElementById('selectCliente');
  select.innerHTML = '<option value="">Selecione o Cliente</option>';

  //O servidor já devolve o telefone formatado "(11) 98765-4321"
  data.forEach(cliente => {
    const opcao = document.createElement('option');
    opcao.value = cliente.id;
    opcao.textContent = cliente.nome + ' (' + cliente.telefone + ')';
    select.appendChild(opcao);
  });
}

async function carregarProfissionais() {
  const { ok, data } = await api('/profissionais');
  if (!ok) return;

  const select = document.getElementById('selectProfissional');
  select.innerHTML = '<option value="">Selecione quem vai atender</option>';

  data.forEach(prof => {
    const opcao = document.createElement('option');
    opcao.value = prof.id;
    opcao.textContent = prof.nome + ' (' + (prof.cargo || 'Atendente') + ')';
    select.appendChild(opcao);
  });
}

async function carregarServicos() {
  const { ok, data } = await api('/servicos');
  if (!ok) return;

  const select = document.getElementById('selectServico');
  select.innerHTML = '<option value="">Selecione o Serviço</option>';

  data.forEach(serv => {
    const opcao = document.createElement('option');
    opcao.value = serv.id;
    const preco = Number(serv.preco).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
    opcao.textContent = serv.nome + ' - ' + preco;
    select.appendChild(opcao);
  });
}

async function carregarAgendamentos() {
  const { ok, data } = await api('/agendamentos');
  if (!ok) return;

  todosAgendamentos = data || [];
  renderizarAgendamentos(todosAgendamentos);
}


//7. RENDERIZAÇÃO DA TIMELINE

function renderizarAgendamentos(lista) {
  const container = document.getElementById('timeline-agendamentos');
  container.innerHTML = '';

  //Se não tem nada, mostra mensagem
  if (!lista || lista.length === 0) {
    const vazio = document.createElement('div');
    vazio.className = 'text-center py-8 text-slate-500 text-xs';
    vazio.textContent = 'Nenhum agendamento encontrado.';
    container.appendChild(vazio);
    return;
  }

  //Para cada agendamento, cria um card
  lista.forEach(item => {
    const dataObj = new Date(item.data_hora_inicio);
    const hora = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dataFormatada = dataObj.toLocaleDateString('pt-BR');
    const precoFormatado = item.servico_preco
      ? Number(item.servico_preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : 'R$ 0,00';

    const card = document.createElement('div');
    card.className = 'glass-card rounded-2xl p-3.5 flex gap-3 border-l-4 border-l-indigo-500';

    //IMPORTANTE: tudo que vem do banco passa por escapeHtml
    card.innerHTML = `
      <div class="text-center border-r border-slate-700/60 pr-3 my-auto">
        <span class="block font-bold text-slate-200 text-sm">${escapeHtml(hora)}</span>
        <span class="text-[10px] text-slate-400">${escapeHtml(dataFormatada)}</span>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-1 mb-1">
          <h3 class="font-semibold text-slate-100 text-sm truncate">${escapeHtml(item.cliente_nome)}</h3>
          <span class="px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            ${escapeHtml(item.status || 'agendado')}
          </span>
        </div>
        <p class="text-xs text-slate-300 mb-1 flex items-center gap-1.5">
          <i class="fa-solid fa-scissors text-indigo-400 text-[10px]"></i>
          ${escapeHtml(item.servico_nome || 'Serviço não especificado')}
        </p>
        <div class="flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/80 mt-1">
          <span>
            <i class="fa-solid fa-user-gear text-slate-500"></i>
            ${escapeHtml(item.profissional_nome || 'A definir')}
          </span>
          <div class="flex items-center gap-3">
            <span class="font-semibold text-slate-200">${escapeHtml(precoFormatado)}</span>
            <button class="btn-cancelar text-rose-400 hover:text-rose-300 transition"
                    title="Cancelar agendamento"
                    data-id="${Number(item.id)}">
              <i class="fa-solid fa-trash text-xs"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    container.appendChild(card);
  });

  //Liga cada botão de cancelar ao seu agendamento
  container.querySelectorAll('.btn-cancelar').forEach(botao => {
    botao.addEventListener('click', () => {
      cancelarAgendamento(Number(botao.dataset.id));
    });
  });
}


//8. AÇÕES DO USUÁRIO

async function salvarAgendamento(evento) {
  evento.preventDefault();

  const cliente_id      = document.getElementById('selectCliente').value;
  const profissional_id = document.getElementById('selectProfissional').value;
  const servico_id      = document.getElementById('selectServico').value;
  const data            = document.getElementById('modalDateInput').value;
  const hora            = document.getElementById('modalTimeInput').value;

  if (!cliente_id || !profissional_id || !servico_id || !data || !hora) {
    alert('Preencha todos os campos.');
    return;
  }

  //Junta data e hora no formato que o backend espera
  const data_hora_inicio = data + 'T' + hora + ':00';

  const { ok, data: resposta } = await api('/agendamentos', {
    method: 'POST',
    body: JSON.stringify({ cliente_id, profissional_id, servico_id, data_hora_inicio })
  });

  if (ok) {
    fecharModal('bookingModal');
    document.getElementById('formAgendamento').reset();
    document.getElementById('modalTimeInput').value = '10:00';
    carregarAgendamentos();
  } else {
    alert((resposta && resposta.erro) || 'Erro ao agendar.');
  }
}

async function cancelarAgendamento(id) {
  if (!confirm('Deseja realmente cancelar este agendamento?')) return;

  //Usa PATCH (soft delete no backend)
  const { ok, data } = await api('/agendamentos/' + id + '/cancelar', {
    method: 'PATCH'
  });

  if (ok) {
    carregarAgendamentos();
  } else {
    alert((data && data.erro) || 'Erro ao cancelar.');
  }
}

async function salvarCliente(evento) {
  evento.preventDefault();

  const nome = document.getElementById('clienteNomeInput').value.trim();
  const telefone = document.getElementById('clienteTelefoneInput').value.trim();

  const { ok, data } = await api('/clientes', {
    method: 'POST',
    body: JSON.stringify({ nome, telefone })
  });

  if (ok) {
    document.getElementById('formCliente').reset();
    fecharModal('clientModal');
    carregarClientes();
  } else {
    alert((data && data.erro) || 'Erro ao salvar cliente.');
  }
}

async function salvarProfissional(evento) {
  evento.preventDefault();

  const nome  = document.getElementById('staffNomeInput').value.trim();
  const cargo = document.getElementById('staffCargoInput').value.trim();

  const { ok, data } = await api('/profissionais', {
    method: 'POST',
    body: JSON.stringify({ nome, cargo })
  });

  if (ok) {
    document.getElementById('formStaff').reset();
    fecharModal('staffModal');
    carregarProfissionais();
  } else {
    alert((data && data.erro) || 'Erro ao salvar profissional.');
  }
}

function filtrarAgendamentos() {
  const termo = document.getElementById('searchInput').value.toLowerCase().trim();

  if (!termo) {
    renderizarAgendamentos(todosAgendamentos);
    return;
  }

  const filtrados = todosAgendamentos.filter(ag => {
    const cliente = (ag.cliente_nome || '').toLowerCase();
    const servico = (ag.servico_nome || '').toLowerCase();
    const profissional = (ag.profissional_nome || '').toLowerCase();
    return cliente.includes(termo) || servico.includes(termo) || profissional.includes(termo);
  });

  renderizarAgendamentos(filtrados);
}