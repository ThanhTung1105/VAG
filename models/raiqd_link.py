from extensions import db
from services.date_utils import now_vn, fmt_vn


class RaiqdLink(db.Model):
    __tablename__ = 'raiqd_links'

    id = db.Column(db.BigInteger().with_variant(db.Integer, "sqlite"), primary_key=True, autoincrement=True)
    from_type = db.Column(db.String(10), nullable=False)   # risk/issue/action/question/decision
    from_id = db.Column(db.BigInteger, nullable=False)
    to_type = db.Column(db.String(10), nullable=False)
    to_id = db.Column(db.BigInteger, nullable=False)
    link_type = db.Column(db.String(20), nullable=False)    # resolves/causes/generates
    created_at = db.Column(db.DateTime, default=now_vn, nullable=False)

    __table_args__ = (
        db.Index('ix_raiqd_link_from', 'from_type', 'from_id'),
        db.Index('ix_raiqd_link_to', 'to_type', 'to_id'),
        db.UniqueConstraint('from_type', 'from_id', 'to_type', 'to_id', 'link_type', name='uq_raiqd_link'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'from_type': self.from_type, 'from_id': self.from_id,
            'to_type': self.to_type, 'to_id': self.to_id,
            'link_type': self.link_type,
            'created_at': fmt_vn(self.created_at),
        }
