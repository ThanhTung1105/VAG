"""
Recalculation engine — mirrors gantt_utils.js logic exactly.

Call recalc_from_subtask(subtask) after any subtask CUD.
It cascades: subtask → task → work_package → phase → project → program.

Call recalc_from_task(task) after task-level changes (dates, cancelled).
Call recalc_from_wp(wp) after WP-level changes.
...and so on up.
"""

from datetime import datetime, timezone
from extensions import db
from services.date_utils import now_vn


def _now():
    n = now_vn()
    return n.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)


# ═══════════════════════════════════════════
# Subtask level (leaf)
# ═══════════════════════════════════════════

def _subtask_pct_finished(subtask):
    return 100 if subtask.finish_status in ('finished', 'approved') else 0


def _subtask_pct_approved(subtask):
    return 100 if subtask.finish_status == 'approved' else 0


# ═══════════════════════════════════════════
# Task level
# ═══════════════════════════════════════════

def _recalc_task(task):
    """Recalc task from its subtasks."""
    subs = task.subtasks
    if not subs:
        task.pct_finished = 0
        task.pct_approved = 0
    else:
        done_f = sum(1 for s in subs if _subtask_pct_finished(s) >= 100)
        done_a = sum(1 for s in subs if _subtask_pct_approved(s) >= 100)
        n = len(subs)
        task.pct_finished = round(done_f / n * 100)
        task.pct_approved = round(done_a / n * 100)

    # Status
    if task.cancelled:
        task.status = 'cancelled'
    elif task.pct_approved >= 100:
        task.status = 'completed'
    elif task.pct_finished >= 100 and task.pct_approved < 100:
        task.status = 'in_review'
    elif task.planned_start and _now() >= task.planned_start and task.pct_finished < 100:
        task.status = 'in_progress'
    else:
        task.status = 'not_started'

    # Health
    task.health = _calc_health(
        task.status, task.planned_start, task.planned_finish,
        task.actual_finish
    )


# ═══════════════════════════════════════════
# Work Package level
# ═══════════════════════════════════════════

def _recalc_wp(wp):
    """Recalc WP from its tasks."""
    tasks = wp.tasks
    if not tasks:
        wp.pct_finished = 0
        wp.pct_approved = 0
    else:
        done_f = sum(1 for t in tasks if t.pct_finished >= 100)
        done_a = sum(1 for t in tasks if t.pct_approved >= 100)
        n = len(tasks)
        wp.pct_finished = round(done_f / n * 100)
        wp.pct_approved = round(done_a / n * 100)

    # Status
    if wp.cancelled:
        wp.status = 'cancelled'
    elif wp.pct_approved >= 100:
        wp.status = 'completed'
    elif wp.pct_finished >= 100 and wp.pct_approved < 100:
        wp.status = 'in_review'
    elif wp.planned_start and _now() >= wp.planned_start and wp.pct_finished < 100:
        wp.status = 'in_progress'
    else:
        wp.status = 'not_started'

    # Health
    wp.health = _calc_health(
        wp.status, wp.planned_start, wp.planned_finish, None
    )


# ═══════════════════════════════════════════
# Phase level
# ═══════════════════════════════════════════

def _recalc_phase(phase):
    """Recalc phase from its work packages."""
    wps = phase.work_packages
    if not wps:
        phase.pct_finished = 0
        phase.pct_approved = 0
        # Status based on dates only
        if phase.planned_start and _now() >= phase.planned_start:
            phase.status = 'in_progress'
        else:
            phase.status = 'not_started'
    else:
        done_f = sum(1 for w in wps if w.pct_finished >= 100)
        done_a = sum(1 for w in wps if w.pct_approved >= 100)
        n = len(wps)
        phase.pct_finished = round(done_f / n * 100)
        phase.pct_approved = round(done_a / n * 100)

        statuses = [w.status for w in wps]
        if all(s == 'completed' for s in statuses):
            phase.status = 'completed'
        elif any(s in ('in_progress', 'in_review') for s in statuses):
            phase.status = 'in_progress'
        else:
            phase.status = 'not_started'

    # Health
    if not wps:
        phase.health = _calc_health(
            phase.status, phase.planned_start, phase.planned_finish, None
        )
    else:
        healths = [w.health for w in wps]
        if 'behind_schedule' in healths:
            phase.health = 'behind_schedule'
        elif 'at_risk' in healths:
            phase.health = 'at_risk'
        else:
            phase.health = 'on_track'


# ═══════════════════════════════════════════
# Project level
# ═══════════════════════════════════════════

