from flask import jsonify, request
from routes import api
from extensions import db
from models import AuditTrail, Task, WorkPackage, Phase, Project, Program, Note


def _get_child_refs(ref_table, ref_id):
    """Get all (ref_table, ref_id) pairs for this item, its descendants, and their notes."""
    refs = [(ref_table, ref_id)]

    # Include notes attached to this item
    note_ids = [n.id for n in Note.query.filter_by(ref_table=ref_table, ref_id=ref_id).all()]
    for nid in note_ids:
        refs.append(('note', nid))

    if ref_table == 'program':
        prj_ids = [p.id for p in Project.query.filter_by(program_id=ref_id).all()]
        for pid in prj_ids:
            refs.append(('project', pid))
            refs.extend(_get_child_refs('project', pid))

    elif ref_table == 'project':
        ph_ids = [p.id for p in Phase.query.filter_by(project_id=ref_id).all()]
        for pid in ph_ids:
            refs.append(('phase', pid))
            refs.extend(_get_child_refs('phase', pid))

    elif ref_table == 'phase':
        wp_ids = [w.id for w in WorkPackage.query.filter_by(phase_id=ref_id).all()]
        for wid in wp_ids:
            refs.append(('work_package', wid))
            refs.extend(_get_child_refs('work_package', wid))

    elif ref_table == 'work_package':
        task_ids = [t.id for t in Task.query.filter_by(wp_id=ref_id).all()]
        for tid in task_ids:
            refs.append(('task', tid))
            refs.extend(_get_child_refs('task', tid))

    elif ref_table == 'task':
        from models import Subtask
        st_ids = [s.id for s in Subtask.query.filter_by(task_id=ref_id).all()]
        for sid in st_ids:
            refs.append(('subtask', sid))
            # Include notes on subtasks too
            sn_ids = [n.id for n in Note.query.filter_by(ref_table='subtask', ref_id=sid).all()]
            for nid in sn_ids:
                refs.append(('note', nid))

    return refs


@api.route('/trail/<ref_table>/<int:ref_id>', methods=['GET'])
def get_trail(ref_table, ref_id):
    """GET /api/trail/task/42 → audit history for task 42 AND all its children."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)

    # Get all descendant refs
    all_refs = _get_child_refs(ref_table, ref_id)

    # Build OR conditions
    from sqlalchemy import or_, and_
    conditions = [and_(AuditTrail.ref_table == rt, AuditTrail.ref_id == ri) for rt, ri in all_refs]

    q = AuditTrail.query.filter(or_(*conditions)).order_by(AuditTrail.created_at.desc())

    total = q.count()
    entries = q.offset((page - 1) * per_page).limit(per_page).all()

    return jsonify({
        'total': total,
        'page': page,
        'per_page': per_page,
        'entries': [e.to_dict() for e in entries],
    })
