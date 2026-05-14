from services.permissions import get_current_user, can_edit_item
from services.date_utils import parse_date as _parse_date
from flask import jsonify, request
from routes import api
from extensions import db
from models import Phase, Project
from services.recalc import recalc_from_phase


@api.route('/projects/<int:project_id>/phases', methods=['GET'])
def list_phases(project_id):
    project = Project.query.get_or_404(project_id)
    return jsonify([ph.to_dict(nested=True) for ph in project.phases])


@api.route('/projects/<int:project_id>/phases', methods=['POST'])
def create_phase(project_id):
    prj = Project.query.get_or_404(project_id)
    user = get_current_user()
    if user and not can_edit_item(user, prj):
        return jsonify({'error': 'Không có quyền thêm phase'}), 403
    data = request.get_json()

    max_sort = db.session.query(db.func.max(Phase.sort_order)) \
        .filter(Phase.project_id == project_id).scalar() or 0

    ph = Phase(
        project_id=project_id,
        name=data['name'],
        planned_start=_parse_date(data.get('planned_start')),
        planned_finish=_parse_date(data.get('planned_finish')),
        sort_order=max_sort + 1,
    )
    db.session.add(ph)
    db.session.flush()

    recalc_from_phase(ph)
    db.session.commit()

    return jsonify(ph.to_dict(nested=True)), 201


@api.route('/phases/<int:phase_id>', methods=['PUT'])
def update_phase(phase_id):
    ph = Phase.query.get_or_404(phase_id)
    user = get_current_user()
    if user and not can_edit_item(user, ph):
        return jsonify({'error': 'Không có quyền chỉnh sửa'}), 403
    data = request.get_json()

    if 'name' in data and data['name'] != ph.name:
        ph.name = data['name']

    if 'description' in data and data.get('description', '') != (ph.description or ''):
        ph.description = data['description']

    for key in ('planned_start', 'planned_finish'):
        if key in data:
            old = getattr(ph, key)
            new = _parse_date(data[key])
            if old != new:
                setattr(ph, key, new)

    if 'sort_order' in data:
        ph.sort_order = data['sort_order']

    recalc_from_phase(ph)
    db.session.commit()

    return jsonify(ph.to_dict(nested=True))


@api.route('/phases/<int:phase_id>', methods=['DELETE'])
def delete_phase(phase_id):
    ph = Phase.query.get_or_404(phase_id)
    user = get_current_user()
    if user and not can_edit_item(user, ph):
        return jsonify({'error': 'Không có quyền xóa'}), 403
    project = ph.project

    db.session.delete(ph)
    db.session.flush()

    from services.recalc import recalc_from_project
    recalc_from_project(project)
    db.session.commit()

    return jsonify({'deleted': True})


    from datetime import datetime
    try:
        return datetime.fromisoformat(s.replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        try:
            return datetime.strptime(s, '%Y-%m-%d')
        except (ValueError, AttributeError):
            return None
