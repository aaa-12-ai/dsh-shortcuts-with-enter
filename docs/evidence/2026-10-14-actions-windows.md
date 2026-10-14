# 消息输入框三条动作行验证

日期：2026-10-14。Windows、Node 24.21.0、Chrome；独立 DSH `0.1.6-alpha.2-ddefc45` Web Profile，官方 CLI 安装插件，携带 in-page directory picker overlay。本地 SSE 模拟模型用于保持忙碌状态，没有调用外部模型。

这次调整替代此前的两个按键行为下拉框：

| 动作 | 默认键 | 宿主行为 |
| --- | --- | --- |
| 发送会话 | Enter | 原生 Enter |
| 插队/排队发送 | Ctrl+Enter | 原生 Ctrl+Enter（macOS 默认 Cmd+Enter） |
| 换行 | Shift+Enter | 插入换行 |

三项使用与现有功能相同的录制、清除、启用/禁用、冲突提示及速查表按键徽章。仅在消息输入框生效。旧两项下拉配置升级为三条动作的默认绑定，其他自定义快捷键保留；遇到与既有自定义绑定冲突的新默认键，保留原绑定并将新动作留为未绑定。

## 验证结果

- `node --check lib/client.js`、`node test/composer.test.cjs`、既有 22 项快捷键测试及 Host 契约测试通过。
- 实际 UI 录制「发送会话」为 Ctrl+Shift+Enter，刷新后保留；尝试录制已占用的 Ctrl+Enter 时显示冲突并拒绝保存。
- 改绑后原 Enter 不提交消息：本地模型请求数仍为 0；自定义发送键正常提交。
- 宿主繁忙时 Enter 设置为插话的情况下，自定义普通发送写入一次 `next-step`；Ctrl+Enter 加速发送写入一次 `next-turn`。两者保留不同语义。
- Shift+Enter 只保留草稿换行，日志无对应 inbox 输入。
- 恢复默认后界面显示 Enter / Ctrl+Enter / Shift+Enter 按键徽章，无行为下拉框。
- 单元回归覆盖清除、禁用、刷新持久化、旧配置迁移、默认冲突保护、输入框范围、菜单选择、IME、repeat 和 WebKit beforeinput。

截图：[设置动作行](2026-10-14-action-settings-windows.png)、[速查表](2026-10-14-action-cheatsheet-windows.png)。

Windows Bash 安装脚本测试及宿主冷启动已有问题沿用[上一轮记录](2026-10-14-enter-windows.md)的限制，本次未进行 Safari 或完整发布版本矩阵验收。
