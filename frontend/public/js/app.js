// ── CONFIG ────────────────────────────────────────────────────────────────────
const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api'
  : '/api';

// ── ESTADO GLOBAL ─────────────────────────────────────────────────────────────
let placas = [], contratos = [], leads = [], dashboard = {};

// ── HELPERS ───────────────────────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function fmt(v) { return Number(v).toLocaleString('pt-BR'); }
function fmtR(v) { return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0 }); }
function fmtData(d) {
  if (!d) return '—';
  const [y, m, dia] = d.split('-');
  return `${dia}/${m}/${y}`;
}

function diasTexto(n) {
  if (n < 0) return 'Vencido';
  if (n === 0) return 'Vence hoje';
  return `${n} dia${n === 1 ? '' : 's'}`;
}

function badgeStatus(status) {
  const m = {
    'Ocupada': 'badge-verde', 'Livre': 'badge-vermelho', 'Vencendo': 'badge-laranja',
    'Ativo': 'badge-verde', 'Vencido': 'badge-vermelho',
    'Em contato': 'badge-azul', 'Proposta enviada': 'badge-laranja',
    'Negociando': 'badge-laranja', 'Fechado': 'badge-verde', 'Perdido': 'badge-cinza'
  };
  return `<span class="badge ${m[status] || 'badge-cinza'}">${status}</span>`;
}

