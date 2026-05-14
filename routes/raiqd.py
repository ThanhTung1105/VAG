"""
RAIQD API — CRUD for Risk, Issue, Action, Question, Decision + cross-links.
All endpoints: /api/raiqd/<type>/...
"""
from flask import jsonify, request
from routes import api
from extensions import db
from models import Risk, Issue, Action, Question, Decision, RaiqdLink
from services.permissions import get_current_user
from services.date_utils import parse_date
from services.member_lookup import find_or_create_member

# Type registry
RAIQD_MODELS = {
    'risk': Risk,
    'issue': Issue,
    'action': Action,
    'question': Question,
    'decision': Decision,
}

# Fields that need date parsing
_DT_FIELDS = {'deadline'}

# Fields that need member lookup by name
_MEMBER_NAME_FIELDS = {
    'detected_by_name': 'detected_by_id',
    'decided_by_name': 'decided_by_id',
    'closed_by_name': 'closed_by_id',
}


def _apply_data(obj, data):
    """Apply request data to a RAIQD model instance."""
    for key, val in data.items():
        # PIC names (M2M) — list of display names
        if key == 'pic_names' and hasattr(obj, 'pics'):
            from services.member_lookup import find_or_create_members
            obj.pics = find_or_create_members(val or [])
            continue

        # Single member name → ID resolution (detected_by, decided_by, closed_by)
        if key in _MEMBER_NAME_FIELDS:
            attr = _MEMBER_NAME_FIELDS[key]
            if hasattr(obj, attr):
                if val:
                    m = find_or_create_member(val)
                    setattr(obj, attr, m.id if m else None)
                else:
                    setattr(obj, attr, None)
            continue

        # Date fields
        if key in _DT_FIELDS and hasattr(obj, key):
            setattr(obj, key, parse_date(val) if val else None)
            continue

        # Skip read-only / non-column fields
        if key in ('id', 'type', 'created_at', 'updated_at', 'pic', 'detected_by', 'decided_by', 'closed_by'):
            continue

        if hasattr(obj, key):
            setattr(obj, key, val)


def _resolve_source_name(source_table, source_id):
    """Resolve source/impact reference to display name."""
    if not source_table or not source_id:
        return None
    MODEL_MAP = {
        'program': ('models.program', 'Program', 'name'),
        'project': ('models.project', 'Project', 'name'),
        'phase': ('models.phase', 'Phase', 'name'),
        'work_package': ('models.work_package', 'WorkPackage', 'name'),
        'task': ('models.task', 'Task', 'name'),
    }
    if source_table not in MODEL_MAP:
        return None
    mod_path, cls_name, field = MODEL_MAP[source_table]
    import importlib
    mod = importlib.import_module(mod_path)
    cls = getattr(mod, cls_name)
    item = cls.query.get(source_id)
    return getattr(item, field) if item else None


# ═══ LIST ═══

@api.route('/raiqd/<raiqd_type>', methods=['GET'])
def raiqd_list(raiqd_type):
    """List items. Optional filters: ?status=open&severity=high&project_id=1&source_table=task&source_id=5"""
    if raiqd_type not in RAIQD_MODELS:
        return jsonify({'error': f'Unknown type: {raiqd_type}'}), 400
    model = RAIQD_MODELS[raiqd_type]

    q = model.query
    # Filters
    status = request.args.get('status')
    if status:
        q = q.filter(model.status == status)
    severity = request.args.get('severity')
    if severity:
        q = q.filter(model.severity == severity)
    source_table = request.args.get('source_table')
    source_id = request.args.get('source_id', type=int)
    if source_table and source_id:
        q = q.filter(model.source_table == source_table, model.source_id == source_id)
    project_id = request.args.get('project_id', type=int)
    if project_id:
        # Filter by project: source is any item under this project
        q = q.filter(
            db.or_(
                db.and_(model.source_table == 'project', model.source_id == project_id),
                model.source_table.in_(['phase', 'work_package', 'task']),
            )
        )

    sort = request.args.get('sort', 'created_at')
    order = request.args.get('order', 'desc')
    col = getattr(model, sort, model.created_at)
    q = q.order_by(col.desc() if order == 'desc' else col.asc())

    items = q.all()
    result = []
    for item in items:
        d = item.to_dict()
        d['source_name'] = _resolve_source_name(item.source_table, item.source_id)
        if hasattr(item, 'impact_table'):
            d['impact_name'] = _resolve_source_name(item.impact_table, item.impact_id)
        # Attach linked items summary
        d['links'] = _get_links(raiqd_type, item.id)
        result.append(d)

    return jsonify(result)


