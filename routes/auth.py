"""
Authentication routes — session-based login/logout.
"""
from flask import jsonify, request, session
from routes import api
from models import Member
from services.date_utils import now_vn


@api.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = (data.get('email') or '').strip()
    password = (data.get('password') or '').strip()

    if not email or not password:
        return jsonify({'error': 'Email và mật khẩu không được để trống'}), 400

    member = Member.query.filter_by(email=email).first()
    if not member or member.password != password:
        return jsonify({'error': 'Email hoặc mật khẩu không đúng'}), 401

    if not member.is_active:
        return jsonify({'error': 'Tài khoản đã bị khóa'}), 403

    # Set session
    session['user_id'] = member.id
    member.last_login = now_vn()
    from extensions import db
    db.session.commit()

    return jsonify({
        'id': member.id,
        'display_name': member.display_name,
        'email': member.email,
        'system_role': member.system_role,
    })


@api.route('/auth/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    return jsonify({'ok': True})


@api.route('/auth/me', methods=['GET'])
def get_current_user():
    """Returns current logged-in user, or 401 if not logged in."""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Chưa đăng nhập'}), 401

    member = Member.query.get(user_id)
    if not member or not member.is_active:
        session.pop('user_id', None)
        return jsonify({'error': 'Phiên đã hết hạn'}), 401

    return jsonify({
        'id': member.id,
        'display_name': member.display_name,
        'email': member.email,
        'system_role': member.system_role,
        'avatar_url': member.avatar_url,
    })
