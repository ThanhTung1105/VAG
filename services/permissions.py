"""
Permission system — decorators and helper functions.

Usage in routes:
    @login_required
    def my_route():
        user = get_current_user()
        check_can_edit(user, 'task', task_obj)
"""
from functools import wraps
from flask import session, jsonify
from models import Member


def get_current_user():
    """Get current logged-in Member from session. Returns None if not logged in."""
    user_id = session.get('user_id')
    if not user_id:
        return None
    return Member.query.get(user_id)


def login_required(f):
    """Decorator: require login. Returns 401 if not authenticated."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user or not user.is_active:
            return jsonify({'error': 'Chưa đăng nhập'}), 401
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    """Decorator: require admin role."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user or not user.is_active:
            return jsonify({'error': 'Chưa đăng nhập'}), 401
        if not user.is_admin:
            return jsonify({'error': 'Không có quyền truy cập'}), 403
        return f(*args, **kwargs)
    return decorated


def _find_project_id(ref_table, item):
    """Walk up the hierarchy to find the project_id for an item."""
    if ref_table == 'project' or hasattr(item, 'program_id'):
        # item IS a project
        return item.id if ref_table == 'project' else None
    if hasattr(item, 'project_id'):
        return item.project_id  # phase
    if hasattr(item, 'phase_id'):
        # WP → phase → project
        if item.phase:
            return item.phase.project_id
    if hasattr(item, 'wp_id'):
        # task → WP → phase → project
        if item.work_package and item.work_package.phase:
            return item.work_package.phase.project_id
    if hasattr(item, 'task_id'):
        # subtask → task → WP → phase → project
        if item.task and item.task.work_package and item.task.work_package.phase:
            return item.task.work_package.phase.project_id
    return None


def can_view_project(user, project_id):
    """Check if user can view a project (any access level or involvement)."""
    if user.is_admin:
        return True
    # Explicit access
    if user.get_project_access(project_id):
        return True
    # Check involvement (PIC/Approver/Assignee in any item under project)
    return _is_involved_in_project(user, project_id)


def can_edit_item(user, item):
    """Check if user can edit a specific item.
    Returns: 'full' | 'own' | False
    - 'full': can edit all fields
    - 'own': can edit only as PIC/Approver/Assignee
    - False: cannot edit
    """
    if user.is_admin:
        return 'full'

    ref_table = item.__class__.__tablename__
    # Programs: only admin
    if ref_table == 'programs':
        return False
    # Projects: only admin or full access
    if ref_table == 'projects':
        access = user.get_project_access(item.id)
        return 'full' if access == 'full' else False

    project_id = _find_project_id(ref_table, item)
    if not project_id:
        return False

    access = user.get_project_access(project_id)
    if access == 'full':
        return 'full'
    if access == 'edit' and user.is_involved_in_item(item):
        return 'own'
    if access == 'view':
        return False
    # No project access but involved → own access
    if user.is_involved_in_item(item):
        return 'own'
    return False


def can_toggle_subtask(user, subtask):
    """Check if user can tick/untick a subtask."""
    if user.is_admin:
        return True
    # Subtask assignee
    if subtask.assignee_id == user.id:
        return True
    # Task assignee
    if user.is_involved_in_item(subtask.task):
        return True
    # Project full access
    project_id = _find_project_id('subtasks', subtask)
    if project_id:
        access = user.get_project_access(project_id)
        if access == 'full':
            return True
    return False


def can_approve_subtask(user, subtask):
    """Check if user can approve/reject a subtask."""
    if user.is_admin:
        return True
    # Task approver
    task = subtask.task
    if task and task.approver_id == user.id:
        return True
    # Project full access
    project_id = _find_project_id('subtasks', subtask)
    if project_id:
        access = user.get_project_access(project_id)
        if access == 'full':
            return True
    return False


def _is_involved_in_project(user, project_id):
    """Check if user is PIC/Approver/Assignee of any item under a project."""
    from models import Phase, WorkPackage, Task, Subtask
    # Check phases
    phases = Phase.query.filter_by(project_id=project_id).all()
    for ph in phases:
        for wp in ph.work_packages:
            if user.is_involved_in_item(wp):
                return True
            for t in wp.tasks:
                if user.is_involved_in_item(t):
                    return True
                for st in t.subtasks:
                    if st.assignee_id == user.id:
                        return True
    return False
