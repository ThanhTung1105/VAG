from extensions import db
from datetime import datetime, timezone
from services.date_utils import now_vn

# Dependency types: FS=Finish-to-Start, FF, SS, SF
DEPENDENCY_TYPES = ('FS', 'FF', 'SS', 'SF')


class Dependency(db.Model):
    __tablename__ = 'dependencies'

    id = db.Column(db.BigInteger().with_variant(db.Integer, "sqlite"), primary_key=True, autoincrement=True)
    predecessor_table = db.Column(db.String(20), nullable=False)  # work_package, task
    predecessor_id = db.Column(db.BigInteger, nullable=False)
    successor_table = db.Column(db.String(20), nullable=False)
    successor_id = db.Column(db.BigInteger, nullable=False)
    dep_type = db.Column(db.String(5), default='FS', nullable=False)
    lag_days = db.Column(db.Integer, default=0, nullable=False)

    created_at = db.Column(db.DateTime, default=now_vn, nullable=False)

    __table_args__ = (
        db.UniqueConstraint('predecessor_table', 'predecessor_id',
                            'successor_table', 'successor_id',
                            name='uq_dependency'),
        db.Index('ix_dep_pred', 'predecessor_table', 'predecessor_id'),
        db.Index('ix_dep_succ', 'successor_table', 'successor_id'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'predecessor_table': self.predecessor_table,
            'predecessor_id': self.predecessor_id,
            'successor_table': self.successor_table,
            'successor_id': self.successor_id,
            'dep_type': self.dep_type,
            'lag_days': self.lag_days,
        }
