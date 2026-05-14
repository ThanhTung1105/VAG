from flask import jsonify, request
from routes import api
from extensions import db
from services.tree import build_portfolio_tree


@api.route('/portfolio', methods=['GET'])
def get_portfolio():
    """Return the full nested tree for the Gantt chart, filtered by user permissions."""
    from services.permissions import get_current_user
    user = get_current_user()
    tree = build_portfolio_tree(user=user)
    return jsonify(tree)


@api.route('/portfolio/version', methods=['GET'])
def get_version():
    """Returns latest audit trail ID as version number."""
    from models import AuditTrail
    # NOTE: On SQLite, polling may see stale version due to session caching.
    # This is resolved automatically with MySQL on PythonAnywhere.
    latest = db.session.query(db.func.max(AuditTrail.id)).scalar()
    resp = jsonify({'version': latest or 0})
    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    resp.headers['Pragma'] = 'no-cache'
    return resp


@api.route('/reorder', methods=['PUT'])
def reorder_items():
    """Bulk reorder children of a parent.
    Body: { parent_type: 'phase', parent_id: 1, child_type: 'work_package', order: [3, 1, 2] }
    order = list of child IDs in new order.
    """
    from models import Program, Project, Phase, WorkPackage, Task, Subtask
    data = request.get_json()
    parent_type = data.get('parent_type')
    child_type = data.get('child_type')
    order = data.get('order', [])

    MODEL_MAP = {
        'program': Program, 'project': Project, 'phase': Phase,
        'work_package': WorkPackage, 'task': Task, 'subtask': Subtask,
    }
    model = MODEL_MAP.get(child_type)
    if not model:
        return jsonify({'error': f'Unknown child_type: {child_type}'}), 400

    for idx, item_id in enumerate(order):
        # Strip frontend prefix (prg1 → 1, prj2 → 2, etc.)
        db_id = item_id
        if isinstance(item_id, str):
            import re
            m = re.search(r'(\d+)$', item_id)
            db_id = int(m.group(1)) if m else None
        if db_id:
            item = model.query.get(db_id)
            if item:
                item.sort_order = idx

    db.session.commit()
    return jsonify({'ok': True, 'count': len(order)})
