import os

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "sonnenlicht.web:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8000)),
    )
