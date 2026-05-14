from extensions import db
from datetime import datetime, timezone
from services.date_utils import now_vn


# Many-to-many: task <-> members (assignees)
task_assignees = db.Table(
    'task_assignees',
    db.Column('task_id', db.BigInteger, db.ForeignKey('tasks.id'), primary_key=True),
    db.Column('member_id', db.BigInteger, db.ForeignKey('members.id'), primary_key=True),
)

# Valid execution modes
EXECUTION_MODES = ('independent', 'online_meeting', 'offline_meeting',
                   'workshop', 'site_visit', 'presentation')


class Task(db.Model):
    __tablename__ = 'tasks'

    id = db.Column(db.BigInteger().with_variant(db.Integer, "sqlite"), primary_key=True, autoincrement=True)
    wp_id = db.Column(db.BigInteger, db.ForeignKey('work_packages.id'), nullable=False, index=True)
    name = db.Column(db.String(300), nullable=False)
    description = db.Column(db.Text, nullable=True)
    execution_mode = db.Column(db.String(30), default='independent', nullable=False)
    execution_note = db.Column(db.Text, nullable=True)
    deliverable_url = db.Column(db.String(1000), nullable=True)
    key_result = db.Column(db.Text, nullable=True)
    cancelled = db.Column(db.Boolean, default=False, nullable=False)
    sort_order = db.Column(db.Integer, default=0, nullable=False)

    planned_start = db.Column(db.DateTime, nullable=True)
    planned_finish = db.Column(db.DateTime, nullable=True)
    actual_start = db.Column(db.DateTime, nullable=True)
    actual_finish = db.Column(db.DateTime, nullable=True)

    pic_id = db.Column(db.BigInteger, db.ForeignKey('members.id'), nullable=True)
    approver_id = db.Column(db.BigInteger, db.ForeignKey('members.id'), nullable=True)

    # Computed (cached)
    pct_finished = db.Column(db.Integer, default=0, nullable=False)
    pct_approved = db.Column(db.Integer, default=0, nullable=False)
    status = db.Column(db.String(20), default='not_started', nullable=False)
    health = db.Column(db.String(20), default='on_track', nullable=False)

    created_at = db.Column(db.DateTime, default=now_vn, nullable=False)
    updated_at = db.Column(db.DateTime, default=now_vn,
                           onupdate=now_vn, nullable=False)

    work_package = db.relationship('WorkPackage', back_populates='tasks')
    pic = db.relationship('Member', foreign_keys=[pic_id], lazy='selectin')
    approver = db.relationship('Member', foreign_keys=[approver_id], lazy='selectin')
    assignees = db.relationship('Member', secondary=task_assignees, lazy='selectin')
    subtasks = db.relationship('Subtask', back_populates='task',
                               order_by='Subtask.sort_order', lazy='selectin')

    def to_dict(self, nested=True):
        d = {
            'id': self.id,
            'name': self.name,
            'executionMode': self.execution_mode,
            'executionNote': self.execution_note,
            'deliverableUrl': self.deliverable_url,
            'keyResult': self.key_result,
            'cancelled': self.cancelled,
            'sort_order': self.sort_order,
            'plannedStart': self.planned_start.strftime('%Y-%m-%dT%H:%M') if self.planned_start else None,
            'plannedFinish': self.planned_finish.strftime('%Y-%m-%dT%H:%M') if self.planned_finish else None,
            'actualStart': self.actual_start.strftime('%Y-%m-%dT%H:%M') if self.actual_start else None,
            'actualFinish': self.actual_finish.strftime('%Y-%m-%dT%H:%M') if self.actual_finish else None,
            'pic': self.pic.display_name if self.pic else None,
            'approver': self.approver.display_name if self.approver else None,
            'assignees': [m.display_name for m in self.assignees],
            'pct_finished': self.pct_finished,
            'pct_approved': self.pct_approved,
            'status': self.status,
            'health': self.health,
        }
        if nested:
            d['subtasks'] = [st.to_dict() for st in self.subtasks]
        return d