def _recalc_project(project):
    """Recalc project from all WPs across all phases."""
    all_wps = []
    for ph in project.phases:
        all_wps.extend(ph.work_packages)

    if not all_wps:
        project.pct_finished = 0
        project.pct_approved = 0
        project.status = 'not_started'
        project.health = 'on_track'
        return

    done_f = sum(1 for w in all_wps if w.pct_finished >= 100)
    done_a = sum(1 for w in all_wps if w.pct_approved >= 100)
    n = len(all_wps)
    project.pct_finished = round(done_f / n * 100)
    project.pct_approved = round(done_a / n * 100)

    statuses = [w.status for w in all_wps]
    if all(s == 'completed' for s in statuses):
        project.status = 'completed'
    elif any(s in ('in_progress', 'in_review') for s in statuses):
        project.status = 'in_progress'
    else:
        project.status = 'not_started'

    healths = [w.health for w in all_wps]
    if 'behind_schedule' in healths:
        project.health = 'behind_schedule'
    elif 'at_risk' in healths:
        project.health = 'at_risk'
    else:
        project.health = 'on_track'


# ═══════════════════════════════════════════
# Program level
# ═══════════════════════════════════════════

def _recalc_program(program):
    """Recalc program from all WPs across all projects."""
    all_wps = []
    for prj in program.projects:
        for ph in prj.phases:
            all_wps.extend(ph.work_packages)

    if not all_wps:
        program.pct_finished = 0
        program.pct_approved = 0
        program.status = 'not_started'
        program.health = 'on_track'
        return

    done_f = sum(1 for w in all_wps if w.pct_finished >= 100)
    done_a = sum(1 for w in all_wps if w.pct_approved >= 100)
    n = len(all_wps)
    program.pct_finished = round(done_f / n * 100)
    program.pct_approved = round(done_a / n * 100)

    statuses = [w.status for w in all_wps]
    if all(s == 'completed' for s in statuses):
        program.status = 'completed'
    elif any(s in ('in_progress', 'in_review') for s in statuses):
        program.status = 'in_progress'
    else:
        program.status = 'not_started'

    healths = [w.health for w in all_wps]
    if 'behind_schedule' in healths:
        program.health = 'behind_schedule'
    elif 'at_risk' in healths:
        program.health = 'at_risk'
    else:
        program.health = 'on_track'


# ═══════════════════════════════════════════
# Health calculation (shared)
# ═══════════════════════════════════════════

def _calc_health(status, planned_start, planned_finish, actual_finish):
    """Same logic as gantt_utils.js calcHealth."""
    if status in ('completed', 'cancelled'):
        return 'on_track'
    if not planned_start or not planned_finish:
        return 'on_track'

    now = _now()

    if actual_finish and actual_finish > planned_finish:
        return 'behind_schedule'
    if not actual_finish and status != 'completed' and now > planned_finish:
        return 'behind_schedule'

    dur = (planned_finish - planned_start).total_seconds()
    if dur > 0:
        elapsed = (now - planned_start).total_seconds()
        if elapsed >= dur * 0.9 and now <= planned_finish:
            return 'at_risk'

    return 'on_track'


# ═══════════════════════════════════════════
# Public API — cascade entry points
# ═══════════════════════════════════════════

def recalc_from_subtask(subtask):
    """Full cascade from subtask up to program."""
    task = subtask.task
    # Expire relationship to pick up newly added subtasks
    db.session.expire(task, ['subtasks'])
    _recalc_task(task)

    wp = task.work_package
    _recalc_wp(wp)

    phase = wp.phase
    _recalc_phase(phase)

    project = phase.project
    _recalc_project(project)

    program = project.program
    _recalc_program(program)

    db.session.flush()


def recalc_from_task(task):
    """Cascade from task up to program."""
    _recalc_task(task)

    wp = task.work_package
    _recalc_wp(wp)

    phase = wp.phase
    _recalc_phase(phase)

    project = phase.project
    _recalc_project(project)

    program = project.program
    _recalc_program(program)

    db.session.flush()


def recalc_from_wp(wp):
    """Cascade from WP up to program."""
    _recalc_wp(wp)

    phase = wp.phase
    _recalc_phase(phase)

    project = phase.project
    _recalc_project(project)

    program = project.program
    _recalc_program(program)

    db.session.flush()


def recalc_from_phase(phase):
    """Cascade from phase up to program."""
    _recalc_phase(phase)

    project = phase.project
    _recalc_project(project)

    program = project.program
    _recalc_program(program)

    db.session.flush()


def recalc_from_project(project):
    """Cascade from project up to program."""
    _recalc_project(project)

    program = project.program
    _recalc_program(program)

    db.session.flush()


def recalc_from_program(program):
    """Recalc program only."""
    _recalc_program(program)
    db.session.flush()
