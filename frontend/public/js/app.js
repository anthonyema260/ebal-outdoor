// ── CONFIG ────────────────────────────────────────────────────────────────────
const API = '/api';

// ── ESTADO GLOBAL ─────────────────────────────────────────────────────────────
let placas = [], contratos = [], leads = [], dashboard = {};
let deletarPendente = null;

// ── HELPERS ───────────────────────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function fmtR(v) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 });
}
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
    'Ocupada':'badge-verde','Livre':'badge-vermelho','Vencendo':'badge-laranja',
    'Ativo':'badge-verde','Vencido':'badge-vermelho',
    'Em contato':'badge-azul','Proposta enviada':'badge-laranja',
    'Negociando':'badge-laranja','Fechado':'badge-verde','Perdido':'badge-cinza'
  };
  return `<span class="badge ${m[status]||'badge-cinza'}">${status}</span>`;
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
function toast(msg, tipo='success') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.innerHTML = `<span>${tipo==='success'?'✓':'✕'}</span> ${msg}`;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── FETCH ─────────────────────────────────────────────────────────────────────
async function api(path, opts={}) {
  try {
    const o = { headers:{'Content-Type':'application/json'}, method: opts.method||'GET' };
    if (opts.body) o.body = JSON.stringify(opts.body);
    const r = await fetch(API + path, o);
    const data = await r.json();
    if (!r.ok) throw new Error(data.erro || 'Erro no servidor');
    return data;
  } catch(e) {
    toast(e.message || 'Erro de conexão', 'error');
    throw e;
  }
}

