import sys, uvicorn
import os
os.environ['DATABASE_URL'] = 'sqlite+aiosqlite:///bot.db'
os.environ['SECRET_KEY'] = 'test'
os.environ['BOT_API_KEY'] = 'test'
sys.path.insert(0, '.')
from main import app
if __name__ == '__main__':
    uvicorn.run(app, host='127.0.0.1', port=8002)
