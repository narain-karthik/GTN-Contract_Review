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

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)
