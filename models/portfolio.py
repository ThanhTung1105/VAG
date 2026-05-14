from extensions import db
from datetime import datetime, timezone
from services.date_utils import now_vn


class Portfolio(db.Model):
    __tablename__ = 'portfolios'

    id = db.Column(db.BigInteger().with_variant(db.Integer, "sqlite"), primary_key=True, autoincrement=True)
    name = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=now_vn, nullable=False)
    updated_at = db.Column(db.DateTime, default=now_vn,
                           onupdate=now_vn, nullable=False)

    programs = db.relationship('Program', back_populates='portfolio',
                               order_by='Program.sort_order', lazy='selectin')

    def to_dict(self, nested=True):
        d = {'id': self.id, 'name': self.name}
        if nested:
            d['programs'] = [p.to_dict(nested=True) for p in self.programs]
        return d
