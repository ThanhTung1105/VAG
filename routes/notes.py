from flask import jsonify, request
from routes import api
from extensions import db
from models import Note

LEVEL_LABELS = {
    'subtask': 'Subtask', 'task': 'Task', 'work_package': 'Work Package',
    'phase': 'Phase', 'project': 'Project', 'program': 'Program'
}


@api.route('/notes/<ref_table>/<int:ref_id>', methods=['GET'])
def list_notes(ref_table, ref_id):
    """GET /api/notes/task/42 → all notes for task 42 and its children."""
    cascade = request.args.get('cascade', '1')

    if cascade == '1':
        from routes.trail import _get_child_refs
        all_refs = _get_child_refs(ref_table, ref_id)
        from sqlalchemy import or_, and_
        conditions = [and_(Note.ref_table == rt, Note.ref_id == ri) for rt, ri in all_refs
                      if rt != 'note']
        if conditions:
            notes = Note.query.filter(or_(*conditions), Note.deleted_at == None) \
                .order_by(Note.created_at.asc()).all()
        else:
            notes = []
    else:
        notes = Note.query.filter_by(ref_table=ref_table, ref_id=ref_id, deleted_at=None) \
            .order_by(Note.created_at.asc()).all()

    return jsonify([n.to_dict() for n in notes])


@api.route('/notes/<ref_table>/<int:ref_id>', methods=['POST'])
def create_note(ref_table, ref_id):
    data = request.get_json()
    from services.permissions import get_current_user
    user = get_current_user()
    n = Note(
        ref_table=ref_table,
        ref_id=ref_id,
        author_id=user.id if user else data.get('author_id'),
        content=data['content'],
    )
    db.session.add(n)
    db.session.commit()
    return jsonify(n.to_dict()), 201


@api.route('/notes/<int:note_id>', methods=['PUT'])
def update_note(note_id):
    n = Note.query.get_or_404(note_id)
    data = request.get_json()

    if 'content' in data and data['content'] != n.content:
        n.content = data['content']
    # auto-audit handles update log on flush

    db.session.commit()
    return jsonify(n.to_dict())


@api.route('/notes/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    n = Note.query.get_or_404(note_id)

    # Soft delete
    from services.date_utils import now_vn
    n.deleted_at = now_vn()
    # auto-audit handles the deleted_at change log on flush

    db.session.commit()
    return jsonify({'deleted': True})