// ── NAVEGAÇÃO ─────────────────────────────────────────────────────────────────
function navTo(page) {
  $$('.page').forEach(p => p.classList.remove('active'));
  $$('.bnav-item,.sidebar-item').forEach(b => b.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  $$('[data-page="' + page + '"]').forEach(b => b.classList.add('active'));
  const fab = document.getElementById('fab-btn');
  if (fab) fab.style.display = (page==='argumentos'||page==='dashboard') ? 'none' : 'flex';
  window.scrollTo(0,0);
  renderPage(page);
}

function renderPage(page) {
  if (page==='dashboard') renderDashboard();
  else if (page==='placas') renderPlacas();
  else if (page==='contratos') renderContratos();
  else if (page==='leads') renderLeads();
}

function paginaAtual() {
  const p = document.querySelector('.page.active');
  return p ? p.id.replace('page-','') : 'dashboard';
}

// ── CARREGAR ──────────────────────────────────────────────────────────────────
async function carregarTudo() {
  try {
    const [p,c,l,d] = await Promise.all([
      api('/placas'), api('/contratos'), api('/leads'), api('/dashboard')
    ]);
    placas=p||[]; contratos=c||[]; leads=l||[]; dashboard=d||{};
    renderPage(paginaAtual());
  } catch(e) { console.error('Erro ao carregar:', e); }
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function renderDashboard() {
  const d = dashboard;
  const set = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
  set('m-ocupadas', d.ocupadas??'—');
  set('m-livres', d.livres??'—');
  set('m-vencendo', d.vencendo30??'—');
  set('m-receita', d.receitaMensal!=null ? fmtR(d.receitaMensal) : '—');
  set('taxa-ocup', (d.taxaOcupacao??0)+'%');

  const bar = document.getElementById('ocup-bar');
  if (bar && placas.length) {
    bar.innerHTML = placas.map(p => {
      const cor = p.status==='Ocupada'?'#2d8a4e': p.status==='Vencendo'?'#d4691e':'#c0392b';
      return `<div class="ocup-seg" style="background:${cor}" title="${p.codigo} – ${p.status}"></div>`;
    }).join('');
  }

  const alertasEl = document.getElementById('alertas');
  if (alertasEl) {
    const urgentes = contratos.filter(c => c.dias_restantes>=0 && c.dias_restantes<=30);
    alertasEl.innerHTML = !urgentes.length
      ? `<div class="empty" style="padding:20px"><div class="empty-icon">✅</div><div class="empty-title">Tudo em dia</div><div class="empty-sub">Nenhum contrato vencendo nos próximos 30 dias.</div></div>`
      : urgentes.map(c => `
          <div class="alert ${c.dias_restantes<=7?'alert-vermelho':'alert-laranja'}">
            <div>
              <div class="alert-title">${c.empresa} — ${c.placa_codigo}</div>
              <div class="alert-sub">Vence em ${diasTexto(c.dias_restantes)} · ${fmtR(c.valor)}/mês</div>
            </div>
            <button class="btn btn-sm btn-outline" onclick="abrirModalContrato(${c.id})">Renovar</button>
          </div>`).join('');
  }

  const leadsEl = document.getElementById('leads-recentes');
  if (leadsEl) {
    const ativos = leads.filter(l=>l.status!=='Fechado'&&l.status!=='Perdido').slice(0,4);
    leadsEl.innerHTML = !ativos.length
      ? `<div class="empty" style="padding:20px"><div class="empty-sub">Nenhum lead ativo.</div></div>`
      : ativos.map(l=>`
          <div class="item-row">
            <div class="item-icon" style="background:#e8f0fb">🎯</div>
            <div class="item-info">
              <div class="item-titulo">${l.empresa}</div>
              <div class="item-sub">${l.segmento||''} · ${l.cidade}</div>
              <div class="item-meta">${badgeStatus(l.status)}<span style="font-size:12px;color:#888;margin-left:6px">${l.proxima_acao||''}</span></div>
            </div>
          </div>`).join('');
  }
}

// ── PLACAS ────────────────────────────────────────────────────────────────────
function renderPlacas() {
  const el = document.getElementById('lista-placas');
  if (!el) return;
  el.innerHTML = !placas.length
    ? `<div class="empty"><div class="empty-icon">📋</div><div class="empty-title">Nenhuma placa cadastrada</div><div class="empty-sub">Toque no botão + para adicionar.</div></div>`
    : placas.map(p=>`
        <div class="item-row">
          <div class="item-icon" style="background:${p.status==='Ocupada'?'#eaf5ef':p.status==='Vencendo'?'#fdf0e6':'#fdecea'}">📋</div>
          <div class="item-info">
            <div class="item-titulo">${p.codigo}</div>
            <div class="item-sub">${p.referencia||p.localizacao}</div>
            <div class="item-meta">
              ${badgeStatus(p.status)}
              ${p.anunciante?`<span style="font-size:12px;color:#555">${p.anunciante}</span>`:''}
              <span style="font-size:12px;font-weight:600;color:#2d8a4e">${fmtR(p.valor_mensal)}/mês</span>
            </div>
          </div>
          <div class="item-actions">
            <button class="btn btn-ghost btn-sm" onclick="abrirModalPlaca(${p.id})">✏️</button>
            <button class="btn btn-ghost btn-sm" onclick="confirmarDeletar('placa',${p.id},'${p.codigo}')">🗑️</button>
          </div>
        </div>`).join('');
}

function abrirModalPlaca(id) {
  const p = id ? placas.find(x=>x.id===id) : null;
  document.getElementById('modal-placa-title').textContent = p ? 'Editar Placa' : 'Nova Placa';
  document.getElementById('fp-id').value = p?.id||'';
  document.getElementById('fp-codigo').value = p?.codigo||'';
  document.getElementById('fp-localizacao').value = p?.localizacao||'Rodovia SE-100, sentido Aracaju';
  document.getElementById('fp-referencia').value = p?.referencia||'';
  document.getElementById('fp-status').value = p?.status||'Livre';
  document.getElementById('fp-anunciante').value = p?.anunciante||'';
  document.getElementById('fp-valor').value = p?.valor_mensal||'';
  document.getElementById('fp-obs').value = p?.observacoes||'';
  abrirModal('modal-placa');
}

async function salvarPlaca() {
  const id = document.getElementById('fp-id').value;
  const body = {
    codigo: document.getElementById('fp-codigo').value.trim(),
    localizacao: document.getElementById('fp-localizacao').value.trim(),
    referencia: document.getElementById('fp-referencia').value.trim(),
    status: document.getElementById('fp-status').value,
    anunciante: document.getElementById('fp-anunciante').value.trim(),
    valor_mensal: parseFloat(document.getElementById('fp-valor').value)||0,
    observacoes: document.getElementById('fp-obs').value.trim()
  };
  if (!body.codigo||!body.localizacao) { toast('Preencha código e localização.','error'); return; }
  try {
    if (id) await api(`/placas/${id}`,{method:'PUT',body});
    else await api('/placas',{method:'POST',body});
    toast(id?'Placa atualizada!':'Placa cadastrada!');
    fecharModal('modal-placa');
    await carregarTudo();
  } catch{}
}

// ── CONTRATOS ─────────────────────────────────────────────────────────────────
function renderContratos() {
  const el = document.getElementById('lista-contratos');
  if (!el) return;
  el.innerHTML = !contratos.length
    ? `<div class="empty"><div class="empty-icon">📄</div><div class="empty-title">Nenhum contrato</div><div class="empty-sub">Cadastre um contrato para acompanhar.</div></div>`
    : contratos.map(c=>{
        const d=c.dias_restantes;
        const cls=d<0?'badge-vermelho':d<=15?'badge-laranja':'badge-verde';
        return `
          <div class="item-row">
            <div class="item-icon" style="background:#eaf5ef">📄</div>
            <div class="item-info">
              <div class="item-titulo">${c.empresa}</div>
              <div class="item-sub">${c.placa_codigo} · ${c.cidade} · ${fmtR(c.valor)}/mês</div>
              <div class="item-meta">
                <span class="badge ${cls}">${diasTexto(d)}</span>
                <span style="font-size:12px;color:#888">${fmtData(c.data_inicio)} → ${fmtData(c.data_vencimento)}</span>
              </div>
            </div>
            <div class="item-actions">
              <button class="btn btn-ghost btn-sm" onclick="abrirModalContrato(${c.id})">🔄</button>
              <button class="btn btn-ghost btn-sm" onclick="confirmarDeletar('contrato',${c.id},'${c.empresa}')">🗑️</button>
            </div>
          </div>`;
      }).join('');
}

function abrirModalContrato(id) {
  const c = id ? contratos.find(x=>x.id===id) : null;
  document.getElementById('modal-contrato-title').textContent = c ? 'Renovar Contrato' : 'Novo Contrato';
  document.getElementById('fc-id').value = c?.id||'';
  const sel = document.getElementById('fc-placa');
  sel.innerHTML = placas.map(p=>`<option value="${p.id}" ${c&&c.placa_id===p.id?'selected':''}>${p.codigo} – ${p.referencia||p.localizacao.substring(0,30)}</option>`).join('');
  document.getElementById('fc-empresa').value = c?.empresa||'';
  document.getElementById('fc-cidade').value = c?.cidade||'Aracaju';
  document.getElementById('fc-contato-nome').value = c?.contato_nome||'';
  document.getElementById('fc-contato-tel').value = c?.contato_tel||'';
  document.getElementById('fc-valor').value = c?.valor||'';
  const hoje = new Date().toISOString().split('T')[0];
  const em3 = new Date(); em3.setMonth(em3.getMonth()+3);
  document.getElementById('fc-inicio').value = hoje;
  document.getElementById('fc-venc').value = em3.toISOString().split('T')[0];
  document.getElementById('fc-obs').value = '';
  abrirModal('modal-contrato');
}

async function salvarContrato() {
  const id = document.getElementById('fc-id').value;
  const body = {
    placa_id: parseInt(document.getElementById('fc-placa').value),
    empresa: document.getElementById('fc-empresa').value.trim(),
    cidade: document.getElementById('fc-cidade').value.trim()||'Aracaju',
    contato_nome: document.getElementById('fc-contato-nome').value.trim(),
    contato_tel: document.getElementById('fc-contato-tel').value.trim(),
    data_inicio: document.getElementById('fc-inicio').value,
    data_vencimento: document.getElementById('fc-venc').value,
    valor: parseFloat(document.getElementById('fc-valor').value)||0,
    observacoes: document.getElementById('fc-obs').value.trim()
  };
  if (!body.empresa||!body.data_inicio||!body.data_vencimento||!body.valor) {
    toast('Preencha todos os campos obrigatórios.','error'); return;
  }
  try {
    if (id) await api(`/contratos/${id}`,{method:'PUT',body});
    else await api('/contratos',{method:'POST',body});
    toast('Contrato salvo!');
    fecharModal('modal-contrato');
    await carregarTudo();
  } catch{}
}

// ── LEADS ─────────────────────────────────────────────────────────────────────
function renderLeads() {
  const el = document.getElementById('lista-leads');
  if (!el) return;
  el.innerHTML = !leads.length
    ? `<div class="empty"><div class="empty-icon">🎯</div><div class="empty-title">Nenhum lead</div><div class="empty-sub">Cadastre prospects para acompanhar.</div></div>`
    : leads.map(l=>`
        <div class="item-row">
          <div class="item-icon" style="background:#e8f0fb">🎯</div>
          <div class="item-info">
            <div class="item-titulo">${l.empresa}</div>
            <div class="item-sub">${l.segmento?l.segmento+' · ':''}${l.cidade}${l.contato_tel?' · '+l.contato_tel:''}</div>
            <div class="item-meta">
              ${badgeStatus(l.status)}
              ${l.placa_codigo?`<span style="font-size:12px;color:#555">📋 ${l.placa_codigo}</span>`:''}
            </div>
            ${l.proxima_acao?`<div style="font-size:12px;color:#d4691e;margin-top:4px">→ ${l.proxima_acao}</div>`:''}
          </div>
          <div class="item-actions">
            <button class="btn btn-ghost btn-sm" onclick="abrirModalLead(${l.id})">✏️</button>
            <button class="btn btn-ghost btn-sm" onclick="confirmarDeletar('lead',${l.id},'${l.empresa}')">🗑️</button>
          </div>
        </div>`).join('');
}

function abrirModalLead(id) {
  const l = id ? leads.find(x=>x.id===id) : null;
  document.getElementById('modal-lead-title').textContent = l ? 'Editar Lead' : 'Novo Lead';
  document.getElementById('fl-id').value = l?.id||'';
  document.getElementById('fl-empresa').value = l?.empresa||'';
  document.getElementById('fl-segmento').value = l?.segmento||'';
  document.getElementById('fl-cidade').value = l?.cidade||'Aracaju';
  document.getElementById('fl-contato-nome').value = l?.contato_nome||'';
  document.getElementById('fl-contato-tel').value = l?.contato_tel||'';
  document.getElementById('fl-status').value = l?.status||'Em contato';
  document.getElementById('fl-acao').value = l?.proxima_acao||'';
  document.getElementById('fl-obs').value = l?.observacoes||'';
  const sel = document.getElementById('fl-placa');
  sel.innerHTML = `<option value="">— Nenhuma —</option>`+
    placas.filter(p=>p.status!=='Ocupada'||(l&&l.placa_id===p.id)).map(p=>
      `<option value="${p.id}" ${l&&l.placa_id===p.id?'selected':''}>${p.codigo} – ${p.referencia||''}</option>`
    ).join('');
  abrirModal('modal-lead');
}

async function salvarLead() {
  const id = document.getElementById('fl-id').value;
  const body = {
    empresa: document.getElementById('fl-empresa').value.trim(),
    segmento: document.getElementById('fl-segmento').value,
    cidade: document.getElementById('fl-cidade').value.trim()||'Aracaju',
    contato_nome: document.getElementById('fl-contato-nome').value.trim(),
    contato_tel: document.getElementById('fl-contato-tel').value.trim(),
    status: document.getElementById('fl-status').value,
    placa_id: document.getElementById('fl-placa').value ? parseInt(document.getElementById('fl-placa').value) : null,
    proxima_acao: document.getElementById('fl-acao').value.trim(),
    observacoes: document.getElementById('fl-obs').value.trim()
  };
  if (!body.empresa) { toast('Informe o nome da empresa.','error'); return; }
  try {
    if (id) await api(`/leads/${id}`,{method:'PUT',body});
    else await api('/leads',{method:'POST',body});
    toast(id?'Lead atualizado!':'Lead cadastrado!');
    fecharModal('modal-lead');
    await carregarTudo();
  } catch{}
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
function abrirModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('open'); document.body.style.overflow='hidden'; }
}
function fecharModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('open'); document.body.style.overflow=''; }
}
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) fecharModal(e.target.id);
});

