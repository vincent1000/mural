import React, { useState, useRef, useCallback, useEffect } from 'react';
import { executePrompt } from "../utils/api";
import { editUserDefinedButton } from "../utils/api";
import { removeUserDefinedButton } from "../utils/api";
import { selectImageVariation } from "../utils/api";

import iconUrl from "../assets/quantum_icon.png";
import thinkingGif from "../assets/thinking cropped small.gif";
import recordStopUrl from "../assets/record_stop.png";
import recordStartUrl from "../assets/record_start.png";
// 1. 单个Button组件
function PromptButton({ label, prompt, inputType, outputType, isUserDefined, disabled, onPointerDown, onPointerUp, showDelete, onDelete, isGrayed, setThinking, isPendingDeletion, isLoading }) {
  const finalDisabled = disabled || isPendingDeletion || isLoading;
  const handleClick = async () => {
    if (finalDisabled) return;
    console.log(`Button '${label}' pressed. Prompt: ${prompt}`);
    const promptPayload = {
      prompt: prompt,
      input_type: inputType,
      output_type: outputType,
      is_user_defined: isUserDefined,
    };
    if (setThinking) setThinking(true);

    try {
      await executePrompt(promptPayload);
      console.log('Prompt executed successfully');
    } catch (e) {
      console.error('Error sending prompt:', e.response?.data || e.message);
    } finally {
      if (setThinking) setThinking(false);
    }
  };

  return (
    <div style={{
      position: "relative",
      /* 移除固定宽度，让容器根据按钮大小自适应 */
      margin: 8,
      opacity: isGrayed ? 0.5 : 1
    }}>
      <button
        style={{
          /* 1. 尺寸自适应：使用 padding 替代固定宽高 */
          padding: '12px 18px', /* 上下内边距 12px, 左右内边距 18px */
          fontSize: 16,
          borderRadius: 58,
          border: "none",
          background: isPendingDeletion 
            ? '#f3f4f6'  // 删除中使用浅灰色背景
            : "white",   // 正常状态白色背景
          color: "black",
          cursor: isLoading ? 'wait' : (finalDisabled ? 'not-allowed' : 'pointer'),
          opacity: isLoading ? 0.7 : 1,
          filter: isGrayed ? "grayscale(1)" : "none",
          transition: 'all 0.2s ease',           // 添加过渡动画，使状态变化更平滑
          /* 2. 添加阴影效果 */
          boxShadow: '0px 11.65px 46.62px rgba(0, 0, 0, 0.06), 0px 2.91px 5.83px rgba(0, 0, 0, 0.06)',

          /* 优化：文本不换行，保持按钮单行显示 */
          whiteSpace: 'nowrap',
        }}
        disabled={finalDisabled}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onClick={handleClick}
      >
         {/* {(isLoading) ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 16,
            height: 16,
            border: '2px solid #666',
            borderTop: '2px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></span>
          {label}
        </span>
      ) : (
        label
      )} */}
      {
        label
      }
      </button>
      {showDelete && (
        <div
          onClick={() => { if (!isPendingDeletion) onDelete(); }} 
          style={{
            position: "absolute",
            top: -8,
            right: -8,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "#fff",
            color: "#000000", // 改为黑色叉号
            border: "1px solid #ddd", // 稍微调整边框颜色，与黑色叉号更协调
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            fontSize: 18,
            cursor: "pointer",
            zIndex: 2,
            // 应用指定的阴影效果
            boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.06), 0px 2px 4px rgba(0, 0, 0, 0.06)',
            userSelect: 'none',
          }}
        >
          ×
        </div>
      )}
    </div>
  );
}

