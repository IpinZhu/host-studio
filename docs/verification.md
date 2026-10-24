# 首版验证记录

验证环境：Windows，2026-10-24。

- 前端 TypeScript 检查和 Vite 生产构建通过。
- cargo check --workspace 通过。
- cargo test --workspace：4 项测试通过（非有限值与范围校验、无效写入原子性、模拟器跟踪目标值、TCP 回环字节完整性）。
- Tauri debug 桌面构建通过，输出 target/debug/host-studio.exe。
- 浏览器交互验证：连接、采集、目标转速从 1500 修改至 2400、应用参数、录制 2294 帧、触发 CSV 下载。
- 原生 Windows 窗口验证：加载打包资源、DESKTOP 环境识别、Rust 模拟器连接、遥测更新及曲线渲染。
- 视觉检查修复：禁止右侧卡片 flex 收缩，避免连接按钮被裁切。
- 尚未验证：USB/串口/BLE 实机收发、跨平台运行、安装器和代码签名。

![桌面运行预览](preview.png)
