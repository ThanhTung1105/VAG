from extensions import db
from services.date_utils import now_vn, fmt_vn


class Decision(db.Model):
    __tablename__ = 'decisions'

    id = db.Column(db.BigInteger().with_variant(db.Integer, "sqlite"), primary_key=True, autoincrement=True)
    source_table = db.Column(db.String(20), nullable=True)
    source_id = db.Column(db.BigInteger, nullable=True)
    decided_by_id = db.Column(db.BigInteger, db.ForeignKey('members.id'), nullable=True)
    decision_text = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(10), default='open', nullable=False)
    created_at = db.Column(db.DateTime, default=now_vn, nullable=False)
    updated_at = db.Column(db.DateTime, default=now_vn, onupdate=now_vn, nullable=False)

    decided_by = db.relationship('Member', foreign_keys=[decided_by_id], lazy='selectin')

    __table_args__ = (db.Index('ix_decision_source', 'source_table', 'source_id'),)

    def to_dict(self):
        return {
            'id': self.id, 'type': 'decision',
            'source_table': self.source_table, 'source_id': self.source_id,
            'decided_by': self.decided_by.display_name if self.decided_by else None,
            'decided_by_id': self.decided_by_id,
            'decision_text': self.decision_text, 'status': self.status,
            'created_at': fmt_vn(self.created_at), 'updated_at': fmt_vn(self.updated_at),
        }
