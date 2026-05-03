import sqlite3
import os
from datetime import datetime, date, timedelta

DB_PATH = os.environ.get('DB_PATH', os.path.join(os.path.dirname(__file__), 'ebal.db'))

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS placas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo TEXT NOT NULL UNIQUE,
            localizacao TEXT NOT NULL,
            referencia TEXT DEFAULT '',
            status TEXT NOT NULL DEFAULT 'Livre',
            anunciante TEXT DEFAULT '',
            valor_mensal REAL DEFAULT 0,
            observacoes TEXT DEFAULT '',
            criado_em TEXT DEFAULT (datetime('now','localtime')),
            atualizado_em TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS contratos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            placa_id INTEGER NOT NULL,
            empresa TEXT NOT NULL,
            cidade TEXT NOT NULL DEFAULT 'Aracaju',
            contato_nome TEXT DEFAULT '',
            contato_tel TEXT DEFAULT '',
            data_inicio TEXT NOT NULL,
            data_vencimento TEXT NOT NULL,
            valor REAL NOT NULL,
            observacoes TEXT DEFAULT '',
            criado_em TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (placa_id) REFERENCES placas(id)
        );

        CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa TEXT NOT NULL,
            segmento TEXT DEFAULT '',
            cidade TEXT DEFAULT 'Aracaju',
            contato_nome TEXT DEFAULT '',
            contato_tel TEXT DEFAULT '',
            status TEXT DEFAULT 'Em contato',
            placa_id INTEGER,
            proxima_acao TEXT DEFAULT '',
            observacoes TEXT DEFAULT '',
            criado_em TEXT DEFAULT (datetime('now','localtime')),
            atualizado_em TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (placa_id) REFERENCES placas(id)
        );
    """)
    conn.commit()

    # Seed inicial
    count = conn.execute("SELECT COUNT(*) as n FROM placas").fetchone()['n']
    if count == 0:
        hoje = date.today()
        add = lambda n: (hoje + timedelta(days=n)).isoformat()
        sub = lambda n: (hoje - timedelta(days=n)).isoformat()

        placas_seed = [
            ('EB-01', 'Rodovia SE-100, sentido Aracaju', 'KM 2 – Ponte Vaza Barris',  'Ocupada',  'Auto Sergipe',    900),
            ('EB-02', 'Rodovia SE-100, sentido Aracaju', 'KM 5 – Próx. Posto BR',      'Livre',    '',                800),
            ('EB-03', 'Rodovia SE-100, sentido Aracaju', 'KM 9 – Entrada São Cristóvão','Vencendo', 'Clínica Saúde+', 750),
            ('EB-04', 'Rodovia SE-100, sentido Aracaju', 'KM 14 – Rotatória Itaporanga','Livre',   '',                800),
            ('EB-05', 'Rodovia SE-100, sentido Aracaju', 'KM 20 – Acesso Lagarto',     'Ocupada',  'Faculdade Pio X', 1000),
            ('EB-06', 'Rodovia SE-100, sentido Aracaju', 'KM 28 – Próx. Estância',     'Livre',    '',                750),
        ]
        ids = []
        for p in placas_seed:
            cur = conn.execute(
                "INSERT INTO placas (codigo,localizacao,referencia,status,anunciante,valor_mensal) VALUES (?,?,?,?,?,?)", p
            )
            ids.append(cur.lastrowid)
        conn.commit()

        contratos_seed = [
            (ids[0], 'Auto Sergipe',    'Aracaju', sub(60), add(45),  900),
            (ids[4], 'Faculdade Pio X', 'Aracaju', sub(30), add(20), 1000),
            (ids[2], 'Clínica Saúde+',  'Aracaju', sub(90), add(8),   750),
        ]
        for c in contratos_seed:
            conn.execute(
                "INSERT INTO contratos (placa_id,empresa,cidade,data_inicio,data_vencimento,valor) VALUES (?,?,?,?,?,?)", c
            )

        leads_seed = [
            ('Unimed Sergipe',   'Clínica / Saúde',          'Aracaju', '(79) 3xxx-xxxx', 'Em contato',      ids[1], 'Ligar segunda para apresentar proposta'),
            ('Habitar Imóveis',  'Construtora / Imobiliária', 'Aracaju', '(79) 9xxxx-xxxx','Proposta enviada', ids[3], 'Aguardar retorno até quinta'),
            ('Atacadão SE',      'Supermercado / Atacado',    'Aracaju', '(79) 3xxx-xxxx', 'Negociando',      ids[5], 'Enviar contrato por e-mail'),
        ]
        for l in leads_seed:
            conn.execute(
                "INSERT INTO leads (empresa,segmento,cidade,contato_tel,status,placa_id,proxima_acao) VALUES (?,?,?,?,?,?,?)", l
            )
        conn.commit()

    conn.close()

def dias_ate_vencer(data_str):
    try:
        venc = date.fromisoformat(data_str)
        return (venc - date.today()).days
    except:
        return 0

def row_to_dict(row):
    return dict(row) if row else None

def rows_to_list(rows):
    return [dict(r) for r in rows]
