"""
Admin API — generic CRUD endpoints for all PMO tables.
GET/POST/PUT/DELETE for each table, with pagination and filtering.
"""
from flask import jsonify, request
from routes import api
from extensions import db
from models import (
    Portfolio, Program, Project, Phase, WorkPackage, Task, Subtask,
    Member, Note, AuditTrail, Dependency, ProjectAccess,
    Risk, Issue, Action, Question, Decision, RaiqdLink
)
from services.date_utils import parse_date

TABLES = {
    'portfolios':     (Portfolio,     'Portfolio'),
    'programs':       (Program,       'Chương trình'),
    'projects':       (Project,       'Dự án'),
    'phases':         (Phase,         'Giai đoạn'),
    'work_packages':  (WorkPackage,   'Work Package'),
    'tasks':          (Task,          'Task'),
    'subtasks':       (Subtask,       'Subtask'),
    'members':        (Member,        'Thành viên'),
    'project_access': (ProjectAccess, 'Phân quyền'),
    'risks':          (Risk,          'Risk'),
    'issues':         (Issue,         'Issue'),
    'actions':        (Action,        'Action'),
    'questions':      (Question,      'Question'),
    'decisions':      (Decision,      'Decision'),
    'raiqd_links':    (RaiqdLink,     'RAIQD Links'),
    'notes':          (Note,          'Ghi chú'),
    'audit_trail':    (AuditTrail,    'Audit Trail'),
    'dependencies':   (Dependency,    'Phụ thuộc'),
}

# Fields that are DateTime and need parse_date
_DT_FIELDS = {
    'planned_start', 'planned_finish', 'actual_start', 'actual_finish',
    'created_at', 'updated_at', 'deleted_at', 'deadline'
}

# Fields that are relationships (skip in direct update)
_REL_FIELDS = {
    'portfolio', 'program', 'project', 'phase', 'work_package', 'task',
    'pic', 'pics', 'approver', 'assignee', 'author', 'actor',
    'assignees', 'phases', 'projects', 'programs', 'work_packages',
    'tasks', 'subtasks', 'notes',
    'detected_by', 'decided_by', 'closed_by',
    'linked_from', 'linked_to',
}


def _model_columns(model):
    """Get column info for a model."""
    cols = []
    for c in model.__table__.columns:
        cols.append({
            'name': c.name,
            'type': str(c.type),
            'nullable': c.nullable,
            'primary_key': c.primary_key,
        })
    return cols


def _row_to_dict(obj):
    """Generic model → dict using column inspection."""
    d = {}
    for c in obj.__class__.__table__.columns:
        val = getattr(obj, c.name)
        if val is not None and hasattr(val, 'isoformat'):
            val = val.strftime('%Y-%m-%dT%H:%M:%S')
        d[c.name] = val
    return d


@api.route('/admin/tables', methods=['GET'])
def admin_list_tables():
    """List all available tables with their column schemas."""
    result = {}
    for key, (model, label) in TABLES.items():
        result[key] = {
            'label': label,
            'columns': _model_columns(model),
            'count': model.query.count(),
        }
    return jsonify(result)


@api.route('/admin/<table_key>', methods=['GET'])
def admin_list_rows(table_key):
    """List rows with pagination. ?page=1&per_page=50&sort=id&order=asc"""
    if table_key not in TABLES:
        return jsonify({'error': f'Unknown table: {table_key}'}), 404
    model, label = TABLES[table_key]

    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    sort_col = request.args.get('sort', 'id')
    order = request.args.get('order', 'asc')

    q = model.query
    col = getattr(model, sort_col, None)
    if col is not None:
        q = q.order_by(col.desc() if order == 'desc' else col.asc())

    total = q.count()
    rows = q.offset((page - 1) * per_page).limit(per_page).all()

    return jsonify({
        'table': table_key,
        'label': label,
        'columns': _model_columns(model),
        'rows': [_row_to_dict(r) for r in rows],
        'total': total,
        'page': page,
        'per_page': per_page,
    })


