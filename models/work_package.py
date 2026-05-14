from extensions import db
from datetime import datetime, timezone
from services.date_utils import now_vn


# Many-to-many: work_package <-> members (assignees)
wp_assignees = db.Table(
    'wp_assignees',
    db.Column('wp_id', db.BigInteger, db.ForeignKey('work_packages.id'), primary_key=True),
    db.Column('member_id', db.BigInteger, db.ForeignKey('members.id'), primary_key=True),
)


class WorkPackage(db.Model):
    __tablename__ = 'work_packages'

    id = db.Column(db.BigInteger().with_variant(db.Integer, "sqlite"), primary_key=True, autoincrement=True)
    phase_id = db.Column(db.BigInteger, db.ForeignKey('phases.id'), nullable=False, index=True)
    name = db.Column(db.String(300), nullable=False)
    description = db.Column(db.Text, nullable=True)
    milestone = db.Column(db.String(10), default='none', nullable=False)  # big, small, none
    key_result = db.Column(db.Text, nullable=True)
    cancelled = db.Column(db.Boolean, default=False, nullable=False)
    sort_order = db.Column(db.Integer, default=0, nullable=False)

    planned_start = db.Column(db.DateTime, nullable=True)
    planned_finish = db.Column(db.DateTime, nullable=True)

    pic_id = db.Column(db.BigInteger, db.ForeignKey('members.id'), nullable=True)
    approver_id = db.Column(db.BigInteger, db.ForeignKey('members.id'), nullable=True)

    # Computed (cached)
    pct_finished = db.Column(db.Integer, default=0, nullable=False)
    pct_approved = db.Column(db.Integer, default=0, nullable=False)
    status = db.Column(db.String(20), default='not_started', nullable=False)
    health = db.Column(db.String(20), default='on_track', nullable=False)
    deliverable_url = db.Column(db.String(500), nullable=True)

    created_at = db.Column(db.DateTime, default=now_vn, nullable=False)
    updated_at = db.Column(db.DateTime, default=now_vn,
                           onupdate=now_vn, nullable=False)

    phase = db.relationship('Phase', back_populates='work_packages')
    pic = db.relationship('Member', foreign_keys=[pic_id], lazy='selectin')
    approver = db.relationship('Member', foreign_keys=[approver_id], lazy='selectin')
    assignees = db.relationship('Member', secondary=wp_assignees, lazy='selectin')
    tasks = db.relationship('Task', back_populates='work_package',
                            order_by='Task.sort_order', lazy='selectin')

    def to_dict(self, nested=True):
        d = {
            'id': self.id,
            'name': self.name,
            'milestone': self.milestone,
            'keyResult': self.key_result,
            'cancelled': self.cancelled,
            'sort_order': self.sort_order,
            'plannedStart': self.planned_start.strftime('%Y-%m-%dT%H:%M') if self.planned_start else None,
            'plannedFinish': self.planned_finish.strftime('%Y-%m-%dT%H:%M') if self.planned_finish else None,
            'pic': self.pic.display_name if self.pic else None,
            'approver': self.approver.display_name if self.approver else None,
            'assignees': [m.display_name for m in self.assignees],
            'pct_finished': self.pct_finished,
            'pct_approved': self.pct_approved,
            'status': self.status,
            'health': self.health,
        }
        if nested:
            d['tasks'] = [t.to_dict(nested=True) for t in self.tasks]
        return d
