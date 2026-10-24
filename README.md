# Host Studio

AI 开发者请先阅读 [AGENTS.md](AGENTS.md)，其中包含设备接入步骤、分层约定和验收要求。

Rust + Tauri 2 + Vue 3 的嵌入式上位机框架起点。界面参考用户提供的浅色卡片工作台：顶部标签、左侧设备与参数、右侧连接与日志、底部操作栏。

## 开始使用

需要 Node.js、Rust MSVC 工具链、Visual Studio C++ Build Tools 和 WebView2。

```powershell
npm install
npm run tauri dev
```

浏览器预览：`npm run dev`。浏览器使用明确标注的本地模拟器，无法扫描硬件。
桌面版本通过 Tauri Commands 调用 Rust 模拟器与硬件扫描。

## 已实现

- 模拟设备连接/断开、参数读写和范围校验、20 Hz 目标遥测、最近 240 帧波形。
- 最多 12,000 帧内存录制、CSV 导出、JSON 参数导入导出、日志导出、明暗主题。
- Rust 核心与 UI 分离；模拟器可用于无硬件开发。
- 独立 host-transport 库：串口、TCP、UDP、USB HID、BLE GATT 收发接口。
- 桌面扫描串口、USB HID、BLE 端点；BLE 扫描每个适配器约 3 秒。

## 边界与后续工作

这是可运行的框架首版，不是已经通过实机验证的通用设备控制软件。

- 工作台当前只开放模拟器业务连接。真实设备必须实现协议适配包、握手、身份确认、请求关联和超时策略后再接入。
- USB 当前为 HID；USB CDC 使用串口适配器。USB Bulk/WinUSB 尚未实现。
- BLE 需要设备适配器选择服务及读写特征；MTU 分片由协议适配器处理。仅支持 BLE，不包含经典蓝牙原生 SPP。
- Wi-Fi 使用 TCP/UDP；不负责操作系统 Wi-Fi 入网和配网。
- UDP connect 不代表远端在线；TCP/串口读操作不保证返回完整消息。
- BLE 通知队列有界，满时终止接收，调用者必须报错并关闭链路；HID 读取使用 1 秒超时。
- Link 使用者负责发送/接收超时、协议上限、断线清理，并在退出时调用 close；BLE 不应直接丢弃未关闭链路。
- 当前模拟遥测采用轮询，目标 20 Hz，不保证实时采样；高吞吐生产采集应迁移到 Rust 任务、有界缓存和 Tauri Channel。
- 当前示例仅单设备，无固件升级、自动重连、录制回放和真实硬件控制；这些是后续扩展。
- 录制暂存内存，关闭页面前需导出；再次录制会开始新记录。

## 结构

- crates/host-core：设备模型、参数校验、模拟设备。
- crates/host-transport：与界面无关的链路适配。
- src-tauri：桌面应用与命令桥。
- src/api.ts：前端类型化接口和浏览器模拟环境。
- src/App.vue、src/style.css：可复用工作台首版。
- docs/architecture.md：扩展约定和迭代边界。

## 验证与构建

```powershell
npm run build
cargo test --workspace
cargo check --workspace
npm run tauri build
```

硬件适配器需要各平台实机验证；本地回环测试不能替代 USB、串口或 BLE 验收。

## 应用图标

原图保存在 `assets/app-icon-source.png`。桌面资源位于 `src-tauri/icons/`，界面与网页图标为 `public/app-icon.png`。更换时同步生成这些文件；窗口启动时显式加载 128px 图标，构建脚本跟踪图标目录变化。
