import React, { useEffect, useState, useCallback, useRef} from "react";
import MainPage from "./components/MainPage";
import PromptPanel from "./components/PromptPanel";
import socket from "./utils/socket";
import { fetchUserDefinedButtons, recordControl} from "./utils/api";
import { ButtonDataType } from './utils/types';

// 预定义按钮
const suggestedWidgetData = [
  {
    id: "pre1",
    type: "slider",
    label: "Summarize text",
    prompt: "summarize",
    minLabel: "Short",
    maxLabel: "Long",
    stepCount: 5,
    inputType: "text",
    outputType: "text",
    isUserDefined: false,
  },
  {
    id: "pre2",
    type: "button",
    label: "Create bullet points",
    prompt: "bulletList",
    inputType: "text",
    outputType: "text",
    isUserDefined: false,
  },
  {
    id: "pre3",
    type: "slider",
    label: "Formality",
    prompt: "formality",
    minLabel: "Casual",
    maxLabel: "Formal",
    stepCount: 5,
    inputType: "text",
    outputType: "text",
    isUserDefined: false,
  },
  {
    id: "pre4",
    type: "button",
    label: "Create image variations",
    prompt: "style_image",
    inputType: "image",
    outputType: "image",
    isUserDefined: false,
  },
];

// 过滤工具函数
function filterPromptWidgets(suggestedList, userDefinedList, selectionType) {
  let filteredSuggested = [];
  let filteredUserDefined = [];
  switch (selectionType) {
    case "text":
    case "shape_text":
      filteredSuggested = suggestedList.filter(
        w => w.inputType === "text" || w.inputType === "ambiguous"
      );
      filteredUserDefined = userDefinedList.filter(
        w => w.inputType === "text" || w.inputType === "ambiguous"
      );
      break;
    case "picture":
    case "image":
      filteredSuggested = suggestedList.filter(
        w => w.inputType === "image" || w.inputType === "ambiguous"
      );
      filteredUserDefined = userDefinedList.filter(
        w => w.inputType === "image" || w.inputType === "ambiguous"
      );
      break;
    default:
      filteredSuggested = [];
      filteredUserDefined = [];
  }
  return [...filteredSuggested, ...filteredUserDefined];
}

