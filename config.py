import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

    # Local dev: mysql+pymysql://root:password@localhost/vietanh_pmo?charset=utf8mb4
    # PythonAnywhere: mysql+pymysql://user:pass@user.mysql.pythonanywhere-services.com/user$vietanh_pmo?charset=utf8mb4
    db_url = os.environ.get(
        'DATABASE_URL',
        'sqlite:///pmo.db'
    )
    if db_url.startswith('postgres://'):
        db_url = db_url.replace('postgres://', 'postgresql://', 1)
        
    SQLALCHEMY_DATABASE_URI = db_url

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_recycle': 280,   # PythonAnywhere kills idle connections after 300s
        'pool_pre_ping': True,  # Check connection alive before using
    }

    # Vietnam timezone offset
    TZ_OFFSET = '+07:00'
