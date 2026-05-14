"""
Auto-audit v3 — before_flush for updates/deletes, after_flush for creates.
Always captures actor_id from Flask session.
"""
from extensions import db
from models.audit_trail import AuditTrail
from sqlalchemy import event, inspect

_SKIP_FIELDS = {'created_at', 'updated_at', 'id'}
_COMPUTED_FIELDS = {'pct_finished', 'pct_approved', 'status', 'health'}
_FK_FIELDS = {'pic_id', 'approver_id', 'assignee_id', 'author_id',
              'detected_by_id', 'decided_by_id', 'closed_by_id'}
_REGISTRY = {}
_flushing = False
_enabled = True


def disable_audit():
    global _enabled; _enabled = False

def enable_audit():
    global _enabled; _enabled = True

def register_audit(model_cls, ref_table, name_field='name'):
    _REGISTRY[model_cls] = (ref_table, name_field)


def _get_actor_id():
    """Get current user ID from Flask session."""
    try:
        from flask import session
        return session.get('user_id')
    except RuntimeError:
        return None


def _obj_name(obj, nf):
    if callable(nf):
        try: return nf(obj)
        except: return ''
    val = getattr(obj, nf, '') or ''
    return val[:200] if isinstance(val, str) else str(val)


def _fmt(val):
    if val is None: return None
    if isinstance(val, (list, tuple)):
        parts = []
        for v in val:
            if hasattr(v, 'display_name'): parts.append(v.display_name)
            elif hasattr(v, 'name'): parts.append(v.name)
            else: parts.append(str(v))
        return ', '.join(parts) if parts else None
    if hasattr(val, 'strftime'): return val.strftime('%d-%m-%Y %H:%M:%S')
    return str(val)


def _resolve_fk(key, val):
    if val and key in _FK_FIELDS:
        from models.member import Member
        m = db.session.get(Member, val)
        if m: return m.display_name
    return _fmt(val)


def _before_flush(session, flush_context, instances):
    global _flushing
    if _flushing or not _enabled: return
    _flushing = True
    entries = []
    actor = _get_actor_id()
    try:
        for obj in list(session.dirty):
            cls = type(obj)
            if cls not in _REGISTRY or cls is AuditTrail: continue
            ref_table, nf = _REGISTRY[cls]
            name = _obj_name(obj, nf)
            insp = inspect(obj)
            for attr in insp.attrs:
                k = attr.key
                if k in _SKIP_FIELDS: continue
                h = attr.history
                if not h.has_changes(): continue

                if h.deleted and hasattr(h.deleted[0], 'display_name') if h.deleted else False:
                    old_s = _fmt(list(h.unchanged or []) + list(h.deleted))
                    new_s = _fmt(list(h.unchanged or []) + list(h.added))
                elif len(h.deleted) > 1 or len(h.added) > 1:
                    old_s = _fmt(h.deleted) if h.deleted else None
                    new_s = _fmt(h.added) if h.added else None
                else:
                    old_v = h.deleted[0] if h.deleted else None
                    new_v = h.added[0] if h.added else None
                    if k in _FK_FIELDS:
                        old_s = _resolve_fk(k, old_v)
                        new_s = _resolve_fk(k, new_v)
                    else:
                        old_s = _fmt(old_v)
                        new_s = _fmt(new_v)

                if old_s == new_s: continue
                dk = k.replace('_id', '') if k in _FK_FIELDS else k
                src = 'system' if k in _COMPUTED_FIELDS else 'user'

                entries.append(AuditTrail(
                    ref_table=ref_table, ref_id=obj.id, source=src,
                    actor_id=actor, action='update', object_name=name,
                    field_name=dk, old_value=old_s, new_value=new_s,
                ))

        for obj in list(session.deleted):
            cls = type(obj)
            if cls not in _REGISTRY or cls is AuditTrail: continue
            ref_table, nf = _REGISTRY[cls]
            entries.append(AuditTrail(
                ref_table=ref_table, ref_id=obj.id, source='user',
                actor_id=actor, action='delete', object_name=_obj_name(obj, nf),
            ))

        if entries: session.add_all(entries)
    finally:
        _flushing = False