function iconePlaca(status) {
  const cores = { 'Ocupada': '#eaf5ef', 'Livre': '#fdecea', 'Vencendo': '#fdf0e6' };
  return `<div class="item-icon" style="background:${cores[status]||'#eee'}">📋</div>`;
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
function toast(msg, tipo = 'success') {
  const c = $('#toast-container');
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.innerHTML = `<span>${tipo === 'success' ? '✓' : '✕'}</span> ${msg}`;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── FETCH API ─────────────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  try {
    const r = await fetch(API + path, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.erro || 'Erro no servidor');
    return data;
  } catch (e) {
    toast(e.message || 'Erro de conexão', 'error');
    throw e;
  }
}

// ── NAVEGAÇÃO ─────────────────────────────────────────────────────────────────
function navTo(page) {
  $$('.page').forEach(p => p.classList.remove('active'));
  $$('.bnav-item, .sidebar-item').forEach(b => b.classList.remove('active'));
  $(`#page-${page}`)?.classList.add('active');
  $$(`[data-page="${page}"]`).forEach(b => b.classList.add('active'));
  window.scrollTo(0, 0);
  renderPage(page);
}

function renderPage(page) {
  if (page === 'dashboard') renderDashboard();
  else if (page === 'placas') renderPlacas();
  else if (page === 'contratos') renderContratos();
  else if (page === 'leads') renderLeads();
  else if (page === 'argumentos') renderArgumentos();
}

// ── CARREGAMENTO ──────────────────────────────────────────────────────────────
async function carregarTudo() {
  try {
    [placas, contratos, leads, dashboard] = await Promise.all([
      api('/placas'), api('/contratos'), api('/leads'), api('/dashboard')
    ]);
    renderPage(paginaAtual());
  } catch {}
}

function paginaAtual() {
  const p = $('.page.active');
  return p ? p.id.replace('page-', '') : 'dashboard';
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function renderDashboard() {
  const d = dashboard;
  $('#m-ocupadas').textContent = d.ocupadas ?? '—';
  $('#m-livres').textContent = d.livres ?? '—';
  $('#m-vencendo').textContent = d.vencendo30 ?? '—';
  $('#m-receita').textContent = d.receitaMensal != null ? fmtR(d.receitaMensal) : '—';

  // Barra ocupação
  const bar = $('#ocup-bar');
  if (bar && placas.length) {
    bar.innerHTML = placas.map(p => {
      const cor = p.status === 'Ocupada' ? '#2d8a4e' : p.status === 'Vencendo' ? '#d4691e' : '#c0392b';
      return `<div class="ocup-seg" style="background:${cor}" title="${p.codigo} – ${p.status}"></div>`;
    }).join('');
  }

  // Taxa
  const taxa = $('#taxa-ocup');
  if (taxa) taxa.textContent = (d.taxaOcupacao ?? 0) + '%';

  // Alertas
  const alertasEl = $('#alertas');
  if (alertasEl) {
    const urgentes = contratos.filter(c => c.dias_restantes >= 0 && c.dias_restantes <= 30);
    if (!urgentes.length) {
      alertasEl.innerHTML = `<div class="empty" style="padding:20px"><div class="empty-icon">✅</div><div class="empty-title">Tudo em dia</div><div class="empty-sub">Nenhum contrato vencendo nos próximos 30 dias.</div></div>`;
    } else {
      alertasEl.innerHTML = urgentes.map(c => {
        const cls = c.dias_restantes <= 7 ? 'alert-vermelho' : 'alert-laranja';
        return `<div class="alert ${cls}">
          <div>
            <div class="alert-title">${c.empresa} — ${c.placa_codigo}</div>
            <div class="alert-sub">Vence em ${diasTexto(c.dias_restantes)} · ${fmtR(c.valor)}/mês</div>
          </div>
          <button class="btn btn-sm btn-outline" onclick="renovarContrato(${c.id})">Renovar</button>
        </div>`;
      }).join('');
    }
  }

  // Leads recentes
  const leadsEl = $('#leads-recentes');
  if (leadsEl) {
    const ativos = leads.filter(l => l.status !== 'Fechado' && l.status !== 'Perdido').slice(0, 4);
    if (!ativos.length) {
      leadsEl.innerHTML = `<div class="empty" style="padding:20px"><div class="empty-sub">Nenhum lead ativo. Cadastre um na aba Prospecção.</div></div>`;
    } else {
      leadsEl.innerHTML = ativos.map(l => `
        <div class="item-row">
          <div class="item-icon" style="background:#e8f0fb">🎯</div>
          <div class="item-info">
            <div class="item-titulo">${l.empresa}</div>
            <div class="item-sub">${l.segmento} · ${l.cidade}</div>
            <div class="item-meta">${badgeStatus(l.status)}<span style="font-size:12px;color:#888">${l.proxima_acao || ''}</span></div>
          </div>
        </div>
      `).join('');
    }
  }
}

// ── PLACAS ────────────────────────────────────────────────────────────────────
function renderPlacas() {
  const el = $('#lista-placas');
  if (!el) return;
  if (!placas.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">📋</div><div class="empty-title">Nenhuma placa cadastrada</div><div class="empty-sub">Toque no botão + para adicionar sua primeira placa.</div></div>`;
    return;
  }
  el.innerHTML = placas.map(p => `
    <div class="item-row">
      ${iconePlaca(p.status)}
      <div class="item-info">
        <div class="item-titulo">${p.codigo}</div>
        <div class="item-sub">${p.referencia || p.localizacao}</div>
        <div class="item-meta">
          ${badgeStatus(p.status)}
          ${p.anunciante ? `<span style="font-size:12px;color:#555">${p.anunciante}</span>` : ''}
          <span style="font-size:12px;font-weight:600;color:#2d8a4e">${fmtR(p.valor_mensal)}/mês</span>
        </div>
      </div>
      <div class="item-actions">
        <button class="btn btn-ghost btn-sm" onclick="editarPlaca(${p.id})">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="confirmarDeletar('placa', ${p.id}, '${p.codigo}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

function abrirModalPlaca(id = null) {
  const p = id ? placas.find(x => x.id === id) : null;
  $('#modal-placa-title').textContent = p ? 'Editar Placa' : 'Nova Placa';
  $('#fp-id').value = p?.id || '';
  $('#fp-codigo').value = p?.codigo || '';
  $('#fp-localizacao').value = p?.localizacao || 'Rodovia SE-100, sentido Aracaju';
  $('#fp-referencia').value = p?.referencia || '';
  $('#fp-status').value = p?.status || 'Livre';
  $('#fp-anunciante').value = p?.anunciante || '';
  $('#fp-valor').value = p?.valor_mensal || '';
  $('#fp-obs').value = p?.observacoes || '';
  abrirModal('modal-placa');
}

function editarPlaca(id) { abrirModalPlaca(id); }

async function salvarPlaca() {
  const id = $('#fp-id').value;
  const body = {
    codigo: $('#fp-codigo').value.trim(),
    localizacao: $('#fp-localizacao').value.trim(),
    referencia: $('#fp-referencia').value.trim(),
    status: $('#fp-status').value,
    anunciante: $('#fp-anunciante').value.trim(),
    valor_mensal: parseFloat($('#fp-valor').value) || 0,
    observacoes: $('#fp-obs').value.trim()
  };
  if (!body.codigo || !body.localizacao) { toast('Preencha o código e a localização.', 'error'); return; }
  try {
    if (id) await api(`/placas/${id}`, { method: 'PUT', body });
    else await api('/placas', { method: 'POST', body });
    toast(id ? 'Placa atualizada!' : 'Placa cadastrada!');
    fecharModal('modal-placa');
    await carregarTudo();
  } catch {}
}

// ── CONTRATOS ─────────────────────────────────────────────────────────────────
function renderContratos() {
  const el = $('#lista-contratos');
  if (!el) return;
  if (!contratos.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">📄</div><div class="empty-title">Nenhum contrato</div><div class="empty-sub">Cadastre um contrato para começar a acompanhar.</div></div>`;
    return;
  }
  el.innerHTML = contratos.map(c => {
    const cls = c.dias_restantes < 0 ? 'badge-vermelho' : c.dias_restantes <= 15 ? 'badge-laranja' : 'badge-verde';
    return `
      <div class="item-row">
        <div class="item-icon" style="background:#eaf5ef">📄</div>
        <div class="item-info">
          <div class="item-titulo">${c.empresa}</div>
          <div class="item-sub">${c.placa_codigo} · ${c.cidade} · ${fmtR(c.valor)}/mês</div>
          <div class="item-meta">
            <span class="badge ${cls}">${diasTexto(c.dias_restantes)}</span>
            <span style="font-size:12px;color:#888">${fmtData(c.data_inicio)} → ${fmtData(c.data_vencimento)}</span>
          </div>
        </div>
        <div class="item-actions">
          <button class="btn btn-ghost btn-sm" onclick="renovarContrato(${c.id})">🔄</button>
          <button class="btn btn-ghost btn-sm" onclick="confirmarDeletar('contrato', ${c.id}, '${c.empresa}')">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

function abrirModalContrato(id = null) {
  const c = id ? contratos.find(x => x.id === id) : null;
  $('#modal-contrato-title').textContent = c ? 'Renovar Contrato' : 'Novo Contrato';
  $('#fc-id').value = c?.id || '';

  const sel = $('#fc-placa');
  sel.innerHTML = placas.map(p => `<option value="${p.id}" ${c?.placa_id === p.id ? 'selected' : ''}>${p.codigo} – ${p.referencia || p.localizacao.substring(0,30)}</option>`).join('');

  $('#fc-empresa').value = c?.empresa || '';
  $('#fc-cidade').value = c?.cidade || 'Aracaju';
  $('#fc-contato-nome').value = c?.contato_nome || '';
  $('#fc-contato-tel').value = c?.contato_tel || '';
  $('#fc-valor').value = c?.valor || '';

  const hoje = new Date().toISOString().split('T')[0];
  const em3meses = new Date(); em3meses.setMonth(em3meses.getMonth() + 3);
  $('#fc-inicio').value = hoje;
  $('#fc-venc').value = em3meses.toISOString().split('T')[0];
  $('#fc-obs').value = '';
  abrirModal('modal-contrato');
}

function renovarContrato(id) { abrirModalContrato(id); }

async function salvarContrato() {
  const id = $('#fc-id').value;
  const body = {
    placa_id: parseInt($('#fc-placa').value),
    empresa: $('#fc-empresa').value.trim(),
    cidade: $('#fc-cidade').value.trim() || 'Aracaju',
    contato_nome: $('#fc-contato-nome').value.trim(),
    contato_tel: $('#fc-contato-tel').value.trim(),
    data_inicio: $('#fc-inicio').value,
    data_vencimento: $('#fc-venc').value,
    valor: parseFloat($('#fc-valor').value) || 0,
    observacoes: $('#fc-obs').value.trim()
  };
  if (!body.empresa || !body.data_inicio || !body.data_vencimento || !body.valor)
    { toast('Preencha todos os campos obrigatórios.', 'error'); return; }
  try {
    if (id) await api(`/contratos/${id}`, { method: 'PUT', body });
    else await api('/contratos', { method: 'POST', body });
    toast('Contrato salvo com sucesso!');
    fecharModal('modal-contrato');
    await carregarTudo();
  } catch {}
}

// ── LEADS ─────────────────────────────────────────────────────────────────────
function renderLeads() {
  const el = $('#lista-leads');
  if (!el) return;
  if (!leads.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">🎯</div><div class="empty-title">Nenhum lead cadastrado</div><div class="empty-sub">Cadastre prospects para acompanhar sua prospecção.</div></div>`;
    return;
  }
  el.innerHTML = leads.map(l => `
    <div class="item-row">
      <div class="item-icon" style="background:#e8f0fb">🎯</div>
      <div class="item-info">
        <div class="item-titulo">${l.empresa}</div>
        <div class="item-sub">${l.segmento ? l.segmento + ' · ' : ''}${l.cidade}${l.contato_tel ? ' · ' + l.contato_tel : ''}</div>
        <div class="item-meta">
          ${badgeStatus(l.status)}
          ${l.placa_codigo ? `<span style="font-size:12px;color:#555">📋 ${l.placa_codigo}</span>` : ''}
        </div>
        ${l.proxima_acao ? `<div style="font-size:12px;color:#d4691e;margin-top:4px">→ ${l.proxima_acao}</div>` : ''}
      </div>
      <div class="item-actions">
        <button class="btn btn-ghost btn-sm" onclick="editarLead(${l.id})">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="confirmarDeletar('lead', ${l.id}, '${l.empresa}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

function abrirModalLead(id = null) {
  const l = id ? leads.find(x => x.id === id) : null;
  $('#modal-lead-title').textContent = l ? 'Editar Lead' : 'Novo Lead';
  $('#fl-id').value = l?.id || '';
  $('#fl-empresa').value = l?.empresa || '';
  $('#fl-segmento').value = l?.segmento || '';
  $('#fl-cidade').value = l?.cidade || 'Aracaju';
  $('#fl-contato-nome').value = l?.contato_nome || '';
  $('#fl-contato-tel').value = l?.contato_tel || '';
  $('#fl-status').value = l?.status || 'Em contato';
  $('#fl-acao').value = l?.proxima_acao || '';
  $('#fl-obs').value = l?.observacoes || '';

  const sel = $('#fl-placa');
  sel.innerHTML = `<option value="">— Nenhuma —</option>` +
    placas.filter(p => p.status !== 'Ocupada').map(p =>
      `<option value="${p.id}" ${l?.placa_id === p.id ? 'selected' : ''}>${p.codigo} – ${p.referencia || ''}</option>`
    ).join('');
  abrirModal('modal-lead');
}

function editarLead(id) { abrirModalLead(id); }

async function salvarLead() {
  const id = $('#fl-id').value;
  const body = {
    empresa: $('#fl-empresa').value.trim(),
    segmento: $('#fl-segmento').value,
    cidade: $('#fl-cidade').value.trim() || 'Aracaju',
    contato_nome: $('#fl-contato-nome').value.trim(),
    contato_tel: $('#fl-contato-tel').value.trim(),
    status: $('#fl-status').value,
    placa_id: $('#fl-placa').value ? parseInt($('#fl-placa').value) : null,
    proxima_acao: $('#fl-acao').value.trim(),
    observacoes: $('#fl-obs').value.trim()
  };
  if (!body.empresa) { toast('Informe o nome da empresa.', 'error'); return; }
  try {
    if (id) await api(`/leads/${id}`, { method: 'PUT', body });
    else await api('/leads', { method: 'POST', body });
    toast(id ? 'Lead atualizado!' : 'Lead cadastrado!');
    fecharModal('modal-lead');
    await carregarTudo();
  } catch {}
}

// ── ARGUMENTOS ────────────────────────────────────────────────────────────────
function renderArgumentos() {
  // estático, já no HTML
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
function abrirModal(id) {
  const el = $(`#${id}`);
  el?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function fecharModal(id) {
  $(`#${id}`)?.classList.remove('open');
  document.body.style.overflow = '';
}

// Fecha modal clicando fora
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    fecharModal(e.target.id);
  }
});

// ── DELETAR ───────────────────────────────────────────────────────────────────
let deletarPendente = null;

function confirmarDeletar(tipo, id, nome) {
  deletarPendente = { tipo, id };
  $('#confirmar-nome').textContent = nome;
  abrirModal('modal-confirmar');
}

async function executarDeletar() {
  if (!deletarPendente) return;
  const { tipo, id } = deletarPendente;
  const rotas = { placa: '/placas/', contrato: '/contratos/', lead: '/leads/' };
  try {
    await api(rotas[tipo] + id, { method: 'DELETE' });
    toast('Removido com sucesso!');
    fecharModal('modal-confirmar');
    deletarPendente = null;
    await carregarTudo();
  } catch {}
}

// ── FAB ───────────────────────────────────────────────────────────────────────
function fabAction() {
  const pg = paginaAtual();
  if (pg === 'placas') abrirModalPlaca();
  else if (pg === 'contratos') abrirModalContrato();
  else if (pg === 'leads') abrirModalLead();
  else navTo('leads'); // dashboard → vai para leads
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  navTo('dashboard');
  carregarTudo();

  // Auto-refresh a cada 5 minutos
  setInterval(carregarTudo, 5 * 60 * 1000);
});
