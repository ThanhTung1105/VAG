from extensions import db
from services.date_utils import now_vn, fmt_vn

question_pics = db.Table("question_pics",
    db.Column("question_id", db.BigInteger, db.ForeignKey("questions.id"), primary_key=True),
    db.Column("member_id", db.BigInteger, db.ForeignKey("members.id"), primary_key=True),
)




class Question(db.Model):
    __tablename__ = 'questions'

    id = db.Column(db.BigInteger().with_variant(db.Integer, "sqlite"), primary_key=True, autoincrement=True)
    source_table = db.Column(db.String(20), nullable=True)
    source_id = db.Column(db.BigInteger, nullable=True)
    question = db.Column(db.Text, nullable=False)
    severity = db.Column(db.String(10), default='medium', nullable=False)
    
    status = db.Column(db.String(10), default='open', nullable=False)
    created_at = db.Column(db.DateTime, default=now_vn, nullable=False)
    updated_at = db.Column(db.DateTime, default=now_vn, onupdate=now_vn, nullable=False)

    pics = db.relationship("Member", secondary="question_pics", lazy="selectin")

    __table_args__ = (db.Index('ix_question_source', 'source_table', 'source_id'),)

    def to_dict(self):
        return {
            'id': self.id, 'type': 'question',
            'source_table': self.source_table, 'source_id': self.source_id,
            'question': self.question, 'severity': self.severity,
            'pics': [m.display_name for m in self.pics],
            'status': self.status,
            'created_at': fmt_vn(self.created_at), 'updated_at': fmt_vn(self.updated_at),
        }
