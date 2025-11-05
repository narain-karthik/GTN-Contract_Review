import os
import sqlite3
import secrets
from datetime import datetime
from flask import Flask, request, jsonify, session, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps

app = Flask(__name__, static_folder='static', static_url_path='')
app.secret_key = os.environ.get('SESSION_SECRET', secrets.token_hex(32))

DATABASE = 'contract_review.db'

def get_db():
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    return db

def init_db():
    db = get_db()
    db.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            department TEXT NOT NULL,
            is_admin BOOLEAN NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    db.execute('''
        CREATE TABLE IF NOT EXISTS pos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer TEXT NOT NULL,
            bid TEXT NOT NULL,
            po TEXT NOT NULL,
            cr TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    db.execute('''
        CREATE TABLE IF NOT EXISTS cr_forms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            po_key TEXT UNIQUE NOT NULL,
            customer TEXT,
            bid TEXT,
            po TEXT,
            cr TEXT,
            record_no TEXT,
            record_date TEXT,
            last_modified_by TEXT,
            last_modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    try:
        db.execute('SELECT record_no FROM cr_forms LIMIT 1')
    except:
        db.execute('ALTER TABLE cr_forms ADD COLUMN record_no TEXT')
        db.execute('ALTER TABLE cr_forms ADD COLUMN record_date TEXT')
        db.commit()
    
    try:
        db.execute('SELECT amendment_details FROM cr_forms LIMIT 1')
    except:
        db.execute('ALTER TABLE cr_forms ADD COLUMN amendment_details TEXT')
        db.commit()
    
    db.execute('''
        CREATE TABLE IF NOT EXISTS cr_form_rows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cr_form_id INTEGER NOT NULL,
            item_no TEXT NOT NULL,
            part_number TEXT,
            part_description TEXT,
            rev TEXT,
            qty TEXT,
            cycles TEXT,
            remarks TEXT,
            FOREIGN KEY (cr_form_id) REFERENCES cr_forms(id) ON DELETE CASCADE
        )
    ''')
    
    db.execute('''
        CREATE TABLE IF NOT EXISTS ped_forms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            po_key TEXT UNIQUE NOT NULL,
            customer TEXT,
            bid TEXT,
            po TEXT,
            cr TEXT,
            record_no TEXT,
            record_date TEXT,
            amendment_details TEXT,
            last_modified_by TEXT,
            last_modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    db.execute('''
        CREATE TABLE IF NOT EXISTS ped_form_rows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ped_form_id INTEGER NOT NULL,
            item_no TEXT NOT NULL,
            part_number TEXT,
            part_description TEXT,
            rev TEXT,
            qty TEXT,
            ped_cycles TEXT,
            notes TEXT,
            remarks TEXT,
            FOREIGN KEY (ped_form_id) REFERENCES ped_forms(id) ON DELETE CASCADE
        )
    ''')
    
    db.execute('''
        CREATE TABLE IF NOT EXISTS lead_forms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            po_key TEXT UNIQUE NOT NULL,
            customer TEXT,
            bid TEXT,
            po TEXT,
            cr TEXT,
            record_no TEXT,
            record_date TEXT,
            last_modified_by TEXT,
            last_modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    db.execute('''
        CREATE TABLE IF NOT EXISTS lead_form_rows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_form_id INTEGER NOT NULL,
            item_no TEXT NOT NULL,
            part_number TEXT,
            part_description TEXT,
            rev TEXT,
            qty TEXT,
            customer_required_date TEXT,
            standard_lead_time TEXT,
            gtn_agreed_date TEXT,
            remarks TEXT,
            FOREIGN KEY (lead_form_id) REFERENCES lead_forms(id) ON DELETE CASCADE
        )
    ''')
    
    cursor = db.execute('SELECT COUNT(*) as count FROM users WHERE username = ?', ('admin',))
    if cursor.fetchone()['count'] == 0:
        db.execute(
            'INSERT INTO users (username, password_hash, name, department, is_admin) VALUES (?, ?, ?, ?, ?)',
            ('admin', generate_password_hash('admin'), 'IT Administrator', 'it', 1)
        )
    
    db.commit()
    db.close()

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        db = get_db()
        user = db.execute('SELECT is_admin FROM users WHERE id = ?', (session['user_id'],)).fetchone()
        db.close()
        if not user or not user['is_admin']:
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    return send_from_directory('static', 'login.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    db.close()
    
    if user and check_password_hash(user['password_hash'], password):
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['user_department'] = user['department']
        session['user_name'] = user['name']
        session['user_is_admin'] = bool(user['is_admin'])
        
        return jsonify({
            'success': True,
            'user': {
                'username': user['username'],
                'name': user['name'],
                'department': user['department'],
                'isAdmin': bool(user['is_admin'])
            }
        })
    
    return jsonify({'error': 'Invalid username or password'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/session', methods=['GET'])
def get_session():
    if 'user_id' in session:
        return jsonify({
            'loggedIn': True,
            'user': {
                'username': session.get('username'),
                'name': session.get('user_name'),
                'department': session.get('user_department'),
                'isAdmin': session.get('user_is_admin', False)
            }
        })
    return jsonify({'loggedIn': False})

@app.route('/api/users', methods=['GET'])
@admin_required
def get_users():
    db = get_db()
    users = db.execute('SELECT id, username, name, department, is_admin FROM users ORDER BY id').fetchall()
    db.close()
    
    return jsonify([{
        'id': user['id'],
        'username': user['username'],
        'name': user['name'],
        'department': user['department'],
        'isAdmin': bool(user['is_admin'])
    } for user in users])

@app.route('/api/users', methods=['POST'])
@admin_required
def create_user():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')
    name = data.get('name', '').strip()
    department = data.get('department', '').strip()
    is_admin = data.get('isAdmin', False)
    
    if not all([username, password, name, department]):
        return jsonify({'error': 'All fields required'}), 400
    
    db = get_db()
    
    existing = db.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
    if existing:
        db.close()
        return jsonify({'error': 'Username already exists'}), 400
    
    try:
        db.execute(
            'INSERT INTO users (username, password_hash, name, department, is_admin) VALUES (?, ?, ?, ?, ?)',
            (username, generate_password_hash(password), name, department, 1 if is_admin else 0)
        )
        db.commit()
        user_id = db.execute('SELECT last_insert_rowid() as id').fetchone()['id']
        db.close()
        
        return jsonify({
            'success': True,
            'user': {
                'id': user_id,
                'username': username,
                'name': name,
                'department': department,
                'isAdmin': is_admin
            }
        })
    except Exception as e:
        db.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/users/<int:user_id>', methods=['PUT'])
@admin_required
def update_user(user_id):
    data = request.get_json()
    name = data.get('name', '').strip()
    department = data.get('department', '').strip()
    is_admin = data.get('isAdmin', False)
    password = data.get('password', '').strip()
    
    if not all([name, department]):
        return jsonify({'error': 'Name and department required'}), 400
    
    db = get_db()
    
    user = db.execute('SELECT username, is_admin FROM users WHERE id = ?', (user_id,)).fetchone()
    if not user:
        db.close()
        return jsonify({'error': 'User not found'}), 404
    
    if user['username'] == 'admin' and user['is_admin'] and not is_admin:
        admin_count = db.execute('SELECT COUNT(*) as count FROM users WHERE is_admin = 1').fetchone()['count']
        if admin_count <= 1:
            db.close()
            return jsonify({'error': 'Cannot remove admin status from last admin user'}), 400
    
    try:
        if password:
            db.execute(
                'UPDATE users SET name = ?, department = ?, is_admin = ?, password_hash = ? WHERE id = ?',
                (name, department, 1 if is_admin else 0, generate_password_hash(password), user_id)
            )
        else:
            db.execute(
                'UPDATE users SET name = ?, department = ?, is_admin = ? WHERE id = ?',
                (name, department, 1 if is_admin else 0, user_id)
            )
        db.commit()
        db.close()
        
        return jsonify({
            'success': True,
            'user': {
                'id': user_id,
                'username': user['username'],
                'name': name,
                'department': department,
                'isAdmin': is_admin
            }
        })
    except Exception as e:
        db.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    db = get_db()
    
    user = db.execute('SELECT username, is_admin FROM users WHERE id = ?', (user_id,)).fetchone()
    if not user:
        db.close()
        return jsonify({'error': 'User not found'}), 404
    
    if user['username'] == 'admin' and user['is_admin']:
        db.close()
        return jsonify({'error': 'Cannot delete default admin user'}), 400
    
    admin_count = db.execute('SELECT COUNT(*) as count FROM users WHERE is_admin = 1').fetchone()['count']
    if user['is_admin'] and admin_count <= 1:
        db.close()
        return jsonify({'error': 'Cannot delete last admin user'}), 400
    
    db.execute('DELETE FROM users WHERE id = ?', (user_id,))
    db.commit()
    db.close()
    
    return jsonify({'success': True})

@app.route('/api/pos', methods=['GET'])
@login_required
def get_pos():
    db = get_db()
    pos_list = db.execute('SELECT * FROM pos ORDER BY id DESC').fetchall()
    db.close()
    
    return jsonify([{
        'id': po['id'],
        'customer': po['customer'],
        'bid': po['bid'],
        'po': po['po'],
        'cr': po['cr']
    } for po in pos_list])

@app.route('/api/pos', methods=['POST'])
@admin_required
def create_po():
    data = request.get_json()
    customer = data.get('customer', '').strip()
    bid = data.get('bid', '').strip()
    po = data.get('po', '').strip()
    cr = data.get('cr', '').strip()
    
    if not all([customer, bid, po, cr]):
        return jsonify({'error': 'All fields required'}), 400
    
    db = get_db()
    try:
        db.execute(
            'INSERT INTO pos (customer, bid, po, cr) VALUES (?, ?, ?, ?)',
            (customer, bid, po, cr)
        )
        db.commit()
        po_id = db.execute('SELECT last_insert_rowid() as id').fetchone()['id']
        db.close()
        
        return jsonify({
            'success': True,
            'po': {
                'id': po_id,
                'customer': customer,
                'bid': bid,
                'po': po,
                'cr': cr
            }
        })
    except Exception as e:
        db.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/pos/<int:po_id>', methods=['PUT'])
@admin_required
def update_po(po_id):
    data = request.get_json()
    customer = data.get('customer', '').strip()
    bid = data.get('bid', '').strip()
    po = data.get('po', '').strip()
    cr = data.get('cr', '').strip()
    
    if not all([customer, bid, po, cr]):
        return jsonify({'error': 'All fields required'}), 400
    
    db = get_db()
    db.execute(
        'UPDATE pos SET customer = ?, bid = ?, po = ?, cr = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        (customer, bid, po, cr, po_id)
    )
    db.commit()
    db.close()
    
    return jsonify({
        'success': True,
        'po': {
            'id': po_id,
            'customer': customer,
            'bid': bid,
            'po': po,
            'cr': cr
        }
    })

@app.route('/api/pos/<int:po_id>', methods=['DELETE'])
@admin_required
def delete_po(po_id):
    db = get_db()
    db.execute('DELETE FROM pos WHERE id = ?', (po_id,))
    db.commit()
    db.close()
    
    return jsonify({'success': True})

@app.route('/api/backup', methods=['GET'])
@admin_required
def backup_data():
    db = get_db()
    users = db.execute('SELECT id, username, password_hash, name, department, is_admin FROM users').fetchall()
    pos_list = db.execute('SELECT * FROM pos').fetchall()
    db.close()
    
    return jsonify({
        'meta': {
            'app': 'GTN-ContractReview',
            'version': '1.0',
            'exportedAt': datetime.utcnow().isoformat(),
            'by': session.get('username', '')
        },
        'users': [{
            'username': u['username'],
            'password_hash': u['password_hash'],
            'name': u['name'],
            'department': u['department'],
            'isAdmin': bool(u['is_admin'])
        } for u in users],
        'pos': [{
            'customer': p['customer'],
            'bid': p['bid'],
            'po': p['po'],
            'cr': p['cr']
        } for p in pos_list]
    })

@app.route('/api/restore', methods=['POST'])
@admin_required
def restore_data():
    data = request.get_json()
    
    if not data or not isinstance(data, dict):
        return jsonify({'error': 'Invalid data format'}), 400
    
    if not data.get('users') or not isinstance(data['users'], list):
        return jsonify({'error': 'Missing or invalid users array'}), 400
    
    if not data.get('pos') or not isinstance(data['pos'], list):
        return jsonify({'error': 'Missing or invalid pos array'}), 400
    
    for user in data['users']:
        if not all(key in user for key in ['username', 'password_hash', 'name', 'department']):
            return jsonify({'error': 'Invalid user data: missing required fields'}), 400
        if not user.get('password_hash') or not user['password_hash'].startswith(('pbkdf2:', 'scrypt:', 'bcrypt:')):
            return jsonify({'error': 'Invalid user data: password_hash must be a valid hash'}), 400
    
    has_admin = any(u.get('isAdmin') for u in data['users'])
    if not has_admin:
        return jsonify({'error': 'Backup must contain at least one admin user'}), 400
    
    for po in data['pos']:
        if not all(key in po for key in ['customer', 'bid', 'po', 'cr']):
            return jsonify({'error': 'Invalid PO data: missing required fields'}), 400
    
    db = get_db()
    try:
        db.execute('BEGIN TRANSACTION')
        
        db.execute('DELETE FROM users')
        db.execute('DELETE FROM pos')
        
        for user in data['users']:
            db.execute(
                'INSERT INTO users (username, password_hash, name, department, is_admin) VALUES (?, ?, ?, ?, ?)',
                (user['username'], user['password_hash'], 
                 user['name'], user['department'], 1 if user.get('isAdmin') else 0)
            )
        
        for po in data['pos']:
            db.execute(
                'INSERT INTO pos (customer, bid, po, cr) VALUES (?, ?, ?, ?)',
                (po['customer'], po['bid'], po['po'], po['cr'])
            )
        
        db.commit()
        db.close()
        return jsonify({'success': True})
    except Exception as e:
        db.rollback()
        db.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/cr-form/save', methods=['POST'])
@login_required
def save_cr_form():
    import json
    data = request.get_json()
    
    po_key = data.get('poKey', '').strip()
    if not po_key:
        return jsonify({'error': 'PO key required'}), 400
    
    customer = data.get('customer', '').strip()
    bid = data.get('bid', '').strip()
    po = data.get('po', '').strip()
    cr = data.get('cr', '').strip()
    record_no = data.get('recordNo', '').strip()
    record_date = data.get('recordDate', '').strip()
    rows = data.get('rows', [])
    
    username = session.get('username', 'unknown')
    is_admin = session.get('user_is_admin', False)
    
    db = get_db()
    try:
        db.execute('BEGIN TRANSACTION')
        
        cursor = db.execute('SELECT id, amendment_details FROM cr_forms WHERE po_key = ?', (po_key,))
        form = cursor.fetchone()
        
        if is_admin:
            amendment_details = data.get('amendmentDetails', '').strip()
        else:
            amendment_details = form['amendment_details'] if form else ''
        
        if form:
            form_id = form['id']
            db.execute('''
                UPDATE cr_forms 
                SET customer = ?, bid = ?, po = ?, cr = ?, record_no = ?, record_date = ?, amendment_details = ?,
                    last_modified_by = ?, last_modified_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (customer, bid, po, cr, record_no, record_date, amendment_details, username, form_id))
            
            db.execute('DELETE FROM cr_form_rows WHERE cr_form_id = ?', (form_id,))
        else:
            db.execute('''
                INSERT INTO cr_forms (po_key, customer, bid, po, cr, record_no, record_date, amendment_details, last_modified_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (po_key, customer, bid, po, cr, record_no, record_date, amendment_details, username))
            form_id = db.execute('SELECT last_insert_rowid() as id').fetchone()['id']
        
        for row in rows:
            item_no = row.get('key', '')
            if not item_no:
                continue
            
            cycles_json = json.dumps(row.get('cycles', []))
            
            db.execute('''
                INSERT INTO cr_form_rows 
                (cr_form_id, item_no, part_number, part_description, rev, qty, cycles, remarks)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                form_id,
                item_no,
                row.get('part', ''),
                row.get('desc', ''),
                row.get('rev', ''),
                row.get('qty', ''),
                cycles_json,
                row.get('remarks', '')
            ))
        
        db.commit()
        db.close()
        
        return jsonify({
            'success': True,
            'lastModifiedBy': username,
            'lastModifiedAt': datetime.utcnow().isoformat()
        })
    except Exception as e:
        db.rollback()
        db.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/cr-form/load', methods=['GET'])
@login_required
def load_cr_form():
    import json
    po_key = request.args.get('poKey', '').strip()
    if not po_key:
        return jsonify({'error': 'PO key required'}), 400
    
    db = get_db()
    try:
        cursor = db.execute('''
            SELECT id, customer, bid, po, cr, record_no, record_date, amendment_details, last_modified_by, last_modified_at
            FROM cr_forms
            WHERE po_key = ?
        ''', (po_key,))
        form = cursor.fetchone()
        
        if not form:
            db.close()
            return jsonify({'exists': False})
        
        form_id = form['id']
        
        rows_cursor = db.execute('''
            SELECT item_no, part_number, part_description, rev, qty, cycles, remarks
            FROM cr_form_rows
            WHERE cr_form_id = ?
            ORDER BY id
        ''', (form_id,))
        
        rows = []
        for row in rows_cursor.fetchall():
            cycles = json.loads(row['cycles']) if row['cycles'] else []
            rows.append({
                'key': row['item_no'],
                'part': row['part_number'] or '',
                'desc': row['part_description'] or '',
                'rev': row['rev'] or '',
                'qty': row['qty'] or '',
                'cycles': cycles,
                'remarks': row['remarks'] or ''
            })
        
        db.close()
        
        return jsonify({
            'exists': True,
            'customer': form['customer'] or '',
            'bid': form['bid'] or '',
            'po': form['po'] or '',
            'cr': form['cr'] or '',
            'recordNo': form['record_no'] or '',
            'recordDate': form['record_date'] or '',
            'amendmentDetails': form['amendment_details'] or '',
            'rows': rows,
            'lastModifiedBy': form['last_modified_by'] or '',
            'lastModifiedAt': form['last_modified_at'] or ''
        })
    except Exception as e:
        db.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/ped-form/save', methods=['POST'])
@login_required
def save_ped_form():
    import json
    data = request.get_json()
    
    po_key = data.get('poKey', '').strip()
    if not po_key:
        return jsonify({'error': 'PO key required'}), 400
    
    customer = data.get('customer', '').strip()
    bid = data.get('bid', '').strip()
    po = data.get('po', '').strip()
    cr = data.get('cr', '').strip()
    record_no = data.get('recordNo', '').strip()
    record_date = data.get('recordDate', '').strip()
    rows = data.get('rows', [])
    
    username = session.get('username', 'unknown')
    is_admin = session.get('user_is_admin', False)
    
    db = get_db()
    try:
        db.execute('BEGIN TRANSACTION')
        
        cursor = db.execute('SELECT id, amendment_details FROM ped_forms WHERE po_key = ?', (po_key,))
        form = cursor.fetchone()
        
        if is_admin:
            amendment_details = data.get('amendmentDetails', '').strip()
        else:
            amendment_details = form['amendment_details'] if form else ''
        
        if form:
            form_id = form['id']
            db.execute('''
                UPDATE ped_forms 
                SET customer = ?, bid = ?, po = ?, cr = ?, record_no = ?, record_date = ?, amendment_details = ?,
                    last_modified_by = ?, last_modified_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (customer, bid, po, cr, record_no, record_date, amendment_details, username, form_id))
            
            db.execute('DELETE FROM ped_form_rows WHERE ped_form_id = ?', (form_id,))
        else:
            db.execute('''
                INSERT INTO ped_forms (po_key, customer, bid, po, cr, record_no, record_date, amendment_details, last_modified_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (po_key, customer, bid, po, cr, record_no, record_date, amendment_details, username))
            form_id = db.execute('SELECT last_insert_rowid() as id').fetchone()['id']
        
        for row in rows:
            item_no = row.get('key', '')
            if not item_no:
                continue
            
            ped_cycles_json = json.dumps(row.get('pedCycles', []))
            notes_json = json.dumps(row.get('notes', []))
            
            db.execute('''
                INSERT INTO ped_form_rows 
                (ped_form_id, item_no, part_number, part_description, rev, qty, ped_cycles, notes, remarks)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                form_id,
                item_no,
                row.get('part', ''),
                row.get('desc', ''),
                row.get('rev', ''),
                row.get('qty', ''),
                ped_cycles_json,
                notes_json,
                row.get('remarks', '')
            ))
        
        db.commit()
        db.close()
        
        return jsonify({
            'success': True,
            'lastModifiedBy': username,
            'lastModifiedAt': datetime.utcnow().isoformat()
        })
    except Exception as e:
        db.rollback()
        db.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/ped-form/load', methods=['GET'])
@login_required
def load_ped_form():
    import json
    po_key = request.args.get('poKey', '').strip()
    if not po_key:
        return jsonify({'error': 'PO key required'}), 400
    
    db = get_db()
    try:
        cursor = db.execute('''
            SELECT id, customer, bid, po, cr, record_no, record_date, amendment_details, last_modified_by, last_modified_at
            FROM ped_forms
            WHERE po_key = ?
        ''', (po_key,))
        form = cursor.fetchone()
        
        if not form:
            db.close()
            return jsonify({'exists': False})
        
        form_id = form['id']
        
        rows_cursor = db.execute('''
            SELECT item_no, part_number, part_description, rev, qty, ped_cycles, notes, remarks
            FROM ped_form_rows
            WHERE ped_form_id = ?
            ORDER BY id
        ''', (form_id,))
        
        rows = []
        for row in rows_cursor.fetchall():
            ped_cycles = json.loads(row['ped_cycles']) if row['ped_cycles'] else []
            notes = json.loads(row['notes']) if row['notes'] else []
            rows.append({
                'key': row['item_no'],
                'part': row['part_number'] or '',
                'desc': row['part_description'] or '',
                'rev': row['rev'] or '',
                'qty': row['qty'] or '',
                'pedCycles': ped_cycles,
                'notes': notes,
                'remarks': row['remarks'] or ''
            })
        
        db.close()
        
        return jsonify({
            'exists': True,
            'customer': form['customer'] or '',
            'bid': form['bid'] or '',
            'po': form['po'] or '',
            'cr': form['cr'] or '',
            'recordNo': form['record_no'] or '',
            'recordDate': form['record_date'] or '',
            'amendmentDetails': form['amendment_details'] or '',
            'rows': rows,
            'lastModifiedBy': form['last_modified_by'] or '',
            'lastModifiedAt': form['last_modified_at'] or ''
        })
    except Exception as e:
        db.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/lead-form/save', methods=['POST'])
@login_required
def save_lead_form():
    import json
    data = request.get_json()
    
    po_key = data.get('poKey', '').strip()
    if not po_key:
        return jsonify({'error': 'PO key required'}), 400
    
    customer = data.get('customer', '').strip()
    bid = data.get('bid', '').strip()
    po = data.get('po', '').strip()
    cr = data.get('cr', '').strip()
    record_no = data.get('recordNo', '').strip()
    record_date = data.get('recordDate', '').strip()
    rows = data.get('rows', [])
    
    username = session.get('username', 'unknown')
    
    db = get_db()
    try:
        db.execute('BEGIN TRANSACTION')
        
        cursor = db.execute('SELECT id FROM lead_forms WHERE po_key = ?', (po_key,))
        form = cursor.fetchone()
        
        if form:
            form_id = form['id']
            db.execute('''
                UPDATE lead_forms 
                SET customer = ?, bid = ?, po = ?, cr = ?, record_no = ?, record_date = ?,
                    last_modified_by = ?, last_modified_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (customer, bid, po, cr, record_no, record_date, username, form_id))
            
            db.execute('DELETE FROM lead_form_rows WHERE lead_form_id = ?', (form_id,))
        else:
            db.execute('''
                INSERT INTO lead_forms (po_key, customer, bid, po, cr, record_no, record_date, last_modified_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (po_key, customer, bid, po, cr, record_no, record_date, username))
            form_id = db.execute('SELECT last_insert_rowid() as id').fetchone()['id']
        
        for row in rows:
            item_no = row.get('itemNo', '')
            if not item_no:
                continue
            
            db.execute('''
                INSERT INTO lead_form_rows 
                (lead_form_id, item_no, part_number, part_description, rev, qty, 
                 customer_required_date, standard_lead_time, gtn_agreed_date, remarks)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                form_id,
                item_no,
                row.get('part', ''),
                row.get('desc', ''),
                row.get('rev', ''),
                row.get('qty', ''),
                row.get('customerRequiredDate', ''),
                row.get('standardLeadTime', ''),
                row.get('gtnAgreedDate', ''),
                row.get('remarks', '')
            ))
        
        db.commit()
        db.close()
        
        return jsonify({
            'success': True,
            'lastModifiedBy': username,
            'lastModifiedAt': datetime.utcnow().isoformat()
        })
    except Exception as e:
        db.rollback()
        db.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/lead-form/load', methods=['GET'])
@login_required
def load_lead_form():
    import json
    po_key = request.args.get('poKey', '').strip()
    if not po_key:
        return jsonify({'error': 'PO key required'}), 400
    
    db = get_db()
    try:
        cursor = db.execute('''
            SELECT id, customer, bid, po, cr, record_no, record_date, last_modified_by, last_modified_at
            FROM lead_forms
            WHERE po_key = ?
        ''', (po_key,))
        form = cursor.fetchone()
        
        if not form:
            db.close()
            return jsonify({'exists': False})
        
        form_id = form['id']
        
        rows_cursor = db.execute('''
            SELECT item_no, part_number, part_description, rev, qty, 
                   customer_required_date, standard_lead_time, gtn_agreed_date, remarks
            FROM lead_form_rows
            WHERE lead_form_id = ?
            ORDER BY id
        ''', (form_id,))
        
        rows = []
        for row in rows_cursor.fetchall():
            rows.append({
                'itemNo': row['item_no'],
                'part': row['part_number'] or '',
                'desc': row['part_description'] or '',
                'rev': row['rev'] or '',
                'qty': row['qty'] or '',
                'customerRequiredDate': row['customer_required_date'] or '',
                'standardLeadTime': row['standard_lead_time'] or '',
                'gtnAgreedDate': row['gtn_agreed_date'] or '',
                'remarks': row['remarks'] or ''
            })
        
        db.close()
        
        return jsonify({
            'exists': True,
            'customer': form['customer'] or '',
            'bid': form['bid'] or '',
            'po': form['po'] or '',
            'cr': form['cr'] or '',
            'recordNo': form['record_no'] or '',
            'recordDate': form['record_date'] or '',
            'rows': rows,
            'lastModifiedBy': form['last_modified_by'] or '',
            'lastModifiedAt': form['last_modified_at'] or ''
        })
    except Exception as e:
        db.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/cr-export-excel', methods=['GET'])
@login_required
def export_cr_to_excel():
    import json
    import openpyxl
    from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
    from io import BytesIO
    import zipfile
    from flask import make_response
    
    db = get_db()
    try:
        forms_cursor = db.execute('''
            SELECT id, customer, bid, po, cr, record_no, record_date, amendment_details, last_modified_by, last_modified_at
            FROM cr_forms
            ORDER BY id
        ''')
        forms = forms_cursor.fetchall()
        
        if not forms:
            db.close()
            return jsonify({'error': 'No CR forms found to export'}), 404
        
        total_forms = len(forms)
        forms_per_file = (total_forms + 2) // 3
        
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for file_index in range(3):
                start_idx = file_index * forms_per_file
                end_idx = min(start_idx + forms_per_file, total_forms)
                
                forms_subset = forms[start_idx:end_idx] if start_idx < total_forms else []
                
                wb = openpyxl.Workbook()
                ws = wb.active
                ws.title = f"CR Data {file_index + 1}"
                
                header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
                header_font = Font(bold=True, color="FFFFFF", size=11)
                border = Border(
                    left=Side(style='thin'),
                    right=Side(style='thin'),
                    top=Side(style='thin'),
                    bottom=Side(style='thin')
                )
                
                row_num = 1
                
                if not forms_subset:
                    ws.cell(row=1, column=1, value="No CR forms in this range")
                    ws.cell(row=1, column=1).font = Font(bold=True, size=12)
                    ws.column_dimensions['A'].width = 30
                
                for form in forms_subset:
                    form_id = form['id']
                    
                    ws.merge_cells(f'A{row_num}:H{row_num}')
                    cell = ws.cell(row=row_num, column=1, value=f"CONTRACT REVIEW - {form['customer']}")
                    cell.font = Font(bold=True, size=14)
                    cell.alignment = Alignment(horizontal='center', vertical='center')
                    cell.fill = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")
                    row_num += 1
                    
                    info_data = [
                        ('Customer:', form['customer']),
                        ('BID:', form['bid']),
                        ('PO:', form['po']),
                        ('CR:', form['cr']),
                        ('Record No:', form['record_no']),
                        ('Record Date:', form['record_date']),
                        ('Amendment Details:', form['amendment_details'] or ''),
                        ('Last Modified By:', form['last_modified_by']),
                        ('Last Modified At:', form['last_modified_at'])
                    ]
                    
                    for label, value in info_data:
                        ws.cell(row=row_num, column=1, value=label).font = Font(bold=True)
                        ws.cell(row=row_num, column=2, value=value or '')
                        row_num += 1
                    
                    row_num += 1
                    
                    headers = ['Item No', 'Part Number', 'Part Description', 'Rev', 'Qty', 'Cycles', 'Remarks']
                    for col_num, header in enumerate(headers, 1):
                        cell = ws.cell(row=row_num, column=col_num, value=header)
                        cell.font = header_font
                        cell.fill = header_fill
                        cell.alignment = Alignment(horizontal='center', vertical='center')
                        cell.border = border
                    
                    row_num += 1
                    
                    rows_cursor = db.execute('''
                        SELECT item_no, part_number, part_description, rev, qty, cycles, remarks
                        FROM cr_form_rows
                        WHERE cr_form_id = ?
                        ORDER BY id
                    ''', (form_id,))
                    
                    for row in rows_cursor.fetchall():
                        cycles = json.loads(row['cycles']) if row['cycles'] else []
                        non_empty_cycles = [str(c) for c in cycles if c and str(c).strip()]
                        cycles_text = ', '.join(non_empty_cycles) if non_empty_cycles else ''
                        
                        data_row = [
                            row['item_no'],
                            row['part_number'] or '',
                            row['part_description'] or '',
                            row['rev'] or '',
                            row['qty'] or '',
                            cycles_text,
                            row['remarks'] or ''
                        ]
                        
                        for col_num, value in enumerate(data_row, 1):
                            cell = ws.cell(row=row_num, column=col_num, value=value)
                            cell.border = border
                            cell.alignment = Alignment(wrap_text=True, vertical='top')
                        
                        row_num += 1
                    
                    row_num += 2
                
                from openpyxl.utils import get_column_letter
                for col_idx in range(1, ws.max_column + 1):
                    max_length = 0
                    column_letter = get_column_letter(col_idx)
                    for row_idx in range(1, ws.max_row + 1):
                        cell = ws.cell(row=row_idx, column=col_idx)
                        if cell.value and not isinstance(cell, openpyxl.cell.cell.MergedCell):
                            max_length = max(max_length, len(str(cell.value)))
                    adjusted_width = min(max_length + 2, 50)
                    ws.column_dimensions[column_letter].width = adjusted_width
                
                excel_buffer = BytesIO()
                wb.save(excel_buffer)
                excel_buffer.seek(0)
                
                filename = f"CR_{file_index + 1}.xlsx"
                zip_file.writestr(filename, excel_buffer.read())
        
        db.close()
        
        zip_buffer.seek(0)
        response = make_response(zip_buffer.read())
        response.headers['Content-Type'] = 'application/zip'
        response.headers['Content-Disposition'] = 'attachment; filename=CR_Export.zip'
        
        return response
        
    except Exception as e:
        db.close()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)
