"""
Tree builder — query DB and return nested JSON matching
the DATA structure that gantt.js expects.
"""

from models import Portfolio




def _fmt_dt(dt):
    """Format datetime: yyyy-mm-dd if midnight, yyyy-mm-ddTHH:MM if has time."""
    if dt is None:
        return None
    if dt.hour == 0 and dt.minute == 0:
        return dt.strftime('%Y-%m-%d')
    return dt.strftime('%Y-%m-%dT%H:%M')

def build_portfolio_tree(portfolio_id=None, user=None):
    """
    Build the full nested JSON tree.
    If user is provided and not admin, filter by permissions.
    """
    if portfolio_id:
        portfolio = Portfolio.query.get(portfolio_id)
    else:
        portfolio = Portfolio.query.first()

    if not portfolio:
        return {'portfolio': 'Empty', 'programs': []}

    programs = []
    for prg in portfolio.programs:
        prg_data = _build_program(prg, user)
        if prg_data:  # None if user has no access to any project in program
            programs.append(prg_data)

    return {
        'portfolio': portfolio.name,
        'programs': programs,
    }


def _build_program(prg, user=None):
    projects = []
    for prj in prg.projects:
        if user and not user.is_admin:
            from services.permissions import can_view_project
            if not can_view_project(user, prj.id):
                continue
        projects.append(_build_project(prj, user))

    if not projects and user and not user.is_admin:
        return None  # User has no visible projects in this program

    return {
        'id': f'prg{prg.id}',
        'name': prg.name,
        'description': prg.description,
        'status': prg.status,
        'health': prg.health,
        'pctFinished': prg.pct_finished,
        'pctApproved': prg.pct_approved,
        'deliverableUrl': prg.deliverable_url or '',
        'projects': projects,
    }


def _build_project(prj, user=None):
    # Determine if we need to filter items within this project
    filter_items = False
    if user and not user.is_admin:
        access = user.get_project_access(prj.id)
        if not access:
            # User has no explicit access — only show items they're involved in
            filter_items = True

    phases = []
    for ph in prj.phases:
        ph_data = _build_phase(ph, user, filter_items)
        if ph_data:
            phases.append(ph_data)

    return {
        'id': f'prj{prj.id}',
        'name': prj.name,
        'description': prj.description,
        'status': prj.status,
        'health': prj.health,
        'pctFinished': prj.pct_finished,
        'pctApproved': prj.pct_approved,
        'deliverableUrl': prj.deliverable_url or '',
        'phases': phases,
    }


def _build_phase(ph, user=None, filter_items=False):
    wps = []
    for wp in ph.work_packages:
        wp_data = _build_wp(wp, user, filter_items)
        if wp_data:
            wps.append(wp_data)

    if filter_items and not wps:
        return None  # No visible items in this phase

    return {
        'id': f'ph{ph.id}',
        'name': ph.name,
        'description': ph.description or '',
        'plannedStart': _fmt_dt(ph.planned_start),
        'plannedFinish': _fmt_dt(ph.planned_finish),
        'status': ph.status,
        'health': ph.health,
        'pctFinished': ph.pct_finished,
        'pctApproved': ph.pct_approved,
        'deliverableUrl': ph.deliverable_url or '',
        'workPackages': wps,
    }


def _build_wp(wp, user=None, filter_items=False):
    tasks = []
    has_involvement = False
    if user and not user.is_admin and user.is_involved_in_item(wp):
        has_involvement = True

    for t in wp.tasks:
        t_data = _build_task(t, user, filter_items)
        if t_data:
            tasks.append(t_data)
            has_involvement = True

    if filter_items and not has_involvement:
        return None

    return {
        'id': f'wp{wp.id}',
        'name': wp.name,
        'description': wp.description or '',
        'milestone': wp.milestone,
        'pic': wp.pic.display_name if wp.pic else None,
        'approver': wp.approver.display_name if wp.approver else None,
        'assignees': [m.display_name for m in wp.assignees],
        'plannedStart': _fmt_dt(wp.planned_start),
        'plannedFinish': _fmt_dt(wp.planned_finish),
        'ketQuaChinh': wp.key_result,
        'cancelled': wp.cancelled,
        'status': wp.status,
        'health': wp.health,
        'pctFinished': wp.pct_finished,
        'pctApproved': wp.pct_approved,
        'deliverableUrl': wp.deliverable_url or '',
        'tasks': tasks,
    }


def _build_task(t, user=None, filter_items=False):
    if filter_items and user and not user.is_admin:
        # Check if user is involved in this task or any subtask
        involved = user.is_involved_in_item(t)
        if not involved:
            for st in t.subtasks:
                if st.assignee_id == user.id:
                    involved = True
                    break
        if not involved:
            return None

    return {
        'id': f't{t.id}',
        'name': t.name,
        'description': t.description or '',
        'executionMode': _mode_display(t.execution_mode),
        'executionNote': t.execution_note or '',
        'deliverableUrl': t.deliverable_url or '',
        'keyResult': t.key_result or '',
        'pic': t.pic.display_name if t.pic else None,
        'approver': t.approver.display_name if t.approver else None,
        'assignees': [m.display_name for m in t.assignees],
        'plannedStart': _fmt_dt(t.planned_start),
        'plannedFinish': _fmt_dt(t.planned_finish),
        'actualStart': _fmt_dt(t.actual_start),
        'actualFinish': _fmt_dt(t.actual_finish),
        'cancelled': t.cancelled,
        'status': t.status,
        'health': t.health,
        'pctFinished': t.pct_finished,
        'pctApproved': t.pct_approved,
        'subtasks': [_build_subtask(st) for st in t.subtasks],
    }


def _build_subtask(st):
    # Assignees: prefer M2M, fallback to single
    if st.assignees:
        assignee_names = [m.display_name for m in st.assignees]
    elif st.assignee:
        assignee_names = [st.assignee.display_name]
    else:
        assignee_names = []

    return {
        'id': f'st{st.id}',
        'name': st.content,
        'finishStatus': st.finish_status,
        'assignee': st.assignee.display_name if st.assignee else None,
        'assignees': assignee_names,
        'plannedStart': _fmt_dt(st.planned_start),
        'plannedFinish': _fmt_dt(st.planned_finish),
        'actualStart': _fmt_dt(st.actual_start),
        'actualFinish': _fmt_dt(st.actual_finish),
        'keyResult': st.key_result or '',
        'deliverableUrl': st.deliverable_url or '',
    }


# Execution mode: DB stores snake_case, frontend expects Title Case
_MODE_MAP = {
    'independent': 'Independent',
    'online_meeting': 'Online Meeting',
    'offline_meeting': 'Offline Meeting',
    'workshop': 'Workshop',
    'site_visit': 'Site Visit',
    'presentation': 'Presentation',
}


def _mode_display(mode):
    return _MODE_MAP.get(mode, mode)
