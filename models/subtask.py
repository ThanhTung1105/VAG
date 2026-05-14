from extensions import db
from services.date_utils import now_vn, fmt_vn

FINISH_STATUSES = ('unfinished', 'finished', 'approved')

# M2M table for subtask assignees (multi-person)
subtask_assignees = db.Table('subtask_assignees',
    db.Column('subtask_id', db.BigInteger, db.ForeignKey('subtasks.id'), primary_key=True),
    db.Column('member_id', db.BigInteger, db.ForeignKey('members.id'), primary_key=True),
)


class Subtask(db.Model):
    __tablename__ = 'subtasks'

    id = db.Column(db.BigInteger().with_variant(db.Integer, "sqlite"), primary_key=True, autoincrement=True)
    task_id = db.Column(db.BigInteger, db.ForeignKey('tasks.id'), nullable=False, index=True)
    content = db.Column(db.String(500), nullable=False)
    finish_status = db.Column(db.String(20), default='unfinished', nullable=False)
    sort_order = db.Column(db.Integer, default=0, nullable=False)

    # Legacy single assignee (kept for backward compat)
    assignee_id = db.Column(db.BigInteger, db.ForeignKey('members.id'), nullable=True)

    # New fields
    planned_start = db.Column(db.DateTime, nullable=True)
    planned_finish = db.Column(db.DateTime, nullable=True)
    actual_start = db.Column(db.DateTime, nullable=True)
    actual_finish = db.Column(db.DateTime, nullable=True)
    key_result = db.Column(db.Text, nullable=True)
    deliverable_url = db.Column(db.String(500), nullable=True)

    created_at = db.Column(db.DateTime, default=now_vn, nullable=False)
    updated_at = db.Column(db.DateTime, default=now_vn, onupdate=now_vn, nullable=False)

    task = db.relationship('Task', back_populates='subtasks')
    assignee = db.relationship('Member', foreign_keys=[assignee_id], lazy='selectin')
    assignees = db.relationship('Member', secondary=subtask_assignees, lazy='selectin')

    def _fmt(self, dt):
        if dt is None:
            return None
        if dt.hour == 0 and dt.minute == 0:
            return dt.strftime('%Y-%m-%d')
        return dt.strftime('%Y-%m-%dT%H:%M')

    def to_dict(self):
        # Assignee names: prefer M2M, fallback to single
        if self.assignees:
            assignee_names = [m.display_name for m in self.assignees]
        elif self.assignee:
            assignee_names = [self.assignee.display_name]
        else:
            assignee_names = []

        return {
            'id': self.id,
            'name': self.content,
            'finishStatus': self.finish_status,
            'sort_order': self.sort_order,
            'assignee': self.assignee.display_name if self.assignee else None,
            'assignees': assignee_names,
            'plannedStart': self._fmt(self.planned_start),
            'plannedFinish': self._fmt(self.planned_finish),
            'actualStart': self._fmt(self.actual_start),
            'actualFinish': self._fmt(self.actual_finish),
            'keyResult': self.key_result,
            'deliverableUrl': self.deliverable_url,
        }
