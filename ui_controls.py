from typing import List, Optional
from api.ws import sio
from external import windows as win
from external import ppt_interop
import re
import time
from services import ai
from services import prompts
from services.utils import SafeFormatDict
from data.store import load_user_defined_buttons, save_user_defined_buttons
import logging
logger = logging.getLogger(__name__)


def has_any_keyword(s: str, keywords) -> bool:
    try:
        s_low = (s or "").lower()
        return any(kw in s_low for kw in keywords)
    except Exception:
        return False


def biased_type_update(prev: str, classified: str, prompt_text: str, channel: str) -> str:
    """Bias toward prev type; switch only on strong cues.
    prev, classified ∈ {"text","image","ambiguous"}
    channel ∈ {"input","output"}
    """
    prev = (prev or "ambiguous").lower()
    classified = (classified or "ambiguous").lower()
    if classified == prev:
        return prev
    if classified == "ambiguous":
        return prev
    if prev == "ambiguous":
        return classified

    image_cues = {
        "image", "picture", "photo", "screenshot", "graphic", "icon", "logo",
        "diagram", "illustration", "crop", "resize", "filter", "brightness",
        "contrast", "saturation", "hue", "color grade", "make the image",
    }
    text_cues = {
        "text", "font", "paragraph", "sentence", "caption", "title", "heading",
        "bullets", "bullet points", "rewrite", "rephrase", "spelling",
        "grammar", "make the font", "make the text",
    }

    prompt_has_image = has_any_keyword(prompt_text, image_cues)
    prompt_has_text = has_any_keyword(prompt_text, text_cues)

    if prompt_has_image and not prompt_has_text:
        return "image"
    if prompt_has_text and not prompt_has_image:
        return "text"

    if classified == "image" and prompt_has_image:
        return "image"
    if classified == "text" and prompt_has_text:
        return "text"

    return prev


async def show_hidden_button_toast(button_label: str, button_input_type: str) -> None:
    """Emits a toast if a newly created button won't be visible for current selection."""
    try:
        sel_type = win.last_selection_type
        current_kind = "none"
        try:
            st = sel_type
            st_str = ("" if st is None else str(st)).lower()
            if (
                st == ppt_interop.SelectionType.PICTURE
                or "picture" in st_str
                or "image" in st_str
            ):
                current_kind = "image"
            elif (
                st is None
                or st == ppt_interop.SelectionType.NONE
                or "none" in st_str
                or st == ppt_interop.SelectionType.UNSUPPORTED
            ):
                current_kind = "none"
            elif ("text" in st_str) or ("shape_text" in st_str):
                current_kind = "text"
            else:
                current_kind = "text"
        except Exception:
            current_kind = "none"

        btn_input = (button_input_type or "ambiguous").lower()
        mismatch_toast = (
            btn_input in ("text", "image")
            and current_kind in ("text", "image")
            and btn_input != current_kind
        )
        none_toast = current_kind == "none" and btn_input in ("text", "image", "ambiguous")
        should_toast = mismatch_toast or none_toast
        if should_toast:
            if current_kind == "none":
                if btn_input == "image":
                    msg = f"Created button: {button_label}. Select an image to see this button."
                elif btn_input == "text":
                    msg = f"Created button: {button_label}. Select text to see this button."
                else:
                    msg = f"Created button: {button_label}. Select text or an image to see this button."
            else:
                if btn_input == "image":
                    msg = f"Created button: {button_label}. Select an image to see this button."
                else:
                    msg = f"Created button: {button_label}. Select text to see this button."
            await sio.emit("toast", {"message": msg})
    except Exception:
        pass


def best_label_match(transcribed_text: str, labels: List[str]) -> Optional[str]:
    try:
        t_words = set(w.strip(".,!?\"'()[]{}").lower() for w in transcribed_text.split())
        best_label = None
        best_score = 0
        for label in labels:
            l_words = set(w.strip(".,!?\"'()[]{}").lower() for w in label.split())
            score = len(t_words & l_words)
            if score > best_score:
                best_score = score
                best_label = label
        return best_label if best_score > 0 else None
    except Exception:
        return None


async def edit_user_defined_button(old_label: str, new_label: str, new_prompt: str) -> dict:
    """Edit a user-defined button and emit an update event.
    - Validates inputs
    - Reclassifies input/output types with bias toward previous values
    - Persists update
    - Emits 'update_user_defined_button' via WS
    Returns the payload dict for the client.
    Raises:
      ValueError on validation issues
      LookupError if the target button is not found
    """
    old_label = (old_label or "").strip()
    new_label = (new_label or "").strip()
    new_prompt = (new_prompt or "").strip()
    if not old_label:
        raise ValueError("Missing 'old_label'")
    if not new_label:
        raise ValueError("Missing 'new_label'")

    buttons = load_user_defined_buttons()
    idx = next((i for i, b in enumerate(buttons)
                if isinstance(b, dict) and (b.get('label', '') or '').strip().lower() == old_label.lower()), -1)
    if idx < 0:
        raise LookupError("Button not found")

    prev_input_type = (buttons[idx].get('inputType') or 'ambiguous')
    prev_output_type = (buttons[idx].get('outputType') or 'ambiguous')

    input_type = prev_input_type
    output_type = prev_output_type
    try:
        io_prompt = prompts.CLASSIFY_BUTTON_IO_TYPES_PROMPT.format_map(
            SafeFormatDict(transcribed_prompt=new_prompt)
        )
        t_cls0 = time.perf_counter()
        io_raw = await ai.generate_text_fast(io_prompt)
        classify_dt_ms = int((time.perf_counter() - t_cls0) * 1000)
        io_line = (io_raw or "").strip().splitlines()[0].lower() if (io_raw or "").strip() else ""
        cand_in = prev_input_type
        cand_out = prev_output_type
        try:
            m_in = re.search(r"input\s*:\s*(text|image|ambiguous)", io_line)
            m_out = re.search(r"output\s*:\s*(text|image|ambiguous)", io_line)
            if m_in:
                cand_in = m_in.group(1)
            if m_out:
                cand_out = m_out.group(1)
        except Exception:
            pass
        input_type = biased_type_update(prev_input_type, cand_in, new_prompt, "input")
        output_type = biased_type_update(prev_output_type, cand_out, new_prompt, "output")
        logger.info(
            "IO reclassification:\n  raw:        %s\n  prev_in:    %s -> final_in: %s\n  prev_out:   %s -> final_out: %s\n  classify_ms:%s",
            io_raw, prev_input_type, input_type, prev_output_type, output_type, classify_dt_ms,
        )
    except Exception as e:
        input_type = prev_input_type
        output_type = prev_output_type
        logger.exception("Reclassify error, keeping previous types: %s", e)

    buttons[idx] = {
        'label': new_label,
        'prompt': new_prompt,
        'inputType': input_type,
        'outputType': output_type,
    }
    save_user_defined_buttons(buttons)

    payload = {
        'oldLabel': old_label,
        'label': new_label,
        'prompt': new_prompt,
        'inputType': input_type,
        'outputType': output_type,
        'isUserDefined': True,
    }
    await sio.emit('update_user_defined_button', payload)
    return payload
