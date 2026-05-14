from services.permissions import get_current_user, can_edit_item
from services.date_utils import parse_date as _parse_date
from flask import jsonify, request
from routes import api
from extensions import db
from models import Task, WorkPackage, Member, task_assignees
from services.member_lookup import find_or_create_member, find_or_create_members
from services.recalc import recalc_from_task


@api.route('/work-packages/<int:wp_id>/tasks', methods=['GET'])
def list_tasks(wp_id):
    wp = WorkPackage.query.get_or_404(wp_id)
    return jsonify([t.to_dict(nested=True) for t in wp.tasks])


@api.route('/work-packages/<int:wp_id>/tasks', methods=['POST'])
def create_task(wp_id):
    wp = WorkPackage.query.get_or_404(wp_id)
    user = get_current_user()
    if user and not can_edit_item(user, wp):
        return jsonify({'error': 'Không có quyền thêm task'}), 403
    data = request.get_json()

    max_sort = db.session.query(db.func.max(Task.sort_order)) \
        .filter(Task.wp_id == wp_id).scalar() or 0

    t = Task(
        wp_id=wp_id,
        name=data['name'],
        execution_mode=data.get('execution_mode', 'independent'),
        execution_note=data.get('execution_note'),
        deliverable_url=data.get('deliverable_url'),
        key_result=data.get('key_result'),
        planned_start=_parse_date(data.get('planned_start')),
        planned_finish=_parse_date(data.get('planned_finish')),
        pic_id=data.get('pic_id'),
        approver_id=data.get('approver_id') or wp.approver_id,
        sort_order=max_sort + 1,
    )
    db.session.add(t)
    db.session.flush()

    # Assignees
    if data.get('assignee_ids'):
        members = Member.query.filter(Member.id.in_(data['assignee_ids'])).all()
        t.assignees = members

    recalc_from_task(t)
    db.session.commit()

    return jsonify(t.to_dict(nested=True)), 201


@api.route('/tasks/<int:task_id>', methods=['GET'])
def get_task(task_id):
    t = Task.query.get_or_404(task_id)
    return jsonify(t.to_dict(nested=True))


@api.route('/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    t = Task.query.get_or_404(task_id)
    user = get_current_user()
    if user and not can_edit_item(user, t):
        return jsonify({'error': 'Không có quyền chỉnh sửa'}), 403
    data = request.get_json()

    fields = {
        'name': 'name', 'description': 'description',
        'execution_mode': 'execution_mode',
        'execution_note': 'execution_note', 'deliverable_url': 'deliverable_url',
        'key_result': 'key_result', 'cancelled': 'cancelled',
    }
    for json_key, attr in fields.items():
        if json_key in data:
            old = getattr(t, attr)
            new = data[json_key]
            if old != new:
                setattr(t, attr, new)

    date_fields = {
        'planned_start': 'planned_start', 'planned_finish': 'planned_finish',
        'actual_start': 'actual_start', 'actual_finish': 'actual_finish',
    }
    for json_key, attr in date_fields.items():
        if json_key in data:
            old = getattr(t, attr)
            new = _parse_date(data[json_key])
            if old != new:
                setattr(t, attr, new)

    if 'pic_id' in data:
        old_name = t.pic.display_name if t.pic else None
        t.pic_id = data['pic_id']
        db.session.flush()
        new_name = t.pic.display_name if t.pic else None

    # Frontend sends pic_name (display name string) instead of pic_id
    if 'pic_name' in data:
        old_name = t.pic.display_name if t.pic else None
        new_name = data['pic_name']
        if new_name:
            m = find_or_create_member(new_name)
            if m: # always true with find_or_create
                t.pic_id = m.id
        else:
            t.pic_id = None

    if 'approver_id' in data:
        old_name = t.approver.display_name if t.approver else None
        t.approver_id = data['approver_id']
        db.session.flush()
        new_name = t.approver.display_name if t.approver else None

    if 'approver_name' in data:
        old_name = t.approver.display_name if t.approver else None
        new_name = data['approver_name']
        if new_name:
            m = find_or_create_member(new_name)
            if m: # always true with find_or_create
                t.approver_id = m.id
        else:
            t.approver_id = None

    if 'assignee_ids' in data:
        old_names = [m.display_name for m in t.assignees]
        members = Member.query.filter(Member.id.in_(data['assignee_ids'])).all()
        t.assignees = members
        new_names = [m.display_name for m in members]

    # Frontend sends assignee_names (list of display name strings)
    if 'assignee_names' in data:
        old_names = [m.display_name for m in t.assignees]
        new_names = data['assignee_names']
        members = find_or_create_members(new_names)
        t.assignees = members

    if 'sort_order' in data:
        t.sort_order = data['sort_order']

    recalc_from_task(t)
    db.session.commit()

    return jsonify(t.to_dict(nested=True))


@api.route('/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    t = Task.query.get_or_404(task_id)
    user = get_current_user()
    if user and not can_edit_item(user, t):
        return jsonify({'error': 'Không có quyền xóa'}), 403
    wp = t.work_package

    db.session.delete(t)
    db.session.flush()

    from services.recalc import recalc_from_wp
    recalc_from_wp(wp)
    db.session.commit()

    return jsonify({'deleted': True})


@api.route('/tasks/<int:task_id>/reorder', methods=['PATCH'])
def reorder_task(task_id):
    """Move task to a different position or different WP."""
    t = Task.query.get_or_404(task_id)
    data = request.get_json()

    old_wp = t.work_package

    if 'wp_id' in data and data['wp_id'] != t.wp_id:
        new_wp = WorkPackage.query.get_or_404(data['wp_id'])
        t.wp_id = new_wp.id

    if 'sort_order' in data:
        t.sort_order = data['sort_order']

    db.session.flush()

    from services.recalc import recalc_from_wp
    recalc_from_wp(old_wp)
    if t.work_package.id != old_wp.id:
        recalc_from_wp(t.work_package)
    db.session.commit()

    return jsonify(t.to_dict(nested=True))


    from datetime import datetime
    try:
        return datetime.fromisoformat(s.replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        try:
            return datetime.strptime(s, '%Y-%m-%d')
        except (ValueError, AttributeError):
            return None
