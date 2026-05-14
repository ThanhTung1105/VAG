from flask import jsonify, request
from routes import api
from extensions import db
from models import Program, Portfolio
from services.recalc import recalc_from_program


@api.route('/portfolios/<int:portfolio_id>/programs', methods=['GET'])
def list_programs(portfolio_id):
    portfolio = Portfolio.query.get_or_404(portfolio_id)
    return jsonify([p.to_dict(nested=True) for p in portfolio.programs])


@api.route('/portfolios/<int:portfolio_id>/programs', methods=['POST'])
def create_program(portfolio_id):
    Portfolio.query.get_or_404(portfolio_id)
    data = request.get_json()

    max_sort = db.session.query(db.func.max(Program.sort_order)) \
        .filter(Program.portfolio_id == portfolio_id).scalar() or 0

    prg = Program(
        portfolio_id=portfolio_id,
        name=data['name'],
        description=data.get('description'),
        sort_order=max_sort + 1,
    )
    db.session.add(prg)
    db.session.flush()

    recalc_from_program(prg)
    db.session.commit()

    return jsonify(prg.to_dict(nested=True)), 201


@api.route('/programs/<int:program_id>', methods=['PUT'])
def update_program(program_id):
    prg = Program.query.get_or_404(program_id)
    data = request.get_json()
    actor_id = data.get('actor_id')

    for key in ('name', 'description'):
        if key in data and data[key] != getattr(prg, key):
            setattr(prg, key, data[key])

    if 'sort_order' in data:
        prg.sort_order = data['sort_order']

    recalc_from_program(prg)
    db.session.commit()

    return jsonify(prg.to_dict(nested=True))


@api.route('/programs/<int:program_id>', methods=['DELETE'])
def delete_program(program_id):
    prg = Program.query.get_or_404(program_id)

    db.session.delete(prg)
    db.session.commit()

    return jsonify({'deleted': True})