# ═══ GET ONE ═══

@api.route('/raiqd/<raiqd_type>/<int:item_id>', methods=['GET'])
def raiqd_get(raiqd_type, item_id):
    if raiqd_type not in RAIQD_MODELS:
        return jsonify({'error': f'Unknown type: {raiqd_type}'}), 400
    model = RAIQD_MODELS[raiqd_type]
    item = model.query.get_or_404(item_id)
    d = item.to_dict()
    d['source_name'] = _resolve_source_name(item.source_table, item.source_id)
    if hasattr(item, 'impact_table'):
        d['impact_name'] = _resolve_source_name(item.impact_table, item.impact_id)
    d['links'] = _get_links(raiqd_type, item.id)
    return jsonify(d)


# ═══ CREATE ═══

@api.route('/raiqd/<raiqd_type>', methods=['POST'])
def raiqd_create(raiqd_type):
    if raiqd_type not in RAIQD_MODELS:
        return jsonify({'error': f'Unknown type: {raiqd_type}'}), 400
    model = RAIQD_MODELS[raiqd_type]
    data = request.get_json()

    user = get_current_user()
    obj = model()
    _apply_data(obj, data)

    # Default detected_by to current user (risk/issue)
    if hasattr(obj, 'detected_by_id') and not obj.detected_by_id and user:
        obj.detected_by_id = user.id
    # Default decided_by to current user (decision)
    if hasattr(obj, 'decided_by_id') and not obj.decided_by_id and user:
        obj.decided_by_id = user.id

    db.session.add(obj)
    db.session.flush()  # Get obj.id for links

    # Create links if provided: links: [{to_type, to_id, link_type}, ...]
    links = data.get('links', [])
    for lk_data in links:
        lk = RaiqdLink(
            from_type=raiqd_type, from_id=obj.id,
            to_type=lk_data['to_type'], to_id=lk_data['to_id'],
            link_type=lk_data['link_type'],
        )
        db.session.add(lk)

    db.session.commit()
    return jsonify(obj.to_dict()), 201


# ═══ UPDATE ═══

@api.route('/raiqd/<raiqd_type>/<int:item_id>', methods=['PUT'])
def raiqd_update(raiqd_type, item_id):
    if raiqd_type not in RAIQD_MODELS:
        return jsonify({'error': f'Unknown type: {raiqd_type}'}), 400
    model = RAIQD_MODELS[raiqd_type]
    obj = model.query.get_or_404(item_id)
    data = request.get_json()

    # Close: set closed_by to current user
    user = get_current_user()
    if data.get('status') == 'closed' and obj.status != 'closed' and hasattr(obj, 'closed_by_id') and user:
        obj.closed_by_id = user.id

    _apply_data(obj, data)
    db.session.commit()
    return jsonify(obj.to_dict())


# ═══ DELETE ═══

@api.route('/raiqd/<raiqd_type>/<int:item_id>', methods=['DELETE'])
def raiqd_delete(raiqd_type, item_id):
    if raiqd_type not in RAIQD_MODELS:
        return jsonify({'error': f'Unknown type: {raiqd_type}'}), 400
    model = RAIQD_MODELS[raiqd_type]
    obj = model.query.get_or_404(item_id)

    # Delete related links
    RaiqdLink.query.filter(
        db.or_(
            db.and_(RaiqdLink.from_type == raiqd_type, RaiqdLink.from_id == item_id),
            db.and_(RaiqdLink.to_type == raiqd_type, RaiqdLink.to_id == item_id),
        )
    ).delete(synchronize_session=False)

    db.session.delete(obj)
    db.session.commit()
    return jsonify({'deleted': True})


# ═══ LINKS ═══

