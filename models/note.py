from extensions import db
from datetime import datetime, timezone
from services.date_utils import now_vn, fmt_vn

# Which table the note belongs to
REF_TABLES = ('program', 'project', 'phase', 'work_package', 'task', 'subtask')


class Note(db.Model):
    __tablename__ = 'notes'

    id = db.Column(db.BigInteger().with_variant(db.Integer, "sqlite"), primary_key=True, autoincrement=True)
    ref_table = db.Column(db.String(20), nullable=False)  # program, project, phase, work_package, task, subtask
    ref_id = db.Column(db.BigInteger, nullable=False)
    author_id = db.Column(db.BigInteger, db.ForeignKey('members.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)

    created_at = db.Column(db.DateTime, default=now_vn, nullable=False)
    updated_at = db.Column(db.DateTime, default=now_vn,
                           onupdate=now_vn, nullable=False)
    deleted_at = db.Column(db.DateTime, nullable=True)  # Soft delete

    author = db.relationship('Member', foreign_keys=[author_id], lazy='selectin')

    __table_args__ = (
        db.Index('ix_notes_ref', 'ref_table', 'ref_id'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'ref_table': self.ref_table,
            'ref_id': self.ref_id,
            'ref_name': self._resolve_ref_name(),
            'author': self.author.display_name if self.author else None,
            'content': self.content,
            'created_at': fmt_vn(self.created_at),
            'updated_at': fmt_vn(self.updated_at),
        }

    def _resolve_ref_name(self):
        """Resolve the name of the referenced item for display."""
        try:
            if self.ref_table == 'subtask':
                from models.subtask import Subtask
                item = Subtask.query.get(self.ref_id)
                return item.content if item else None
            elif self.ref_table == 'task':
                from models.task import Task
                item = Task.query.get(self.ref_id)
                return item.name if item else None
            elif self.ref_table == 'work_package':
                from models.work_package import WorkPackage
                item = WorkPackage.query.get(self.ref_id)
                return item.name if item else None
            elif self.ref_table == 'phase':
                from models.phase import Phase
                item = Phase.query.get(self.ref_id)
                return item.name if item else None
            elif self.ref_table == 'project':
                from models.project import Project
                item = Project.query.get(self.ref_id)
                return item.name if item else None
            elif self.ref_table == 'program':
                from models.program import Program
                item = Program.query.get(self.ref_id)
                return item.name if item else None
        except Exception:
            pass
        return None