def _recalc_after_change(table_key, obj):
    """Trigger recalc cascade based on what was changed."""
    from services.recalc import (
        recalc_from_subtask, recalc_from_task, recalc_from_wp,
        recalc_from_phase, recalc_from_project, recalc_from_program,
    )
    try:
        if table_key == 'subtasks':
            recalc_from_subtask(obj)
        elif table_key == 'tasks':
            recalc_from_task(obj)
        elif table_key == 'work_packages':
            recalc_from_wp(obj)
        elif table_key == 'phases':
            recalc_from_phase(obj)
        elif table_key == 'projects':
            recalc_from_project(obj)
        elif table_key == 'programs':
            recalc_from_program(obj)
    except Exception:
        pass  # recalc failure shouldn't block admin save


def _recalc_parent_after_delete(table_key, obj):
    """Recalc the parent after a child is deleted."""
    from services.recalc import (
        recalc_from_task, recalc_from_wp,
        recalc_from_phase, recalc_from_project, recalc_from_program,
    )
    try:
        if table_key == 'subtasks' and hasattr(obj, 'task') and obj.task:
            recalc_from_task(obj.task)
        elif table_key == 'tasks' and hasattr(obj, 'work_package') and obj.work_package:
            recalc_from_wp(obj.work_package)
        elif table_key == 'work_packages' and hasattr(obj, 'phase') and obj.phase:
            recalc_from_phase(obj.phase)
        elif table_key == 'phases' and hasattr(obj, 'project') and obj.project:
            recalc_from_project(obj.project)
        elif table_key == 'projects' and hasattr(obj, 'program') and obj.program:
            recalc_from_program(obj.program)
    except Exception:
        pass


@api.route('/admin/<table_key>', methods=['POST'])
def admin_create_row(table_key):
    """Create a new row."""
    if table_key not in TABLES:
        return jsonify({'error': f'Unknown table: {table_key}'}), 404
    model, _ = TABLES[table_key]
    data = request.get_json()

    obj = model()
    for key, val in data.items():
        if key == 'id' or key in _REL_FIELDS:
            continue
        if hasattr(obj, key):
            if key in _DT_FIELDS and val:
                val = parse_date(val)
            setattr(obj, key, val)

    db.session.add(obj)
    db.session.flush()
    _recalc_after_change(table_key, obj)
    db.session.commit()
    return jsonify(_row_to_dict(obj)), 201


@api.route('/admin/<table_key>/<int:row_id>', methods=['PUT'])
def admin_update_row(table_key, row_id):
    """Update a row by ID."""
    if table_key not in TABLES:
        return jsonify({'error': f'Unknown table: {table_key}'}), 404
    model, _ = TABLES[table_key]
    obj = model.query.get_or_404(row_id)
    data = request.get_json()

    for key, val in data.items():
        if key == 'id' or key in _REL_FIELDS:
            continue
        if hasattr(obj, key):
            if key in _DT_FIELDS and val:
                val = parse_date(val)
            elif key in _DT_FIELDS and not val:
                val = None
            setattr(obj, key, val)

    db.session.flush()
    _recalc_after_change(table_key, obj)
    db.session.commit()
    return jsonify(_row_to_dict(obj))


@api.route('/admin/<table_key>/<int:row_id>', methods=['DELETE'])
def admin_delete_row(table_key, row_id):
    """Delete a row by ID."""
    if table_key not in TABLES:
        return jsonify({'error': f'Unknown table: {table_key}'}), 404
    model, _ = TABLES[table_key]
    obj = model.query.get_or_404(row_id)
    _recalc_parent_after_delete(table_key, obj)
    db.session.delete(obj)
    db.session.commit()
    return jsonify({'deleted': True, 'id': row_id})


# Member list for FK dropdowns
@api.route('/admin/members/lookup', methods=['GET'])
def admin_members_lookup():
    members = Member.query.order_by(Member.display_name).all()
    return jsonify([{'id': m.id, 'name': m.display_name} for m in members])
