from flask import jsonify, request
from routes import api
from extensions import db
from models import Subtask, Task, Member
from services.member_lookup import find_or_create_member
from services.permissions import get_current_user, login_required, can_toggle_subtask, can_approve_subtask, can_edit_item
from services.recalc import recalc_from_subtask


@api.route('/subtasks/<int:subtask_id>', methods=['GET'])
def get_subtask(subtask_id):
    """Get single subtask with all fields."""
    st = Subtask.query.get_or_404(subtask_id)
    return jsonify(st.to_dict())


@api.route('/tasks/<int:task_id>/subtasks', methods=['GET'])
def list_subtasks(task_id):
    task = Task.query.get_or_404(task_id)
    return jsonify([st.to_dict() for st in task.subtasks])


@api.route('/tasks/<int:task_id>/subtasks', methods=['POST'])
def create_subtask(task_id):
    task = Task.query.get_or_404(task_id)
    user = get_current_user()
    if user and not can_edit_item(user, task):
        return jsonify({'error': 'Không có quyền thêm đầu việc'}), 403
    data = request.get_json()
    from services.date_utils import parse_date

    max_sort = db.session.query(db.func.max(Subtask.sort_order)) \
        .filter(Subtask.task_id == task_id).scalar() or 0

    st = Subtask(
        task_id=task_id,
        content=data['content'],
        finish_status='unfinished',
        assignee_id=data.get('assignee_id'),
        sort_order=max_sort + 1,
        # Default dates from parent task
        planned_start=parse_date(data['planned_start']) if data.get('planned_start') else task.planned_start,
        planned_finish=parse_date(data['planned_finish']) if data.get('planned_finish') else task.planned_finish,
        key_result=data.get('key_result'),
        deliverable_url=data.get('deliverable_url'),
    )
    db.session.add(st)
    db.session.flush()

    # M2M assignees
    if 'assignee_names' in data and data['assignee_names']:
        from services.member_lookup import find_or_create_members
        st.assignees = find_or_create_members(data['assignee_names'])

    recalc_from_subtask(st)
    db.session.commit()
    return jsonify(st.to_dict()), 201


@api.route('/subtasks/<int:subtask_id>', methods=['PUT'])
def update_subtask(subtask_id):
    st = Subtask.query.get_or_404(subtask_id)
    user = get_current_user()
    if user and not can_toggle_subtask(user, st):
        return jsonify({'error': 'Không có quyền chỉnh sửa'}), 403
    data = request.get_json()

    if 'content' in data and data['content'] != st.content:
        st.content = data['content']

    # Legacy single assignee
    if 'assignee_id' in data:
        st.assignee_id = data['assignee_id']
        db.session.flush()

    if 'assignee_name' in data:
        new_name = data['assignee_name']
        if new_name:
            m = find_or_create_member(new_name)
            if m:
                st.assignee_id = m.id
        else:
            st.assignee_id = None

    # M2M assignees (list of names)
    if 'assignee_names' in data:
        from services.member_lookup import find_or_create_members
        st.assignees = find_or_create_members(data['assignee_names'] or [])

    # Dates
    from services.date_utils import parse_date
    for field in ('planned_start', 'planned_finish', 'actual_start', 'actual_finish'):
        json_key = field  # same name
        if json_key in data:
            setattr(st, field, parse_date(data[json_key]) if data[json_key] else None)

    # Text fields
    if 'key_result' in data:
        st.key_result = data['key_result']
    if 'deliverable_url' in data:
        st.deliverable_url = data['deliverable_url']

    if 'sort_order' in data:
        st.sort_order = data['sort_order']

    # Status change via popover
    if 'finish_status' in data and data['finish_status'] in ('unfinished', 'finished', 'approved'):
        st.finish_status = data['finish_status']

    recalc_from_subtask(st)
    db.session.commit()
    return jsonify(st.to_dict())


@api.route('/subtasks/<int:subtask_id>', methods=['DELETE'])
def delete_subtask(subtask_id):
    st = Subtask.query.get_or_404(subtask_id)
    user = get_current_user()
    if user and not can_edit_item(user, st.task):
        return jsonify({'error': 'Không có quyền xóa'}), 403
    task = st.task

    db.session.delete(st)
    db.session.flush()

    # Recalc from task (subtask is gone)
    from services.recalc import recalc_from_task
    recalc_from_task(task)
    db.session.commit()

    return jsonify({'deleted': True})


@api.route('/subtasks/<int:subtask_id>/finish', methods=['PATCH'])
def toggle_finish(subtask_id):
    """Assignee marks subtask as finished (or un-finishes it)."""
    st = Subtask.query.get_or_404(subtask_id)
    user = get_current_user()
    if user and not can_toggle_subtask(user, st):
        return jsonify({'error': 'Không có quyền thao tác'}), 403

    if st.finish_status == 'unfinished':
        st.finish_status = 'finished'
    elif st.finish_status == 'finished':
        st.finish_status = 'unfinished'

    db.session.flush()
    recalc_from_subtask(st)
    db.session.commit()
    return jsonify(st.to_dict())


@api.route('/subtasks/<int:subtask_id>/approve', methods=['PATCH'])
def approve_subtask(subtask_id):
    st = Subtask.query.get_or_404(subtask_id)
    data = request.get_json() or {}
    action = data.get('action', 'approve')
    user = get_current_user()
    if user and not can_approve_subtask(user, st):
        return jsonify({'error': 'Không có quyền phê duyệt'}), 403

    old_status = st.finish_status

    if action == 'approve' and st.finish_status == 'finished':
        st.finish_status = 'approved'
    elif action == 'reject' and st.finish_status in ('finished', 'approved'):
        st.finish_status = 'unfinished'

    db.session.flush()  # Flush subtask change → auto-audit catches it
    recalc_from_subtask(st)
    db.session.commit()

    return jsonify(st.to_dict())


@api.route('/subtask-sort/<int:task_id>', methods=['GET'])
def get_subtask_sort(task_id):
    """Get personal subtask sort order for current user."""
    from models.subtask_sort import SubtaskSortPersonal
    # get_current_user already imported from services.permissions
    user = get_current_user()
    if not user:
        return jsonify({'order': []}), 200
    sort = SubtaskSortPersonal.query.filter_by(member_id=user.id, task_id=task_id).first()
    if sort:
        import json
        return jsonify({'order': json.loads(sort.order_json)})
    return jsonify({'order': []})


@api.route('/subtask-sort/<int:task_id>', methods=['PUT'])
def save_subtask_sort(task_id):
    """Save personal subtask sort order for current user."""
    from models.subtask_sort import SubtaskSortPersonal
    # get_current_user already imported from services.permissions
    import json
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Not logged in'}), 401
    data = request.get_json()
    order = data.get('order', [])
    sort = SubtaskSortPersonal.query.filter_by(member_id=user.id, task_id=task_id).first()
    if sort:
        sort.order_json = json.dumps(order)
    else:
        sort = SubtaskSortPersonal(member_id=user.id, task_id=task_id, order_json=json.dumps(order))
        db.session.add(sort)
    db.session.commit()
    return jsonify({'ok': True})