// ── DELETAR ───────────────────────────────────────────────────────────────────
function confirmarDeletar(tipo, id, nome) {
  deletarPendente = {tipo, id};
  const el = document.getElementById('confirmar-nome');
  if (el) el.textContent = nome;
  abrirModal('modal-confirmar');
}
async function executarDeletar() {
  if (!deletarPendente) return;
  const rotas = {placa:'/placas/',contrato:'/contratos/',lead:'/leads/'};
  try {
    await api(rotas[deletarPendente.tipo]+deletarPendente.id, {method:'DELETE'});
    toast('Removido com sucesso!');
    fecharModal('modal-confirmar');
    deletarPendente = null;
    await carregarTudo();
  } catch{}
}

// ── FAB ───────────────────────────────────────────────────────────────────────
function fabAction() {
  const pg = paginaAtual();
  if (pg==='placas') abrirModalPlaca();
  else if (pg==='contratos') abrirModalContrato();
  else if (pg==='leads') abrirModalLead();
}

// ── WHATSAPP ──────────────────────────────────────────────────────────────────
function copiarMensagem() {
  const msg = `Boa tarde, [Nome]! Tudo bem?\n\nSou Emanuel, da Ebal Outdoor aqui de Sergipe.\n\nTrabalhamos com painéis ao longo da rodovia que liga o sul do estado a Aracaju. Quem passa por ali vai direto para a capital — trabalhadores, comerciantes, famílias que frequentam Aracaju todo dia.\n\nA mídia outdoor é a 3ª mais notada pelos brasileiros e gera R$5,97 de retorno para cada R$1 investido.\n\nAcredito que faz muito sentido para a [empresa]. Posso te mostrar os pontos disponíveis e os valores?`;
  navigator.clipboard.writeText(msg)
    .then(()=>toast('Mensagem copiada!'))
    .catch(()=>toast('Erro ao copiar.','error'));
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const dataEl = document.getElementById('data-hoje');
  if (dataEl) {
    dataEl.textContent = new Date().toLocaleDateString('pt-BR', {weekday:'long',day:'numeric',month:'long'});
  }
  navTo('dashboard');
  carregarTudo();
  setInterval(carregarTudo, 5 * 60 * 1000);
});
