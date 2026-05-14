from flask import jsonify, request
from routes import api
from extensions import db
from models import Project, Program
from services.recalc import recalc_from_project


@api.route('/programs/<int:program_id>/projects', methods=['GET'])
def list_projects(program_id):
    program = Program.query.get_or_404(program_id)
    return jsonify([p.to_dict(nested=True) for p in program.projects])


@api.route('/programs/<int:program_id>/projects', methods=['POST'])
def create_project(program_id):
    Program.query.get_or_404(program_id)
    data = request.get_json()

    max_sort = db.session.query(db.func.max(Project.sort_order)) \
        .filter(Project.program_id == program_id).scalar() or 0

    prj = Project(
        program_id=program_id,
        name=data['name'],
        description=data.get('description'),
        sort_order=max_sort + 1,
    )
    db.session.add(prj)
    db.session.flush()

    recalc_from_project(prj)
    db.session.commit()

    return jsonify(prj.to_dict(nested=True)), 201


@api.route('/projects/<int:project_id>', methods=['PUT'])
def update_project(project_id):
    prj = Project.query.get_or_404(project_id)
    data = request.get_json()
    actor_id = data.get('actor_id')

    for key in ('name', 'description'):
        if key in data and data[key] != getattr(prj, key):
            setattr(prj, key, data[key])

    if 'sort_order' in data:
        prj.sort_order = data['sort_order']

    recalc_from_project(prj)
    db.session.commit()

    return jsonify(prj.to_dict(nested=True))


@api.route('/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    prj = Project.query.get_or_404(project_id)
    program = prj.program

    db.session.delete(prj)
    db.session.flush()

    from services.recalc import recalc_from_program
    recalc_from_program(program)
    db.session.commit()

    return jsonify({'deleted': True})
