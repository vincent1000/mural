from fastapi import APIRouter, HTTPException
import logging

from api.ws import sio
from models.dto import PromptRequest, ImageVariationRequest, ExecutePromptResponse, TokenRequest
from services import content_ops
from services.ui_controls import edit_user_defined_button as svc_edit_user_button
from data.store import (
    load_user_defined_buttons,
    remove_user_defined_button,
    updateAccessToken,
    GetAccessToken,
)
from external import windows

router = APIRouter()
logger = logging.getLogger(__name__)


# ---- System
@router.get("/cross-control-state")
def is_cross_control_active():
    return windows.is_cross_control_active()


# ---- Buttons CRUD
@router.get("/user-defined-buttons")
async def get_user_defined_buttons():
    buttons = load_user_defined_buttons()
    normalized = []
    for b in buttons:
        if not isinstance(b, dict):
            continue
        normalized.append({
            "label": b.get("label", ""),
            "prompt": b.get("prompt", ""),
            "inputType": b.get("inputType", "ambiguous"),
            "outputType": b.get("outputType", "ambiguous"),
            "isUserDefined": True,
        })
    return {"buttons": normalized}


@router.post("/remove-user-defined-button")
async def remove_user_defined_button_http(payload: dict):
    label = (payload or {}).get('label') if isinstance(payload, dict) else None
    if not label:
        raise HTTPException(status_code=400, detail="Missing 'label'")
    ok = remove_user_defined_button(label)
    if not ok:
        raise HTTPException(status_code=404, detail="Button not found")
    await sio.emit("remove_user_defined_button", {"label": label})
    return {"status": "removed", "label": label}


@router.post("/edit-user-defined-button")
async def edit_user_defined_button_http(payload: dict):
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid payload")
    old_label = (payload.get('old_label') or '').strip()
    new_label = (payload.get('new_label') or '').strip()
    new_prompt = (payload.get('new_prompt') or '').strip()

    try:
        result = await svc_edit_user_button(old_label, new_label, new_prompt)
        return {'status': 'updated', **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except LookupError:
        raise HTTPException(status_code=404, detail="Button not found")
    except Exception as e:
        logger.exception("edit_user_defined_button error: %s", e)
        raise HTTPException(status_code=500, detail="Internal error")


# ---- AI endpoints
@router.post("/execute-prompt", response_model=ExecutePromptResponse)
async def execute_prompt(request: PromptRequest):
    if content_ops.get_action_source() == "stage":
        err = await content_ops.execute_prompt_stage(request)
    else:
        err = await content_ops.execute_prompt(request)
    if err:
        raise HTTPException(status_code=400, detail=err)
    return ExecutePromptResponse(status="success", prompt=request.prompt)


@router.post("/select-image-variation")
async def select_image_variation(request: ImageVariationRequest):
    err = await content_ops.replace_with_suggested(request.image_num)
    if err:
        raise HTTPException(status_code=400, detail=err)
    return {"status": "success", "image_num": request.image_num}


# ---- Voice endpoints
@router.post("/start-recording")
async def start_recording():
    from services.voice_command import start_recording as svc_start
    return await svc_start()


@router.post("/stop-recording")
async def stop_recording():
    from services.voice_command import stop_recording as svc_stop
    return await svc_stop()


@router.post("/token-update")
async def token_update(request: TokenRequest):
    logger.info("request:%s",request.token)
    return updateAccessToken(request.token)