// 2. 单个Slider组件
function PromptSlider({ 
  label = '', 
  prompt = '', 
  inputType = 'ambiguous', 
  outputType = 'ambiguous', 
  isUserDefined = false,
  minLabel = '0', // ✅ 为滑块属性添加默认值
  maxLabel = '100', // ✅ 为滑块属性添加默认值
  stepCount = 10, // ✅ 为滑块属性添加默认值
  disabled = false, 
  onPointerDown = () => {}, 
  onPointerUp = () => {}, 
  showDelete = false, 
  onDelete = () => {}, 
  isGrayed = false, 
  setThinking, 
  isPendingDeletion = false,
  isLoading = false
}) {
  const finalDisabled = disabled || isPendingDeletion || isLoading;
  const [sliderValue, setSliderValue] = useState(Math.floor(stepCount / 2));

  const interpolatePrompt = (prompt, currentValue, stepCount) => {
    const normalizedSliderValue = currentValue / stepCount;
    // 替换 prompt 中的 {slider_param} 占位符
    return prompt.replace(/{slider_param}/g, normalizedSliderValue.toString());
  };
  
  const handleClick = async () => {
    if (finalDisabled) return;
    const interpolatedPrompt = interpolatePrompt(prompt, sliderValue, stepCount);
    console.log(`Slider '${label}' pressed (value: ${sliderValue}/${stepCount}). Interpolated prompt: ${interpolatedPrompt}`);
    const promptPayload = {
      prompt: interpolatedPrompt,
      input_type: inputType,
      output_type: outputType,
      is_user_defined: isUserDefined,
    };
    if (setThinking) setThinking(true);
    try {
      await executePrompt(promptPayload);
      console.log('Prompt executed successfully');
    } catch (e) {
      console.error('Error sending prompt:', e.response?.data || e.message);
    } finally {
      if (setThinking) setThinking(false);
    }
  };
  const handleSliderChange = (e) => {
    if (!finalDisabled) {
      setSliderValue(Number(e.target.value));
    }
  };
  return (
        <div style={{ 
          position: "relative", 
          width: 220, 
          margin: 8, 
          // ✅ 删除中时降低整体透明度
          opacity: isGrayed || finalDisabled ? 0.7 : 1,
          // ✅ 添加过渡效果
          transition: 'all 0.2s ease',
        }}>
        <div style={{
          fontWeight: 500,
          marginBottom: 6,
          color: "#333",
          filter: isGrayed ? "grayscale(1)" : "none",
          // ✅ 为标题区域添加 flex 布局，用于对齐标题和加载动画
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {/* {isLoading ? (
          // ✅ 显示加载动画
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 14,
              height: 14,
              border: '2px solid #666',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}></span>
            <span>{label}</span>
          </span>
        ) : (
          // 正常显示标题
          label
        )} */}
        {
          label
        }
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, color: "#666", opacity: finalDisabled ? 0.7 : 1 }}>{minLabel}</span>
        <input
          type="range"
          min={0}
          max={stepCount}
          value={sliderValue}
          onChange={handleSliderChange}
          // ✅ 使用计算后的禁用状态
          disabled={finalDisabled}
          style={{ 
            flex: 1,
            cursor: isLoading ? 'wait' : (finalDisabled ? 'not-allowed' : 'default'),
            // 添加滑块样式优化
            accentColor: !finalDisabled ? '#4285f4' : '#ccc'
          }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onClick={handleClick}
        />
        <span style={{ fontSize: 13, color: "#666", opacity: finalDisabled ? 0.7 : 1 }}>{maxLabel}</span>
      </div>
      {showDelete && (
        <div
          onClick={() => { if (!finalDisabled) onDelete(); }} 
          style={{
            position: "absolute",
            top: -8,
            right: -8,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: finalDisabled ? '#f3f4f6' : '#fff',
            cursor: isLoading ? 'wait' : (finalDisabled ? 'not-allowed' : 'pointer'),
            opacity: finalDisabled ? 0.8 : 1,
            color: "#000000",
            border: "1px solid #ddd",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            fontSize: 18,
            zIndex: 2,
            boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.06), 0px 2px 4px rgba(0, 0, 0, 0.06)',
            userSelect: 'none',
            transition: 'all 0.2s ease',
          }}
        >
          ×
        </div>
      )}
    </div>
  );
}

