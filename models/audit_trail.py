from extensions import db
from datetime import datetime, timezone
from services.date_utils import now_vn, fmt_vn


class AuditTrail(db.Model):
    __tablename__ = 'audit_trail'

    id = db.Column(db.BigInteger().with_variant(db.Integer, "sqlite"), primary_key=True, autoincrement=True)
    ref_table = db.Column(db.String(20), nullable=False)  # program, project, phase, work_package, task, subtask
    ref_id = db.Column(db.BigInteger, nullable=False)
    source = db.Column(db.String(10), default='user', nullable=False)  # user, system
    actor_id = db.Column(db.BigInteger, db.ForeignKey('members.id'), nullable=True)
    action = db.Column(db.String(10), nullable=False)  # create, update, delete
    object_name = db.Column(db.String(300), nullable=True)  # Tên đối tượng tại thời điểm log
    field_name = db.Column(db.String(100), nullable=True)   # Thuộc tính bị thay đổi
    old_value = db.Column(db.Text, nullable=True)
    new_value = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=now_vn, nullable=False)

    actor = db.relationship('Member', foreign_keys=[actor_id], lazy='selectin')

    __table_args__ = (
        db.Index('ix_audit_ref', 'ref_table', 'ref_id'),
        db.Index('ix_audit_time', 'created_at'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'ref_table': self.ref_table,
            'ref_id': self.ref_id,
            'source': self.source,
            'actor': self.actor.display_name if self.actor else 'System',
            'action': self.action,
            'object_name': self.object_name,
            'field_name': self.field_name,
            'old_value': self.old_value,
            'new_value': self.new_value,
            'created_at': fmt_vn(self.created_at),
        }