def _after_flush(session, flush_context):
    global _flushing
    if _flushing or not _enabled: return
    _flushing = True
    entries = []
    actor = _get_actor_id()
    try:
        for obj in list(session.new):
            cls = type(obj)
            if cls not in _REGISTRY or cls is AuditTrail: continue
            if not getattr(obj, 'id', None): continue
            ref_table, nf = _REGISTRY[cls]
            entries.append(AuditTrail(
                ref_table=ref_table, ref_id=obj.id, source='user',
                actor_id=actor, action='create', object_name=_obj_name(obj, nf),
            ))
        if entries: session.add_all(entries)
    finally:
        _flushing = False


def init_auto_audit(app):
    from models import (
        Portfolio, Program, Project, Phase, WorkPackage,
        Task, Subtask, Note, Member, Dependency,
        Risk, Issue, Action, Question, Decision, RaiqdLink
    )

    register_audit(Portfolio, 'portfolio', 'name')
    register_audit(Program, 'program', 'name')
    register_audit(Project, 'project', 'name')
    register_audit(Phase, 'phase', 'name')
    register_audit(WorkPackage, 'work_package', 'name')
    register_audit(Task, 'task', 'name')
    register_audit(Subtask, 'subtask', 'content')
    register_audit(Member, 'member', 'display_name')
    register_audit(Dependency, 'dependency', 'id')

    _LEVEL_LABELS = {
        'subtask': 'Subtask', 'task': 'Task', 'work_package': 'Work Package',
        'phase': 'Phase', 'project': 'Project', 'program': 'Program'
    }
    def _note_name(n):
        level = _LEVEL_LABELS.get(n.ref_table, n.ref_table)
        ref_name = n._resolve_ref_name() or f'#{n.ref_id}'
        return f'Ghi chú trên {level}: {ref_name}'
    register_audit(Note, 'note', _note_name)

    from models import ProjectAccess
    register_audit(ProjectAccess, 'project_access', 'access_level')

    # RAIQD models
    from models import Risk, Issue, Action, Question, Decision, RaiqdLink
    register_audit(Risk, 'risk', 'description')
    register_audit(Issue, 'issue', 'description')
    register_audit(Action, 'action', 'method')
    register_audit(Question, 'question', 'question')
    register_audit(Decision, 'decision', 'decision_text')
    register_audit(RaiqdLink, 'raiqd_link', 'link_type')

    event.listen(db.session, 'before_flush', _before_flush)
    event.listen(db.session, 'after_flush', _after_flush)


# Backward-compat manual helpers
def log_create(ref_table, ref_id, object_name, actor_id=None, source='user'):
    if actor_id is None: actor_id = _get_actor_id()
    db.session.add(AuditTrail(ref_table=ref_table, ref_id=ref_id, source=source,
                               actor_id=actor_id, action='create', object_name=object_name))

def log_update(ref_table, ref_id, object_name, field_name, old_value, new_value,
               actor_id=None, source='user'):
    if str(old_value) == str(new_value): return
    if actor_id is None: actor_id = _get_actor_id()
    db.session.add(AuditTrail(ref_table=ref_table, ref_id=ref_id, source=source,
                               actor_id=actor_id, action='update', object_name=object_name,
                               field_name=field_name, old_value=str(old_value) if old_value is not None else None,
                               new_value=str(new_value) if new_value is not None else None))

def log_delete(ref_table, ref_id, object_name, actor_id=None, source='user'):
    if actor_id is None: actor_id = _get_actor_id()
    db.session.add(AuditTrail(ref_table=ref_table, ref_id=ref_id, source=source,
                               actor_id=actor_id, action='delete', object_name=object_name))
