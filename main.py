import logging
import uvicorn
from fastapi import FastAPI, Request
from dotenv import load_dotenv
import asyncio
from fastapi.middleware.cors import CORSMiddleware 
from fastapi.responses import HTMLResponse 
from services.socketio_utils import sio
from services.socketio_utils import asgi_app as socket_app
from api.rest import router as rest_router
from external import ppt_interop
from external import windows
from services import content_ops
# from token_manager import store_tokens
import requests
import threading
import time

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# Create a FastAPI app instance
app = FastAPI()

# 配置 CORS 允许的源（将多个域名/端口放在一个列表中）
ALLOWED_ORIGINS = [
    "http://localhost:5173",  # 前端项目1
    "http://localhost:5174",  # 前端项目2
    # 生产环境可添加实际域名，例如："https://your-frontend.com"
]

# 添加 CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # 允许的跨域源（列表形式，支持多个）
    allow_credentials=True,  # 允许携带 Cookie（前后端都需开启，否则跨域时 Cookie 会被屏蔽）
    allow_methods=["*"],  # 允许所有 HTTP 方法（GET/POST/PUT/DELETE 等）
    allow_headers=["*"],  # 允许所有请求头（包括自定义头，如 Authorization）
)
access_token = None
refresh_token = None
# Mount the Socket.IO server on the FastAPI app
app.mount("/socket.io", socket_app)

# Include API routers
app.include_router(rest_router)

AUTH_BASE = "https://account.naea1.uds.lenovo.com/auth"
REALM = "LenovoConsumer"
CLIENT_ID = "HEC"
REDIRECT_URI = "http://127.0.0.1:8000"

@app.get("/")
async def oauth_callback(request: Request):
    params = dict(request.query_params)
    code = params.get("code")
    logger.info("Code:%s", code);
    token_url = f"{AUTH_BASE}/realms/{REALM}/protocol/openid-connect/token"
    data = {
        "grant_type": "authorization_code",
        "client_id": CLIENT_ID,
        "code": code,
        "redirect_uri": REDIRECT_URI
    }

    response = requests.post(token_url, data=data)
    logger.info("response:%s", response);
    tokens = response.json()
    store_tokens(tokens)

    return "<h3>Login successful! You may close this window.</h3>"

def refresh_loop():
    global access_token, refresh_token
    while True:
        if refresh_token:
            token_url = f"{AUTH_BASE}/realms/{REALM}/protocol/openid-connect/token"
            data = {
                'grant_type': 'refresh_token',
                'client_id': 'HEC',
                'refresh_token': refresh_token
            }
            response = requests.post(token_url, data=data)
            tokens = response.json()
            access_token = tokens.get('access_token')
            refresh_token = tokens.get('refresh_token')
            print(f"Refreshed Access Token: {access_token}")
        time.sleep(3000)  # 每 50 分钟刷新一次

@app.on_event("startup")
async def startup_event():
    async def debugError(reason):
        logger.info("Socket disconnected:%s", reason);
    async def on_selection_type_change(selection_type):
        try:
            logger.info(f"Emitting selection_type: {selection_type}")
            content_ops.set_action_source("windows")
            await sio.emit("selection_type", {"type": selection_type})
            sio.on("disconnect", debugError);
            if selection_type == ppt_interop.SelectionType.PICTURE:
                # Trigger image variation suggestions in background
                from services.content_ops import generate_image_variations
                asyncio.create_task(generate_image_variations())
        except Exception as e:
            logger.error(f"selection change error: {e}")
    # Start window monitoring with callback
    asyncio.create_task(windows.monitor_active_window(on_selection_type_change=on_selection_type_change))

if __name__ == "__main__":
    # threading.Thread(target=refresh_loop, daemon=True).start()
    logger.info(f"main.py 的 sio 实例地址：{id(sio)}")  # 打印 sio 内存地址
    # Start server
    uvicorn.run(app, host="0.0.0.0", port=8000)
    
