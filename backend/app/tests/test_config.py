import os

os.environ["ENV_FILE"] = ".env.test"


from app.core.config import Settings


settings = Settings()