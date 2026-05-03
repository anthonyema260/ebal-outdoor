import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, jsonify, request, send_from_directory
from db import get_db, init_db, dias_ate_vencer, rows_to_list, row_to_dict

FRONTEND = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public')

app = Flask(__name__, static_folder=FRONTEND, static_url_path='')

# Inicializa banco ao subir
init_db()

# ── CORS manual (sem dependência externa) ─────────────────────────────────────
@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
    return response

@app.route('/api/<path:p>', methods=['OPTIONS'])
def options_handler(p):
    return jsonify({}), 200

# ── SERVIR FRONTEND ───────────────────────────────────────────────────────────
@app.route('/')
def index():
    return send_from_directory(FRONTEND, 'index.html')

@app.route('/<path:path>')
def static_files(path):
    full = os.path.join(FRONTEND, path)
    if os.path.isfile(full):
        return send_from_directory(FRONTEND, path)
    return send_from_directory(FRONTEND, 'index.html')

# ── PLACAS ────────────────────────────────────────────────────────────────────
@app.route('/api/placas', methods=['GET'])
def listar_placas():
    db = get_db()
    rows = db.execute("SELECT * FROM placas ORDER BY codigo").fetchall()
    db.close()
    return jsonify(rows_to_list(rows))

@app.route('/api/placas/<int:pid>', methods=['GET'])
def obter_placa(pid):
    db = get_db()
    row = db.execute("SELECT * FROM placas WHERE id=?", (pid,)).fetchone()
    db.close()
    if not row:
        return jsonify({'erro': 'Placa não encontrada'}), 404
    return jsonify(row_to_dict(row))

@app.route('/api/placas', methods=['POST'])
def criar_placa():
    d = request.json or {}
    codigo = (d.get('codigo') or '').strip()
    localizacao = (d.get('localizacao') or '').strip()
    if not codigo or not localizacao:
        return jsonify({'erro': 'Código e localização são obrigatórios'}), 400
    db = get_db()
    try:
        cur = db.execute(
            "INSERT INTO placas (codigo,localizacao,referencia,status,anunciante,valor_mensal,observacoes) VALUES (?,?,?,?,?,?,?)",
            (codigo, localizacao, d.get('referencia',''), d.get('status','Livre'),
             d.get('anunciante',''), float(d.get('valor_mensal') or 0), d.get('observacoes',''))
        )
        db.commit()
        return jsonify({'id': cur.lastrowid, 'mensagem': 'Placa cadastrada com sucesso'})
    except Exception as e:
        return jsonify({'erro': 'Código já existe'}), 400
    finally:
        db.close()

@app.route('/api/placas/<int:pid>', methods=['PUT'])
def atualizar_placa(pid):
    d = request.json or {}
    db = get_db()
    db.execute(
        """UPDATE placas SET codigo=?,localizacao=?,referencia=?,status=?,anunciante=?,
           valor_mensal=?,observacoes=?,atualizado_em=datetime('now','localtime') WHERE id=?""",
        (d.get('codigo',''), d.get('localizacao',''), d.get('referencia',''),
         d.get('status','Livre'), d.get('anunciante',''),
         float(d.get('valor_mensal') or 0), d.get('observacoes',''), pid)
    )
    db.commit(); db.close()
    return jsonify({'mensagem': 'Placa atualizada'})

@app.route('/api/placas/<int:pid>', methods=['DELETE'])
def deletar_placa(pid):
    db = get_db()
    db.execute("DELETE FROM placas WHERE id=?", (pid,))
    db.commit(); db.close()
    return jsonify({'mensagem': 'Placa removida'})

# ── CONTRATOS ─────────────────────────────────────────────────────────────────
@app.route('/api/contratos', methods=['GET'])
def listar_contratos():
    db = get_db()
    rows = db.execute("""
        SELECT c.*, p.codigo as placa_codigo, p.localizacao, p.referencia
        FROM contratos c
        LEFT JOIN placas p ON c.placa_id = p.id
        ORDER BY c.data_vencimento ASC
    """).fetchall()
    db.close()
    result = []
    for r in rows:
        item = dict(r)
        item['dias_restantes'] = dias_ate_vencer(item['data_vencimento'])
        d = item['dias_restantes']
        item['status_contrato'] = 'Vencido' if d < 0 else ('Vencendo' if d <= 15 else 'Ativo')
        result.append(item)
    return jsonify(result)

@app.route('/api/contratos', methods=['POST'])
def criar_contrato():
    d = request.json or {}
    campos = ['placa_id','empresa','data_inicio','data_vencimento','valor']
    for c in campos:
        if not d.get(c):
            return jsonify({'erro': f'Campo obrigatório: {c}'}), 400
    db = get_db()
    cur = db.execute(
        """INSERT INTO contratos (placa_id,empresa,cidade,contato_nome,contato_tel,
           data_inicio,data_vencimento,valor,observacoes) VALUES (?,?,?,?,?,?,?,?,?)""",
        (int(d['placa_id']), d['empresa'], d.get('cidade','Aracaju'),
         d.get('contato_nome',''), d.get('contato_tel',''),
         d['data_inicio'], d['data_vencimento'],
         float(d['valor']), d.get('observacoes',''))
    )
    # Atualiza placa
    db.execute(
        "UPDATE placas SET status='Ocupada',anunciante=?,valor_mensal=?,atualizado_em=datetime('now','localtime') WHERE id=?",
        (d['empresa'], float(d['valor']), int(d['placa_id']))
    )
    db.commit(); db.close()
    return jsonify({'id': cur.lastrowid, 'mensagem': 'Contrato registrado com sucesso'})

