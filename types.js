// src/utils/types.js
// 按钮数据模型（对齐 Flutter 的 PromptButtonData）
export const ButtonDataType = {
  // 生成唯一ID（避免重复）
  generateId: () => `btn_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
  // 默认按钮结构
  default: (data) => ({
    id: ButtonDataType.generateId(), // React 列表需要唯一key，新增ID字段
    label: data.label || '',
    prompt: data.prompt || '',
    inputType: data.inputType || 'text',
    outputType: data.outputType || 'text',
    isUserDefined: data.isUserDefined ?? true,
    type: 'button', // 标记为按钮类型（区别于滑块）
  }),
};