import os
from flask import Flask, session, redirect, jsonify
from config import Config
from extensions import db, migrate


def create_app(config_class=Config):
    app = Flask(__name__, static_folder='static', static_url_path='')
    app.config.from_object(config_class)
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

    db.init_app(app)
    migrate.init_app(app, db)

    import models  # noqa

    with app.app_context():
        from services.audit import init_auto_audit, enable_audit
        init_auto_audit(app)
        enable_audit()
        # Auto-create any missing tables (dev convenience)
        db.create_all()

    from routes import api
    app.register_blueprint(api)

    @app.route('/login')
    def login_page():
        return app.send_static_file('login.html')

    @app.route('/')
    def index():
        if not session.get('user_id'):
            return redirect('/login')
        return redirect('/gantt')

    @app.route('/gantt')
    @app.route('/gantt/<view_name>')
    def gantt_page(view_name=None):
        if not session.get('user_id'):
            return redirect('/login')
        return app.send_static_file('gantt.html')

    @app.route('/raiqd')
    def raiqd_page():
        if not session.get('user_id'):
            return redirect('/login')
        return app.send_static_file('raiqd.html')

    @app.route('/kanban')
    def kanban_page():
        if not session.get('user_id'):
            return redirect('/login')
        return app.send_static_file('kanban.html')

    @app.route('/my-tasks')
    def mytasks_page():
        if not session.get('user_id'):
            return redirect('/login')
        return app.send_static_file('my_tasks.html')

    @app.route('/report')
    def report_page():
        if not session.get('user_id'):
            return redirect('/login')
        return app.send_static_file('report.html')

    @app.route('/workload')
    def workload_page():
        if not session.get('user_id'):
            return redirect('/login')
        return app.send_static_file('workload.html')

    @app.route('/admin')
    def admin_page():
        if not session.get('user_id'):
            return redirect('/login')
        from models import Member
        user = Member.query.get(session['user_id'])
        if not user or not user.is_admin:
            return redirect('/')
        return app.send_static_file('admin.html')

    @app.route('/api/health')
    def health():
        from services.audit import _enabled, _REGISTRY
        from sqlalchemy import event
        from services.audit import _before_flush, _after_flush
        return {
            'audit_enabled': _enabled,
            'models_registered': len(_REGISTRY),
            'before_flush_hooked': event.contains(db.session, 'before_flush', _before_flush),
            'after_flush_hooked': event.contains(db.session, 'after_flush', _after_flush),
        }

    return app
