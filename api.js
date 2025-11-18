import axios from "axios";

const BASE_URL = "http://localhost:8000";
export async function fetchUserDefinedButtons() {
  try {
    const resp = await axios.get(`${BASE_URL}/user-defined-buttons`, {
      withCredentials: true,
    });
    
    console.debug('resp status:', resp.status);
    const buttons = (resp.data && Array.isArray(resp.data.buttons)) ? resp.data.buttons : [];

    return buttons.map(b => ({
      id: b.id ?? b.label ?? Math.random().toString(36).slice(2),
      type: 'button',
      label: (b.label ?? '').toString(),
      prompt: (b.prompt ?? '').toString(),
      inputType: (b.inputType ?? 'ambiguous').toString(),
      outputType: (b.outputType ?? 'ambiguous').toString(),
      isUserDefined: true,
    }));
  } catch (e) {
    console.error('Error loading user-defined buttons:', e.response?.data || e.message);
    return [];
  }
}
export async function executePrompt(promptPayload) {
  try {
    const response = await axios.post(`${BASE_URL}/execute-prompt`, promptPayload, {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}
export async function selectImageVariation(imagenum) {
  try {
      const response = await axios.post(`${BASE_URL}/select-image-variation`, {
      image_num: imageNum,},{
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        console.log(`图片 ${imageNum + 1} 选择成功`);
      } else {
        const error = await response.text();
        console.error('图片选择失败：', error);
      }
    } catch (err) {
      console.error('图片选择请求错误：', err);
    }
}
export async function recordControl(recording) {
  try {
    const micAction = recording ? 'start-recording' : 'stop-recording';
    const response = await axios.post(`${BASE_URL}/${micAction}`, {}, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (response.status === 200) {
      console.log(`${micAction} executed successfully`);
      return true;
    } else {
      console.log(`Failed to execute ${micAction}: ${response.status}`);
      console.log('Response body:', response.data);
      return false;
    }
  } catch (e) {
    console.log(`Error executing ${recording}:`, e);
    return false;
  }
}
export async function editUserDefinedButton(oldLabel, newLabel, newPrompt) {
    try {
        const response = await axios.post(`${BASE_URL}/edit-user-defined-button`, {
    old_label: oldLabel,
    new_label: newLabel,
    new_prompt: newPrompt,
  },{
      headers: { 'Content-Type': 'application/json' }
    });
    console.debug(response.status);
    return response.data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }

}
export async function removeUserDefinedButton(label) {
  await axios.post(`${BASE_URL}/remove-user-defined-button`, {
    label: label,
  });
}