export default function App() {
  const [connected, setConnected] = useState(false);
  const [selectionType, setSelectionType] = useState(null);
  const [selectionSrc, setSelectionSrc] = useState(null);
  const [userButtons, setUserButtons] = useState([]);
  const [suggestedImageDatas, setSuggestedImageDatas] = useState([]); 
  const [userDefinedButtons, setUserDefinedButtons] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [removalMode, setRemovalMode] = useState(false);
  const selectionTypeRef = useRef(selectionType);

  // 拉取自定义按钮数据
  const reloadUserButtons = useCallback(() => {
    fetchUserDefinedButtons().then(list => {
      // 保证每个按钮有唯一id
      setUserButtons(
        (list || []).map(b => ({
          ...b,
          id:
            b.id ||
            b.label + "_" + b.prompt + "_" + Math.random().toString(36).slice(2),
          isUserDefined: true,
        }))
      );
    });
  }, []);

 const toggleRecording = async () => {
    console.log('Old recording state:', isRecording);
    const newRecording = !isRecording;

    // 先更新本地状态（开始录音时同步设置 thinking 为 true）
    setIsRecording(newRecording);
    if (newRecording) {
      setThinking(true);
    }
    console.log('New recording state:', newRecording);
    if(recordControl(newRecording))
    {
      if (!newRecording) {
        setThinking(false);
      }
    } else {
      // 请求失败：回滚状态
      setIsRecording(isRecording);
      if (newRecording) {
        setThinking(false);
      }
    }
  };
  // 2. 监听 selectionType 变化，实时同步到 ref
  useEffect(() => {
    selectionTypeRef.current = selectionType;
    console.log("🔄 ref 已同步最新 selectionType:", selectionType);
  }, [selectionType]);

  // 3. 在 handleGeneratingImages 中使用 ref.current 替代直接访问 selectionType
  const handleGeneratingImages = (data) => {
    // 读取 ref 中的最新值，而非闭包中的旧值
    console.log("📥 处理 generating 事件，ref 中的 selectionType:", selectionTypeRef.current);
    
    if (data?.count && selectionTypeRef.current === "picture") {
      const emptyImageList = Array.from({ length: data.count }, () => "");
      setSuggestedImageDatas(emptyImageList);
      console.log("✅ 成功生成图片占位列表，长度:", emptyImageList.length);
    }
  };
  // socket 连接与事件监听
  useEffect(() => {
    console.log("Registering selection_type listener");
    const handleConnect = () => {
      setConnected(true);
      reloadUserButtons();
    };
    const handleDisconnect = () => {
      setConnected(false);
      setSelectionType(null);
      console.debug("set type null");
    };
    const handleSelectionType = data => {
      console.log(`Received selection_type: ${data.type} from ${data.src}`);
      setSelectionType(data.type);
      setSelectionSrc(data.src);
    };
    const handleButtonRemoved = (data) => {
      const { label } = data;
      if (!label) return;
      
      console.log(`App: 收到后端删除事件，删除按钮: ${label}`);
      
      // 从 userButtons 中移除被删除的按钮
      // 注意：我们通过 label 来匹配，因为后端事件只返回 label
      setUserButtons(prevButtons => 
        prevButtons.filter(btn => (btn.label?.trim() || '') !== label.trim())
      );
    };
    const handleButtonUpdated = (data) => {
      console.log('Received update_user_defined_button event:', data);
      try {
        if (typeof data === 'object' && data !== null) {
          const oldLabel = (data.oldLabel || '').toString().trim().toLowerCase();
          const newLabel = (data.label || '').toString().trim();
          const newPrompt = (data.prompt || '').toString().trim();
          const newInputType = (data.inputType || 'ambiguous').toString();
          const newOutputType = (data.outputType || 'ambiguous').toString();

          // 更新用户按钮列表
          setUserButtons(prevButtons => prevButtons.map(btn => {
            // 匹配旧标签（不区分大小写）
            if (btn.label?.trim().toLowerCase() === oldLabel) {
              // 返回更新后的按钮数据，保留原有id和类型
              return {
                ...btn,
                label: newLabel,
                prompt: newPrompt,
                inputType: newInputType,
                outputType: newOutputType
              };
            }
            return btn;
          }));
        }
      } catch (e) {
        console.error('Error handling update_user_defined_button:', e);
      }
    };
    // // 监听后端“图片生成中”事件（初始化图片占位）
    // const handleGeneratingImages = (data) => {
    //   console.debug("datalength:", data.count); // 打印日志确认
    //   console.debug("type:",selectionType);
    //   if (data?.count && selectionType === "picture") {
    //     const emptyImageList = Array.from({ length: data.count }, () => "");
    //     console.debug("before suggestedImageDatas：emptyImageList:", emptyImageList); // 打印日志确认
    //     setSuggestedImageDatas(emptyImageList); // 更新状态
    //     console.debug("suggestedImageDatas：emptyImageList:", emptyImageList); // 打印日志确认
    //   }
    // };

    // 监听后端“图片数据”事件（接收 Base64 图片）
    const handleNewImage = (data) => {
      if (
        data?.image_num !== undefined && 
        data?.image_data && 
        selectionType === "picture"
      ) {
        setSuggestedImageDatas(prev => {
          const newImages = [...prev];
          if (data.image_num >= 0 && data.image_num < newImages.length) {
            newImages[data.image_num] = data.image_data; // 存储 Base64 字符串
          }
          return newImages;
        });
      }
    };
    const handleConnectError = (err) => {
        console.error("Socket connect err", err);
        // 3 秒后尝试重连（避免频繁重连）
        setTimeout(() => {
          if (!connected) socket.connect();
        }, 3000);
    };
    const handleVoiceProcessing = (data) => {
      console.log('Received voice_processing event:', data);
      try {
        if (typeof data === 'object' && data !== null && 'state' in data) {
          const state = String(data.state);
          if (state === 'start') {
            setThinking(true);
            console.log('Voice processing started → thinking: true');
          } else if (state === 'end') {
            setThinking(false);
            console.log('Voice processing ended → thinking: false');
          }
          } else {
            console.warn('Invalid voice_processing data: missing "state" or wrong type');
          }
        } catch (e) {
          console.error('Error handling voice_processing event:', e);
        }
    };
    const handleAddButton = (data) => {
      // Listen for backend-created user-defined buttons
      console.log('Received add_user_defined_button event:', data);
      try {
        // 校验数据格式（与 Flutter 一致：Map 类型）
        if (typeof data === 'object' && data !== null) {
          // 3. 构建新按钮（使用统一模型，确保字段对齐）
          const newButton = ButtonDataType.default({
            label: (data.label ?? '').toString(),
            prompt: (data.prompt ?? '').toString(),
            inputType: (data.inputType ?? 'text').toString(),
            outputType: (data.outputType ?? 'text').toString(),
            isUserDefined: (data.isUserDefined ?? true) === true,
          });
          setUserButtons(prev => [newButton, ...prev]);
          console.log('New user-defined button added:', newButton);
        } else {
            console.warn('Invalid add_user_defined_button data: not an object');
          }
        } catch (e) {
          console.error('Error handling add_user_defined_button:', e);
        }
    };
    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);
    socket.on("disconnect", handleDisconnect);
    socket.on("selection_type", handleSelectionType);
    socket.on("button_removed", handleButtonRemoved);
    socket.on("update_user_defined_button", handleButtonUpdated);
    socket.on("generating_image_variations", handleGeneratingImages);
    socket.on("new_image_variation", handleNewImage);
    socket.on("voice_processing", handleVoiceProcessing);
    socket.on("add_user_defined_button", handleAddButton);
    socket.connect();
    return () => {
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
      socket.off("disconnect", handleDisconnect);
      socket.off("selection_type", handleSelectionType);
      socket.off("button_removed", handleButtonRemoved);
      socket.off("update_user_defined_button", handleButtonUpdated);
      socket.off("generating_image_variations", handleGeneratingImages);
      socket.off("new_image_variation", handleNewImage);
      socket.off("voice_processing", handleVoiceProcessing);
      socket.off("add_user_defined_button", handleAddButton);
      console.debug("app page:Socket disconnected");
      // socket.disconnect();
    };
  }, [connected]);

  // 处理自定义按钮编辑/删除
  const handleUserButtonsChange = useCallback(
    (action, id, newData) => {
      if (action === "edit") {
        setUserButtons((btns) =>
          btns.map((btn) =>
            btn.id === id ? { ...btn, ...newData } : btn
          )
        );
      } else if (action === "delete") {
        setUserButtons((btns) => btns.filter((btn) => btn.id !== id));
      }
    },
    []
  );
  // 按 selectionType 过滤按钮
  const filteredWidgetList = filterPromptWidgets(
    suggestedWidgetData,
    userButtons,
    selectionType
  );

  // 渲染逻辑
  if (!connected) return <MainPage />;
  if (
    selectionType === "text" ||
    selectionType === "shape_text" ||
    selectionType === "picture" ||
    selectionType === "image"
  ) {

    return (
      <PromptPanel
        widgetList={filteredWidgetList}
        onUserButtonsChange={handleUserButtonsChange}
        reloadUserButtons={reloadUserButtons}
        selectionType={selectionType}
        suggestedImageDatas={suggestedImageDatas}
        isRecording={isRecording}
        thinking={thinking}
        removalMode={removalMode}
        toggleRecording={toggleRecording}
      />
    );
  }
  return <MainPage />;
}
