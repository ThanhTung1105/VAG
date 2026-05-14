from extensions import db
from services.date_utils import now_vn, fmt_vn

issue_pics = db.Table("issue_pics",
    db.Column("issue_id", db.BigInteger, db.ForeignKey("issues.id"), primary_key=True),
    db.Column("member_id", db.BigInteger, db.ForeignKey("members.id"), primary_key=True),
)




class Issue(db.Model):
    __tablename__ = 'issues'

    id = db.Column(db.BigInteger().with_variant(db.Integer, "sqlite"), primary_key=True, autoincrement=True)
    source_table = db.Column(db.String(20), nullable=True)
    source_id = db.Column(db.BigInteger, nullable=True)
    impact_table = db.Column(db.String(20), nullable=True)
    impact_id = db.Column(db.BigInteger, nullable=True)
    detected_by_id = db.Column(db.BigInteger, db.ForeignKey('members.id'), nullable=True)
    description = db.Column(db.Text, nullable=False)
    severity = db.Column(db.String(10), default='medium', nullable=False)
    
    deadline = db.Column(db.DateTime, nullable=True)
    proposed_solution = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(10), default='open', nullable=False)
    closed_by_id = db.Column(db.BigInteger, db.ForeignKey('members.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=now_vn, nullable=False)
    updated_at = db.Column(db.DateTime, default=now_vn, onupdate=now_vn, nullable=False)

    pics = db.relationship("Member", secondary="issue_pics", lazy="selectin")
    detected_by = db.relationship('Member', foreign_keys=[detected_by_id], lazy='selectin')
    closed_by = db.relationship('Member', foreign_keys=[closed_by_id], lazy='selectin')

    __table_args__ = (db.Index('ix_issue_source', 'source_table', 'source_id'),)

    def to_dict(self):
        return {
            'id': self.id, 'type': 'issue',
            'source_table': self.source_table, 'source_id': self.source_id,
            'impact_table': self.impact_table, 'impact_id': self.impact_id,
            'detected_by': self.detected_by.display_name if self.detected_by else None,
            'detected_by_id': self.detected_by_id,
            'description': self.description, 'severity': self.severity,
            'pics': [m.display_name for m in self.pics],
            'deadline': fmt_vn(self.deadline), 'proposed_solution': self.proposed_solution,
            'status': self.status,
            'closed_by': self.closed_by.display_name if self.closed_by else None,
            'created_at': fmt_vn(self.created_at), 'updated_at': fmt_vn(self.updated_at),
        }
