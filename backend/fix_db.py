import asyncio
import os
from dotenv import load_dotenv

# Load from .env
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from database import engine
from sqlalchemy import text

async def main():
    async with engine.begin() as conn:
        try:
            res = await conn.execute(text("SELECT id, title, image_url FROM news_items ORDER BY created_at DESC LIMIT 5"))
            for row in res.mappings():
                img = row['image_url']
                has_img = bool(img)
                print(f"ID: {row['id']}, Title: {row['title']}, HasImage: {has_img}, ImgStart: {img[:30] if img else 'None'}")
        except Exception as e:
            print("Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
