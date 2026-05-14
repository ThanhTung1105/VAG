from services.permissions import get_current_user, can_edit_item
from services.date_utils import parse_date as _parse_date
from flask import jsonify, request
from routes import api
from extensions import db
from models import WorkPackage, Phase, Member, wp_assignees
from services.member_lookup import find_or_create_member, find_or_create_members
from services.recalc import recalc_from_wp


@api.route('/phases/<int:phase_id>/work-packages', methods=['GET'])
def list_wps(phase_id):
    phase = Phase.query.get_or_404(phase_id)
    return jsonify([wp.to_dict(nested=True) for wp in phase.work_packages])


@api.route('/phases/<int:phase_id>/work-packages', methods=['POST'])
def create_wp(phase_id):
    ph = Phase.query.get_or_404(phase_id)
    user = get_current_user()
    if user and not can_edit_item(user, ph):
        return jsonify({"error": "Không có quyền thêm WP"}), 403
    data = request.get_json()

    max_sort = db.session.query(db.func.max(WorkPackage.sort_order)) \
        .filter(WorkPackage.phase_id == phase_id).scalar() or 0

    wp = WorkPackage(
        phase_id=phase_id,
        name=data['name'],
        milestone=data.get('milestone', 'none'),
        key_result=data.get('key_result'),
        planned_start=_parse_date(data.get('planned_start')),
        planned_finish=_parse_date(data.get('planned_finish')),
        pic_id=data.get('pic_id'),
        approver_id=data.get('approver_id'),
        sort_order=max_sort + 1,
    )
    db.session.add(wp)
    db.session.flush()

    if data.get('assignee_ids'):
        members = Member.query.filter(Member.id.in_(data['assignee_ids'])).all()
        wp.assignees = members

    recalc_from_wp(wp)
    db.session.commit()

    return jsonify(wp.to_dict(nested=True)), 201


@api.route('/work-packages/<int:wp_id>', methods=['GET'])
def get_wp(wp_id):
    wp = WorkPackage.query.get_or_404(wp_id)
    return jsonify(wp.to_dict(nested=True))


@api.route('/work-packages/<int:wp_id>', methods=['PUT'])
def update_wp(wp_id):
    wp = WorkPackage.query.get_or_404(wp_id)
    user = get_current_user()
    if user and not can_edit_item(user, wp):
        return jsonify({'error': 'Không có quyền chỉnh sửa'}), 403
    data = request.get_json()

    fields = {'name': 'name', 'description': 'description', 'milestone': 'milestone', 'key_result': 'key_result', 'cancelled': 'cancelled'}
    for json_key, attr in fields.items():
        if json_key in data:
            old = getattr(wp, attr)
            new = data[json_key]
            if old != new:
                setattr(wp, attr, new)

    for json_key, attr in {'planned_start': 'planned_start', 'planned_finish': 'planned_finish'}.items():
        if json_key in data:
            old = getattr(wp, attr)
            new = _parse_date(data[json_key])
            if old != new:
                setattr(wp, attr, new)

    if 'pic_id' in data:
        old_name = wp.pic.display_name if wp.pic else None
        wp.pic_id = data['pic_id']
        db.session.flush()
        new_name = wp.pic.display_name if wp.pic else None

    if 'pic_name' in data:
        old_name = wp.pic.display_name if wp.pic else None
        new_name = data['pic_name']
        if new_name:
            m = find_or_create_member(new_name)
            if m: # always true with find_or_create
                wp.pic_id = m.id
        else:
            wp.pic_id = None

    if 'approver_id' in data:
        old_name = wp.approver.display_name if wp.approver else None
        wp.approver_id = data['approver_id']
        db.session.flush()
        new_name = wp.approver.display_name if wp.approver else None

    if 'approver_name' in data:
        old_name = wp.approver.display_name if wp.approver else None
        new_name = data['approver_name']
        if new_name:
            m = find_or_create_member(new_name)
            if m: # always true with find_or_create
                wp.approver_id = m.id
        else:
            wp.approver_id = None

    if 'assignee_ids' in data:
        old_names = [m.display_name for m in wp.assignees]
        members = Member.query.filter(Member.id.in_(data['assignee_ids'])).all()
        wp.assignees = members
        new_names = [m.display_name for m in members]

    if 'assignee_names' in data:
        old_names = [m.display_name for m in wp.assignees]
        new_names = data['assignee_names']
        members = find_or_create_members(new_names)
        wp.assignees = members

    recalc_from_wp(wp)
    db.session.commit()

    return jsonify(wp.to_dict(nested=True))


@api.route('/work-packages/<int:wp_id>', methods=['DELETE'])
def delete_wp(wp_id):
    wp = WorkPackage.query.get_or_404(wp_id)
    user = get_current_user()
    if user and not can_edit_item(user, wp):
        return jsonify({'error': 'Không có quyền xóa'}), 403
    phase = wp.phase

    db.session.delete(wp)
    db.session.flush()

    from services.recalc import recalc_from_phase
    recalc_from_phase(phase)
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