def _get_links(item_type, item_id):
    """Get all links for an item, resolve linked item names."""
    links_from = RaiqdLink.query.filter_by(from_type=item_type, from_id=item_id).all()
    links_to = RaiqdLink.query.filter_by(to_type=item_type, to_id=item_id).all()
    result = []
    for lk in links_from:
        d = lk.to_dict()
        d['direction'] = 'outgoing'
        d['linked_item'] = _get_linked_item_summary(lk.to_type, lk.to_id)
        result.append(d)
    for lk in links_to:
        d = lk.to_dict()
        d['direction'] = 'incoming'
        d['linked_item'] = _get_linked_item_summary(lk.from_type, lk.from_id)
        result.append(d)
    return result


def _get_linked_item_summary(item_type, item_id):
    """Get brief summary of a linked RAIQD item."""
    model = RAIQD_MODELS.get(item_type)
    if not model:
        return None
    item = model.query.get(item_id)
    if not item:
        return None
    # Get the primary text field
    if hasattr(item, 'description'):
        text = item.description
    elif hasattr(item, 'method'):
        text = item.method
    elif hasattr(item, 'question'):
        text = item.question
    elif hasattr(item, 'decision_text'):
        text = item.decision_text
    else:
        text = ''
    return {
        'type': item_type,
        'id': item_id,
        'text': (text or '')[:100],
        'status': item.status,
        'severity': getattr(item, 'severity', None),
    }


@api.route('/raiqd/links', methods=['POST'])
def raiqd_link_create():
    """Create a link between two RAIQD items."""
    data = request.get_json()
    lk = RaiqdLink(
        from_type=data['from_type'], from_id=data['from_id'],
        to_type=data['to_type'], to_id=data['to_id'],
        link_type=data['link_type'],
    )
    db.session.add(lk)
    db.session.commit()
    return jsonify(lk.to_dict()), 201


@api.route('/raiqd/links/<int:link_id>', methods=['DELETE'])
def raiqd_link_delete(link_id):
    """Delete a link."""
    lk = RaiqdLink.query.get_or_404(link_id)
    db.session.delete(lk)
    db.session.commit()
    return jsonify({'deleted': True})


# ═══ SUMMARY (for dashboard/reports) ═══

@api.route('/raiqd/summary', methods=['GET'])
def raiqd_summary():
    """Get counts by type and status."""
    result = {}
    for type_name, model in RAIQD_MODELS.items():
        open_count = model.query.filter_by(status='open').count()
        closed_count = model.query.filter_by(status='closed').count()
        result[type_name] = {'open': open_count, 'closed': closed_count, 'total': open_count + closed_count}
    return jsonify(result)


# ═══ WORK ITEM RESOLVE (for displaying source/impact breadcrumbs) ═══

@api.route('/raiqd/resolve-item', methods=['GET'])
def resolve_work_item():
    """Resolve a work item (table, id) to its full breadcrumb path.
    ?table=task&id=6 → { table, id, name, breadcrumb: "PRG → PRJ → PH → WP → Task" }
    """
    table = request.args.get('table')
    item_id = request.args.get('id', type=int)
    if not table or not item_id:
        return jsonify({'error': 'Missing table or id'}), 400

    MODEL_MAP = {
        'program':      ('models.program', 'Program'),
        'project':      ('models.project', 'Project'),
        'phase':        ('models.phase', 'Phase'),
        'work_package': ('models.work_package', 'WorkPackage'),
        'task':         ('models.task', 'Task'),
    }
    if table not in MODEL_MAP:
        return jsonify({'error': 'Unknown table'}), 400

    import importlib
    mod_path, cls_name = MODEL_MAP[table]
    mod = importlib.import_module(mod_path)
    cls = getattr(mod, cls_name)
    item = cls.query.get(item_id)
    if not item:
        return jsonify({'error': 'Not found'}), 404

    # Build breadcrumb by walking up
    parts = []
    if table == 'task':
        parts = [item.work_package.phase.project.program.name,
                 item.work_package.phase.project.name,
                 item.work_package.phase.name,
                 item.work_package.name,
                 item.name]
    elif table == 'work_package':
        parts = [item.phase.project.program.name,
                 item.phase.project.name,
                 item.phase.name,
                 item.name]
    elif table == 'phase':
        parts = [item.project.program.name,
                 item.project.name,
                 item.name]
    elif table == 'project':
        parts = [item.program.name, item.name]
    elif table == 'program':
        parts = [item.name]

    return jsonify({
        'table': table,
        'id': item_id,
        'name': getattr(item, 'name', getattr(item, 'content', '')),
        'breadcrumb': ' → '.join(parts),
    })
