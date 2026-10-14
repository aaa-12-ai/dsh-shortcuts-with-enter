# Enter / Ctrl+Enter 验证记录

日期：2026-10-14。环境：Windows、Node.js 24.21.0、Chrome（agent-browser），DSH 源码 `0.1.6-alpha.2-ddefc45`。

## 本次行为

- 设置 → 快捷键新增 Enter、Ctrl+Enter 两项，分别选择「dsh 插话/排队发送」或「换行」。默认两项均为前者；macOS 的 Cmd+Enter 使用 Ctrl+Enter 项。
- 发送选项跟随宿主当前 Ctrl+Enter 的行为，不固定为插话或排队。配置只影响消息输入框，浏览器 localStorage 保存、立即生效。
- 插件拦截原始按键并只转交一次宿主手势，保留宿主的输入机、菜单、附件、上传、忙碌及会话路由逻辑。

## 实际 dsh 验证

通过源码 CLI 的 `dsh --profile web` 启动独立 DSH_HOME，使用官方 `dsh plugin --profile web add --save-prod --ignore-scripts file:<plugin>` 安装修改后的插件。启动携带 `apps/web/tests/pin-browse-picker.overlay.yml`，未修改用户当前 Web Profile 或重启其 3080 实例。

模型由本地 Chat Completions SSE 模拟服务提供，保持一次响应打开，以便在真正的 dsh HTTP / WebSocket、输入机和 agent inbox 路径上验证忙碌状态。没有访问外部模型服务。核对运行实例提供的 `lib/client.js` 与工作区文件 SHA-256 一致。

| 验证项 | 结果 |
| --- | --- |
| 首次打开设置，两项均为 dsh 插话/排队发送 | 通过 |
| Enter=换行，Ctrl+Enter=发送；Enter 不启动模型请求 | 通过 |
| Enter=发送，Ctrl+Enter=换行；Ctrl+Enter 保留草稿 | 通过 |
| Shift+Enter 继续换行 | 通过 |
| 宿主繁忙时 Enter=排队，即 Ctrl+Enter=插话；两键各发送一次 | 两条输入各自写入一次 `next-step` |
| 将宿主繁忙时 Enter 改为插话，即 Ctrl+Enter=排队；两键各发送一次 | 两条输入各自写入一次 `next-turn`；界面显示两条排队消息 |
| 刷新后 Enter、Ctrl+Enter 的不同配置保留 | 通过 |
| Enter=换行时，输入 `/`、选择菜单高亮再按 Enter | 选中目标指令，无换行或额外消息 |
| 浏览器中模拟 `isComposing`、keyCode 229 的候选确认 | 草稿不变，无 inbox 输入 |
| 模拟 repeat Enter | 原始按键被消费，无重复转交 |
| 点击恢复默认 | 两项恢复为 dsh 插话/排队发送 |
| 用 dsh 持久化日志核对发送记录 | 插话及排队测试消息各一次，IME 草稿未提交 |

输入法检查使用合成事件，不等同于人工操作每一种真实输入法。WebKit 的 beforeinput 换行路径由回归测试覆盖，本次未运行 Safari。

截图：[设置](2026-10-14-enter-settings-windows.png)、[排队结果](2026-10-14-enter-queue-windows.png)。

## 本地回归

以下检查通过：

```text
node --check lib/client.js
node --check lib/index.js
node test/shortcuts.test.cjs     # 22 项现有快捷键测试
node test/composer.test.cjs     # 新增回车配置及事件路由测试
node test/host.test.mjs
git diff --check
```

`npm run check` 未全绿：原有 `test/install.test.sh` 在此 Windows 环境遇到 WSL 启动/CRLF 问题；改用 Git Bash 临时核验后又遇到 POSIX 与 Windows 的 `file:` 路径断言差异。未修改安装脚本。实际插件安装已通过官方 CLI 完成。

本次没有重跑三个已发布版本的完整安装/卸载矩阵；更新了既有运行烟测中设置行数及默认值断言。

## 宿主既有问题

冷启动/刷新时出现以下错误：

```text
SlotAssemblyError: scope 'session-maybe' rendered without an installed adapter
Error: conversation.input: sessions service unavailable
```

同一独立实例通过额外 overlay 禁用 `shortcuts` 插件后，仍复现两条错误，且快捷键入口已消失。未修改宿主源码。上述功能检查在页面就绪后完成。

测试结束后已停止独立 dsh 与模拟模型进程。