// 3. 编辑对话框
function EditDialog({
  buttonName,
  setButtonName,
  buttonExplanation,
  setButtonExplanation,
  onDelete,
  onCancel,
  onSave,
  isSaving = false,
  saveError = '',
  isDeleting = false
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: 80,
        left: "50%",
        transform: "translateX(-50%)",
        background: "#fff",
        boxShadow: "0 2px 16px #0002",
        padding: 24,
        borderRadius: 10,
        zIndex: 100,
        minWidth: 400, // 适当增大宽度，适配内容
      }}
    >
      {/* 顶部标签 */}
      <div
        style={{
          marginBottom: 12,
          fontWeight: 600,
          textAlign: "center", // 让顶部标签居中显示
          fontSize: 18,
        }}
      >
        Create bullet points
      </div>
      {/* --- 显示错误信息 --- */}
      {saveError && (
        <div style={{ 
          marginBottom: 12, 
          padding: 10, 
          backgroundColor: '#fee2e2', 
          color: '#b91c1c', 
          borderRadius: 6, 
          fontSize: 14 
        }}>
          {saveError}
        </div>
      )}
      {/* 第一个编辑框 - 按钮名称 */}
      <div style={{ marginBottom: 12 }}>
        <label
          style={{
            display: "block",
            marginBottom: 4,
            fontSize: 14,
            color: "#666",
          }}
        >
          Name of button
        </label>
        <input
          value={buttonName}
          disabled={isSaving}
          onChange={(e) => setButtonName(e.target.value)}
          style={{
            fontSize: 16,
            padding: 6,
            width: "100%",
            border: "1px solid #ddd",
            borderRadius: 4,
          }}
        />
      </div>

      {/* 第二个编辑框 - 按钮说明 */}
      <div style={{ marginBottom: 20 }}>
        <label
          style={{
            display: "block",
            marginBottom: 4,
            fontSize: 14,
            color: "#666",
          }}
        >
          Explanation of button
        </label>
        <textarea
          value={buttonExplanation}
          disabled={isSaving}
          onChange={(e) => setButtonExplanation(e.target.value)}
          style={{
            fontSize: 16,
            padding: 6,
            width: "100%",
            border: "1px solid #ddd",
            borderRadius: 4,
            minHeight: 80, // 设置文本域最小高度
            resize: "vertical", // 允许垂直方向调整大小
          }}
        />
      </div>

      {/* 底部三个按钮 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={onDelete}
          disabled={isSaving || isDeleting}
          style={{
            background: "#fff",
            color: "#333",
            border: "1px solid #ddd",
            borderRadius: 6,
            padding: "6px 14px",
            fontWeight: 500,
            opacity: isDeleting ? 0.7 : 1,
            cursor: isDeleting ? 'wait' : 'pointer',
          }}
        >
          {isDeleting ? 'Deleting...' : 'Delete button'}
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onCancel}
            disabled={isSaving || isDeleting}
            style={{
              background: "#fff",
              color: "#333",
              border: "1px solid #ddd",
              borderRadius: 6,
              padding: "6px 18px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={isSaving || isDeleting}
            style={{
              background: "#2563eb", // 蓝色按钮背景
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "6px 18px",
              fontWeight: 500,
              opacity: isDeleting ? 0.7 : 1,
              cursor: isDeleting ? 'wait' : 'pointer',
            }}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
// 4. 单个图片widget
function ImageReplacementOption({ imageData, imageNum, onSelected, disabled }) {
  const isLoading = !imageData; // 空数据表示加载中

  return (
    <div style={{
      width: 256,
      height: 256,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: disabled ? '1px solid #eee' : '1px solid #ddd',
      borderRadius: 8,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.7 : 1,
      margin: 8
    }}>
      <button
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: 'transparent',
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: 0,
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        disabled={disabled || isLoading}
        onClick={() => onSelected(imageNum)}
      >
        {isLoading ? (
          // 加载中：显示进度条
          <div style={{ width: 64, height: 64}}>
            <div style={{
              width: '100%',
              height: '100%',
              border: '3px solid #eee',
              borderTop: '3px solid #4285f4',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : (
          // 加载完成：显示图片（Base64）
          <img
            src={`data:image/png;base64,${imageData}`}
            alt={`Image variation ${imageNum + 1}`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'fitHeight',
              borderRadius: 4
            }}
          />
        )}
      </button>
    </div>
  );
}
// 5. 新增：图片预览列表组件
function ImageReplacementView({ imageDatas, onCancel, onImageSelected, disabled }) {
  console.debug('imagereplaceview:', imageDatas.length);
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
      padding: 24,
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* 取消按钮：返回 Prompt 列表 */}
      {/* <button
        style={{
          padding: '6px 16px',
          border: '1px solid #ddd',
          borderRadius: 6,
          background: '#fff',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.7 : 1,
          alignSelf: 'flex-start'
        }}
        disabled={disabled}
        onClick={onCancel}
      >
        ← Back to options
      </button> */}

      {/* 图片列表（横向滚动） */}
      <div style={{
        display: 'flex',
        gap: 16,
        overflowX: 'auto',
        overflowY: 'hidden', 
        padding: 16,
        width: '100%',
        justifyContent: 'flex-start',
        boxSizing: 'border-box'
      }}>
        {imageDatas.map((data, index) => (
          <ImageReplacementOption
            key={index}
            imageData={data}
            imageNum={index}
            onSelected={onImageSelected}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}
// 6. 子组件：录音按钮
const MicButton = ({ isRecording, toggleRecording, disabled }) => {
  const imgRef = React.useRef(null);

  const handleBeforeToggle = () => {
    if (imgRef.current) {
      imgRef.current.src = '';
      imgRef.current.style.opacity = 0;
    }
  };

  const handleToggle = () => {
    if (disabled) return;
    handleBeforeToggle();
    toggleRecording();
  };

  const handleImageLoad = () => {
    if (imgRef.current) {
      imgRef.current.style.opacity = 1;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '55px',
      right: '55px',
      zIndex: 999,
      // 与参考示例保持一致的容器样式（不固定宽高，由内容撑开）
      borderRadius: '50%', // 圆形按钮
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      backgroundColor: 'transparent',
    }}>
      <button
        style={{
          border: 'none',
          background: 'transparent', // 移除按钮背景，避免影响图片显示
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: 0,
          outline: 'none',
          opacity: disabled ? 0.6 : 1,
          borderRadius: '50%', // 确保按钮也是圆形
          width: '74px',
          height: '74px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        disabled={disabled}
        onClick={handleToggle}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* 核心：强制图片显示为64px×64px，与参考示例一致 */}
        <img 
          ref={imgRef}
          src={isRecording ? recordStartUrl : recordStopUrl} 
          alt={isRecording ? "recording..." : "Ready"} 
          style={{ 
            width: '74px',    // 固定宽度64px
            height: '74px',   // 固定高度64px
            objectFit: 'cover', // 修正拼写错误：conver -> cover
            objectPosition: 'center',
            transition: 'opacity 0.2s ease',
            opacity: 1,
            pointerEvents: 'none',
            borderRadius: '50%', // 确保图片也是圆形
          }}
          onLoad={handleImageLoad}
        />
      </button>
    </div>
  );
};
// 7. PromptPanel 主体
export default function PromptPanel({ widgetList = [], onUserButtonsChange, reloadUserButtons, selectionType, suggestedImageDatas = [], isRecording,
  thinking,
  removalMode,
  toggleRecording,}) {
  // widgetList: 由App.jsx合并后传递, 结构为 [{id, type, label, prompt, ...}]
  // onUserButtonsChange: 传递给App.jsx用于修改自定义按钮（如编辑、删除）
  const [pendingRemovalLabels, setPendingRemovalLabels] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editLabel, setEditLabel] = useState("");  // 按钮名称
  const [editPrompt, setEditPrompt] = useState(""); // 按钮说明
  const [deleteMode, setDeleteMode] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const longPressTimer = useRef(null);

  useEffect(() => {
    setIsThinking(thinking); // 父组件值变化时，更新本地状态
  }, [thinking]);

  // 查找某个按钮对象
  const findButtonById = id => widgetList.find(btn => btn.id === id);

  // 长按按钮进入编辑 - 初始化两个输入框的值
  const handleButtonPointerDown = btn => {
    if (deleteMode || !btn.isUserDefined) return;
    longPressTimer.current = setTimeout(() => {
      setEditId(btn.id);
      setEditLabel(btn.label || "");      // 初始化按钮名称
      setEditPrompt(btn.prompt || "");    // 初始化按钮说明
      setSaveError('');
    }, 600);
  };
  const handleButtonPointerUp = () => clearTimeout(longPressTimer.current);
  // 删除请求的核心函数
  const handleDeleteRequest = useCallback(async (label) => {
    const trimmedLabel = label.trim();
    if (pendingRemovalLabels.includes(trimmedLabel)) return;

    // 标记为删除中
    setPendingRemovalLabels(prev => [...prev, trimmedLabel]);

    try {
      // 1. 发送删除请求到后端
      await removeUserDefinedButton(trimmedLabel);
      
      // 2. ✅ 调用 reloadUserButtons 重新拉取完整数据
      await reloadUserButtons();

    } catch (error) {
      // 失败：恢复状态
      setPendingRemovalLabels(prev => prev.filter(l => l !== trimmedLabel));
      console.error('删除失败:', error);
      alert('删除失败，请稍后重试。');
    }
  }, [pendingRemovalLabels, reloadUserButtons]);
  

  // 长按空白进入删除
  const handleBlankPointerDown = e => {
    if (deleteMode || editId !== null) return;
    if (e.target === e.currentTarget) {
      longPressTimer.current = setTimeout(() => setDeleteMode(true), 600);
    }
  };
  const handleBlankPointerUp = () => clearTimeout(longPressTimer.current);

  // 编辑保存 - 传递两个字段的值
const handleEditSave = async () => {
    if (!onUserButtonsChange || !editId) return;

    // 简单验证
    if (!editLabel.trim() || !editPrompt.trim()) {
      setSaveError('Button Name and Prompt cannot be null');
      return;
    }
    
    // 查找原始按钮，用于获取 old_label
    const originalButton = widgetList.find(btn => btn.id === editId);
    if (!originalButton) {
      setSaveError('Cannot find edit Button');
      return;
    }
    if (originalButton.label === editLabel && originalButton.prompt === editPrompt) {
      setEditId(null);
      return;
    }
    setIsSaving(true);
    setSaveError('');

    try {
      // 调用API
      await editUserDefinedButton(
        originalButton.label, // old_label
        editLabel,            // new_label
        editPrompt            // new_prompt
      );
      
      console.log('编辑请求成功，正在刷新按钮列表...');
      
      // 2. ✅ 调用 reloadUserButtons 从后端拉取最新数据
      await reloadUserButtons();
      
      // 3. 数据刷新成功后，关闭对话框
      setEditId(null);

    } catch (error) {
      console.error('编辑按钮失败:', error);
      setSaveError(error.response?.data?.message || `保存失败: ${error.message || '未知错误'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // 编辑对话框中的删除按钮
  const handleDialogDelete = async() => {
    if (!editLabel) return;
    // 由编辑对话框中的 "Delete button" 按钮调用
    await handleDeleteRequest(editLabel);
    setEditId(null);
  };
  //UI事件触发器 (用户点击) ---
  const handleDeleteInDeleteMode = (item) => {
    // 它只做一件事：调用核心函数
    handleDeleteRequest(item.label);
  }; 
  // 取消编辑
  const handleEditCancel = () => {
    setEditId(null);
  };

  // 删除模式下点击❌以外区域退出
  const handleDeleteModeMaskClick = e => {
    if (e.target.id === "del-mask") setDeleteMode(false);
  };
  //图片选择处理函数
  const handleImageSelected = async (imageNum) => {
    await selectImageVariation(imageNum)
  };
  console.log('prompt', suggestedImageDatas.length);
  //取消图片预览
  const handleCancelImagePreview = () => {
    // 通知父组件清空图片数据（可选，根据需求）
    // 这里通过 props 传递给 App.jsx 处理更合适
  };
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#fafafa",
        position: "relative",
        padding: 48,
        boxSizing: "border-box"
      }}
      onPointerDown={handleBlankPointerDown}
      onPointerUp={handleBlankPointerUp}
    >
    
      <div style={{
        position: "fixed",
        top: 50,
        right: 50,
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10, // 确保在其他内容上方
      }}>
        {<img 
          src={isThinking ? thinkingGif : iconUrl} 
          alt={isThinking ? "Processing..." : "Ready"} 
          style={{ width: '64px', height: '64px' }}
        />}
      </div>
      <MicButton
        isRecording={isRecording}
        toggleRecording={toggleRecording}
        disabled={removalMode}
        style={{
          // 确保录音按钮的定位基准一致
          position: 'fixed',
          right: 32, // 与状态图标统一右侧距离
          bottom: 32, // 固定在底部
        }}
      />

      {/* 编辑模式蒙版与对话框 - 适配新的EditDialog */}
      {editId && (
        <div style={{
          position: "fixed", inset: 0, background: "#0005", zIndex: 90,
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <EditDialog
            // 按钮名称相关
            buttonName={editLabel}
            setButtonName={setEditLabel}
            // 按钮说明相关
            buttonExplanation={editPrompt}
            setButtonExplanation={setEditPrompt}
            // 三个按钮的回调
            onDelete={handleDialogDelete}
            onCancel={handleEditCancel}
            onSave={handleEditSave}
            isSaving={isSaving}
            saveError={saveError}
            isDeleting={pendingRemovalLabels.includes(editLabel.trim())}
          />
        </div>
      )}
      {/* 删除模式灰色蒙版 */}
      {deleteMode && (
        <div
          id="del-mask"
          style={{
            position: "fixed", inset: 0, background: "#0002", zIndex: 50
          }}
          onClick={handleDeleteModeMaskClick}
        />
      )}
      
      {/* 组件列表 - 支持按钮和滑块,picture类型 */}
      <div style={{ display: "flex", flexDirection: selectionType === 'picture' ? "column" : "row", flexWrap: selectionType === 'picture' ? "nowrap" : "wrap", gap: 20, zIndex: 1, position: "relative", width: "100%" }}>
        {/* 1. 图片模式且有图片数据：显示图片预览 */}
        {selectionType === 'picture' && suggestedImageDatas.length > 0 ? (
          <ImageReplacementView
            imageDatas={suggestedImageDatas}
            onCancel={handleCancelImagePreview}
            onImageSelected={handleImageSelected}
            disabled={deleteMode || isThinking}
          />
        ) : (
          // 2. 其他情况：显示筛选后的 Prompt 组件列表
          widgetList.map(item => {
            const itemType = item.type || "button";
            const isPendingDeletion = pendingRemovalLabels.includes(item.label?.trim() || '');
            const isLoading = isThinking || isPendingDeletion;

            if (itemType === "slider" &&
              "minLabel" in item &&
              "maxLabel" in item &&
              "stepCount" in item) {

              return (
                <PromptSlider
                  key={item.id}
                  label={item.label}
                  prompt={item.prompt}
                  inputType={item.inputType}
                  outputType={item.outputType}
                  isUserDefined={item.isUserDefined}
                  minLabel={item.minLabel}
                  maxLabel={item.maxLabel}
                  stepCount={item.stepCount}
                  disabled={deleteMode || isThinking}
                  onPointerDown={() => handleButtonPointerDown(item)}
                  onPointerUp={handleButtonPointerUp}
                  showDelete={deleteMode && item.isUserDefined}
                  onDelete={() => handleDeleteInDeleteMode(item.id)}
                  isGrayed={deleteMode && !item.isUserDefined}
                  setThinking={setIsThinking}
                  isPendingDeletion={isPendingDeletion}
                  isLoading={isLoading}
                />
              );
            }

            return (
              <PromptButton
                key={item.id}
                label={item.label}
                prompt={item.prompt}
                inputType={item.inputType}
                outputType={item.outputType}
                isUserDefined={item.isUserDefined}
                disabled={deleteMode || isThinking}
                onPointerDown={() => handleButtonPointerDown(item)}
                onPointerUp={handleButtonPointerUp}
                showDelete={deleteMode && item.isUserDefined}
                onDelete={() => handleDeleteInDeleteMode(item.id)}
                isGrayed={deleteMode && !item.isUserDefined}
                setThinking={setIsThinking}
                isPendingDeletion={isPendingDeletion}
                isLoading={isLoading}
              />
            );
          })
        )}
      </div>
    </div>
  );
}