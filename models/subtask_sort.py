from extensions import db


class SubtaskSortPersonal(db.Model):
    """Per-user subtask sort order for execution view."""
    __tablename__ = 'subtask_sort_personal'

    id = db.Column(db.BigInteger().with_variant(db.Integer, "sqlite"), primary_key=True, autoincrement=True)
    member_id = db.Column(db.BigInteger, db.ForeignKey('members.id'), nullable=False, index=True)
    task_id = db.Column(db.BigInteger, db.ForeignKey('tasks.id'), nullable=False, index=True)
    # Ordered list of subtask IDs as JSON array: [3, 1, 5, 2]
    order_json = db.Column(db.Text, nullable=False, default='[]')

    __table_args__ = (
        db.UniqueConstraint('member_id', 'task_id', name='uq_member_task_sort'),
    )