@app.route('/api/contratos/<int:cid>', methods=['PUT'])
def atualizar_contrato(cid):
    d = request.json or {}
    db = get_db()
    db.execute(
        """UPDATE contratos SET empresa=?,cidade=?,contato_nome=?,contato_tel=?,
           data_inicio=?,data_vencimento=?,valor=?,observacoes=? WHERE id=?""",
        (d.get('empresa',''), d.get('cidade','Aracaju'),
         d.get('contato_nome',''), d.get('contato_tel',''),
         d.get('data_inicio',''), d.get('data_vencimento',''),
         float(d.get('valor') or 0), d.get('observacoes',''), cid)
    )
    db.commit(); db.close()
    return jsonify({'mensagem': 'Contrato atualizado'})

@app.route('/api/contratos/<int:cid>', methods=['DELETE'])
def deletar_contrato(cid):
    db = get_db()
    row = db.execute("SELECT placa_id FROM contratos WHERE id=?", (cid,)).fetchone()
    db.execute("DELETE FROM contratos WHERE id=?", (cid,))
    if row:
        ativos = db.execute(
            "SELECT COUNT(*) as n FROM contratos WHERE placa_id=? AND date(data_vencimento) >= date('now')",
            (row['placa_id'],)
        ).fetchone()['n']
        if ativos == 0:
            db.execute(
                "UPDATE placas SET status='Livre',anunciante='',atualizado_em=datetime('now','localtime') WHERE id=?",
                (row['placa_id'],)
            )
    db.commit(); db.close()
    return jsonify({'mensagem': 'Contrato removido'})

# ── LEADS ─────────────────────────────────────────────────────────────────────
@app.route('/api/leads', methods=['GET'])
def listar_leads():
    db = get_db()
    rows = db.execute("""
        SELECT l.*, p.codigo as placa_codigo
        FROM leads l
        LEFT JOIN placas p ON l.placa_id = p.id
        ORDER BY l.criado_em DESC
    """).fetchall()
    db.close()
    return jsonify(rows_to_list(rows))

@app.route('/api/leads', methods=['POST'])
def criar_lead():
    d = request.json or {}
    if not d.get('empresa','').strip():
        return jsonify({'erro': 'Nome da empresa é obrigatório'}), 400
    db = get_db()
    cur = db.execute(
        """INSERT INTO leads (empresa,segmento,cidade,contato_nome,contato_tel,
           status,placa_id,proxima_acao,observacoes) VALUES (?,?,?,?,?,?,?,?,?)""",
        (d['empresa'].strip(), d.get('segmento',''), d.get('cidade','Aracaju'),
         d.get('contato_nome',''), d.get('contato_tel',''),
         d.get('status','Em contato'), d.get('placa_id') or None,
         d.get('proxima_acao',''), d.get('observacoes',''))
    )
    db.commit(); db.close()
    return jsonify({'id': cur.lastrowid, 'mensagem': 'Lead cadastrado'})

@app.route('/api/leads/<int:lid>', methods=['PUT'])
def atualizar_lead(lid):
    d = request.json or {}
    db = get_db()
    db.execute(
        """UPDATE leads SET empresa=?,segmento=?,cidade=?,contato_nome=?,contato_tel=?,
           status=?,placa_id=?,proxima_acao=?,observacoes=?,atualizado_em=datetime('now','localtime')
           WHERE id=?""",
        (d.get('empresa',''), d.get('segmento',''), d.get('cidade','Aracaju'),
         d.get('contato_nome',''), d.get('contato_tel',''),
         d.get('status','Em contato'), d.get('placa_id') or None,
         d.get('proxima_acao',''), d.get('observacoes',''), lid)
    )
    db.commit(); db.close()
    return jsonify({'mensagem': 'Lead atualizado'})

@app.route('/api/leads/<int:lid>', methods=['DELETE'])
def deletar_lead(lid):
    db = get_db()
    db.execute("DELETE FROM leads WHERE id=?", (lid,))
    db.commit(); db.close()
    return jsonify({'mensagem': 'Lead removido'})

# ── DASHBOARD ─────────────────────────────────────────────────────────────────
@app.route('/api/dashboard', methods=['GET'])
def dashboard():
    db = get_db()
    placas = db.execute("SELECT status FROM placas").fetchall()
    contratos = db.execute("SELECT valor, data_vencimento FROM contratos").fetchall()
    leads = db.execute("SELECT status FROM leads").fetchall()
    db.close()

    total_placas = len(placas)
    ocupadas = sum(1 for p in placas if p['status'] == 'Ocupada')
    livres = sum(1 for p in placas if p['status'] == 'Livre')
    vencendo_placas = sum(1 for p in placas if p['status'] == 'Vencendo')

    contratos_ativos = [c for c in contratos if dias_ate_vencer(c['data_vencimento']) >= 0]
    receita_mensal = sum(float(c['valor']) for c in contratos_ativos)
    vencendo_30 = sum(1 for c in contratos if 0 <= dias_ate_vencer(c['data_vencimento']) <= 30)

    leads_ativos = sum(1 for l in leads if l['status'] not in ('Fechado','Perdido'))
    leads_fechados = sum(1 for l in leads if l['status'] == 'Fechado')
    taxa = round((ocupadas / total_placas) * 100) if total_placas else 0

    return jsonify({
        'totalPlacas': total_placas,
        'ocupadas': ocupadas,
        'livres': livres,
        'vencendo_placas': vencendo_placas,
        'receitaMensal': receita_mensal,
        'vencendo30': vencendo_30,
        'leadsAtivos': leads_ativos,
        'leadsFechados': leads_fechados,
        'taxaOcupacao': taxa
    })

# ── START ─────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    print(f"✅ Ebal Outdoor rodando na porta {port}")
    app.run(host='0.0.0.0', port=port, debug=debug)
