from extensions import db
from services.date_utils import now_vn, fmt_vn

action_pics = db.Table("action_pics",
    db.Column("action_id", db.BigInteger, db.ForeignKey("actions.id"), primary_key=True),
    db.Column("member_id", db.BigInteger, db.ForeignKey("members.id"), primary_key=True),
)




class Action(db.Model):
    __tablename__ = 'actions'

    id = db.Column(db.BigInteger().with_variant(db.Integer, "sqlite"), primary_key=True, autoincrement=True)
    source_table = db.Column(db.String(20), nullable=True)
    source_id = db.Column(db.BigInteger, nullable=True)
    method = db.Column(db.Text, nullable=True)  # phương án thực hiện
    severity = db.Column(db.String(10), default='medium', nullable=False)
    
    deadline = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(10), default='open', nullable=False)
    created_at = db.Column(db.DateTime, default=now_vn, nullable=False)
    updated_at = db.Column(db.DateTime, default=now_vn, onupdate=now_vn, nullable=False)

    pics = db.relationship("Member", secondary="action_pics", lazy="selectin")

    __table_args__ = (db.Index('ix_action_source', 'source_table', 'source_id'),)

    def to_dict(self):
        return {
            'id': self.id, 'type': 'action',
            'source_table': self.source_table, 'source_id': self.source_id,
            'method': self.method, 'severity': self.severity,
            'pics': [m.display_name for m in self.pics],
            'deadline': fmt_vn(self.deadline), 'status': self.status,
            'created_at': fmt_vn(self.created_at), 'updated_at': fmt_vn(self.updated_at),
        }
