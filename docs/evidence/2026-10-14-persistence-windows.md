# 1.1.6 快捷键持久化验证

原实现只使用 localStorage；它属于浏览器及具体 origin，访问 localhost / 127.0.0.1、不同端口或不同浏览器时互不共享。原来同一 origin 刷新测试通过，但不能保证换访问入口后的恢复。

现在 Host 插件注册 dsh-shortcuts 设置命名空间，浏览器通过公开 settingsScope 服务将 actions 写入 dsh 的 settings.yaml。localStorage 仅作缓存和初次迁移；已有宿主配置优先。加载期间修改排队写入，保存异常显示错误提示。

实际验证环境：Windows、Chrome、Node 24.21.0、源码 dsh 0.1.6-alpha.2，独立 DSH_HOME：

1. 在 3091 页面将「发送会话」录制为 Ctrl+Shift+Enter。
2. 核对 settings.yaml 的 dsh-shortcuts.actions.sendMessage.combo 为 Control+Shift+Enter。
3. 完全关闭测试浏览器，并停止 dsh Node 进程。
4. 使用相同 DSH_HOME 在 3093 重新启动 dsh，以新的独立浏览器会话打开。
5. 设置页面自动恢复 Ctrl+Shift+Enter，新的浏览器缓存也与宿主一致。

结果通过，截图见 [重启后恢复](2026-10-14-persistence-restart-windows.png)。未发送模型请求，也未修改用户业务设置。

回归检查：client / host 语法、现有 22 项快捷键测试、Host 注册与权限路由测试，以及 composer 测试中的迁移、全新浏览器恢复、旧缓存优先级、初始化期间保存，均通过。
